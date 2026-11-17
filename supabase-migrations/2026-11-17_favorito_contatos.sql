-- 17/11/2026 — Estrela de favorito nos contatos do CRM.
-- NÃO aplicada ainda: depende do OK do dono (altera o banco de produção).
-- Aplicar ANTES do deploy do código: o CRM passa a selecionar contacts.favorito.
alter table public.contacts add column if not exists favorito boolean not null default false;
