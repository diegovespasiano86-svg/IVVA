-- Modo "sugerir e aprovar": o robô escreve a resposta, o dono lê e aprova antes de ir para o cliente.
alter table public.bot_settings add column if not exists modo_sugerir boolean not null default false;

create table if not exists public.conversation_rascunhos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  conteudo text not null,
  fontes jsonb,
  status text not null default 'pendente' check (status in ('pendente','enviado','descartado')),
  created_at timestamptz not null default now()
);
create index if not exists conversation_rascunhos_conv_idx on public.conversation_rascunhos (conversation_id, status);
alter table public.conversation_rascunhos enable row level security;

create policy rascunhos_select on public.conversation_rascunhos for select to authenticated
  using (tenant_id = current_tenant_id());
create policy rascunhos_update on public.conversation_rascunhos for update to authenticated
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create or replace function public.bot_modo_sugerir(p_secret text, p_tenant_id uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v boolean;
begin
  perform check_webhook_secret(p_secret);
  select modo_sugerir into v from bot_settings where tenant_id = p_tenant_id;
  return coalesce(v, false);
end $$;

create or replace function public.rascunho_registrar(p_secret text, p_conversation_id uuid, p_conteudo text, p_fontes jsonb default null)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  perform check_webhook_secret(p_secret);
  select tenant_id into v_tenant from conversations where id = p_conversation_id;
  if v_tenant is null then return; end if;
  update conversation_rascunhos set status = 'descartado' where conversation_id = p_conversation_id and status = 'pendente';
  insert into conversation_rascunhos (tenant_id, conversation_id, conteudo, fontes)
  values (v_tenant, p_conversation_id, p_conteudo,
          case when jsonb_typeof(p_fontes) = 'array' and jsonb_array_length(p_fontes) > 0 then p_fontes end);
  update conversations set updated_at = now() where id = p_conversation_id;
end $$;
