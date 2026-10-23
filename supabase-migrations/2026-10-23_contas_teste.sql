-- Contas de teste sem cartão (check final de 23/10/2026). Autorizado pelo Vespa em chat.
-- Só e-mails cadastrados em contas_teste (pela equipe, direto no banco) conseguem montar um negócio sem passar pelo Stripe.
-- A tabela não tem política (ninguém lê pelo app) e a função só funciona para quem está logado e está na lista.
-- Remover depois do teste: drop function public.provisionar_conta_teste(text); drop table public.contas_teste;
-- (Aplicada em produção pelo MCP; este arquivo é o registro.)

create table if not exists public.contas_teste (
  email text primary key,
  plano text not null check (plano in ('essencial', 'profissional', 'completo')),
  nome_negocio text not null,
  segmento text not null default 'clinica-estetica',
  criado_em timestamptz not null default now()
);
alter table public.contas_teste enable row level security;

create or replace function public.provisionar_conta_teste(p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_conta public.contas_teste%rowtype;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  select * into v_conta from public.contas_teste where lower(email) = v_email;
  if not found then
    raise exception 'e-mail não autorizado para conta de teste';
  end if;
  return public.provision_tenant(
    p_secret, v_conta.nome_negocio, v_conta.plano, null, v_uid, v_conta.nome_negocio, v_email, v_conta.segmento, null
  );
end;
$$;

revoke all on function public.provisionar_conta_teste(text) from public, anon;
grant execute on function public.provisionar_conta_teste(text) to authenticated;
