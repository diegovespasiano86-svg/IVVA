-- Limite mensal de conversas atendidas pela IA, por cliente (tenant).
-- Mudança só ADITIVA: tabelas e funções novas + 1 coluna opcional em tenants.
-- Nada existente é alterado ou apagado.
--
-- Regras (valores dos planos ficam em src/lib/planos.ts e chegam como parâmetro):
--  * "Conversa" = janela de 24h por contato. Várias respostas da IA na mesma janela
--    contam como UMA conversa (teto de respostas por conversa para barrar laços).
--  * Ciclo MENSAL (mês-calendário em America/Sao_Paulo): soma o mês inteiro, zera no dia 1º.
--  * Ordem de consumo ao abrir uma conversa nova: plano -> crédito avulso -> folga (%) -> bloqueia.
--  * Avisos de 80%, 90% e 100% do limite do plano, uma vez por ciclo cada.
--  * tenants.limite_conversas_mes (opcional) sobrepõe o limite do plano (cliente negociado).
--  * O app envia a tabela de limites por plano (jsonb) e o banco escolhe pelo plano do cliente.
--
-- Para desfazer:
--   drop function if exists public.ia_consumir_conversa(text,uuid,uuid,jsonb,int,int);
--   drop function if exists public.ia_uso_resumo(jsonb,int);
--   drop function if exists public.admin_ia_uso_overview();
--   drop function if exists public.ia_creditos_pendentes();
--   drop function if exists public.ia_creditos_registrar_compra(text,uuid,text,int,int);
--   drop function if exists public.ia_creditos_confirmar(text,text);
--   drop table if exists public.ia_janelas, public.ia_creditos_compras, public.ia_creditos_saldo, public.ia_uso_ciclo;
--   alter table public.tenants drop column if exists limite_conversas_mes;

alter table public.tenants
  add column if not exists limite_conversas_mes integer
  check (limite_conversas_mes is null or limite_conversas_mes >= 0);

-- Consumo do mês, por cliente.
create table if not exists public.ia_uso_ciclo (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  ciclo        date not null,                 -- 1º dia do mês (America/Sao_Paulo)
  usado_plano  integer not null default 0 check (usado_plano >= 0),
  usado_extra  integer not null default 0 check (usado_extra >= 0),
  usado_folga  integer not null default 0 check (usado_folga >= 0),
  bloqueios    integer not null default 0 check (bloqueios >= 0),
  aviso_max    integer not null default 0 check (aviso_max in (0, 80, 90, 100)),
  primary key (tenant_id, ciclo)
);

-- Saldo de conversas avulsas compradas (não expira).
create table if not exists public.ia_creditos_saldo (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  saldo         integer not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now()
);

-- Compras de pacote avulso (uma linha por checkout da Stripe; idempotente pelo id da sessão).
create table if not exists public.ia_creditos_compras (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  stripe_session_id text not null unique,
  conversas         integer not null check (conversas > 0),
  valor_centavos    integer not null check (valor_centavos > 0),
  status            text not null default 'pendente' check (status in ('pendente', 'pago')),
  created_at        timestamptz not null default now(),
  pago_em           timestamptz
);
create index if not exists ia_creditos_compras_tenant_idx on public.ia_creditos_compras (tenant_id, status);

-- Janelas de conversa de 24h por contato.
create table if not exists public.ia_janelas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  inicio     timestamptz not null default now(),
  fim        timestamptz not null,
  respostas  integer not null default 1,
  fonte      text not null check (fonte in ('plano', 'extra', 'folga'))
);
create index if not exists ia_janelas_busca_idx on public.ia_janelas (tenant_id, contact_id, fim desc);

-- Sem política de acesso direto (como ia_uso_diario): leitura e escrita só pelas funções abaixo.
alter table public.ia_uso_ciclo enable row level security;
alter table public.ia_creditos_saldo enable row level security;
alter table public.ia_creditos_compras enable row level security;
alter table public.ia_janelas enable row level security;

