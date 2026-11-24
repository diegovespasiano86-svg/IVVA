-- Convite IVVA BLACK 60 dias: confere se quem está assinando entrou na lista /60-dias (mesmo e-mail ou WhatsApp)
-- e marca acesso_enviado_em. Usado por src/app/planos/actions.ts (link app.ivva.app.br/planos?convite=black60).
create or replace function public.lista60_confere(p_secret text, p_email text, p_telefone text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_tel text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 11);
begin
  perform check_webhook_secret(p_secret);
  select id into v_id
    from lista_vip
   where campanha = 'lista-60-dias'
     and (lower(trim(email)) = lower(trim(p_email))
          or (length(v_tel) >= 10 and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_tel))
   order by created_at
   limit 1;
  if v_id is null then
    return false;
  end if;
  update lista_vip set acesso_enviado_em = coalesce(acesso_enviado_em, now()) where id = v_id;
  return true;
end;
$$;
revoke all on function public.lista60_confere(text, text, text) from public;
grant execute on function public.lista60_confere(text, text, text) to anon, authenticated;
