-- Trilha de auditoria das importações. A tabela eventos só tem política de leitura, então o app não conseguia gravar nela.
-- SÓ ACRESCENTA uma função: grava no negócio do próprio usuário, só o dono, só tipos de importação.
-- Para desfazer: drop function public.evento_auditoria(text, jsonb);

create or replace function public.evento_auditoria(p_tipo text, p_detalhe jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if current_tenant_id() is null or current_app_role() is distinct from 'dono' then raise exception 'sem_permissao'; end if;
  if p_tipo not in ('importacao_clientes', 'importacao_vendas', 'importacao_vendas_desfeita') then raise exception 'tipo_invalido'; end if;
  insert into eventos (tenant_id, tipo, detalhe) values (current_tenant_id(), p_tipo, coalesce(p_detalhe, '{}'::jsonb));
end; $f$;

revoke all on function public.evento_auditoria(text, jsonb) from public, anon;
grant execute on function public.evento_auditoria(text, jsonb) to authenticated;
