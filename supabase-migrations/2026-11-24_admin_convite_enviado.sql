-- Registra que o convite foi enviado pelo botão do quadro /admin/clientes.
-- Reverter: drop function public.admin_lista_marcar_enviado(uuid);
create or replace function public.admin_lista_marcar_enviado(p_lead uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  update lista_vip set acesso_enviado_em = now() where id = p_lead and campanha = 'lista-60-dias';
end;
$$;
revoke all on function public.admin_lista_marcar_enviado(uuid) from public, anon;
grant execute on function public.admin_lista_marcar_enviado(uuid) to authenticated;
