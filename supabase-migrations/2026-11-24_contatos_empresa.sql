-- Empresa do contato (aparece em itálico abaixo do nome nos cards do CRM).
-- Reverter: alter table public.contacts drop column empresa;
alter table public.contacts add column if not exists empresa text;
