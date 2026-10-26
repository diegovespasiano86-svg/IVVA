-- Aceite do contrato de prestação de serviços (popup obrigatório no primeiro acesso).
-- Uma linha por usuário e versão do contrato (src/lib/contrato.ts, CONTRATO_VERSAO).
create table if not exists public.contrato_aceites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  ip text,
  user_agent text,
  unique (user_id, versao)
);

alter table public.contrato_aceites enable row level security;

-- Cada usuário registra e consulta só o próprio aceite; o tenant precisa ser o dele.
create policy contrato_aceites_insert_proprio on public.contrato_aceites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (tenant_id is null or tenant_id = (select u.tenant_id from public.users u where u.id = (select auth.uid())))
  );

create policy contrato_aceites_select_proprio on public.contrato_aceites
  for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin));

-- Sem update/delete: o registro do aceite não muda depois de feito.
create index if not exists contrato_aceites_tenant_idx on public.contrato_aceites (tenant_id);
