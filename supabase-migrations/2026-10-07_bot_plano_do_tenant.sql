-- Informa o plano do negócio ao robô do WhatsApp (que fala com o banco só por funções protegidas pelo segredo),
-- para ele não oferecer recursos que o plano não inclui (lista de espera, cancelar pelo chat, Pix de sinal).
create or replace function public.bot_plano_do_tenant(p_secret text, p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_webhook_secret(p_secret);
  return (select plano from public.tenants where id = p_tenant_id);
end;
$$;
revoke all on function public.bot_plano_do_tenant(text, uuid) from public;
grant execute on function public.bot_plano_do_tenant(text, uuid) to anon, authenticated;
