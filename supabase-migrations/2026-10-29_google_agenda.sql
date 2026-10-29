-- Google Agenda: o dono liga a própria agenda e os agendamentos da ivva (robô ou manual) viram eventos lá.
create table if not exists public.google_agenda_conexoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  professional_id uuid references public.professionals(id) on delete set null,
  email text,
  convidar_cliente boolean not null default false,
  ativo boolean not null default true,
  erro text,
  created_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.google_agenda_conexoes enable row level security;

-- Token fica em tabela à parte, sem nenhuma política: só as funções abaixo (com segredo) enxergam.
create table if not exists public.google_agenda_tokens (
  conexao_id uuid primary key references public.google_agenda_conexoes(id) on delete cascade,
  refresh_token_enc text not null
);
alter table public.google_agenda_tokens enable row level security;

create table if not exists public.google_agenda_eventos (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  conexao_id uuid not null references public.google_agenda_conexoes(id) on delete cascade,
  event_id text not null,
  versao text not null,
  sincronizado_em timestamptz not null default now(),
  primary key (appointment_id, conexao_id)
);
alter table public.google_agenda_eventos enable row level security;

create policy "conexoes do proprio negocio" on public.google_agenda_conexoes
  for select to authenticated
  using (tenant_id = current_tenant_id());
create policy "dono ou o proprio usuario desliga" on public.google_agenda_conexoes
  for delete to authenticated
  using (user_id = auth.uid());
create policy "ajusta a propria conexao" on public.google_agenda_conexoes
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Salva/atualiza a conexão (chamada pelo retorno do OAuth, no servidor, com segredo).
create or replace function public.google_agenda_salvar(
  p_secret text, p_tenant_id uuid, p_user_id uuid, p_email text, p_token_enc text
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_prof uuid;
begin
  perform check_webhook_secret(p_secret);
  select professional_id into v_prof from users where id = p_user_id and tenant_id = p_tenant_id;
  insert into google_agenda_conexoes (tenant_id, user_id, professional_id, email, ativo, erro)
  values (p_tenant_id, p_user_id, v_prof, p_email, true, null)
  on conflict (user_id) do update set email = excluded.email, professional_id = excluded.professional_id, ativo = true, erro = null
  returning id into v_id;
  insert into google_agenda_tokens (conexao_id, refresh_token_enc) values (v_id, p_token_enc)
  on conflict (conexao_id) do update set refresh_token_enc = excluded.refresh_token_enc;
  return v_id;
end $$;

create or replace function public.google_agenda_conexoes_ativas(p_secret text, p_tenant_id uuid default null)
returns table (id uuid, tenant_id uuid, professional_id uuid, convidar_cliente boolean, refresh_token_enc text)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
    select c.id, c.tenant_id, c.professional_id, c.convidar_cliente, t.refresh_token_enc
    from google_agenda_conexoes c join google_agenda_tokens t on t.conexao_id = c.id
    where c.ativo and (p_tenant_id is null or c.tenant_id = p_tenant_id);
end $$;

-- O que precisa ir para o Google: agendamentos novos/alterados (de 7 dias atrás a 120 à frente) e cancelados que já têm evento.
create or replace function public.google_agenda_pendencias(p_secret text, p_conexao_id uuid)
returns table (
  appointment_id uuid, acao text, event_id text, versao text,
  data_hora timestamptz, duracao_minutos int, servico text, observacoes text,
  contato_nome text, contato_telefone text, contato_email text, profissional_nome text
)
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid; v_prof uuid;
begin
  perform check_webhook_secret(p_secret);
  select c.tenant_id, c.professional_id into v_tenant, v_prof from google_agenda_conexoes c where c.id = p_conexao_id and c.ativo;
  if v_tenant is null then return; end if;
  return query
    select a.id,
      case when a.status = 'cancelado' then 'apagar' when e.event_id is null then 'criar' else 'atualizar' end,
      e.event_id,
      md5(concat_ws('|', a.data_hora, a.duracao_minutos, a.servico, a.status, ct.nome, ct.email)),
      a.data_hora, a.duracao_minutos, a.servico, a.observacoes,
      ct.nome, ct.telefone, ct.email, pr.nome
    from appointments a
    join contacts ct on ct.id = a.contact_id
    left join professionals pr on pr.id = a.professional_id
    left join google_agenda_eventos e on e.appointment_id = a.id and e.conexao_id = p_conexao_id
    where a.tenant_id = v_tenant
      and (v_prof is null or a.professional_id = v_prof)
      and a.data_hora between now() - interval '7 days' and now() + interval '120 days'
      and (
        (a.status = 'cancelado' and e.event_id is not null)
        or (a.status <> 'cancelado' and (e.event_id is null or e.versao <> md5(concat_ws('|', a.data_hora, a.duracao_minutos, a.servico, a.status, ct.nome, ct.email))))
      )
    order by a.data_hora
    limit 60;
end $$;

create or replace function public.google_agenda_marcar(
  p_secret text, p_conexao_id uuid, p_appointment_id uuid, p_event_id text, p_versao text, p_apagado boolean default false
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if p_apagado then
    delete from google_agenda_eventos where appointment_id = p_appointment_id and conexao_id = p_conexao_id;
  else
    insert into google_agenda_eventos (appointment_id, conexao_id, event_id, versao)
    values (p_appointment_id, p_conexao_id, p_event_id, p_versao)
    on conflict (appointment_id, conexao_id) do update set event_id = excluded.event_id, versao = excluded.versao, sincronizado_em = now();
  end if;
  update google_agenda_conexoes set erro = null where id = p_conexao_id;
end $$;

create or replace function public.google_agenda_erro(p_secret text, p_conexao_id uuid, p_erro text, p_desativar boolean default false)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  update google_agenda_conexoes set erro = left(p_erro, 300), ativo = case when p_desativar then false else ativo end where id = p_conexao_id;
end $$;
