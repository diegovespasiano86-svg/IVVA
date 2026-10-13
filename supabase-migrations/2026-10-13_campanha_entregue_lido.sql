-- Campanhas: guarda quando a Meta avisou que a mensagem foi entregue e lida.
-- Só acrescenta (colunas novas e uma função). Nada existente muda.

alter table public.campaign_recipients
  add column if not exists entregue_em timestamptz,
  add column if not exists lido_em timestamptz;

-- Chamado pelo webhook com os avisos de status da Meta: [{ "id": "wamid...", "status": "delivered" | "read" }]
create or replace function public.campanha_registrar_status(p_secret text, p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  it jsonb;
  n int := 0;
  v int;
begin
  perform check_webhook_secret(p_secret);
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    return 0;
  end if;

  for it in select * from jsonb_array_elements(p_itens) limit 200 loop
    if coalesce(it->>'id', '') = '' or it->>'status' not in ('delivered', 'read') then
      continue;
    end if;
    update public.campaign_recipients
       set entregue_em = coalesce(entregue_em, now()),
           lido_em = case when it->>'status' = 'read' then coalesce(lido_em, now()) else lido_em end
     where wa_message_id = it->>'id';
    get diagnostics v = row_count;
    n := n + v;
  end loop;
  return n;
end;
$function$;

revoke all on function public.campanha_registrar_status(text, jsonb) from public;
grant execute on function public.campanha_registrar_status(text, jsonb) to anon, service_role;
