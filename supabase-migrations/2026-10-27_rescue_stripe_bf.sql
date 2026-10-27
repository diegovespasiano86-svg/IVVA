-- Rescue, fim da fase 1:
--  1. Avisos da Stripe (cancelamento agendado, cartão recusado, fim do teste) viram caso do Rescue, uma vez por evento.
--  2. Lista VIP da Black Friday (inscrição pelo site, liberação antecipada em 20/11).

-- 1. Evento da Stripe -> caso do Rescue. Devolve os dados do cliente só na primeira vez (a Stripe repete avisos).
create unique index if not exists rescue_eventos_chave_idx on public.rescue_eventos ((detalhe ->> 'chave')) where detalhe ? 'chave';

create or replace function public.rescue_evento_stripe(p_secret text, p_customer text, p_tipo text, p_chave text, p_detalhe jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant uuid;
  v_out jsonb;
begin
  perform check_stripe_webhook_secret(p_secret);
  select s.tenant_id into v_tenant from subscriptions s where s.stripe_customer_id = p_customer order by s.created_at desc limit 1;
  if v_tenant is null then return null; end if;
  if exists (select 1 from rescue_eventos e where e.detalhe ->> 'chave' = p_chave) then return null; end if;

  select jsonb_build_object(
           'tenant_id', t.id, 'negocio', t.nome, 'segmento', t.segmento,
           'plano', coalesce(t.plano_contratado, t.plano), 'dono_nome', d.nome, 'dono_email', lower(d.email),
           'preenchido', exists (select 1 from knowledge_base k where k.tenant_id = t.id)
                          or exists (select 1 from professionals p where p.tenant_id = t.id),
           'conversas_30d', (select count(*) from conversations c where c.tenant_id = t.id and c.created_at > now() - interval '30 days'),
           'agendamentos_30d', (select count(*) from appointments a where a.tenant_id = t.id and a.created_at > now() - interval '30 days'))
    into v_out
    from tenants t
    left join lateral (select u.nome, u.email from users u where u.tenant_id = t.id and u.role = 'dono' order by u.created_at limit 1) d on true
   where t.id = v_tenant;

  insert into rescue_eventos (tenant_id, email, tipo, canal, detalhe)
  values (v_tenant, v_out ->> 'dono_email', p_tipo, 'email', coalesce(p_detalhe, '{}'::jsonb) || jsonb_build_object('chave', p_chave))
  on conflict do nothing;
  return v_out;
end $$;

-- 2. Lista VIP da Black Friday -----------------------------------------------------------------------------
create table if not exists public.lista_vip (
  id uuid primary key default gen_random_uuid(),
  campanha text not null default 'black-friday-2026',
  nome text,
  email text not null,
  telefone text,
  segmento text,
  aceita_whatsapp boolean not null default false,
  origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campanha, email)
);
alter table public.lista_vip enable row level security;
drop policy if exists lista_vip_admin_select on public.lista_vip;
create policy lista_vip_admin_select on public.lista_vip for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_platform_admin));
revoke all on public.lista_vip from anon;

create or replace function public.lista_vip_inscrever(p_secret text, p_campanha text, p_nome text, p_email text, p_telefone text,
                                                     p_segmento text, p_aceita_whatsapp boolean, p_origem jsonb)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  insert into lista_vip (campanha, nome, email, telefone, segmento, aceita_whatsapp, origem)
  values (left(p_campanha, 40), left(p_nome, 80), lower(left(trim(p_email), 120)), left(p_telefone, 20), left(p_segmento, 40),
          coalesce(p_aceita_whatsapp, false), coalesce(p_origem, '{}'::jsonb))
  on conflict (campanha, email) do update
     set nome = excluded.nome, telefone = coalesce(excluded.telefone, lista_vip.telefone),
         aceita_whatsapp = lista_vip.aceita_whatsapp or excluded.aceita_whatsapp;
  return true;
end $$;
