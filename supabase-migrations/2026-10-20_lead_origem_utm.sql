-- Origem do cadastro (UTM e indicador). SÓ ACRESCENTA: uma coluna e uma função.
-- Para desfazer: drop function public.lead_origem(text, text, jsonb); alter table public.leads_cadastro drop column origem;

alter table public.leads_cadastro add column if not exists origem jsonb;

create or replace function public.lead_origem(p_secret text, p_email text, p_origem jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  perform check_webhook_secret(p_secret);
  update leads_cadastro set origem = p_origem where lower(email) = lower(trim(p_email)) and origem is null;
end; $f$;

revoke all on function public.lead_origem(text, text, jsonb) from public;
grant execute on function public.lead_origem(text, text, jsonb) to anon, authenticated;
