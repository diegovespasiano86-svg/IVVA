-- Leads de cadastro: os dados do cliente (nome, e-mail, WhatsApp, negócio, tipo) são gravados ANTES do pagamento.
-- Quem desistir no meio fica registrado para repescagem (futuramente via n8n lendo esta tabela).
--  * status só avança: cadastro_iniciado > pagamento_aberto > pago > conta_criada.
--  * Só administrador da plataforma lê; as gravações passam por funções com segredo.
-- Para desfazer: drop table public.leads_cadastro cascade; drop function lead_ordem, lead_registrar, lead_avancar, lead_pago;
--   e restaurar provision_tenant sem a linha que atualiza leads_cadastro.
-- (Aplicada em produção pelo MCP em 07/10/2026; este arquivo é o registro.)

create table if not exists public.leads_cadastro (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  nome_negocio text,
  segmento text,
  plano text,
  status text not null default 'cadastro_iniciado' check (status in ('cadastro_iniciado', 'pagamento_aberto', 'pago', 'conta_criada')),
  aceite_termos_em timestamptz,
  stripe_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leads_cadastro_email_uq on public.leads_cadastro (lower(email));
create index if not exists leads_cadastro_status_idx on public.leads_cadastro (status, updated_at);

alter table public.leads_cadastro enable row level security;
create policy leads_cadastro_admin_select on public.leads_cadastro for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_platform_admin));
revoke all on public.leads_cadastro from anon;

create or replace function public.lead_ordem(p_status text) returns int
language sql immutable as $$
  select case p_status when 'cadastro_iniciado' then 1 when 'pagamento_aberto' then 2 when 'pago' then 3 when 'conta_criada' then 4 else 0 end
$$;

create or replace function public.lead_registrar(
  p_secret text, p_nome text, p_email text, p_telefone text, p_nome_negocio text, p_segmento text, p_plano text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text := lower(trim(p_email));
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_id uuid;
  v_tem_conta boolean;
begin
  perform check_webhook_secret(p_secret);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'email invalido'; end if;
  if p_nome is null or length(trim(p_nome)) < 2 or length(p_nome) > 120 then raise exception 'nome invalido'; end if;
  if length(v_tel) not between 10 and 13 then raise exception 'telefone invalido'; end if;

  select exists (select 1 from auth.users where lower(email) = v_email) into v_tem_conta;

  insert into leads_cadastro (nome, email, telefone, nome_negocio, segmento, plano, aceite_termos_em)
  values (trim(p_nome), v_email, v_tel, left(trim(coalesce(p_nome_negocio, '')), 120), left(coalesce(p_segmento, ''), 40), left(coalesce(p_plano, ''), 20), now())
  on conflict (lower(email)) do update
    set nome = excluded.nome, telefone = excluded.telefone, nome_negocio = excluded.nome_negocio,
        segmento = excluded.segmento, plano = excluded.plano, aceite_termos_em = now(), updated_at = now()
  returning id into v_id;

  return jsonb_build_object('lead_id', v_id, 'tem_conta', v_tem_conta);
end;
$$;

create or replace function public.lead_avancar(p_secret text, p_email text, p_status text, p_session_id text default null)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  update leads_cadastro
     set status = case when lead_ordem(p_status) > lead_ordem(status) then p_status else status end,
         stripe_session_id = coalesce(p_session_id, stripe_session_id),
         updated_at = now()
   where lower(email) = lower(trim(p_email));
end;
$$;

create or replace function public.lead_pago(p_secret text, p_email text, p_session_id text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_stripe_webhook_secret(p_secret);
  update leads_cadastro
     set status = case when lead_ordem('pago') > lead_ordem(status) then 'pago' else status end,
         stripe_session_id = coalesce(p_session_id, stripe_session_id),
         updated_at = now()
   where lower(email) = lower(trim(p_email));
end;
$$;

-- provision_tenant: igual à versão de 2026-10-07_cadastros_pendentes.sql + baixa no lead (conta_criada).
-- (A definição completa está aplicada no banco; ver pg_get_functiondef.)
