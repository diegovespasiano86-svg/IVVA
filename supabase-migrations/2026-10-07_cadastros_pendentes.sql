-- Cadastro automático: quando o pagamento entra na Stripe (checkout.session.completed), o sistema registra
-- o cadastro como "pendente" e avisa o cliente por e-mail (link para finalizar). Assim quem paga e fecha a aba
-- (ou cai em erro) não fica sem acesso, e a ivva é avisada se algo travar.
--  * status: aguardando (e-mail enviado, falta o cliente criar a senha), concluido (negócio criado),
--    conta_existente (o e-mail do pagamento já tem conta: precisa de ação humana).
--  * Só administrador da plataforma lê; as gravações passam por funções com segredo.
-- Para desfazer:
--   drop table public.cadastros_pendentes cascade;
--   (e restaurar provision_tenant sem a linha de update de cadastros_pendentes)

create table if not exists public.cadastros_pendentes (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_customer_id text,
  email text not null,
  nome_negocio text,
  plano text,
  status text not null default 'aguardando' check (status in ('aguardando', 'concluido', 'conta_existente')),
  email_enviado_em timestamptz,
  alerta_enviado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cadastros_pendentes_status_idx on public.cadastros_pendentes (status, created_at);
create index if not exists cadastros_pendentes_customer_idx on public.cadastros_pendentes (stripe_customer_id);

alter table public.cadastros_pendentes enable row level security;
create policy cadastros_pendentes_admin_select on public.cadastros_pendentes for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_platform_admin));
revoke all on public.cadastros_pendentes from anon;

-- Registra o pagamento. Devolve o estado e se é a primeira vez que o vemos (o e-mail só sai uma vez).
create or replace function public.cadastro_pendente_registrar(
  p_secret text, p_session_id text, p_customer_id text, p_email text, p_nome text, p_plano text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_status text;
  v_novo boolean := false;
begin
  perform check_stripe_webhook_secret(p_secret);
  if p_session_id is null or p_email is null then
    raise exception 'dados invalidos';
  end if;

  select id, status into v_id, v_status from cadastros_pendentes where stripe_session_id = p_session_id;
  if v_id is null then
    v_novo := true;
    if p_customer_id is not null and exists (select 1 from subscriptions where stripe_customer_id = p_customer_id) then
      v_status := 'concluido';
    elsif exists (select 1 from auth.users where lower(email) = lower(p_email)) then
      v_status := 'conta_existente';
    else
      v_status := 'aguardando';
    end if;
    insert into cadastros_pendentes (stripe_session_id, stripe_customer_id, email, nome_negocio, plano, status, concluido_em)
    values (p_session_id, p_customer_id, lower(p_email), p_nome, p_plano, v_status, case when v_status = 'concluido' then now() end);
  end if;

  return jsonb_build_object('status', v_status, 'novo', v_novo);
end;
$$;

-- Marca como enviado o e-mail ao cliente.
create or replace function public.cadastro_pendente_email_enviado(p_secret text, p_session_id text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_stripe_webhook_secret(p_secret);
  update cadastros_pendentes set email_enviado_em = now() where stripe_session_id = p_session_id;
end;
$$;

-- Lista (e marca como alertados) os cadastros que seguem sem conclusão depois de 30 min.
create or replace function public.cadastros_pendentes_para_alertar(p_secret text)
returns table (email text, nome_negocio text, plano text, status text, criado_em timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_stripe_webhook_secret(p_secret);
  return query
  with alvo as (
    update cadastros_pendentes c
       set alerta_enviado_em = now()
     where c.status in ('aguardando', 'conta_existente')
       and c.alerta_enviado_em is null
       and c.created_at < now() - interval '30 minutes'
    returning c.email, c.nome_negocio, c.plano, c.status, c.created_at
  )
  select a.email, a.nome_negocio, a.plano, a.status, a.created_at from alvo a order by a.created_at;
end;
$$;

-- provision_tenant: igual ao anterior, e dá baixa no cadastro pendente do mesmo cliente da Stripe.
create or replace function public.provision_tenant(
  p_secret text, p_nome text, p_plano text, p_stripe_customer_id text, p_user_id uuid, p_user_nome text,
  p_user_email text, p_segmento text default null, p_conhecimento_inicial text[] default null
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant_id uuid;
  v_auth_uid uuid := auth.uid();
  v_user_created_at timestamptz;
begin
  perform check_webhook_secret(p_secret);
  if v_auth_uid is not null then
    if p_user_id <> v_auth_uid then raise exception 'not allowed'; end if;
  else
    select created_at into v_user_created_at from auth.users where id = p_user_id;
    if v_user_created_at is null or v_user_created_at < now() - interval '10 minutes' then
      raise exception 'not allowed';
    end if;
    if exists (select 1 from users where id = p_user_id) then raise exception 'not allowed'; end if;
  end if;

  insert into tenants (nome, plano, segmento) values (p_nome, p_plano, p_segmento) returning id into v_tenant_id;
  insert into subscriptions (tenant_id, stripe_customer_id, plano, status) values (v_tenant_id, p_stripe_customer_id, p_plano, 'trial');
  insert into users (id, tenant_id, nome, email, role) values (p_user_id, v_tenant_id, p_user_nome, p_user_email, 'dono');

  if p_conhecimento_inicial is not null and array_length(p_conhecimento_inicial, 1) > 0 then
    insert into knowledge_base (tenant_id, tipo, conteudo)
    select v_tenant_id, 'template', item from unnest(p_conhecimento_inicial) as item;
  end if;

  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = p_user_id;

  if p_stripe_customer_id is not null then
    update cadastros_pendentes set status = 'concluido', concluido_em = now()
     where stripe_customer_id = p_stripe_customer_id and status <> 'concluido';
  end if;
  return v_tenant_id;
end;
$$;
