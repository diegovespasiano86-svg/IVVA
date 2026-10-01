-- =============================================================================
-- Clientes (etiquetas, listas, atribuição de conversa) + Campanhas WhatsApp
-- Data: 2026-10-01
--
-- Mudança só ADITIVA. Nenhuma linha existente é alterada ou apagada.
-- Em tabelas que já existem, só entra:
--   * users:         índice único (id, tenant_id)       -> alvo de FK composta
--   * contacts:      índice único (id, tenant_id)       -> alvo de FK composta
--   * conversations: coluna nova assigned_user_id (null) + FK composta + índice
--
-- Garantia de "mesmo tenant": FKs COMPOSTAS (x_id, tenant_id) -> (id, tenant_id).
-- Assim é impossível (no banco, não só no front) ligar etiqueta/lista/campanha
-- de um tenant a contato/usuário de outro.
--
-- Rode inteiro, de uma vez (begin/commit). Idempotente: pode rodar de novo.
-- Rollback comentado no final.
-- =============================================================================

begin;

set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 0. Alvos para FKs compostas em tabelas existentes (só índices; sem dado novo)
--    id já é PK, então (id, tenant_id) é trivialmente único: não pode falhar.
-- -----------------------------------------------------------------------------
create unique index if not exists users_id_tenant_uidx    on public.users (id, tenant_id);
create unique index if not exists contacts_id_tenant_uidx on public.contacts (id, tenant_id);

-- -----------------------------------------------------------------------------
-- 1. Etiquetas
-- -----------------------------------------------------------------------------
create table if not exists public.labels (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_tenant_id()
             references public.tenants(id) on delete cascade,
  nome       text not null,
  cor        text not null default 'cinza',
  created_at timestamptz not null default now(),
  constraint labels_nome_check check (char_length(btrim(nome)) between 1 and 40),
  constraint labels_cor_check  check (cor in ('cinza','vermelho','laranja','amarelo','verde','azul','roxo','rosa'))
);
create unique index if not exists labels_tenant_nome_uidx on public.labels (tenant_id, lower(nome));
create unique index if not exists labels_id_tenant_uidx   on public.labels (id, tenant_id);

create table if not exists public.contact_labels (
  contact_id uuid not null,
  label_id   uuid not null,
  tenant_id  uuid not null default public.current_tenant_id()
             references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, label_id),
  constraint contact_labels_contact_fk foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete cascade,
  constraint contact_labels_label_fk foreign key (label_id, tenant_id)
    references public.labels (id, tenant_id) on delete cascade
);
create index if not exists contact_labels_label_idx  on public.contact_labels (label_id);
create index if not exists contact_labels_tenant_idx on public.contact_labels (tenant_id);

-- -----------------------------------------------------------------------------
-- 2. Atribuição de conversa (coluna nova, nullable -> linhas atuais ficam null)
--    FK composta: o usuário atribuído TEM que ser do mesmo tenant da conversa.
--    ON DELETE SET NULL (assigned_user_id): zera só a coluna do usuário,
--    nunca o tenant_id (sintaxe PG15+; o projeto está no PG17).
-- -----------------------------------------------------------------------------
alter table public.conversations add column if not exists assigned_user_id uuid;

alter table public.conversations drop constraint if exists conversations_assigned_user_fk;
alter table public.conversations
  add constraint conversations_assigned_user_fk
  foreign key (assigned_user_id, tenant_id)
  references public.users (id, tenant_id)
  on delete set null (assigned_user_id);

create index if not exists conversations_tenant_assigned_idx
  on public.conversations (tenant_id, assigned_user_id)
  where assigned_user_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Listas
-- -----------------------------------------------------------------------------
create table if not exists public.contact_lists (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_tenant_id()
             references public.tenants(id) on delete cascade,
  nome       text not null,
  descricao  text,
  created_at timestamptz not null default now(),
  constraint contact_lists_nome_check check (char_length(btrim(nome)) between 1 and 80),
  constraint contact_lists_descricao_check check (descricao is null or char_length(descricao) <= 500)
);
create unique index if not exists contact_lists_id_tenant_uidx on public.contact_lists (id, tenant_id);
create index if not exists contact_lists_tenant_idx on public.contact_lists (tenant_id, created_at desc);

create table if not exists public.contact_list_members (
  list_id    uuid not null,
  contact_id uuid not null,
  tenant_id  uuid not null default public.current_tenant_id()
             references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, contact_id),
  constraint contact_list_members_list_fk foreign key (list_id, tenant_id)
    references public.contact_lists (id, tenant_id) on delete cascade,
  constraint contact_list_members_contact_fk foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete cascade
);
create index if not exists contact_list_members_contact_idx on public.contact_list_members (contact_id);
create index if not exists contact_list_members_tenant_idx  on public.contact_list_members (tenant_id);

-- -----------------------------------------------------------------------------
-- 4. Campanhas
-- -----------------------------------------------------------------------------

