-- Chave "Atendo empresas (B2B)" por negócio: só então o campo Empresa aparece no CRM e o robô pergunta.
-- Reverter: alter table public.bot_settings drop column usa_empresa; drop function public.ia_usa_empresa(text, uuid); drop function public.ia_definir_empresa(text, uuid, uuid, text);
alter table public.bot_settings add column if not exists usa_empresa boolean not null default false;

create or replace function public.ia_usa_empresa(p_secret text, p_tenant_id uuid)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform check_webhook_secret(p_secret);
  return coalesce((select usa_empresa from bot_settings where tenant_id = p_tenant_id), false);
end;
$$;
revoke all on function public.ia_usa_empresa(text, uuid) from public, anon, authenticated;
grant execute on function public.ia_usa_empresa(text, uuid) to anon;

create or replace function public.ia_definir_empresa(p_secret text, p_contact_id uuid, p_tenant_id uuid, p_empresa text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform check_webhook_secret(p_secret);
  if nullif(btrim(coalesce(p_empresa, '')), '') is null then return; end if;
  if not coalesce((select usa_empresa from bot_settings where tenant_id = p_tenant_id), false) then return; end if;
  update contacts set empresa = left(btrim(p_empresa), 120)
   where id = p_contact_id and tenant_id = p_tenant_id and nullif(btrim(coalesce(empresa, '')), '') is null;
end;
$$;
revoke all on function public.ia_definir_empresa(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ia_definir_empresa(text, uuid, uuid, text) to anon;
