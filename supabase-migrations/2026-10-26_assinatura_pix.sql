-- Assinatura paga no Pix pela conta Asaas da PRÓPRIA ivva (26/10/2026, pedido do Vespa).
-- Caminho alternativo ao cartão da Stripe: sem teste grátis, o 1º mês é pago na hora e as próximas cobranças
-- chegam por e-mail/SMS do Asaas. Quem paga no Pix não tem stripe_customer_id; o vínculo fica nesta tabela.
--  * ref = identificador aleatório ("pix_" + 32 hex) que faz o papel do session_id da Stripe em /bem-vindo.
--  * status: aguardando_pagamento > ativa; ativa <> vencida; qualquer um > cancelada.
--  * Bloqueio: vencida há mais de 5 dias, ou cancelada depois do período pago (função assinatura_pix_bloquear, cron diário).
--  * Só administrador da plataforma lê; as gravações passam por funções com segredo.
-- Para desfazer: drop function assinatura_pix_registrar, assinatura_pix_pendentes, assinatura_pix_ler, assinatura_pix_pago,
--   assinatura_pix_vencida, assinatura_pix_cancelada, assinatura_pix_vincular, assinatura_pix_do_tenant, assinatura_pix_bloquear;
--   drop table public.assinaturas_pix;

create table if not exists public.assinaturas_pix (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  email text not null,
  nome text,
  telefone text,
  nome_negocio text not null,
  segmento text,
  plano text not null check (plano in ('essencial', 'profissional', 'completo')),
  ciclo text not null check (ciclo in ('mensal', 'anual')),
  cpf_cnpj text not null,
  valor numeric(10, 2) not null,
  ambiente text not null check (ambiente in ('sandbox', 'producao')),
  asaas_customer_id text not null,
  asaas_subscription_id text not null unique,
  asaas_primeira_cobranca text,
  status text not null default 'aguardando_pagamento' check (status in ('aguardando_pagamento', 'ativa', 'vencida', 'cancelada')),
  pago_em timestamptz,
  pago_ate date,
  vencida_desde timestamptz,
  tenant_id uuid references public.tenants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assinaturas_pix_email_idx on public.assinaturas_pix (lower(email), status);
create index if not exists assinaturas_pix_tenant_idx on public.assinaturas_pix (tenant_id);

alter table public.assinaturas_pix enable row level security;
create policy assinaturas_pix_admin_select on public.assinaturas_pix for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_platform_admin));
revoke all on public.assinaturas_pix from anon;

