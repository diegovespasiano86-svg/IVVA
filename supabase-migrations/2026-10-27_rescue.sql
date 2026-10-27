-- Rescue (agente de retenção da ivva), fase 1. Aplica DEPOIS de 2026-10-27_recuperar_cadastro.sql.
--  1. Histórico de tudo o que o Rescue fez (rescue_eventos), visível só para o admin da plataforma.
--  2. Acompanhamento do preenchimento: negócio com 5+ dias sem preencher nada recebe contato a cada 5 dias.
--  3. Presente "30 dias do plano acima": plano bônus com prazo, que a sincronização com a Stripe respeita.
--  4. Indique e ganhe: 1 mês do plano de quem indica por indicado pagante, até 6 meses.
-- Funções protegidas pela senha interna (check_webhook_secret), como as demais rotinas do cron.

-- 1. Histórico ------------------------------------------------------------------------------------------------
create table if not exists public.rescue_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  email text,
  tipo text not null,          -- cadastro_abandonado | onboarding_parado | presente | bonus_aplicado | bonus_encerrado
  etapa int not null default 1,
  canal text not null,         -- email | whatsapp_manual | sistema
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rescue_eventos_tenant_idx on public.rescue_eventos (tenant_id, tipo, created_at desc);
alter table public.rescue_eventos enable row level security;
drop policy if exists rescue_eventos_admin_select on public.rescue_eventos;
create policy rescue_eventos_admin_select on public.rescue_eventos for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_platform_admin));
revoke all on public.rescue_eventos from anon;

