-- Demonstração viva no cadastro (v2). SÓ ACRESCENTA: uma tabela e uma função novas.
-- Limita o uso público (sem login) por visitante (IP com hash) e no total do dia, para controlar custo de IA.
-- Para desfazer: drop function public.demo_registrar_uso(text, int, int); drop table public.demo_usos;

create table if not exists public.demo_usos (
  id bigint generated always as identity primary key,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index if not exists demo_usos_chave_idx on public.demo_usos (chave, criado_em desc);
create index if not exists demo_usos_criado_idx on public.demo_usos (criado_em desc);
alter table public.demo_usos enable row level security;
-- sem políticas: ninguém lê nem escreve direto; só a função abaixo (security definer)

create or replace function public.demo_registrar_uso(p_chave text, p_limite_visitante int, p_limite_dia_global int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if length(coalesce(p_chave, '')) < 8 then return false; end if;
  delete from demo_usos where criado_em < now() - interval '2 days';
  if (select count(*) from demo_usos where criado_em > now() - interval '24 hours') >= p_limite_dia_global then
    return false;
  end if;
  if (select count(*) from demo_usos where chave = p_chave and criado_em > now() - interval '1 hour') >= p_limite_visitante then
    return false;
  end if;
  insert into demo_usos (chave) values (p_chave);
  return true;
end;
$function$;

revoke all on function public.demo_registrar_uso(text, int, int) from public;
grant execute on function public.demo_registrar_uso(text, int, int) to anon, authenticated;