-- Grava a assinatura recém-criada no Asaas (antes do pagamento).
create or replace function public.assinatura_pix_registrar(
  p_secret text, p_ref text, p_email text, p_nome text, p_telefone text, p_nome_negocio text, p_segmento text,
  p_plano text, p_ciclo text, p_cpf_cnpj text, p_valor numeric, p_ambiente text,
  p_customer text, p_subscription text, p_primeira_cobranca text
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if p_ref !~ '^pix_[0-9a-f]{32}$' then raise exception 'ref invalida'; end if;
  insert into assinaturas_pix (ref, email, nome, telefone, nome_negocio, segmento, plano, ciclo, cpf_cnpj, valor, ambiente,
                               asaas_customer_id, asaas_subscription_id, asaas_primeira_cobranca)
  values (p_ref, lower(trim(p_email)), left(trim(coalesce(p_nome, '')), 120), left(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 13),
          left(trim(p_nome_negocio), 120), left(coalesce(p_segmento, ''), 40), p_plano, p_ciclo,
          regexp_replace(p_cpf_cnpj, '\D', '', 'g'), p_valor, p_ambiente, p_customer, p_subscription, p_primeira_cobranca);
end;
$$;

-- Tentativas anteriores do mesmo e-mail ainda sem pagamento: o app cancela no Asaas antes de criar outra.
create or replace function public.assinatura_pix_pendentes(p_secret text, p_email text)
returns table (asaas_subscription_id text, ambiente text)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
    update assinaturas_pix a set status = 'cancelada', updated_at = now()
     where lower(a.email) = lower(trim(p_email)) and a.status = 'aguardando_pagamento' and a.tenant_id is null
    returning a.asaas_subscription_id, a.ambiente;
end;
$$;

-- Dados para as telas de boas-vindas (pelo ref).
create or replace function public.assinatura_pix_ler(p_secret text, p_ref text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  perform check_webhook_secret(p_secret);
  select jsonb_build_object(
           'email', email, 'nome', nome, 'nome_negocio', nome_negocio, 'segmento', segmento, 'plano', plano, 'ciclo', ciclo,
           'status', status, 'ambiente', ambiente, 'primeira_cobranca', asaas_primeira_cobranca,
           'subscription', asaas_subscription_id, 'tenant_id', tenant_id)
    into v
    from assinaturas_pix where ref = p_ref;
  return v;
end;
$$;

-- Pagamento recebido (1º ou recorrente): libera o acesso e estende o período pago.
create or replace function public.assinatura_pix_pago(p_secret text, p_subscription text, p_vencimento date)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  a assinaturas_pix%rowtype;
  v_ate date;
begin
  perform check_webhook_secret(p_secret);
  select * into a from assinaturas_pix where asaas_subscription_id = p_subscription for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desconhecida'); end if;
  v_ate := coalesce(p_vencimento, current_date) + case when a.ciclo = 'anual' then interval '1 year' else interval '1 month' end;
  update assinaturas_pix
     set status = case when status = 'cancelada' and tenant_id is null then status else 'ativa' end,
         pago_em = coalesce(pago_em, now()),
         pago_ate = greatest(coalesce(pago_ate, v_ate), v_ate),
         vencida_desde = null,
         updated_at = now()
   where id = a.id;
  if a.tenant_id is not null then
    update subscriptions set status = 'active' where tenant_id = a.tenant_id;
    update tenants set acesso_bloqueado = false where id = a.tenant_id;
  end if;
  update leads_cadastro set status = case when lead_ordem('pago') > lead_ordem(status) then 'pago' else status end, updated_at = now()
   where lower(email) = lower(a.email);
  -- primeiro = 1º pagamento e ainda sem negócio: o webhook manda o e-mail com o link para criar o acesso.
  return jsonb_build_object('ok', true, 'email', a.email, 'ref', a.ref, 'nome_negocio', a.nome_negocio, 'plano', a.plano,
                            'primeiro', a.pago_em is null and a.tenant_id is null);
end;
$$;

-- Cobrança venceu sem pagamento: marca (o bloqueio só vem depois da tolerância, no cron).
create or replace function public.assinatura_pix_vencida(p_secret text, p_subscription text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  perform check_webhook_secret(p_secret);
  update assinaturas_pix
     set status = 'vencida', vencida_desde = coalesce(vencida_desde, now()), updated_at = now()
   where asaas_subscription_id = p_subscription and status = 'ativa'
  returning tenant_id into v_tenant;
  if v_tenant is not null then
    update subscriptions set status = 'past_due' where tenant_id = v_tenant;
  end if;
end;
$$;

-- Assinatura cancelada/removida no Asaas: o acesso vale até o fim do período pago (bloqueio no cron).
create or replace function public.assinatura_pix_cancelada(p_secret text, p_subscription text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  perform check_webhook_secret(p_secret);
  update assinaturas_pix set status = 'cancelada', updated_at = now()
   where asaas_subscription_id = p_subscription and status <> 'cancelada'
  returning tenant_id into v_tenant;
  if v_tenant is not null then
    update subscriptions set status = 'canceled' where tenant_id = v_tenant;
  end if;
end;
$$;

-- Depois de montar o negócio (provision_tenant cria a assinatura como 'trial'): liga o Pix ao negócio e marca ativa.
create or replace function public.assinatura_pix_vincular(p_secret text, p_ref text, p_tenant uuid)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare a assinaturas_pix%rowtype;
begin
  perform check_webhook_secret(p_secret);
  select * into a from assinaturas_pix where ref = p_ref for update;
  if not found then raise exception 'assinatura pix desconhecida'; end if;
  if a.status not in ('ativa', 'vencida') then raise exception 'assinatura pix sem pagamento'; end if;
  if a.tenant_id is not null and a.tenant_id <> p_tenant then raise exception 'assinatura pix de outro negocio'; end if;
  update assinaturas_pix set tenant_id = p_tenant, updated_at = now() where id = a.id;
  update subscriptions set status = case when a.status = 'vencida' then 'past_due' else 'active' end where tenant_id = p_tenant;
end;
$$;

-- Tela Minha assinatura: só o dono do próprio negócio.
create or replace function public.assinatura_pix_do_tenant()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant uuid;
  v jsonb;
begin
  select u.tenant_id into v_tenant from users u where u.id = auth.uid() and u.role = 'dono';
  if v_tenant is null then return null; end if;
  select jsonb_build_object('subscription', asaas_subscription_id, 'ambiente', ambiente, 'status', status, 'ciclo', ciclo,
                            'valor', valor, 'pago_ate', pago_ate, 'vencida_desde', vencida_desde)
    into v
    from assinaturas_pix where tenant_id = v_tenant order by created_at desc limit 1;
  return v;
end;
$$;

-- Cron diário: bloqueia quem venceu há mais de 5 dias e quem cancelou e já passou do período pago.
create or replace function public.assinatura_pix_bloquear(p_secret text)
returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_qtd int;
begin
  perform check_webhook_secret(p_secret);
  with alvo as (
    select tenant_id from assinaturas_pix
     where tenant_id is not null
       and ((status = 'vencida' and vencida_desde < now() - interval '5 days')
         or (status = 'cancelada' and coalesce(pago_ate, current_date) < current_date))
  )
  update tenants t set acesso_bloqueado = true
    from alvo where t.id = alvo.tenant_id and not coalesce(t.acesso_bloqueado, false);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function public.assinatura_pix_registrar(text, text, text, text, text, text, text, text, text, text, numeric, text, text, text, text) from public;
revoke all on function public.assinatura_pix_pendentes(text, text) from public;
revoke all on function public.assinatura_pix_ler(text, text) from public;
revoke all on function public.assinatura_pix_pago(text, text, date) from public;
revoke all on function public.assinatura_pix_vencida(text, text) from public;
revoke all on function public.assinatura_pix_cancelada(text, text) from public;
revoke all on function public.assinatura_pix_vincular(text, text, uuid) from public;
revoke all on function public.assinatura_pix_bloquear(text) from public;
grant execute on function public.assinatura_pix_registrar(text, text, text, text, text, text, text, text, text, text, numeric, text, text, text, text) to anon, authenticated;
grant execute on function public.assinatura_pix_pendentes(text, text) to anon, authenticated;
grant execute on function public.assinatura_pix_ler(text, text) to anon, authenticated;
grant execute on function public.assinatura_pix_pago(text, text, date) to anon, authenticated;
grant execute on function public.assinatura_pix_vencida(text, text) to anon, authenticated;
grant execute on function public.assinatura_pix_cancelada(text, text) to anon, authenticated;
grant execute on function public.assinatura_pix_vincular(text, text, uuid) to anon, authenticated;
grant execute on function public.assinatura_pix_bloquear(text) to anon, authenticated;
revoke all on function public.assinatura_pix_do_tenant() from public, anon;
grant execute on function public.assinatura_pix_do_tenant() to authenticated;
