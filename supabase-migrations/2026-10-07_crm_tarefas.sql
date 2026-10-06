-- Tarefas e lembretes do CRM: o dono (ou profissional) agenda "ligar para o cliente" (tarefa) ou
-- "mandar WhatsApp no dia do evento" (lembrete) para uma data. No dia, o app avisa no topo.
--  * Dono vê tudo do negócio; profissional vê e mexe só no que ele mesmo criou.
--  * Apagar o contato (LGPD) apaga suas tarefas (on delete cascade).
-- Para desfazer: drop table public.crm_tarefas;

create table if not exists public.crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  criado_por uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('tarefa', 'lembrete')),
  titulo text not null check (char_length(titulo) between 1 and 200),
  data date not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluida')),
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crm_tarefas_tenant_data_idx on public.crm_tarefas (tenant_id, status, data);
create index if not exists crm_tarefas_contact_idx on public.crm_tarefas (contact_id);

alter table public.crm_tarefas enable row level security;

create policy crm_tarefas_select on public.crm_tarefas for select
  using (tenant_id = current_tenant_id() and (current_app_role() = 'dono' or criado_por = auth.uid()));
create policy crm_tarefas_insert on public.crm_tarefas for insert
  with check (tenant_id = current_tenant_id() and criado_por = auth.uid());
create policy crm_tarefas_update on public.crm_tarefas for update
  using (tenant_id = current_tenant_id() and (current_app_role() = 'dono' or criado_por = auth.uid()))
  with check (tenant_id = current_tenant_id() and (current_app_role() = 'dono' or criado_por = auth.uid()));
create policy crm_tarefas_delete on public.crm_tarefas for delete
  using (tenant_id = current_tenant_id() and (current_app_role() = 'dono' or criado_por = auth.uid()));

revoke all on public.crm_tarefas from anon;
