-- Perfil "profissional" (usuário comum): só o administrador (dono) cadastra e configura.
-- O profissional usa agenda, conversas/SAC (ajuda quando o robô para), CRM só com a base própria,
-- estoque (ajusta quantidade) e checkout.
--
--  * contacts.professional_id: profissional responsável pelo contato. A base do CRM de um
--    profissional = contatos dele + contatos que ele já atendeu na agenda (o filtro é feito no
--    servidor, em src/lib/escopo-profissional.ts).
--  * products: só o dono cria e apaga produto; qualquer usuário do negócio ajusta (estoque no checkout).
--
-- Para desfazer:
--   alter table public.contacts drop column professional_id;
--   drop policy products_select on public.products; drop policy products_insert_owner on public.products;
--   drop policy products_update on public.products; drop policy products_delete_owner on public.products;
--   create policy products_all on public.products for all using (tenant_id = current_tenant_id());

alter table public.contacts
  add column if not exists professional_id uuid references public.professionals(id) on delete set null;
create index if not exists contacts_professional_idx on public.contacts (tenant_id, professional_id)
  where professional_id is not null;

drop policy if exists products_all on public.products;
create policy products_select on public.products for select
  using (tenant_id = current_tenant_id());
create policy products_insert_owner on public.products for insert
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');
create policy products_update on public.products for update
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
create policy products_delete_owner on public.products for delete
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono');
