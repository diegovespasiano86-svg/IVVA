-- Vocabulário personalizado por negócio (ex.: "Outro tipo de negócio" chama Cliente de "Hóspede").
-- Guarda só o que o dono mudou; o resto vem do padrão do nicho (src/lib/termos.ts).
-- Para desfazer: alter table public.tenants drop column termos;
alter table public.tenants add column if not exists termos jsonb;

-- O app só pode alterar colunas liberadas explicitamente na tabela tenants (plano e demais ficam protegidos).
-- Libera só o vocabulário e os dados do Pix; a política de linha continua valendo (só o administrador do negócio).
-- Para desfazer: revoke update (termos, pix_chave, pix_beneficiario, pix_cidade) on public.tenants from authenticated;
grant update (termos, pix_chave, pix_beneficiario, pix_cidade) on public.tenants to authenticated;
