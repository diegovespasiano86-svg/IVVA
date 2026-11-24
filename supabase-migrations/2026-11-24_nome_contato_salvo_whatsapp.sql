-- Nome do contato = nome salvo no WhatsApp Business do dono (coexistência), não o número.
-- Reverter: restaurar as definições anteriores de handle_inbound_whatsapp_message e whatsapp_registrar_echo_humano
-- e whatsapp_registrar_contato_sync; drop function public.nome_whatsapp_salvo(uuid, text).

create or replace function public.nome_whatsapp_salvo(p_tenant uuid, p_telefone text)
returns text
language sql stable security definer set search_path to 'public'
as $$
  select nullif(btrim(h.nome_sugerido), '')
    from whatsapp_historico_contatos h
   where h.tenant_id = p_tenant
     and nullif(btrim(h.nome_sugerido), '') is not null
     and (h.telefone = p_telefone or right(h.telefone, 8) = right(p_telefone, 8))
   order by (h.telefone = p_telefone) desc, h.updated_at desc
   limit 1;
$$;
revoke all on function public.nome_whatsapp_salvo(uuid, text) from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'handle_inbound_whatsapp_message' and p.pronamespace = 'public'::regnamespace;
  if position('coalesce(p_contact_name, p_wa_id)' in d) = 0 then raise exception 'trecho inbound não encontrado'; end if;
  execute replace(d, 'coalesce(p_contact_name, p_wa_id)', 'coalesce(nome_whatsapp_salvo(v_tenant_id, p_wa_id), nullif(p_contact_name, ''''), p_wa_id)');

  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'whatsapp_registrar_echo_humano' and p.pronamespace = 'public'::regnamespace;
  if position('coalesce(nullif(p_contact_name, ''''), p_wa_id)' in d) = 0 then raise exception 'trecho echo não encontrado'; end if;
  execute replace(d, 'coalesce(nullif(p_contact_name, ''''), p_wa_id)', 'coalesce(nome_whatsapp_salvo(v_tenant_id, p_wa_id), nullif(p_contact_name, ''''), p_wa_id)');
end $$;

-- Quando a lista de contatos chega depois da conversa: renomeia só quem ainda está com o número no nome.
create or replace function public.whatsapp_registrar_contato_sync(p_secret text, p_phone_number_id text, p_telefone text, p_nome text, p_action text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  perform check_webhook_secret(p_secret);

  select tenant_id into v_tenant_id
  from whatsapp_accounts where phone_number_id = p_phone_number_id;

  if v_tenant_id is null or p_telefone is null then
    return;
  end if;

  if p_action = 'remove' then
    return;
  end if;

  insert into whatsapp_historico_contatos (tenant_id, telefone, nome_sugerido)
  values (v_tenant_id, p_telefone, p_nome)
  on conflict (tenant_id, telefone) do update
  set nome_sugerido = coalesce(excluded.nome_sugerido, whatsapp_historico_contatos.nome_sugerido),
      updated_at = now();

  if nullif(btrim(p_nome), '') is not null then
    update contacts
       set nome = btrim(p_nome)
     where tenant_id = v_tenant_id
       and nome = telefone
       and (telefone = p_telefone or right(telefone, 8) = right(p_telefone, 8));
  end if;
end;
$$;

-- Corrige quem já entrou só com o número.
update contacts c
   set nome = s.nome
  from (
    select c2.id, nome_whatsapp_salvo(c2.tenant_id, c2.telefone) as nome
      from contacts c2
     where c2.nome = c2.telefone
  ) s
 where c.id = s.id and s.nome is not null;
