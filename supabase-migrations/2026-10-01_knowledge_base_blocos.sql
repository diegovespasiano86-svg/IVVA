-- Base de conhecimento em blocos por tema (etapa 3 da reforma de UX).
-- Mudança só ADITIVA: duas colunas novas e opcionais. Nada é apagado nem
-- renomeado; as 65 linhas atuais continuam iguais (categoria = null => "Geral").
-- A busca da IA (ia_consultar_catalogo) lê só `conteudo`, então não muda.

alter table public.knowledge_base
  add column if not exists categoria text,
  add column if not exists titulo text;

-- Só valores conhecidos (ou null), para a tela agrupar sem surpresa.
alter table public.knowledge_base
  drop constraint if exists knowledge_base_categoria_check;
alter table public.knowledge_base
  add constraint knowledge_base_categoria_check
  check (categoria is null or categoria in
    ('servicos','precos','horarios','pagamento','politicas','promocoes','equipe','faq','outros'));

-- Agrupamento rápido por negócio e tema.
create index if not exists knowledge_base_tenant_categoria_idx
  on public.knowledge_base (tenant_id, categoria);

-- Para desfazer (se algum dia precisar):
--   alter table public.knowledge_base drop column categoria, drop column titulo;
