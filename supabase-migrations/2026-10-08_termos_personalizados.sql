-- Vocabulário personalizado por negócio (ex.: "Outro tipo de negócio" chama Cliente de "Hóspede").
-- Guarda só o que o dono mudou; o resto vem do padrão do nicho (src/lib/termos.ts).
-- Para desfazer: alter table public.tenants drop column termos;
alter table public.tenants add column if not exists termos jsonb;