-- Validação do formato de `audiencia` (usada no CHECK). Pura/imutável.
create or replace function public.campaign_audiencia_valida(a jsonb)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  -- CASE aninhado garante a ordem de avaliação (jsonb_object_keys /
  -- jsonb_array_length dariam erro em tipo errado em vez de "false").
  select coalesce(
    case
      when a is null or jsonb_typeof(a) <> 'object' then false
      when not (select coalesce(bool_and(k in ('tipo','ids','segmento')), false)
                  from jsonb_object_keys(a) k) then false
      when (a->>'tipo') = 'todos' then
        not (a ? 'ids') and not (a ? 'segmento')
      when (a->>'tipo') = 'segmento' then
        not (a ? 'ids')
        and coalesce((a->>'segmento') in ('inativos_60d','novos_30d','aniversariantes_mes'), false)
      when (a->>'tipo') in ('lista','etiqueta') then
        case
          when a ? 'segmento' then false
          when jsonb_typeof(a->'ids') is distinct from 'array' then false
          when jsonb_array_length(a->'ids') not between 1 and 50 then false
          else not exists (
            select 1 from jsonb_array_elements(a->'ids') e
             where jsonb_typeof(e) <> 'string'
                or (e #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        end
      else false
    end
  , false);
$$;

create table if not exists public.campaigns (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null default public.current_tenant_id()
                              references public.tenants(id) on delete cascade,
  nome                        text not null,
  canal                       text not null default 'whatsapp',
  template_nome               text,
  template_idioma             text not null default 'pt_BR',
  usa_nome                    boolean not null default false,
  mensagem_previa             text,
  audiencia                   jsonb not null default '{"tipo":"todos"}'::jsonb,
  status                      text not null default 'rascunho',
  agendada_para               timestamptz,
  consentimento_confirmado_em timestamptz,
  consentimento_por           uuid,
  total                       integer not null default 0,
  enviados                    integer not null default 0,
  falhas                      integer not null default 0,
  ignorados                   integer not null default 0,
  pausa_motivo                text,
  iniciada_em                 timestamptz,
  concluida_em                timestamptz,
  created_by                  uuid,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint campaigns_nome_check      check (char_length(btrim(nome)) between 1 and 120),
  constraint campaigns_canal_check     check (canal in ('whatsapp')),
  -- (corrigido em 2026-10-01: o Postgres limita repeticao de regex a 255, entao o tamanho vai em char_length)
  constraint campaigns_template_check  check (template_nome is null or (template_nome ~ '^[a-z0-9_]+
  constraint campaigns_idioma_check    check (template_idioma ~ '^[a-z]{2,3}(_[A-Z]{2})?$'),
  constraint campaigns_previa_check    check (mensagem_previa is null or char_length(mensagem_previa) <= 1024),
  constraint campaigns_audiencia_check check (public.campaign_audiencia_valida(audiencia)),
  constraint campaigns_status_check    check (status in ('rascunho','agendada','enviando','concluida','pausada','cancelada')),
  constraint campaigns_contadores_check check (total >= 0 and enviados >= 0 and falhas >= 0 and ignorados >= 0),
  constraint campaigns_pausa_motivo_check check (pausa_motivo is null or pausa_motivo in ('manual','muitas_falhas')),
  constraint campaigns_created_by_fk foreign key (created_by, tenant_id)
    references public.users (id, tenant_id) on delete set null (created_by),
  constraint campaigns_consentimento_por_fk foreign key (consentimento_por, tenant_id)
    references public.users (id, tenant_id) on delete set null (consentimento_por)
);
create unique index if not exists campaigns_id_tenant_uidx on public.campaigns (id, tenant_id);
create index if not exists campaigns_tenant_status_idx on public.campaigns (tenant_id, status, created_at desc);
create index if not exists campaigns_ativas_idx on public.campaigns (status, agendada_para)
  where status in ('enviando','agendada');

create table if not exists public.campaign_recipients (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  contact_id     uuid not null,
  nome           text,
  telefone       text not null,                 -- snapshot (só dígitos, com DDI)
  status         text not null default 'pendente',
  erro           text,
  tentativas     integer not null default 0,
  enviando_desde timestamptz,
  enviado_em     timestamptz,
  wa_message_id  text,
  created_at     timestamptz not null default now(),
  constraint campaign_recipients_status_check
    check (status in ('pendente','enviando','enviado','falhou','ignorado')),
  constraint campaign_recipients_enviado_check  check (status <> 'enviado'  or enviado_em is not null),
  constraint campaign_recipients_enviando_check check (status <> 'enviando' or enviando_desde is not null),
  constraint campaign_recipients_erro_check     check (erro is null or char_length(erro) <= 500),
  constraint campaign_recipients_unique unique (campaign_id, contact_id),
  constraint campaign_recipients_campaign_fk foreign key (campaign_id, tenant_id)
    references public.campaigns (id, tenant_id) on delete cascade,
  constraint campaign_recipients_contact_fk foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete cascade
);
create index if not exists campaign_recipients_campaign_status_idx
  on public.campaign_recipients (campaign_id, status);
create index if not exists campaign_recipients_pendentes_idx
  on public.campaign_recipients (campaign_id, created_at) where status = 'pendente';
create index if not exists campaign_recipients_enviando_idx
  on public.campaign_recipients (enviando_desde) where status = 'enviando';
create index if not exists campaign_recipients_teto_idx
  on public.campaign_recipients (tenant_id, enviado_em) where status = 'enviado';
create index if not exists campaign_recipients_contact_idx
  on public.campaign_recipients (contact_id);
create index if not exists campaign_recipients_wa_msg_idx
  on public.campaign_recipients (wa_message_id) where wa_message_id is not null;

-- -----------------------------------------------------------------------------
-- 5. Trigger de campanhas: updated_at + trava de campos controlados pelo sistema
--    Escrita DIRETA do front (role authenticated/anon) não pode mudar status,
--    contadores, autoria nem forjar consentimento. As RPCs SECURITY DEFINER
--    rodam como dono das funções (current_user <> authenticated) e passam.
-- -----------------------------------------------------------------------------
create or replace function public.campaigns_before_write()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status       := 'rascunho';
    new.total        := 0;
    new.enviados     := 0;
    new.falhas       := 0;
    new.ignorados    := 0;
    new.pausa_motivo := null;
    new.iniciada_em  := null;
    new.concluida_em := null;
    new.created_by   := auth.uid();
    new.created_at   := now();
    new.updated_at   := now();
    if new.consentimento_confirmado_em is not null then
      new.consentimento_confirmado_em := now();
      new.consentimento_por := auth.uid();
    else
      new.consentimento_por := null;
    end if;
    return new;
  end if;

  -- UPDATE direto
  if new.id is distinct from old.id
     or new.tenant_id    is distinct from old.tenant_id
     or new.status       is distinct from old.status
     or new.total        is distinct from old.total
     or new.enviados     is distinct from old.enviados
     or new.falhas       is distinct from old.falhas
     or new.ignorados    is distinct from old.ignorados
     or new.pausa_motivo is distinct from old.pausa_motivo
     or new.iniciada_em  is distinct from old.iniciada_em
     or new.concluida_em is distinct from old.concluida_em
     or new.created_by   is distinct from old.created_by
     or new.created_at   is distinct from old.created_at then
    raise exception 'campo controlado pelo sistema não pode ser alterado diretamente';
  end if;

  if (new.canal, new.template_nome, new.template_idioma, new.usa_nome, new.mensagem_previa, new.audiencia)
     is distinct from
     (old.canal, old.template_nome, old.template_idioma, old.usa_nome, old.mensagem_previa, old.audiencia)
     and old.status <> 'rascunho' then
    raise exception 'só é possível editar o conteúdo da campanha em rascunho';
  end if;

  if new.agendada_para is distinct from old.agendada_para
     and old.status not in ('rascunho','agendada','pausada') then
    raise exception 'não é possível mudar o agendamento com a campanha em %', old.status;
  end if;

  if new.audiencia is distinct from old.audiencia then
    -- Público mudou: destinatários antigos ficam inválidos até preparar de novo,
    -- e o consentimento confirmado era para o público anterior.
    new.total := 0;
    new.ignorados := 0;
    new.consentimento_confirmado_em := null;
    new.consentimento_por := null;
  elsif new.consentimento_confirmado_em is distinct from old.consentimento_confirmado_em then
    if old.status not in ('rascunho','pausada') then
      raise exception 'consentimento só pode ser alterado com a campanha em rascunho ou pausada';
    end if;
    if new.consentimento_confirmado_em is not null then
      new.consentimento_confirmado_em := now();   -- nunca aceita data enviada pelo cliente
      new.consentimento_por := auth.uid();
    else
      new.consentimento_por := null;
    end if;
  else
    new.consentimento_por := old.consentimento_por;  -- não deixa forjar autoria
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_before_write on public.campaigns;
create trigger campaigns_before_write
  before insert or update on public.campaigns
  for each row execute function public.campaigns_before_write();

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.labels               enable row level security;
alter table public.contact_labels       enable row level security;
alter table public.contact_lists        enable row level security;
alter table public.contact_list_members enable row level security;
alter table public.campaigns            enable row level security;
alter table public.campaign_recipients  enable row level security;

-- labels: qualquer usuário do tenant
drop policy if exists labels_select on public.labels;
drop policy if exists labels_insert on public.labels;
drop policy if exists labels_update on public.labels;
drop policy if exists labels_delete on public.labels;
create policy labels_select on public.labels for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy labels_insert on public.labels for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy labels_update on public.labels for update to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy labels_delete on public.labels for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_labels: qualquer usuário do tenant (sem update: é tabela de ligação)
drop policy if exists contact_labels_select on public.contact_labels;
drop policy if exists contact_labels_insert on public.contact_labels;
drop policy if exists contact_labels_delete on public.contact_labels;
create policy contact_labels_select on public.contact_labels for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_labels_insert on public.contact_labels for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_labels_delete on public.contact_labels for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_lists: qualquer usuário do tenant
drop policy if exists contact_lists_select on public.contact_lists;
drop policy if exists contact_lists_insert on public.contact_lists;
drop policy if exists contact_lists_update on public.contact_lists;
drop policy if exists contact_lists_delete on public.contact_lists;
create policy contact_lists_select on public.contact_lists for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_insert on public.contact_lists for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_update on public.contact_lists for update to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_delete on public.contact_lists for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_list_members: qualquer usuário do tenant
drop policy if exists contact_list_members_select on public.contact_list_members;
drop policy if exists contact_list_members_insert on public.contact_list_members;
drop policy if exists contact_list_members_delete on public.contact_list_members;
create policy contact_list_members_select on public.contact_list_members for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_list_members_insert on public.contact_list_members for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_list_members_delete on public.contact_list_members for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- campaigns: só dono
drop policy if exists campaigns_select on public.campaigns;
drop policy if exists campaigns_insert on public.campaigns;
drop policy if exists campaigns_update on public.campaigns;
drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
create policy campaigns_update on public.campaigns for update to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono')
  with check (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
-- Apagar só quando não há envio em andamento/possível.
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono'
         and status in ('rascunho','cancelada','concluida'));

-- campaign_recipients: dono só LÊ. Toda escrita é via RPC (resolução de público,
-- opt-out, validação de telefone e teto de envio ficam no servidor).
drop policy if exists campaign_recipients_select on public.campaign_recipients;
create policy campaign_recipients_select on public.campaign_recipients for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');

-- Privilégios de tabela (defesa em profundidade além do RLS).
revoke all on public.labels, public.contact_labels, public.contact_lists,
              public.contact_list_members, public.campaigns, public.campaign_recipients
  from anon;
revoke truncate, references, trigger on public.labels, public.contact_labels, public.contact_lists,
              public.contact_list_members, public.campaigns, public.campaign_recipients
  from authenticated;
revoke insert, update, delete on public.campaign_recipients from authenticated;
revoke update on public.contact_labels, public.contact_list_members from authenticated;

-- Função do CHECK precisa de EXECUTE para quem insere/atualiza.
revoke all on function public.campaign_audiencia_valida(jsonb) from public, anon, authenticated;
grant execute on function public.campaign_audiencia_valida(jsonb) to authenticated, service_role;
revoke all on function public.campaigns_before_write() from public, anon, authenticated;
grant execute on function public.campaigns_before_write() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. RPCs do DONO (usuário autenticado)
--    Erro único "campanha não encontrada" para id inexistente OU de outro tenant
--    (não vaza existência de campanhas alheias).
-- -----------------------------------------------------------------------------

-- 7a. Preparar: resolve público NO SERVIDOR e grava destinatários.
create or replace function public.campanha_preparar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_tipo   text;
  v_seg    text;
  v_ids    uuid[];
  v_total  int;
  v_sem_aceite int;
  v_invalido   int;
  v_duplicado  int;
  v_status text;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','agendada') then
    raise exception 'campanha não pode ser preparada no status %', c.status;
  end if;

  v_tipo := c.audiencia->>'tipo';
  v_seg  := c.audiencia->>'segmento';

  if v_tipo in ('lista','etiqueta') then
    select array_agg(distinct x::uuid) into v_ids
      from jsonb_array_elements_text(c.audiencia->'ids') x;
    if v_tipo = 'lista' and
       (select count(*) from contact_lists where tenant_id = v_tenant and id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'audiência contém lista inválida';
    end if;
    if v_tipo = 'etiqueta' and
       (select count(*) from labels where tenant_id = v_tenant and id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'audiência contém etiqueta inválida';
    end if;
  end if;

  -- Idempotente: refaz do zero (nada foi enviado em rascunho/agendada).
  delete from campaign_recipients where campaign_id = c.id;

  with alvo as (
    select ct.id, ct.nome, ct.telefone, ct.aceita_mensagem_automatica, ct.created_at
      from contacts ct
     where ct.tenant_id = v_tenant
       and (
         v_tipo = 'todos'
         or (v_tipo = 'lista' and exists (
               select 1 from contact_list_members m
                where m.tenant_id = v_tenant and m.contact_id = ct.id and m.list_id = any(v_ids)))
         or (v_tipo = 'etiqueta' and exists (
               select 1 from contact_labels cl
                where cl.tenant_id = v_tenant and cl.contact_id = ct.id and cl.label_id = any(v_ids)))
         or (v_tipo = 'segmento' and v_seg = 'novos_30d'
               and ct.created_at >= now() - interval '30 days')
         or (v_tipo = 'segmento' and v_seg = 'aniversariantes_mes'
               and ct.data_nascimento is not null
               and extract(month from ct.data_nascimento)
                   = extract(month from (now() at time zone 'America/Sao_Paulo')))
         or (v_tipo = 'segmento' and v_seg = 'inativos_60d'
               and (exists (select 1 from appointments a
                             where a.tenant_id = v_tenant and a.contact_id = ct.id and a.status = 'concluido')
                    or exists (select 1 from payments p
                                where p.tenant_id = v_tenant and p.contact_id = ct.id))
               and not exists (select 1 from appointments a
                                where a.tenant_id = v_tenant and a.contact_id = ct.id
                                  and a.status = 'concluido' and a.data_hora >= now() - interval '60 days')
               and not exists (select 1 from payments p
                                where p.tenant_id = v_tenant and p.contact_id = ct.id
                                  and p.created_at >= now() - interval '60 days')
               -- quem já tem horário marcado no futuro não é "inativo"
               and not exists (select 1 from appointments a
                                where a.tenant_id = v_tenant and a.contact_id = ct.id
                                  and a.status = 'agendado' and a.data_hora >= now()))
       )
  ),
  norm as (
    select a.*,
           regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') as dig
      from alvo a
  ),
  base as (
    select n.*,
           -- 10–11 dígitos = número brasileiro sem DDI: prefixa 55.
           case when length(n.dig) in (10, 11) then '55' || n.dig else n.dig end as tel,
           case
             when not n.aceita_mensagem_automatica then 'sem_aceite'
             when n.dig !~ '^[0-9]{10,13}$'        then 'telefone_invalido'
             else null
           end as motivo
      from norm n
  ),
  classif as (
    select b.*,
           case
             when b.motivo is null
                  and row_number() over (partition by (b.motivo is null), b.tel
                                         order by b.created_at, b.id) > 1
               then 'telefone_duplicado'
             else b.motivo
           end as motivo_final
      from base b
  )
  insert into campaign_recipients (campaign_id, tenant_id, contact_id, nome, telefone, status, erro)
  select c.id, v_tenant, k.id, k.nome,
         case when k.motivo_final = 'telefone_invalido' then coalesce(nullif(k.dig, ''), '-') else k.tel end,
         case when k.motivo_final is null then 'pendente' else 'ignorado' end,
         k.motivo_final
    from classif k;

  select count(*) filter (where status = 'pendente'),
         count(*) filter (where erro = 'sem_aceite'),
         count(*) filter (where erro = 'telefone_invalido'),
         count(*) filter (where erro = 'telefone_duplicado')
    into v_total, v_sem_aceite, v_invalido, v_duplicado
    from campaign_recipients where campaign_id = c.id;

  v_status := case when c.status = 'agendada' and v_total = 0 then 'rascunho' else c.status end;

  update campaigns
     set total = v_total,
         ignorados = v_sem_aceite + v_invalido + v_duplicado,
         enviados = 0,
         falhas = 0,
         status = v_status
   where id = c.id;

  return jsonb_build_object(
    'total', v_total,
    'ignorados_sem_aceite', v_sem_aceite,
    'ignorados_telefone_invalido', v_invalido,
    'ignorados_duplicados', v_duplicado,
    'status', v_status
  );
end;
$$;

-- 7b. Iniciar (ou retomar campanha pausada)
create or replace function public.campanha_iniciar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_pend   int;
  v_ativo  boolean;
  v_pausado_ate timestamptz;
  v_status text;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','pausada') then
    raise exception 'campanha não pode ser iniciada no status %', c.status;
  end if;
  if c.template_nome is null or btrim(c.template_nome) = '' then
    raise exception 'defina o modelo (template) aprovado pela Meta antes de iniciar';
  end if;
  if c.consentimento_confirmado_em is null then
    raise exception 'confirme que os contatos aceitaram receber mensagens antes de iniciar';
  end if;

  select count(*) into v_pend from campaign_recipients
   where campaign_id = c.id and status in ('pendente','enviando');

  if c.status = 'rascunho' and (c.total <= 0 or v_pend = 0) then
    raise exception 'nenhum destinatário elegível: prepare a campanha antes de iniciar';
  end if;

  select (status = 'ativo'), automacoes_pausadas_ate into v_ativo, v_pausado_ate
    from whatsapp_accounts where tenant_id = v_tenant;
  if not coalesce(v_ativo, false) then
    raise exception 'WhatsApp não está conectado (status ativo) para este negócio';
  end if;

  if c.status = 'pausada' and v_pend = 0 then
    update campaigns set status = 'concluida', concluida_em = now(), pausa_motivo = null
     where id = c.id;
    return jsonb_build_object('status', 'concluida', 'pendentes', 0,
                              'agendada_para', c.agendada_para,
                              'automacoes_pausadas_ate', v_pausado_ate);
  end if;

  v_status := case when c.agendada_para is not null and c.agendada_para > now()
                   then 'agendada' else 'enviando' end;

  update campaigns
     set status = v_status,
         pausa_motivo = null,
         iniciada_em = case when v_status = 'enviando' then coalesce(iniciada_em, now()) else iniciada_em end
   where id = c.id;

  return jsonb_build_object(
    'status', v_status,
    'pendentes', v_pend,
    'agendada_para', c.agendada_para,
    -- se não for null e estiver no futuro, o envio fica parado até essa hora
    'automacoes_pausadas_ate', v_pausado_ate
  );
end;
$$;

-- 7e. Pausar
create or replace function public.campanha_pausar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('enviando','agendada') then
    raise exception 'campanha não pode ser pausada no status %', c.status;
  end if;

  update campaigns set status = 'pausada', pausa_motivo = 'manual' where id = c.id;

  return jsonb_build_object(
    'status', 'pausada',
    'em_envio_agora', (select count(*) from campaign_recipients
                        where campaign_id = c.id and status = 'enviando')
  );
end;
$$;

-- 7e. Cancelar
create or replace function public.campanha_cancelar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_ign    int;
  v_presos int;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','agendada','enviando','pausada') then
    raise exception 'campanha não pode ser cancelada no status %', c.status;
  end if;

  update campaign_recipients
     set status = 'ignorado', erro = 'campanha_cancelada', enviando_desde = null
   where campaign_id = c.id and status = 'pendente';
  get diagnostics v_ign = row_count;

  -- presos há mais de 15 min sem confirmação: encerra como falha
  update campaign_recipients
     set status = 'falhou', erro = 'interrompido_sem_confirmacao', enviando_desde = null
   where campaign_id = c.id and status = 'enviando'
     and enviando_desde < now() - interval '15 minutes';
  get diagnostics v_presos = row_count;

  update campaigns
     set status = 'cancelada',
         ignorados = ignorados + v_ign,
         falhas = falhas + v_presos,
         concluida_em = now()
   where id = c.id;

  return jsonb_build_object(
    'status', 'cancelada',
    'ignorados_cancelamento', v_ign,
    'em_envio_agora', (select count(*) from campaign_recipients
                        where campaign_id = c.id and status = 'enviando')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPCs de SERVIÇO (rota do app / cron) — exigem o segredo interno
-- -----------------------------------------------------------------------------

-- 8c. Próximo lote. Devolve credenciais: NUNCA chamar do navegador.
create or replace function public.campanha_proximo_lote(p_secret text, p_limite int default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Constantes ajustáveis
  c_teto_24h        constant int      := 250;                 -- envios por tenant em 24h
  c_limite_max      constant int      := 40;                  -- máximo por chamada
  c_preso           constant interval := interval '15 minutes';
  c_max_tentativas  constant int      := 2;                   -- após isso, preso vira 'falhou'
  v_limite int;
  v_camps  uuid[];
  v_ids    uuid[];
  v_itens  jsonb;
  v_rest   int;
begin
  perform check_webhook_secret(p_secret);

  v_limite := least(greatest(coalesce(p_limite, 25), 1), c_limite_max);

  -- Serializa a seleção de lotes (rota e cron simultâneos): o teto por tenant
  -- é calculado e consumido sem corrida. Liberado no fim da transação.
  perform pg_advisory_xact_lock(hashtext('ivva.campanha_proximo_lote'));

  -- Campanhas elegíveis, travadas (ordem de trava: campanha -> destinatário,
  -- igual às demais RPCs, evitando deadlock). SKIP LOCKED: campanha sendo
  -- pausada/cancelada/preparada agora fica de fora deste lote.
  select coalesce(array_agg(id), '{}') into v_camps
    from (select id from campaigns
           where status = 'enviando'
              or (status = 'agendada' and coalesce(agendada_para, now()) <= now())
           order by created_at
           for update skip locked) s;

  if cardinality(v_camps) = 0 then
    return jsonb_build_object('itens', '[]'::jsonb, 'restantes', 0);
  end if;

  -- Promove agendadas vencidas.
  update campaigns
     set status = 'enviando', iniciada_em = coalesce(iniciada_em, now())
   where id = any(v_camps) and status = 'agendada';

  -- Recuperação: presos em 'enviando' (rota caiu no meio do lote).
  with presos as (
    update campaign_recipients r
       set status = case when r.tentativas >= c_max_tentativas then 'falhou' else 'pendente' end,
           erro   = case when r.tentativas >= c_max_tentativas then 'interrompido_sem_confirmacao' else r.erro end,
           enviando_desde = null
     where r.campaign_id = any(v_camps)
       and r.status = 'enviando'
       and r.enviando_desde < now() - c_preso
    returning r.campaign_id, r.status
  )
  update campaigns c
     set falhas = c.falhas + x.n
    from (select campaign_id, count(*) as n from presos where status = 'falhou' group by 1) x
   where c.id = x.campaign_id;

  -- Opt-out é reconferido NA HORA do envio (pode ter mudado após preparar).
  with ign as (
    update campaign_recipients r
       set status = 'ignorado', erro = 'sem_aceite'
      from contacts ct
     where r.campaign_id = any(v_camps)
       and r.status = 'pendente'
       and ct.id = r.contact_id and ct.tenant_id = r.tenant_id
       and not ct.aceita_mensagem_automatica
    returning r.campaign_id
  )
  update campaigns c
     set ignorados = c.ignorados + x.n
    from (select campaign_id, count(*) as n from ign group by 1) x
   where c.id = x.campaign_id;

  -- Seleção respeitando: WhatsApp ativo, pausa de qualidade, acesso do tenant
  -- e teto de 24h por tenant (enviados + em envio recente).
  with elig as (
    select r.id, r.tenant_id, r.created_at,
           row_number() over (partition by r.tenant_id order by r.created_at, r.id) as rn
      from campaign_recipients r
      join whatsapp_accounts wa on wa.tenant_id = r.tenant_id
      join tenants t on t.id = r.tenant_id
     where r.campaign_id = any(v_camps)
       and r.status = 'pendente'
       and wa.status = 'ativo'
       and (wa.automacoes_pausadas_ate is null or wa.automacoes_pausadas_ate <= now())
       and not t.acesso_bloqueado
  ),
  uso as (
    select r.tenant_id, count(*) as n
      from campaign_recipients r
     where r.tenant_id in (select distinct tenant_id from elig)
       and ((r.status = 'enviado' and r.enviado_em > now() - interval '24 hours')
            or (r.status = 'enviando' and r.enviando_desde >= now() - c_preso))
     group by 1
  )
  select coalesce(array_agg(id), '{}') into v_ids
    from (select e.id
            from elig e
            left join uso u on u.tenant_id = e.tenant_id
           where e.rn <= c_teto_24h - coalesce(u.n, 0)
           order by e.rn, e.created_at          -- intercala tenants (justo)
           limit v_limite) s;

  -- Trava e marca (SKIP LOCKED: nenhuma linha é entregue a duas chamadas).
  select coalesce(array_agg(id), '{}') into v_ids
    from (select id from campaign_recipients
           where id = any(v_ids) and status = 'pendente'
           for update skip locked) s;

  update campaign_recipients
     set status = 'enviando', enviando_desde = now(), tentativas = tentativas + 1
   where id = any(v_ids);

  -- Conclui campanhas sem nada a enviar (ex.: todos viraram opt-out).
  update campaigns c
     set status = 'concluida', concluida_em = now()
   where c.id = any(v_camps) and c.status = 'enviando'
     and not exists (select 1 from campaign_recipients r
                      where r.campaign_id = c.id and r.status in ('pendente','enviando'));

  select coalesce(jsonb_agg(jsonb_build_object(
           'recipient_id',    r.id,
           'campaign_id',     r.campaign_id,
           'tenant_id',       r.tenant_id,
           'nome',            r.nome,
           'primeiro_nome',   nullif(split_part(btrim(coalesce(r.nome, '')), ' ', 1), ''),
           'telefone',        r.telefone,
           'template_nome',   c.template_nome,
           'template_idioma', c.template_idioma,
           'usa_nome',        c.usa_nome,
           'phone_number_id', wa.phone_number_id,
           'access_token',    wa.access_token
         ) order by r.created_at), '[]'::jsonb)
    into v_itens
    from campaign_recipients r
    join campaigns c on c.id = r.campaign_id
    join whatsapp_accounts_decrypted wa on wa.tenant_id = r.tenant_id
   where r.id = any(v_ids);

  select count(*) into v_rest
    from campaign_recipients r
    join campaigns c on c.id = r.campaign_id
   where c.status = 'enviando' and r.status = 'pendente';

  return jsonb_build_object('itens', v_itens, 'restantes', v_rest);
end;
$$;

-- 8d. Registrar resultado de um envio (idempotente).
create or replace function public.campanha_registrar_envio(
  p_secret text,
  p_recipient_id uuid,
  p_ok boolean,
  p_wa_message_id text default null,
  p_erro text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c_falhas_para_pausar constant int := 10;
  v_camp   uuid;
  r        public.campaign_recipients%rowtype;
  cp       public.campaigns%rowtype;
  d_env int := 0; d_fal int := 0; d_ign int := 0;
begin
  perform check_webhook_secret(p_secret);

  if p_ok is null then
    raise exception 'p_ok é obrigatório';
  end if;

  select campaign_id into v_camp from campaign_recipients where id = p_recipient_id;
  if v_camp is null then
    return jsonb_build_object('ok', false, 'motivo', 'destinatario_nao_encontrado');
  end if;

  -- Ordem de trava: campanha -> destinatário.
  perform 1 from campaigns where id = v_camp for update;
  select * into r from campaign_recipients where id = p_recipient_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'destinatario_nao_encontrado');
  end if;

  if p_ok then
    if r.status = 'enviado' then
      return jsonb_build_object('ok', true, 'ja_registrado', true, 'status', r.status);
    end if;
    -- Confirmação tardia (a mensagem SAIU): corrige qualquer estado anterior.
    d_env := 1;
    if r.status = 'falhou'   then d_fal := -1; end if;
    if r.status = 'ignorado' then d_ign := -1; end if;
    update campaign_recipients
       set status = 'enviado', enviado_em = now(), enviando_desde = null, erro = null,
           wa_message_id = left(p_wa_message_id, 200)
     where id = r.id;
  else
    if r.status <> 'enviando' then
      return jsonb_build_object('ok', true, 'ja_registrado', true, 'status', r.status);
    end if;
    d_fal := 1;
    update campaign_recipients
       set status = 'falhou', enviando_desde = null,
           erro = left(coalesce(nullif(btrim(p_erro), ''), 'erro_desconhecido'), 500),
           wa_message_id = left(p_wa_message_id, 200)
     where id = r.id;
  end if;

  update campaigns
     set enviados  = enviados  + d_env,
         falhas    = greatest(falhas + d_fal, 0),
         ignorados = greatest(ignorados + d_ign, 0)
   where id = v_camp
  returning * into cp;

  -- Disjuntor: muitas falhas e mais falhas que sucessos -> pausa sozinha
  -- (ex.: template rejeitado, número bloqueado). Evita queimar a qualidade.
  if cp.status = 'enviando' and cp.falhas >= c_falhas_para_pausar and cp.falhas > cp.enviados then
    update campaigns set status = 'pausada', pausa_motivo = 'muitas_falhas'
     where id = v_camp returning * into cp;
  elsif cp.status = 'enviando' and not exists (
          select 1 from campaign_recipients
           where campaign_id = v_camp and status in ('pendente','enviando')) then
    update campaigns set status = 'concluida', concluida_em = now()
     where id = v_camp returning * into cp;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ja_registrado', false,
    'status', case when p_ok then 'enviado' else 'falhou' end,
    'campanha_status', cp.status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Privilégios de função
--    Supabase concede EXECUTE a anon/authenticated por padrão: revoga tudo e
--    concede o mínimo.
--    * RPCs do dono: só authenticated (a função ainda valida tenant + role).
--    * RPCs com segredo: anon + service_role, porque as rotas/cron do app usam
--      o cliente com a ANON KEY (mesmo padrão de list_pos_venda_pendentes).
--      Sem o segredo, check_webhook_secret aborta com 'not allowed'.
-- -----------------------------------------------------------------------------
revoke all on function public.campanha_preparar(uuid) from public, anon, authenticated;
revoke all on function public.campanha_iniciar(uuid)  from public, anon, authenticated;
revoke all on function public.campanha_pausar(uuid)   from public, anon, authenticated;
revoke all on function public.campanha_cancelar(uuid) from public, anon, authenticated;
grant execute on function public.campanha_preparar(uuid) to authenticated, service_role;
grant execute on function public.campanha_iniciar(uuid)  to authenticated, service_role;
grant execute on function public.campanha_pausar(uuid)   to authenticated, service_role;
grant execute on function public.campanha_cancelar(uuid) to authenticated, service_role;

revoke all on function public.campanha_proximo_lote(text, int) from public, anon, authenticated;
revoke all on function public.campanha_registrar_envio(text, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.campanha_proximo_lote(text, int) to anon, service_role;
grant execute on function public.campanha_registrar_envio(text, uuid, boolean, text, text) to anon, service_role;

commit;

-- =============================================================================
-- ROLLBACK (desfaz SÓ o que esta migração criou). ATENÇÃO: apaga etiquetas,
-- listas, campanhas e atribuições de conversa criadas depois da migração.
-- =============================================================================
-- begin;
-- drop function if exists public.campanha_registrar_envio(text, uuid, boolean, text, text);
-- drop function if exists public.campanha_proximo_lote(text, int);
-- drop function if exists public.campanha_cancelar(uuid);
-- drop function if exists public.campanha_pausar(uuid);
-- drop function if exists public.campanha_iniciar(uuid);
-- drop function if exists public.campanha_preparar(uuid);
-- drop table if exists public.campaign_recipients;
-- drop table if exists public.campaigns;          -- remove trigger e constraints junto
-- drop function if exists public.campaigns_before_write();
-- drop function if exists public.campaign_audiencia_valida(jsonb);
-- drop table if exists public.contact_list_members;
-- drop table if exists public.contact_lists;
-- drop table if exists public.contact_labels;
-- drop table if exists public.labels;
-- drop index if exists public.conversations_tenant_assigned_idx;
-- alter table public.conversations drop constraint if exists conversations_assigned_user_fk;
-- alter table public.conversations drop column if exists assigned_user_id;
-- drop index if exists public.contacts_id_tenant_uidx;
-- drop index if exists public.users_id_tenant_uidx;
-- commit;
 and char_length(template_nome) <= 512)),
  constraint campaigns_idioma_check    check (template_idioma ~ '^[a-z]{2,3}(_[A-Z]{2})?$'),
  constraint campaigns_previa_check    check (mensagem_previa is null or char_length(mensagem_previa) <= 1024),
  constraint campaigns_audiencia_check check (public.campaign_audiencia_valida(audiencia)),
  constraint campaigns_status_check    check (status in ('rascunho','agendada','enviando','concluida','pausada','cancelada')),
  constraint campaigns_contadores_check check (total >= 0 and enviados >= 0 and falhas >= 0 and ignorados >= 0),
  constraint campaigns_pausa_motivo_check check (pausa_motivo is null or pausa_motivo in ('manual','muitas_falhas')),
  constraint campaigns_created_by_fk foreign key (created_by, tenant_id)
    references public.users (id, tenant_id) on delete set null (created_by),
  constraint campaigns_consentimento_por_fk foreign key (consentimento_por, tenant_id)
    references public.users (id, tenant_id) on delete set null (consentimento_por)
);
create unique index if not exists campaigns_id_tenant_uidx on public.campaigns (id, tenant_id);
create index if not exists campaigns_tenant_status_idx on public.campaigns (tenant_id, status, created_at desc);
create index if not exists campaigns_ativas_idx on public.campaigns (status, agendada_para)
  where status in ('enviando','agendada');

create table if not exists public.campaign_recipients (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  contact_id     uuid not null,
  nome           text,
  telefone       text not null,                 -- snapshot (só dígitos, com DDI)
  status         text not null default 'pendente',
  erro           text,
  tentativas     integer not null default 0,
  enviando_desde timestamptz,
  enviado_em     timestamptz,
  wa_message_id  text,
  created_at     timestamptz not null default now(),
  constraint campaign_recipients_status_check
    check (status in ('pendente','enviando','enviado','falhou','ignorado')),
  constraint campaign_recipients_enviado_check  check (status <> 'enviado'  or enviado_em is not null),
  constraint campaign_recipients_enviando_check check (status <> 'enviando' or enviando_desde is not null),
  constraint campaign_recipients_erro_check     check (erro is null or char_length(erro) <= 500),
  constraint campaign_recipients_unique unique (campaign_id, contact_id),
  constraint campaign_recipients_campaign_fk foreign key (campaign_id, tenant_id)
    references public.campaigns (id, tenant_id) on delete cascade,
  constraint campaign_recipients_contact_fk foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete cascade
);
create index if not exists campaign_recipients_campaign_status_idx
  on public.campaign_recipients (campaign_id, status);
create index if not exists campaign_recipients_pendentes_idx
  on public.campaign_recipients (campaign_id, created_at) where status = 'pendente';
create index if not exists campaign_recipients_enviando_idx
  on public.campaign_recipients (enviando_desde) where status = 'enviando';
create index if not exists campaign_recipients_teto_idx
  on public.campaign_recipients (tenant_id, enviado_em) where status = 'enviado';
create index if not exists campaign_recipients_contact_idx
  on public.campaign_recipients (contact_id);
create index if not exists campaign_recipients_wa_msg_idx
  on public.campaign_recipients (wa_message_id) where wa_message_id is not null;

-- -----------------------------------------------------------------------------
-- 5. Trigger de campanhas: updated_at + trava de campos controlados pelo sistema
--    Escrita DIRETA do front (role authenticated/anon) não pode mudar status,
--    contadores, autoria nem forjar consentimento. As RPCs SECURITY DEFINER
--    rodam como dono das funções (current_user <> authenticated) e passam.
-- -----------------------------------------------------------------------------
create or replace function public.campaigns_before_write()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status       := 'rascunho';
    new.total        := 0;
    new.enviados     := 0;
    new.falhas       := 0;
    new.ignorados    := 0;
    new.pausa_motivo := null;
    new.iniciada_em  := null;
    new.concluida_em := null;
    new.created_by   := auth.uid();
    new.created_at   := now();
    new.updated_at   := now();
    if new.consentimento_confirmado_em is not null then
      new.consentimento_confirmado_em := now();
      new.consentimento_por := auth.uid();
    else
      new.consentimento_por := null;
    end if;
    return new;
  end if;

  -- UPDATE direto
  if new.id is distinct from old.id
     or new.tenant_id    is distinct from old.tenant_id
     or new.status       is distinct from old.status
     or new.total        is distinct from old.total
     or new.enviados     is distinct from old.enviados
     or new.falhas       is distinct from old.falhas
     or new.ignorados    is distinct from old.ignorados
     or new.pausa_motivo is distinct from old.pausa_motivo
     or new.iniciada_em  is distinct from old.iniciada_em
     or new.concluida_em is distinct from old.concluida_em
     or new.created_by   is distinct from old.created_by
     or new.created_at   is distinct from old.created_at then
    raise exception 'campo controlado pelo sistema não pode ser alterado diretamente';
  end if;

  if (new.canal, new.template_nome, new.template_idioma, new.usa_nome, new.mensagem_previa, new.audiencia)
     is distinct from
     (old.canal, old.template_nome, old.template_idioma, old.usa_nome, old.mensagem_previa, old.audiencia)
     and old.status <> 'rascunho' then
    raise exception 'só é possível editar o conteúdo da campanha em rascunho';
  end if;

  if new.agendada_para is distinct from old.agendada_para
     and old.status not in ('rascunho','agendada','pausada') then
    raise exception 'não é possível mudar o agendamento com a campanha em %', old.status;
  end if;

  if new.audiencia is distinct from old.audiencia then
    -- Público mudou: destinatários antigos ficam inválidos até preparar de novo,
    -- e o consentimento confirmado era para o público anterior.
    new.total := 0;
    new.ignorados := 0;
    new.consentimento_confirmado_em := null;
    new.consentimento_por := null;
  elsif new.consentimento_confirmado_em is distinct from old.consentimento_confirmado_em then
    if old.status not in ('rascunho','pausada') then
      raise exception 'consentimento só pode ser alterado com a campanha em rascunho ou pausada';
    end if;
    if new.consentimento_confirmado_em is not null then
      new.consentimento_confirmado_em := now();   -- nunca aceita data enviada pelo cliente
      new.consentimento_por := auth.uid();
    else
      new.consentimento_por := null;
    end if;
  else
    new.consentimento_por := old.consentimento_por;  -- não deixa forjar autoria
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_before_write on public.campaigns;
create trigger campaigns_before_write
  before insert or update on public.campaigns
  for each row execute function public.campaigns_before_write();

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.labels               enable row level security;
alter table public.contact_labels       enable row level security;
alter table public.contact_lists        enable row level security;
alter table public.contact_list_members enable row level security;
alter table public.campaigns            enable row level security;
alter table public.campaign_recipients  enable row level security;

-- labels: qualquer usuário do tenant
drop policy if exists labels_select on public.labels;
drop policy if exists labels_insert on public.labels;
drop policy if exists labels_update on public.labels;
drop policy if exists labels_delete on public.labels;
create policy labels_select on public.labels for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy labels_insert on public.labels for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy labels_update on public.labels for update to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy labels_delete on public.labels for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_labels: qualquer usuário do tenant (sem update: é tabela de ligação)
drop policy if exists contact_labels_select on public.contact_labels;
drop policy if exists contact_labels_insert on public.contact_labels;
drop policy if exists contact_labels_delete on public.contact_labels;
create policy contact_labels_select on public.contact_labels for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_labels_insert on public.contact_labels for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_labels_delete on public.contact_labels for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_lists: qualquer usuário do tenant
drop policy if exists contact_lists_select on public.contact_lists;
drop policy if exists contact_lists_insert on public.contact_lists;
drop policy if exists contact_lists_update on public.contact_lists;
drop policy if exists contact_lists_delete on public.contact_lists;
create policy contact_lists_select on public.contact_lists for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_insert on public.contact_lists for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_update on public.contact_lists for update to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_lists_delete on public.contact_lists for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- contact_list_members: qualquer usuário do tenant
drop policy if exists contact_list_members_select on public.contact_list_members;
drop policy if exists contact_list_members_insert on public.contact_list_members;
drop policy if exists contact_list_members_delete on public.contact_list_members;
create policy contact_list_members_select on public.contact_list_members for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
create policy contact_list_members_insert on public.contact_list_members for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()));
create policy contact_list_members_delete on public.contact_list_members for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()));

-- campaigns: só dono
drop policy if exists campaigns_select on public.campaigns;
drop policy if exists campaigns_insert on public.campaigns;
drop policy if exists campaigns_update on public.campaigns;
drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
create policy campaigns_update on public.campaigns for update to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono')
  with check (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');
-- Apagar só quando não há envio em andamento/possível.
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono'
         and status in ('rascunho','cancelada','concluida'));

-- campaign_recipients: dono só LÊ. Toda escrita é via RPC (resolução de público,
-- opt-out, validação de telefone e teto de envio ficam no servidor).
drop policy if exists campaign_recipients_select on public.campaign_recipients;
create policy campaign_recipients_select on public.campaign_recipients for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'dono');

-- Privilégios de tabela (defesa em profundidade além do RLS).
revoke all on public.labels, public.contact_labels, public.contact_lists,
              public.contact_list_members, public.campaigns, public.campaign_recipients
  from anon;
revoke truncate, references, trigger on public.labels, public.contact_labels, public.contact_lists,
              public.contact_list_members, public.campaigns, public.campaign_recipients
  from authenticated;
revoke insert, update, delete on public.campaign_recipients from authenticated;
revoke update on public.contact_labels, public.contact_list_members from authenticated;

-- Função do CHECK precisa de EXECUTE para quem insere/atualiza.
revoke all on function public.campaign_audiencia_valida(jsonb) from public, anon, authenticated;
grant execute on function public.campaign_audiencia_valida(jsonb) to authenticated, service_role;
revoke all on function public.campaigns_before_write() from public, anon, authenticated;
grant execute on function public.campaigns_before_write() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. RPCs do DONO (usuário autenticado)
--    Erro único "campanha não encontrada" para id inexistente OU de outro tenant
--    (não vaza existência de campanhas alheias).
-- -----------------------------------------------------------------------------

-- 7a. Preparar: resolve público NO SERVIDOR e grava destinatários.
create or replace function public.campanha_preparar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_tipo   text;
  v_seg    text;
  v_ids    uuid[];
  v_total  int;
  v_sem_aceite int;
  v_invalido   int;
  v_duplicado  int;
  v_status text;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','agendada') then
    raise exception 'campanha não pode ser preparada no status %', c.status;
  end if;

  v_tipo := c.audiencia->>'tipo';
  v_seg  := c.audiencia->>'segmento';

  if v_tipo in ('lista','etiqueta') then
    select array_agg(distinct x::uuid) into v_ids
      from jsonb_array_elements_text(c.audiencia->'ids') x;
    if v_tipo = 'lista' and
       (select count(*) from contact_lists where tenant_id = v_tenant and id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'audiência contém lista inválida';
    end if;
    if v_tipo = 'etiqueta' and
       (select count(*) from labels where tenant_id = v_tenant and id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'audiência contém etiqueta inválida';
    end if;
  end if;

  -- Idempotente: refaz do zero (nada foi enviado em rascunho/agendada).
  delete from campaign_recipients where campaign_id = c.id;

  with alvo as (
    select ct.id, ct.nome, ct.telefone, ct.aceita_mensagem_automatica, ct.created_at
      from contacts ct
     where ct.tenant_id = v_tenant
       and (
         v_tipo = 'todos'
         or (v_tipo = 'lista' and exists (
               select 1 from contact_list_members m
                where m.tenant_id = v_tenant and m.contact_id = ct.id and m.list_id = any(v_ids)))
         or (v_tipo = 'etiqueta' and exists (
               select 1 from contact_labels cl
                where cl.tenant_id = v_tenant and cl.contact_id = ct.id and cl.label_id = any(v_ids)))
         or (v_tipo = 'segmento' and v_seg = 'novos_30d'
               and ct.created_at >= now() - interval '30 days')
         or (v_tipo = 'segmento' and v_seg = 'aniversariantes_mes'
               and ct.data_nascimento is not null
               and extract(month from ct.data_nascimento)
                   = extract(month from (now() at time zone 'America/Sao_Paulo')))
         or (v_tipo = 'segmento' and v_seg = 'inativos_60d'
               and (exists (select 1 from appointments a
                             where a.tenant_id = v_tenant and a.contact_id = ct.id and a.status = 'concluido')
                    or exists (select 1 from payments p
                                where p.tenant_id = v_tenant and p.contact_id = ct.id))
               and not exists (select 1 from appointments a
                                where a.tenant_id = v_tenant and a.contact_id = ct.id
                                  and a.status = 'concluido' and a.data_hora >= now() - interval '60 days')
               and not exists (select 1 from payments p
                                where p.tenant_id = v_tenant and p.contact_id = ct.id
                                  and p.created_at >= now() - interval '60 days')
               -- quem já tem horário marcado no futuro não é "inativo"
               and not exists (select 1 from appointments a
                                where a.tenant_id = v_tenant and a.contact_id = ct.id
                                  and a.status = 'agendado' and a.data_hora >= now()))
       )
  ),
  norm as (
    select a.*,
           regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') as dig
      from alvo a
  ),
  base as (
    select n.*,
           -- 10–11 dígitos = número brasileiro sem DDI: prefixa 55.
           case when length(n.dig) in (10, 11) then '55' || n.dig else n.dig end as tel,
           case
             when not n.aceita_mensagem_automatica then 'sem_aceite'
             when n.dig !~ '^[0-9]{10,13}$'        then 'telefone_invalido'
             else null
           end as motivo
      from norm n
  ),
  classif as (
    select b.*,
           case
             when b.motivo is null
                  and row_number() over (partition by (b.motivo is null), b.tel
                                         order by b.created_at, b.id) > 1
               then 'telefone_duplicado'
             else b.motivo
           end as motivo_final
      from base b
  )
  insert into campaign_recipients (campaign_id, tenant_id, contact_id, nome, telefone, status, erro)
  select c.id, v_tenant, k.id, k.nome,
         case when k.motivo_final = 'telefone_invalido' then coalesce(nullif(k.dig, ''), '-') else k.tel end,
         case when k.motivo_final is null then 'pendente' else 'ignorado' end,
         k.motivo_final
    from classif k;

  select count(*) filter (where status = 'pendente'),
         count(*) filter (where erro = 'sem_aceite'),
         count(*) filter (where erro = 'telefone_invalido'),
         count(*) filter (where erro = 'telefone_duplicado')
    into v_total, v_sem_aceite, v_invalido, v_duplicado
    from campaign_recipients where campaign_id = c.id;

  v_status := case when c.status = 'agendada' and v_total = 0 then 'rascunho' else c.status end;

  update campaigns
     set total = v_total,
         ignorados = v_sem_aceite + v_invalido + v_duplicado,
         enviados = 0,
         falhas = 0,
         status = v_status
   where id = c.id;

  return jsonb_build_object(
    'total', v_total,
    'ignorados_sem_aceite', v_sem_aceite,
    'ignorados_telefone_invalido', v_invalido,
    'ignorados_duplicados', v_duplicado,
    'status', v_status
  );
end;
$$;

-- 7b. Iniciar (ou retomar campanha pausada)
create or replace function public.campanha_iniciar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_pend   int;
  v_ativo  boolean;
  v_pausado_ate timestamptz;
  v_status text;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','pausada') then
    raise exception 'campanha não pode ser iniciada no status %', c.status;
  end if;
  if c.template_nome is null or btrim(c.template_nome) = '' then
    raise exception 'defina o modelo (template) aprovado pela Meta antes de iniciar';
  end if;
  if c.consentimento_confirmado_em is null then
    raise exception 'confirme que os contatos aceitaram receber mensagens antes de iniciar';
  end if;

  select count(*) into v_pend from campaign_recipients
   where campaign_id = c.id and status in ('pendente','enviando');

  if c.status = 'rascunho' and (c.total <= 0 or v_pend = 0) then
    raise exception 'nenhum destinatário elegível: prepare a campanha antes de iniciar';
  end if;

  select (status = 'ativo'), automacoes_pausadas_ate into v_ativo, v_pausado_ate
    from whatsapp_accounts where tenant_id = v_tenant;
  if not coalesce(v_ativo, false) then
    raise exception 'WhatsApp não está conectado (status ativo) para este negócio';
  end if;

  if c.status = 'pausada' and v_pend = 0 then
    update campaigns set status = 'concluida', concluida_em = now(), pausa_motivo = null
     where id = c.id;
    return jsonb_build_object('status', 'concluida', 'pendentes', 0,
                              'agendada_para', c.agendada_para,
                              'automacoes_pausadas_ate', v_pausado_ate);
  end if;

  v_status := case when c.agendada_para is not null and c.agendada_para > now()
                   then 'agendada' else 'enviando' end;

  update campaigns
     set status = v_status,
         pausa_motivo = null,
         iniciada_em = case when v_status = 'enviando' then coalesce(iniciada_em, now()) else iniciada_em end
   where id = c.id;

  return jsonb_build_object(
    'status', v_status,
    'pendentes', v_pend,
    'agendada_para', c.agendada_para,
    -- se não for null e estiver no futuro, o envio fica parado até essa hora
    'automacoes_pausadas_ate', v_pausado_ate
  );
end;
$$;

-- 7e. Pausar
create or replace function public.campanha_pausar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('enviando','agendada') then
    raise exception 'campanha não pode ser pausada no status %', c.status;
  end if;

  update campaigns set status = 'pausada', pausa_motivo = 'manual' where id = c.id;

  return jsonb_build_object(
    'status', 'pausada',
    'em_envio_agora', (select count(*) from campaign_recipients
                        where campaign_id = c.id and status = 'enviando')
  );
end;
$$;

-- 7e. Cancelar
create or replace function public.campanha_cancelar(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid;
  c        public.campaigns%rowtype;
  v_ign    int;
  v_presos int;
begin
  v_tenant := current_tenant_id();
  if v_tenant is null or current_app_role() is distinct from 'dono' then
    raise exception 'not allowed';
  end if;

  select * into c from campaigns
   where id = p_campaign_id and tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'campanha não encontrada';
  end if;
  if c.status not in ('rascunho','agendada','enviando','pausada') then
    raise exception 'campanha não pode ser cancelada no status %', c.status;
  end if;

  update campaign_recipients
     set status = 'ignorado', erro = 'campanha_cancelada', enviando_desde = null
   where campaign_id = c.id and status = 'pendente';
  get diagnostics v_ign = row_count;

  -- presos há mais de 15 min sem confirmação: encerra como falha
  update campaign_recipients
     set status = 'falhou', erro = 'interrompido_sem_confirmacao', enviando_desde = null
   where campaign_id = c.id and status = 'enviando'
     and enviando_desde < now() - interval '15 minutes';
  get diagnostics v_presos = row_count;

  update campaigns
     set status = 'cancelada',
         ignorados = ignorados + v_ign,
         falhas = falhas + v_presos,
         concluida_em = now()
   where id = c.id;

  return jsonb_build_object(
    'status', 'cancelada',
    'ignorados_cancelamento', v_ign,
    'em_envio_agora', (select count(*) from campaign_recipients
                        where campaign_id = c.id and status = 'enviando')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPCs de SERVIÇO (rota do app / cron) — exigem o segredo interno
-- -----------------------------------------------------------------------------

-- 8c. Próximo lote. Devolve credenciais: NUNCA chamar do navegador.
create or replace function public.campanha_proximo_lote(p_secret text, p_limite int default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Constantes ajustáveis
  c_teto_24h        constant int      := 250;                 -- envios por tenant em 24h
  c_limite_max      constant int      := 40;                  -- máximo por chamada
  c_preso           constant interval := interval '15 minutes';
  c_max_tentativas  constant int      := 2;                   -- após isso, preso vira 'falhou'
  v_limite int;
  v_camps  uuid[];
  v_ids    uuid[];
  v_itens  jsonb;
  v_rest   int;
begin
  perform check_webhook_secret(p_secret);

  v_limite := least(greatest(coalesce(p_limite, 25), 1), c_limite_max);

  -- Serializa a seleção de lotes (rota e cron simultâneos): o teto por tenant
  -- é calculado e consumido sem corrida. Liberado no fim da transação.
  perform pg_advisory_xact_lock(hashtext('ivva.campanha_proximo_lote'));

  -- Campanhas elegíveis, travadas (ordem de trava: campanha -> destinatário,
  -- igual às demais RPCs, evitando deadlock). SKIP LOCKED: campanha sendo
  -- pausada/cancelada/preparada agora fica de fora deste lote.
  select coalesce(array_agg(id), '{}') into v_camps
    from (select id from campaigns
           where status = 'enviando'
              or (status = 'agendada' and coalesce(agendada_para, now()) <= now())
           order by created_at
           for update skip locked) s;

  if cardinality(v_camps) = 0 then
    return jsonb_build_object('itens', '[]'::jsonb, 'restantes', 0);
  end if;

  -- Promove agendadas vencidas.
  update campaigns
     set status = 'enviando', iniciada_em = coalesce(iniciada_em, now())
   where id = any(v_camps) and status = 'agendada';

  -- Recuperação: presos em 'enviando' (rota caiu no meio do lote).
  with presos as (
    update campaign_recipients r
       set status = case when r.tentativas >= c_max_tentativas then 'falhou' else 'pendente' end,
           erro   = case when r.tentativas >= c_max_tentativas then 'interrompido_sem_confirmacao' else r.erro end,
           enviando_desde = null
     where r.campaign_id = any(v_camps)
       and r.status = 'enviando'
       and r.enviando_desde < now() - c_preso
    returning r.campaign_id, r.status
  )
  update campaigns c
     set falhas = c.falhas + x.n
    from (select campaign_id, count(*) as n from presos where status = 'falhou' group by 1) x
   where c.id = x.campaign_id;

  -- Opt-out é reconferido NA HORA do envio (pode ter mudado após preparar).
  with ign as (
    update campaign_recipients r
       set status = 'ignorado', erro = 'sem_aceite'
      from contacts ct
     where r.campaign_id = any(v_camps)
       and r.status = 'pendente'
       and ct.id = r.contact_id and ct.tenant_id = r.tenant_id
       and not ct.aceita_mensagem_automatica
    returning r.campaign_id
  )
  update campaigns c
     set ignorados = c.ignorados + x.n
    from (select campaign_id, count(*) as n from ign group by 1) x
   where c.id = x.campaign_id;

  -- Seleção respeitando: WhatsApp ativo, pausa de qualidade, acesso do tenant
  -- e teto de 24h por tenant (enviados + em envio recente).
  with elig as (
    select r.id, r.tenant_id, r.created_at,
           row_number() over (partition by r.tenant_id order by r.created_at, r.id) as rn
      from campaign_recipients r
      join whatsapp_accounts wa on wa.tenant_id = r.tenant_id
      join tenants t on t.id = r.tenant_id
     where r.campaign_id = any(v_camps)
       and r.status = 'pendente'
       and wa.status = 'ativo'
       and (wa.automacoes_pausadas_ate is null or wa.automacoes_pausadas_ate <= now())
       and not t.acesso_bloqueado
  ),
  uso as (
    select r.tenant_id, count(*) as n
      from campaign_recipients r
     where r.tenant_id in (select distinct tenant_id from elig)
       and ((r.status = 'enviado' and r.enviado_em > now() - interval '24 hours')
            or (r.status = 'enviando' and r.enviando_desde >= now() - c_preso))
     group by 1
  )
  select coalesce(array_agg(id), '{}') into v_ids
    from (select e.id
            from elig e
            left join uso u on u.tenant_id = e.tenant_id
           where e.rn <= c_teto_24h - coalesce(u.n, 0)
           order by e.rn, e.created_at          -- intercala tenants (justo)
           limit v_limite) s;

  -- Trava e marca (SKIP LOCKED: nenhuma linha é entregue a duas chamadas).
  select coalesce(array_agg(id), '{}') into v_ids
    from (select id from campaign_recipients
           where id = any(v_ids) and status = 'pendente'
           for update skip locked) s;

  update campaign_recipients
     set status = 'enviando', enviando_desde = now(), tentativas = tentativas + 1
   where id = any(v_ids);

  -- Conclui campanhas sem nada a enviar (ex.: todos viraram opt-out).
  update campaigns c
     set status = 'concluida', concluida_em = now()
   where c.id = any(v_camps) and c.status = 'enviando'
     and not exists (select 1 from campaign_recipients r
                      where r.campaign_id = c.id and r.status in ('pendente','enviando'));

  select coalesce(jsonb_agg(jsonb_build_object(
           'recipient_id',    r.id,
           'campaign_id',     r.campaign_id,
           'tenant_id',       r.tenant_id,
           'nome',            r.nome,
           'primeiro_nome',   nullif(split_part(btrim(coalesce(r.nome, '')), ' ', 1), ''),
           'telefone',        r.telefone,
           'template_nome',   c.template_nome,
           'template_idioma', c.template_idioma,
           'usa_nome',        c.usa_nome,
           'phone_number_id', wa.phone_number_id,
           'access_token',    wa.access_token
         ) order by r.created_at), '[]'::jsonb)
    into v_itens
    from campaign_recipients r
    join campaigns c on c.id = r.campaign_id
    join whatsapp_accounts_decrypted wa on wa.tenant_id = r.tenant_id
   where r.id = any(v_ids);

  select count(*) into v_rest
    from campaign_recipients r
    join campaigns c on c.id = r.campaign_id
   where c.status = 'enviando' and r.status = 'pendente';

  return jsonb_build_object('itens', v_itens, 'restantes', v_rest);
end;
$$;

-- 8d. Registrar resultado de um envio (idempotente).
create or replace function public.campanha_registrar_envio(
  p_secret text,
  p_recipient_id uuid,
  p_ok boolean,
  p_wa_message_id text default null,
  p_erro text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c_falhas_para_pausar constant int := 10;
  v_camp   uuid;
  r        public.campaign_recipients%rowtype;
  cp       public.campaigns%rowtype;
  d_env int := 0; d_fal int := 0; d_ign int := 0;
begin
  perform check_webhook_secret(p_secret);

  if p_ok is null then
    raise exception 'p_ok é obrigatório';
  end if;

  select campaign_id into v_camp from campaign_recipients where id = p_recipient_id;
  if v_camp is null then
    return jsonb_build_object('ok', false, 'motivo', 'destinatario_nao_encontrado');
  end if;

  -- Ordem de trava: campanha -> destinatário.
  perform 1 from campaigns where id = v_camp for update;
  select * into r from campaign_recipients where id = p_recipient_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'destinatario_nao_encontrado');
  end if;

  if p_ok then
    if r.status = 'enviado' then
      return jsonb_build_object('ok', true, 'ja_registrado', true, 'status', r.status);
    end if;
    -- Confirmação tardia (a mensagem SAIU): corrige qualquer estado anterior.
    d_env := 1;
    if r.status = 'falhou'   then d_fal := -1; end if;
    if r.status = 'ignorado' then d_ign := -1; end if;
    update campaign_recipients
       set status = 'enviado', enviado_em = now(), enviando_desde = null, erro = null,
           wa_message_id = left(p_wa_message_id, 200)
     where id = r.id;
  else
    if r.status <> 'enviando' then
      return jsonb_build_object('ok', true, 'ja_registrado', true, 'status', r.status);
    end if;
    d_fal := 1;
    update campaign_recipients
       set status = 'falhou', enviando_desde = null,
           erro = left(coalesce(nullif(btrim(p_erro), ''), 'erro_desconhecido'), 500),
           wa_message_id = left(p_wa_message_id, 200)
     where id = r.id;
  end if;

  update campaigns
     set enviados  = enviados  + d_env,
         falhas    = greatest(falhas + d_fal, 0),
         ignorados = greatest(ignorados + d_ign, 0)
   where id = v_camp
  returning * into cp;

  -- Disjuntor: muitas falhas e mais falhas que sucessos -> pausa sozinha
  -- (ex.: template rejeitado, número bloqueado). Evita queimar a qualidade.
  if cp.status = 'enviando' and cp.falhas >= c_falhas_para_pausar and cp.falhas > cp.enviados then
    update campaigns set status = 'pausada', pausa_motivo = 'muitas_falhas'
     where id = v_camp returning * into cp;
  elsif cp.status = 'enviando' and not exists (
          select 1 from campaign_recipients
           where campaign_id = v_camp and status in ('pendente','enviando')) then
    update campaigns set status = 'concluida', concluida_em = now()
     where id = v_camp returning * into cp;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ja_registrado', false,
    'status', case when p_ok then 'enviado' else 'falhou' end,
    'campanha_status', cp.status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Privilégios de função
--    Supabase concede EXECUTE a anon/authenticated por padrão: revoga tudo e
--    concede o mínimo.
--    * RPCs do dono: só authenticated (a função ainda valida tenant + role).
--    * RPCs com segredo: anon + service_role, porque as rotas/cron do app usam
--      o cliente com a ANON KEY (mesmo padrão de list_pos_venda_pendentes).
--      Sem o segredo, check_webhook_secret aborta com 'not allowed'.
-- -----------------------------------------------------------------------------
revoke all on function public.campanha_preparar(uuid) from public, anon, authenticated;
revoke all on function public.campanha_iniciar(uuid)  from public, anon, authenticated;
revoke all on function public.campanha_pausar(uuid)   from public, anon, authenticated;
revoke all on function public.campanha_cancelar(uuid) from public, anon, authenticated;
grant execute on function public.campanha_preparar(uuid) to authenticated, service_role;
grant execute on function public.campanha_iniciar(uuid)  to authenticated, service_role;
grant execute on function public.campanha_pausar(uuid)   to authenticated, service_role;
grant execute on function public.campanha_cancelar(uuid) to authenticated, service_role;

revoke all on function public.campanha_proximo_lote(text, int) from public, anon, authenticated;
revoke all on function public.campanha_registrar_envio(text, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.campanha_proximo_lote(text, int) to anon, service_role;
grant execute on function public.campanha_registrar_envio(text, uuid, boolean, text, text) to anon, service_role;

commit;

-- =============================================================================
-- ROLLBACK (desfaz SÓ o que esta migração criou). ATENÇÃO: apaga etiquetas,
-- listas, campanhas e atribuições de conversa criadas depois da migração.
-- =============================================================================
-- begin;
-- drop function if exists public.campanha_registrar_envio(text, uuid, boolean, text, text);
-- drop function if exists public.campanha_proximo_lote(text, int);
-- drop function if exists public.campanha_cancelar(uuid);
-- drop function if exists public.campanha_pausar(uuid);
-- drop function if exists public.campanha_iniciar(uuid);
-- drop function if exists public.campanha_preparar(uuid);
-- drop table if exists public.campaign_recipients;
-- drop table if exists public.campaigns;          -- remove trigger e constraints junto
-- drop function if exists public.campaigns_before_write();
-- drop function if exists public.campaign_audiencia_valida(jsonb);
-- drop table if exists public.contact_list_members;
-- drop table if exists public.contact_lists;
-- drop table if exists public.contact_labels;
-- drop table if exists public.labels;
-- drop index if exists public.conversations_tenant_assigned_idx;
-- alter table public.conversations drop constraint if exists conversations_assigned_user_fk;
-- alter table public.conversations drop column if exists assigned_user_id;
-- drop index if exists public.contacts_id_tenant_uidx;
-- drop index if exists public.users_id_tenant_uidx;
-- commit;
