-- Correção: a IA não achava preços na base de conhecimento.
-- Causa: ia_consultar_catalogo procurava a frase INTEIRA digitada pela IA como pedaço de texto
-- (conteudo ilike '%frase%'). Buscas naturais como "serviços", "preços", "valores" ou
-- "quanto custa" voltavam vazias, e a IA, sem informação, chamava a equipe logo na 1ª pergunta.
--
-- Agora:
--  * a busca é por palavras (sem acento, sem maiúsculas), ignorando palavras genéricas;
--  * ranqueia pelas palavras encontradas e devolve até 8 itens da base e 8 produtos
--    (o limite antigo não funcionava: estava aplicado ao agregado, não às linhas);
--  * se nada casar (ou a pergunta for genérica, como "valores"), devolve os 12 primeiros
--    itens da base em vez de vazio, para a IA ter o que responder. Negócios pequenos têm
--    poucas dezenas de itens, então é pouco texto.
-- O formato da resposta não mudou ('produtos' e 'base_conhecimento'); só acrescenta 'modo'.
--
-- Para desfazer: recriar a função com a definição anterior (busca por frase inteira):
--   select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'conteudo', conteudo)), '[]'::jsonb)
--   from knowledge_base where tenant_id = p_tenant_id and conteudo ilike '%' || p_busca || '%';

create or replace function public.ia_consultar_catalogo(p_secret text, p_tenant_id uuid, p_busca text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_norm text;
  v_tokens text[];
  v_produtos jsonb;
  v_base jsonb;
  v_modo text := 'busca';
begin
  perform check_webhook_secret(p_secret);

  v_norm := translate(lower(coalesce(p_busca, '')),
                      'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  select coalesce(array_agg(distinct t), '{}') into v_tokens
  from regexp_split_to_table(v_norm, '[^a-z0-9$]+') as t
  where length(t) >= 3
    and t <> all (array[
      'que','quais','qual','quanto','quantos','como','tem','voce','voces','vcs','para','por','com','uma','uns',
      'dos','das','nos','nas','sao','esta','tudo','mais','pode','ser','fazem','fazer','custa','custam','custo',
      'valor','valores','preco','precos','servico','servicos','oi','ola','bom','dia','tarde','noite','gostaria',
      'saber','sobre','queria','quero','algum','alguma']);

  if coalesce(array_length(v_tokens, 1), 0) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'conteudo', x.conteudo)), '[]'::jsonb) into v_base
    from (
      select k.tipo, k.conteudo
      from knowledge_base k
      where k.tenant_id = p_tenant_id
        and exists (
          select 1 from unnest(v_tokens) tk
          where translate(lower(k.conteudo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%' || tk || '%')
      order by (
          select count(*) from unnest(v_tokens) tk
          where translate(lower(k.conteudo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%' || tk || '%') desc,
        k.created_at
      limit 8
    ) x;

    select coalesce(jsonb_agg(jsonb_build_object('nome', y.nome, 'categoria', y.categoria, 'preco', y.preco)), '[]'::jsonb) into v_produtos
    from (
      select p.nome, p.categoria, p.preco
      from products p
      where p.tenant_id = p_tenant_id
        and exists (
          select 1 from unnest(v_tokens) tk
          where translate(lower(p.nome || ' ' || coalesce(p.categoria, '')),
                          'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%' || tk || '%')
      order by p.nome
      limit 8
    ) y;
  else
    v_base := '[]'::jsonb;
    v_produtos := '[]'::jsonb;
  end if;

  -- Pergunta genérica ou sem resultado: devolve o começo da base, em vez de nada.
  if jsonb_array_length(v_base) = 0 and jsonb_array_length(v_produtos) = 0 then
    v_modo := 'geral';
    select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'conteudo', x.conteudo)), '[]'::jsonb) into v_base
    from (select k.tipo, k.conteudo from knowledge_base k where k.tenant_id = p_tenant_id order by k.created_at limit 12) x;
    select coalesce(jsonb_agg(jsonb_build_object('nome', y.nome, 'categoria', y.categoria, 'preco', y.preco)), '[]'::jsonb) into v_produtos
    from (select p.nome, p.categoria, p.preco from products p where p.tenant_id = p_tenant_id order by p.nome limit 8) y;
  end if;

  return jsonb_build_object('produtos', v_produtos, 'base_conhecimento', v_base, 'modo', v_modo);
end;
$function$;
