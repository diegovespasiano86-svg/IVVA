-- IVVA BLACK: entrada sem cartão. 60 dias no plano Essencial; o cartão (R$ 0) é cadastrado durante o período.
-- Sem cartão até o fim, a IA para de responder (os dados ficam). Um período grátis por e-mail e por WhatsApp.

create table if not exists public.testes_gratis (
  id uuid primary key default gen_random_uuid(),
  -- "set null": mesmo apagando a conta, o e-mail e o WhatsApp continuam marcados como já usados.
  tenant_id uuid unique references public.tenants(id) on delete set null,
  email text not null,
  telefone text not null,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  cartao_em timestamptz,
  avisos text[] not null default '{}',
  aceite_em timestamptz
);
create unique index if not exists testes_gratis_email on public.testes_gratis (lower(email));
create unique index if not exists testes_gratis_telefone on public.testes_gratis (telefone);

alter table public.testes_gratis enable row level security;
drop policy if exists testes_gratis_ler on public.testes_gratis;
create policy testes_gratis_ler on public.testes_gratis for select to authenticated
  using (tenant_id in (select u.tenant_id from public.users u where u.id = auth.uid()));

create or replace function public.teste_gratis_telefone(p text) returns text
language sql immutable as $$ select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 11) $$;

create or replace function public.teste_gratis_livre(p_secret text, p_email text, p_telefone text)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if exists (select 1 from testes_gratis where lower(email) = lower(trim(p_email))) then return 'email_usado'; end if;
  if exists (select 1 from testes_gratis where telefone = teste_gratis_telefone(p_telefone)) then return 'telefone_usado'; end if;
  return 'livre';
end $$;

