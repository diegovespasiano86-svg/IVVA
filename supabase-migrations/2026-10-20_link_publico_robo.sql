-- Link público do robô (v2). SÓ ACRESCENTA: duas colunas e três funções novas.
-- O dono liga/desliga; o visitante conversa com o robô sem login, só com a base de conhecimento do negócio.
-- Para desfazer: drop function public.robo_publico_definir(boolean), public.robo_publico_estado(), public.robo_publico_contexto(text);
--                alter table public.tenants drop column link_publico_ativo, drop column link_publico_codigo;

alter table public.tenants add column if not exists link_publico_ativo boolean not null default false;
alter table public.tenants add column if not exists link_publico_codigo text;
create unique index if not exists tenants_link_publico_codigo_key on public.tenants (link_publico_codigo) where link_publico_codigo is not null;

create or replace function public.robo_publico_estado()
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v_t uuid; v_r jsonb;
begin
  select u.tenant_id into v_t from users u where u.id = auth.uid() and u.role = 'dono';
  if v_t is null then return null; end if;
  select jsonb_build_object('ativo', link_publico_ativo, 'codigo', link_publico_codigo) into v_r from tenants where id = v_t;
  return v_r;
end; $f$;

create or replace function public.robo_publico_definir(p_ativo boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v_t uuid;
begin
  select u.tenant_id into v_t from users u where u.id = auth.uid() and u.role = 'dono';
  if v_t is null then raise exception 'sem permissao'; end if;
  update tenants set link_publico_ativo = p_ativo,
    link_publico_codigo = coalesce(link_publico_codigo, substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 10))
  where id = v_t;
  return robo_publico_estado();
end; $f$;

create or replace function public.robo_publico_contexto(p_codigo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare v_t tenants%rowtype;
begin
  select * into v_t from tenants where link_publico_codigo = lower(trim(p_codigo)) and link_publico_ativo;
  if v_t.id is null then return null; end if;
  return jsonb_build_object(
    'negocio', v_t.nome,
    'assistente', coalesce(v_t.identidade_assistente->>'nome_assistente', ''),
    'fatos', coalesce((select jsonb_agg(conteudo) from (select conteudo from knowledge_base where tenant_id = v_t.id order by created_at limit 80) k), '[]'::jsonb)
  );
end; $f$;

revoke all on function public.robo_publico_estado(), public.robo_publico_definir(boolean), public.robo_publico_contexto(text) from public;
grant execute on function public.robo_publico_estado(), public.robo_publico_definir(boolean) to authenticated;
grant execute on function public.robo_publico_contexto(text) to anon, authenticated;
