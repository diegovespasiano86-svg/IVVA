-- API para Zapier/n8n/formularios (v2). SÓ ACRESCENTA: uma tabela e quatro funções.
-- O dono cria uma chave; quem tem a chave cria contatos no CRM do negócio (POST /api/v1/contatos).
-- A chave só aparece uma vez; o banco guarda apenas o hash (sha256).
-- Para desfazer: drop function public.api_chave_criar(text), public.api_chave_listar(), public.api_chave_revogar(uuid), public.api_contato_criar(text,text,text,text,text);
--                drop table public.api_chaves;

create table if not exists public.api_chaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  prefixo text not null,
  hash text not null unique,
  criada_em timestamptz not null default now(),
  ultimo_uso timestamptz,
  revogada_em timestamptz
);
alter table public.api_chaves enable row level security;

create or replace function public.api_chave_criar(p_nome text)
returns text language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_t uuid; v_chave text;
begin
  select u.tenant_id into v_t from users u where u.id = auth.uid() and u.role = 'dono';
  if v_t is null then raise exception 'sem permissao'; end if;
  if (select count(*) from api_chaves where tenant_id = v_t and revogada_em is null) >= 5 then raise exception 'limite de chaves'; end if;
  v_chave := 'ivva_' || encode(gen_random_bytes(24), 'hex');
  insert into api_chaves (tenant_id, nome, prefixo, hash)
  values (v_t, left(coalesce(nullif(trim(p_nome), ''), 'Chave'), 60), left(v_chave, 9), encode(digest(v_chave, 'sha256'), 'hex'));
  return v_chave;
end; $f$;

create or replace function public.api_chave_listar()
returns table (id uuid, nome text, prefixo text, criada_em timestamptz, ultimo_uso timestamptz)
language sql security definer set search_path to 'public' as $f$
  select k.id, k.nome, k.prefixo, k.criada_em, k.ultimo_uso from api_chaves k
  where k.revogada_em is null and k.tenant_id = (select u.tenant_id from users u where u.id = auth.uid() and u.role = 'dono')
  order by k.criada_em desc;
$f$;

create or replace function public.api_chave_revogar(p_id uuid)
returns void language sql security definer set search_path to 'public' as $f$
  update api_chaves set revogada_em = now()
  where id = p_id and tenant_id = (select u.tenant_id from users u where u.id = auth.uid() and u.role = 'dono');
$f$;

-- Chamada pelo servidor do app (com o segredo interno): confere o hash da chave e cria o contato.
create or replace function public.api_contato_criar(p_secret text, p_hash text, p_nome text, p_telefone text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v_k api_chaves%rowtype; v_tel text; v_id uuid;
begin
  perform check_webhook_secret(p_secret);
  select * into v_k from api_chaves where hash = p_hash and revogada_em is null;
  if v_k.id is null then return jsonb_build_object('ok', false, 'motivo', 'chave_invalida'); end if;
  v_tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_tel) between 10 and 11 then v_tel := '55' || v_tel; end if;
  if not (length(v_tel) in (12, 13) and left(v_tel, 2) = '55') or length(trim(coalesce(p_nome, ''))) < 2 then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;
  update api_chaves set ultimo_uso = now() where id = v_k.id;
  select id into v_id from contacts where tenant_id = v_k.tenant_id and telefone = v_tel limit 1;
  if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id, 'criado', false); end if;
  insert into contacts (tenant_id, nome, telefone, email, como_conheceu)
  values (v_k.tenant_id, left(trim(p_nome), 120), v_tel, nullif(left(trim(coalesce(p_email, '')), 200), ''), 'api')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'criado', true);
end; $f$;

revoke all on function public.api_chave_criar(text), public.api_chave_listar(), public.api_chave_revogar(uuid), public.api_contato_criar(text,text,text,text,text) from public;
grant execute on function public.api_chave_criar(text), public.api_chave_listar(), public.api_chave_revogar(uuid) to authenticated;
grant execute on function public.api_contato_criar(text,text,text,text,text) to anon, authenticated;