-- Monta o negócio de quem confirmou o e-mail. Só a própria pessoa logada, uma vez.
create or replace function public.teste_gratis_criar(
  p_secret text, p_user_id uuid, p_nome_negocio text, p_user_nome text, p_segmento text,
  p_telefone text, p_aceite_em timestamptz, p_conhecimento text[] default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text;
  v_confirmado timestamptz;
  v_criado timestamptz;
  v_tel text := teste_gratis_telefone(p_telefone);
  v_tenant uuid;
begin
  perform check_webhook_secret(p_secret);
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'not allowed'; end if;
  select lower(email), email_confirmed_at, created_at into v_email, v_confirmado, v_criado from auth.users where id = p_user_id;
  if v_confirmado is null then raise exception 'email nao confirmado'; end if;
  if v_criado >= timestamptz '2027-01-01 00:00:00-03' then raise exception 'campanha encerrada'; end if;
  if length(v_tel) < 10 then raise exception 'telefone invalido'; end if;
  perform pg_advisory_xact_lock(hashtext('teste_gratis:' || v_tel));
  select tenant_id into v_tenant from users where id = p_user_id;
  if v_tenant is not null then return v_tenant; end if;
  if exists (select 1 from testes_gratis where lower(email) = v_email) then raise exception 'email ja usou'; end if;
  if exists (select 1 from testes_gratis where telefone = v_tel) then raise exception 'telefone ja usou'; end if;

  v_tenant := provision_tenant(p_secret, p_nome_negocio, 'essencial', null, p_user_id, p_user_nome, v_email, p_segmento, p_conhecimento);

  insert into testes_gratis (tenant_id, email, telefone, fim, aceite_em)
  values (v_tenant, v_email, v_tel,
          (((now() at time zone 'America/Sao_Paulo')::date + 60) + time '23:59') at time zone 'America/Sao_Paulo',
          p_aceite_em);
  return v_tenant;
end $$;

create or replace function public.teste_gratis_ativar_cartao(p_secret text, p_tenant_id uuid, p_customer text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if coalesce(p_customer, '') = '' then raise exception 'cliente invalido'; end if;
  update testes_gratis set cartao_em = coalesce(cartao_em, now()) where tenant_id = p_tenant_id;
  if not found then raise exception 'sem teste'; end if;
  update subscriptions set stripe_customer_id = p_customer where tenant_id = p_tenant_id;
  update tenants set acesso_bloqueado = false where id = p_tenant_id;
end $$;

-- Avisos que vencem hoje (rotina diária): relatório no dia 30, lembretes do cartão em 45, 52 e 57, e o fim.
create or replace function public.teste_gratis_avisos(p_secret text)
returns table (tenant_id uuid, email text, nome text, negocio text, etapa text, fim timestamptz, tem_cartao boolean,
               conversas bigint, agendamentos bigint)
language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  perform check_webhook_secret(p_secret);
  return query
  with base as (
    select g.tenant_id, g.email, g.fim, g.avisos, g.cartao_em is not null as tem_cartao,
           case
             when now() > g.fim then 'fim'
             when now() >= g.inicio + interval '57 days' then 'dia57'
             when now() >= g.inicio + interval '52 days' then 'dia52'
             when now() >= g.inicio + interval '45 days' then 'dia45'
             when now() >= g.inicio + interval '30 days' then 'dia30'
           end as etapa
    from testes_gratis g
    where g.tenant_id is not null and g.fim > now() - interval '7 days'
  )
  select b.tenant_id, b.email, d.nome, t.nome, b.etapa, b.fim, b.tem_cartao,
         (select count(*) from conversations c where c.tenant_id = b.tenant_id),
         (select count(*) from appointments a where a.tenant_id = b.tenant_id)
  from base b
  join tenants t on t.id = b.tenant_id
  left join lateral (select u.nome from users u where u.tenant_id = b.tenant_id and u.role = 'dono' order by u.created_at limit 1) d on true
  where b.etapa is not null and not (b.etapa = any (b.avisos)) and (b.etapa = 'dia30' or not b.tem_cartao)
  limit 50;
end $$;

create or replace function public.teste_gratis_aviso_marcar(p_secret text, p_tenant_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  update testes_gratis set avisos = array_append(avisos, p_etapa) where tenant_id = p_tenant_id and not (p_etapa = any (avisos));
end $$;

-- Trava única da IA: teste encerrado sem cartão não consome nem responde.
do $mig$
declare
  v_def text := pg_get_functiondef('public.ia_consumir_conversa(text,uuid,uuid,jsonb,integer,integer)'::regprocedure);
  v_ancora text := 'perform check_webhook_secret(p_secret);';
begin
  if position('teste_encerrado' in v_def) > 0 then return; end if;
  if position(v_ancora in v_def) = 0 then raise exception 'ancora nao encontrada'; end if;
  execute replace(v_def, v_ancora, v_ancora || $novo$

  if exists (select 1 from testes_gratis g where g.tenant_id = p_tenant_id and g.cartao_em is null and g.fim < now()) then
    return jsonb_build_object('permitido', false, 'motivo', 'teste_encerrado');
  end if;$novo$);
end $mig$;

revoke all on function public.teste_gratis_livre(text, text, text) from public;
revoke all on function public.teste_gratis_criar(text, uuid, text, text, text, text, timestamptz, text[]) from public, anon;
revoke all on function public.teste_gratis_ativar_cartao(text, uuid, text) from public;
revoke all on function public.teste_gratis_avisos(text) from public;
revoke all on function public.teste_gratis_aviso_marcar(text, uuid, text) from public;
grant execute on function public.teste_gratis_livre(text, text, text) to anon, authenticated;
grant execute on function public.teste_gratis_criar(text, uuid, text, text, text, text, timestamptz, text[]) to authenticated;
grant execute on function public.teste_gratis_ativar_cartao(text, uuid, text) to anon, authenticated;
grant execute on function public.teste_gratis_avisos(text) to anon, authenticated;
grant execute on function public.teste_gratis_aviso_marcar(text, uuid, text) to anon, authenticated;