-- Chamada pelo servidor (webhook do WhatsApp) ANTES de cada resposta da IA.
-- Devolve se pode responder e, quando um limiar de 80/90/100% é cruzado pela 1ª vez no mês,
-- o nível em nivel_aviso_novo.
create or replace function public.ia_consumir_conversa(
  p_secret text,
  p_tenant_id uuid,
  p_contact_id uuid,
  p_limites jsonb,
  p_folga_pct integer,
  p_max_respostas integer
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ciclo date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_limite integer;
  v_uso public.ia_uso_ciclo%rowtype;
  v_jan public.ia_janelas%rowtype;
  v_saldo integer;
  v_folga_max integer;
  v_fonte text;
  v_pct integer;
  v_nivel_novo integer := 0;
begin
  perform check_webhook_secret(p_secret);

  if p_limites is null or jsonb_typeof(p_limites) <> 'object'
     or p_folga_pct is null or p_folga_pct < 0 or p_folga_pct > 100
     or p_max_respostas is null or p_max_respostas < 1 then
    raise exception 'parametros invalidos';
  end if;

  -- Limite do cliente: valor negociado (tenants.limite_conversas_mes) ou o do plano dele
  -- (tabela recebida do app); plano desconhecido cai no menor (essencial).
  select coalesce(t.limite_conversas_mes, (p_limites ->> t.plano)::integer, (p_limites ->> 'essencial')::integer)
  into v_limite
  from tenants t where t.id = p_tenant_id;
  if not found or v_limite is null or v_limite < 0 then
    return jsonb_build_object('permitido', false, 'motivo', 'tenant_nao_encontrado');
  end if;

  insert into ia_uso_ciclo (tenant_id, ciclo) values (p_tenant_id, v_ciclo)
  on conflict (tenant_id, ciclo) do nothing;
  select * into v_uso from ia_uso_ciclo where tenant_id = p_tenant_id and ciclo = v_ciclo for update;

  select coalesce(saldo, 0) into v_saldo from ia_creditos_saldo where tenant_id = p_tenant_id;
  v_saldo := coalesce(v_saldo, 0);

  -- Conversa já aberta nas últimas 24h com esse contato: não consome crédito novo.
  select * into v_jan
  from ia_janelas
  where tenant_id = p_tenant_id and contact_id = p_contact_id and fim > now()
  order by inicio desc limit 1
  for update;

  if found then
    if v_jan.respostas >= p_max_respostas then
      return jsonb_build_object(
        'permitido', false, 'motivo', 'limite_respostas_conversa',
        'usado_plano', v_uso.usado_plano, 'limite', v_limite, 'saldo_extra', v_saldo
      );
    end if;
    update ia_janelas set respostas = respostas + 1 where id = v_jan.id;
    return jsonb_build_object(
      'permitido', true, 'nova_conversa', false, 'nivel_aviso_novo', 0,
      'usado_plano', v_uso.usado_plano, 'limite', v_limite, 'saldo_extra', v_saldo,
      'em_folga', v_uso.usado_folga > 0
    );
  end if;

  -- Conversa nova: plano -> avulso -> folga -> bloqueio.
  v_folga_max := ceil(v_limite * p_folga_pct / 100.0);

  if v_uso.usado_plano < v_limite then
    v_fonte := 'plano';
    update ia_uso_ciclo set usado_plano = usado_plano + 1
      where tenant_id = p_tenant_id and ciclo = v_ciclo
      returning * into v_uso;
  elsif v_saldo > 0 then
    v_fonte := 'extra';
    update ia_creditos_saldo set saldo = saldo - 1, atualizado_em = now() where tenant_id = p_tenant_id;
    v_saldo := v_saldo - 1;
    update ia_uso_ciclo set usado_extra = usado_extra + 1
      where tenant_id = p_tenant_id and ciclo = v_ciclo
      returning * into v_uso;
  elsif v_uso.usado_folga < v_folga_max then
    v_fonte := 'folga';
    update ia_uso_ciclo set usado_folga = usado_folga + 1
      where tenant_id = p_tenant_id and ciclo = v_ciclo
      returning * into v_uso;
  else
    update ia_uso_ciclo set bloqueios = bloqueios + 1
      where tenant_id = p_tenant_id and ciclo = v_ciclo
      returning * into v_uso;
    return jsonb_build_object(
      'permitido', false, 'motivo', 'limite_mes',
      'usado_plano', v_uso.usado_plano, 'limite', v_limite, 'saldo_extra', v_saldo
    );
  end if;

  insert into ia_janelas (tenant_id, contact_id, fim, respostas, fonte)
  values (p_tenant_id, p_contact_id, now() + interval '24 hours', 1, v_fonte);

  -- Limiares de aviso (sobre o limite do plano), uma vez por mês cada.
  v_pct := case when v_limite = 0 then 100 else floor(v_uso.usado_plano * 100.0 / v_limite)::integer end;
  v_nivel_novo := case when v_pct >= 100 then 100 when v_pct >= 90 then 90 when v_pct >= 80 then 80 else 0 end;
  if v_nivel_novo > v_uso.aviso_max then
    update ia_uso_ciclo set aviso_max = v_nivel_novo where tenant_id = p_tenant_id and ciclo = v_ciclo;
  else
    v_nivel_novo := 0;
  end if;

  return jsonb_build_object(
    'permitido', true, 'nova_conversa', true, 'fonte', v_fonte, 'nivel_aviso_novo', v_nivel_novo,
    'usado_plano', v_uso.usado_plano, 'limite', v_limite, 'saldo_extra', v_saldo,
    'em_folga', v_fonte = 'folga' or v_uso.usado_folga > 0
  );
end;
$function$;

-- Resumo para o painel (usuário logado do próprio negócio).
create or replace function public.ia_uso_resumo(p_limites jsonb, p_folga_pct integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_t uuid := current_tenant_id();
  v_ciclo date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_limite integer;
  v_uso public.ia_uso_ciclo%rowtype;
  v_saldo integer;
  v_pct integer;
begin
  if v_t is null or p_limites is null or jsonb_typeof(p_limites) <> 'object' or p_folga_pct is null or p_folga_pct < 0 then
    return null;
  end if;

  select coalesce(t.limite_conversas_mes, (p_limites ->> t.plano)::integer, (p_limites ->> 'essencial')::integer)
  into v_limite from tenants t where t.id = v_t;
  if v_limite is null then return null; end if;
  select * into v_uso from ia_uso_ciclo where tenant_id = v_t and ciclo = v_ciclo;
  select coalesce(saldo, 0) into v_saldo from ia_creditos_saldo where tenant_id = v_t;
  v_saldo := coalesce(v_saldo, 0);

  v_pct := case when v_limite = 0 then 100
                else floor(coalesce(v_uso.usado_plano, 0) * 100.0 / v_limite)::integer end;

  return jsonb_build_object(
    'limite', v_limite,
    'usado_plano', coalesce(v_uso.usado_plano, 0),
    'usado_extra', coalesce(v_uso.usado_extra, 0),
    'usado_folga', coalesce(v_uso.usado_folga, 0),
    'folga_max', ceil(v_limite * p_folga_pct / 100.0)::integer,
    'saldo_extra', v_saldo,
    'percentual', v_pct,
    'bloqueios', coalesce(v_uso.bloqueios, 0),
    'renova_em', ((v_ciclo + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
  );
end;
$function$;

-- Servidor registra o início de uma compra (antes de mandar o cliente pagar).
create or replace function public.ia_creditos_registrar_compra(
  p_secret text, p_tenant_id uuid, p_stripe_session_id text, p_conversas integer, p_valor_centavos integer
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform check_webhook_secret(p_secret);
  if p_conversas is null or p_conversas < 1 or p_valor_centavos is null or p_valor_centavos < 1
     or p_stripe_session_id is null or length(p_stripe_session_id) < 5 then
    raise exception 'parametros invalidos';
  end if;
  insert into ia_creditos_compras (tenant_id, stripe_session_id, conversas, valor_centavos)
  values (p_tenant_id, p_stripe_session_id, p_conversas, p_valor_centavos)
  on conflict (stripe_session_id) do nothing;
end;
$function$;

-- Servidor confirma o pagamento (depois de ler a sessão paga na Stripe). Idempotente:
-- chamar de novo para a mesma sessão não credita duas vezes.
create or replace function public.ia_creditos_confirmar(p_secret text, p_stripe_session_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c public.ia_creditos_compras%rowtype;
begin
  perform check_webhook_secret(p_secret);

  select * into v_c from ia_creditos_compras where stripe_session_id = p_stripe_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'compra_nao_encontrada');
  end if;
  if v_c.status = 'pago' then
    return jsonb_build_object('ok', true, 'ja_creditado', true, 'conversas', v_c.conversas, 'tenant_id', v_c.tenant_id);
  end if;

  update ia_creditos_compras set status = 'pago', pago_em = now() where id = v_c.id;
  insert into ia_creditos_saldo (tenant_id, saldo) values (v_c.tenant_id, v_c.conversas)
  on conflict (tenant_id) do update
    set saldo = ia_creditos_saldo.saldo + excluded.saldo, atualizado_em = now();

  return jsonb_build_object('ok', true, 'ja_creditado', false, 'conversas', v_c.conversas, 'tenant_id', v_c.tenant_id);
end;
$function$;

-- Compras ainda não confirmadas do próprio negócio (para conferir na Stripe ao voltar do pagamento).
create or replace function public.ia_creditos_pendentes()
returns table (stripe_session_id text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.stripe_session_id
  from ia_creditos_compras c
  where c.tenant_id = current_tenant_id() and c.status = 'pendente'
    and c.created_at > now() - interval '3 days';
$function$;

-- Permissões: funções com p_secret ficam executáveis pelo servidor (anon + segredo interno),
-- como as demais; as de usuário logado só para authenticated.
revoke execute on function public.ia_uso_resumo(jsonb, integer) from public, anon;
grant  execute on function public.ia_uso_resumo(jsonb, integer) to authenticated, service_role;
revoke execute on function public.ia_creditos_pendentes() from public, anon;
grant  execute on function public.ia_creditos_pendentes() to authenticated, service_role;

-- Visão do administrador da plataforma: uso do mês de cada cliente (somente leitura).
create or replace function public.admin_ia_uso_overview()
returns table (
  tenant_id uuid, usado_plano integer, usado_extra integer, usado_folga integer,
  bloqueios integer, saldo_extra integer, limite_override integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_ciclo date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from users where id = auth.uid() and is_platform_admin) then
    raise exception 'not allowed';
  end if;
  return query
  select t.id,
         coalesce(u.usado_plano, 0), coalesce(u.usado_extra, 0), coalesce(u.usado_folga, 0),
         coalesce(u.bloqueios, 0), coalesce(s.saldo, 0), t.limite_conversas_mes
  from tenants t
  left join ia_uso_ciclo u on u.tenant_id = t.id and u.ciclo = v_ciclo
  left join ia_creditos_saldo s on s.tenant_id = t.id;
end;
$function$;
revoke execute on function public.admin_ia_uso_overview() from public, anon;
grant  execute on function public.admin_ia_uso_overview() to authenticated, service_role;
