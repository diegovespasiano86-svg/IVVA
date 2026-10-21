-- Histórico de vendas importado de planilha. SÓ ACRESCENTA: duas colunas com padrão (as linhas atuais continuam como 'checkout').
-- origem: de onde veio o pagamento. importacao_id: agrupa o lote, para poder desfazer a importação inteira.
-- Para desfazer: drop index public.payments_importacao_idx; alter table public.payments drop column importacao_id, drop column origem;

alter table public.payments add column if not exists origem text not null default 'checkout';
alter table public.payments add column if not exists importacao_id uuid;

create index if not exists payments_importacao_idx on public.payments (tenant_id, importacao_id) where importacao_id is not null;