create or replace function public.rescue_registrar(p_secret text, p_tenant uuid, p_email text, p_tipo text, p_etapa int, p_canal text, p_detalhe jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  insert into rescue_eventos (tenant_id, email, tipo, etapa, canal, detalhe)
  values (p_tenant, lower(p_email), p_tipo, coalesce(p_etapa, 1), p_canal, coalesce(p_detalhe, '{}'::jsonb));
end $$;

-- 2. Preenchimento parado ---------------------------------------------------------------------------------
-- "Não preencheu nada" = sem base de conhecimento, sem profissionais e sem ajuste do robô.
-- Etapa = dias de conta / 5 (dia 5 → 1, dia 10 → 2 ...), até a etapa 6 (dia 30); depois disso fica só no /admin.
create or replace function public.rescue_onboarding_parados(p_secret text)
returns table (tenant_id uuid, negocio text, segmento text, plano text, dono_nome text, dono_email text, telefone text, dias int, etapa int)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
  with base as (
    select t.id, t.nome, t.segmento, t.plano,
           (extract(epoch from now() - t.created_at) / 86400)::int as dias,
           u.nome as dono_nome, lower(u.email) as dono_email
      from tenants t
      join lateral (select u.nome, u.email from users u where u.tenant_id = t.id and u.role = 'dono' order by u.created_at limit 1) u on true
     where coalesce(t.acesso_bloqueado, false) = false
       and t.created_at <= now() - interval '5 days'
       and not exists (select 1 from users a where a.tenant_id = t.id and a.is_platform_admin)
       and not exists (select 1 from knowledge_base k where k.tenant_id = t.id)
       and not exists (select 1 from professionals p where p.tenant_id = t.id)
       and not exists (select 1 from bot_settings b where b.tenant_id = t.id)
  )
  select b.id, b.nome, b.segmento, b.plano, b.dono_nome, b.dono_email,
         (select l.telefone from leads_cadastro l where lower(l.email) = b.dono_email order by l.created_at desc limit 1),
         b.dias, least(b.dias / 5, 6)
    from base b
   where not exists (
     select 1 from rescue_eventos e
      where e.tenant_id = b.id and e.tipo = 'onboarding_parado' and e.canal = 'email' and e.etapa >= least(b.dias / 5, 6)
   )
   limit 50;
end $$;

-- 3. Plano bônus (presente "30 dias do plano acima") --------------------------------------------------------
alter table public.tenants
  add column if not exists plano_contratado text,
  add column if not exists plano_bonus text,
  add column if not exists plano_bonus_ate timestamptz;

create or replace function public.plano_ordem(p text) returns int
language sql immutable as $$
  select case p when 'essencial' then 1 when 'profissional' then 2 when 'completo' then 3 else 0 end
$$;

-- A Stripe continua mandando no plano contratado; durante o bônus, o plano em uso fica no bônus se ele for maior.
create or replace function public.sincronizar_plano_tenant(p_secret text, p_tenant_id uuid, p_plano text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_bonus text;
  v_ate timestamptz;
  v_uso text;
begin
  perform check_webhook_secret(p_secret);
  select plano_bonus, plano_bonus_ate into v_bonus, v_ate from tenants where id = p_tenant_id;
  v_uso := case when v_ate > now() and plano_ordem(v_bonus) > plano_ordem(p_plano) then v_bonus else p_plano end;
  update tenants set plano = v_uso, plano_contratado = p_plano where id = p_tenant_id;
  update subscriptions set plano = p_plano where tenant_id = p_tenant_id;
end $$;

-- Liga o bônus uma vez por negócio (o e-mail do dono escolheu o presente no site).
create or replace function public.rescue_bonus_pendentes(p_secret text)
returns table (tenant_id uuid, dono_email text, plano text)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
  select t.id, lower(u.email), t.plano
    from tenants t
    join users u on u.tenant_id = t.id and u.role = 'dono'
    join leads_cadastro l on lower(l.email) = lower(u.email)
   where l.origem ->> 'presente' = 'upgrade'
     and t.plano_bonus is null
     and t.plano <> 'completo'
     and not exists (select 1 from rescue_eventos e where e.tenant_id = t.id and e.tipo = 'bonus_aplicado');
end $$;

create or replace function public.rescue_aplicar_bonus(p_secret text, p_tenant uuid, p_dias int)
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  v_atual text;
  v_bonus text;
begin
  perform check_webhook_secret(p_secret);
  select coalesce(plano_contratado, plano) into v_atual from tenants where id = p_tenant;
  v_bonus := case v_atual when 'essencial' then 'profissional' when 'profissional' then 'completo' else null end;
  if v_bonus is null then return null; end if;
  update tenants
     set plano_contratado = v_atual, plano_bonus = v_bonus,
         plano_bonus_ate = now() + make_interval(days => greatest(1, least(p_dias, 31))), plano = v_bonus
   where id = p_tenant;
  insert into rescue_eventos (tenant_id, tipo, canal, detalhe)
  values (p_tenant, 'bonus_aplicado', 'sistema', jsonb_build_object('de', v_atual, 'para', v_bonus, 'dias', p_dias));
  return v_bonus;
end $$;

-- Bônus vencido: volta ao plano contratado (a conta e os dados ficam iguais).
create or replace function public.rescue_encerrar_bonus(p_secret text)
returns int
language plpgsql security definer set search_path to 'public' as $$
declare
  n int;
begin
  perform check_webhook_secret(p_secret);
  with fim as (
    update tenants
       set plano = coalesce(plano_contratado, plano), plano_bonus = null
     where plano_bonus is not null and plano_bonus_ate <= now()
    returning id
  )
  insert into rescue_eventos (tenant_id, tipo, canal) select id, 'bonus_encerrado', 'sistema' from fim;
  get diagnostics n = row_count;
  return n;
end $$;

-- 4. Indique e ganhe: 1 mês grátis por indicado pagante, até 6 -------------------------------------------
drop function if exists public.indicacoes_a_pagar(text);
create or replace function public.indicacoes_a_pagar(p_secret text)
returns table (indicacao_id uuid, valor_centavos integer, indicador_customer_id text, indicado_customer_id text,
               indicado_desde timestamptz, indicador_plano text, pagas_do_indicador int)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);

  update indicacoes i
     set status = 'expirada', motivo = 'nao_virou_cliente', resolvida_em = now()
   where i.status = 'aguardando'
     and i.created_at < now() - interval '60 days'
     and not exists (select 1 from users u where lower(u.email) = i.email_indicado);

  return query
  select i.id, i.valor_centavos,
         (select s.stripe_customer_id from subscriptions s where s.tenant_id = i.tenant_indicador_id order by s.created_at desc limit 1),
         sub.stripe_customer_id,
         sub.created_at,
         (select coalesce(t.plano_contratado, t.plano) from tenants t where t.id = i.tenant_indicador_id),
         (select count(*)::int from indicacoes p where p.tenant_indicador_id = i.tenant_indicador_id and p.status = 'paga')
    from indicacoes i
    join users u on lower(u.email) = i.email_indicado
    join lateral (
      select s.stripe_customer_id, s.created_at from subscriptions s where s.tenant_id = u.tenant_id order by s.created_at desc limit 1
    ) sub on true
   where i.status = 'aguardando'
     and sub.created_at <= now() - interval '30 days';
end $$;

-- Guarda o valor que foi de fato creditado (o mês do plano de quem indicou).
create or replace function public.indicacao_resolver(p_secret text, p_id uuid, p_status text, p_motivo text, p_valor int)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if p_status not in ('paga', 'recusada') then raise exception 'status inválido'; end if;
  update indicacoes set status = p_status, motivo = left(p_motivo, 80), resolvida_em = now(),
         valor_centavos = coalesce(p_valor, valor_centavos)
   where id = p_id and status = 'aguardando';
end $$;

-- 5. Painel do Rescue no /admin: cada negócio com os passos feitos e o último contato do Rescue -----------
create or replace function public.rescue_painel()
returns table (tenant_id uuid, negocio text, segmento text, plano text, plano_bonus text, plano_bonus_ate timestamptz,
               dono_nome text, dono_email text, telefone text, dias int,
               whatsapp boolean, conhecimento int, profissionais int, robo boolean, agendamentos int, conversas_7d int,
               ultimo_contato timestamptz, contatos int, presente text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from users u where u.id = auth.uid() and u.is_platform_admin) then
    raise exception 'acesso negado';
  end if;
  return query
  select t.id, t.nome, t.segmento, t.plano, t.plano_bonus, t.plano_bonus_ate,
         d.nome, lower(d.email),
         (select l.telefone from leads_cadastro l where lower(l.email) = lower(d.email) order by l.created_at desc limit 1),
         (extract(epoch from now() - t.created_at) / 86400)::int,
         exists (select 1 from whatsapp_accounts w where w.tenant_id = t.id and w.status = 'ativo'),
         (select count(*)::int from knowledge_base k where k.tenant_id = t.id),
         (select count(*)::int from professionals p where p.tenant_id = t.id),
         exists (select 1 from bot_settings b where b.tenant_id = t.id),
         (select count(*)::int from appointments a where a.tenant_id = t.id),
         (select count(*)::int from conversations c where c.tenant_id = t.id and c.created_at > now() - interval '7 days'),
         (select max(e.created_at) from rescue_eventos e where e.tenant_id = t.id and e.tipo = 'onboarding_parado'),
         (select count(*)::int from rescue_eventos e where e.tenant_id = t.id and e.tipo = 'onboarding_parado'),
         (select l.origem ->> 'presente' from leads_cadastro l where lower(l.email) = lower(d.email) order by l.created_at desc limit 1)
    from tenants t
    left join lateral (select u.nome, u.email from users u where u.tenant_id = t.id and u.role = 'dono' order by u.created_at limit 1) d on true
   where not exists (select 1 from users a where a.tenant_id = t.id and a.is_platform_admin)
   order by t.created_at desc
   limit 300;
end $$;
