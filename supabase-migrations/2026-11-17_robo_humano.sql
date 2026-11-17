-- Robô x atendimento humano (17/11/2026)
--  1) Quando o administrador responde pelo celular (coexistência, evento smb_message_echoes),
--     a conversa vai para "humano" na hora e o robô para de responder.
--  2) Contato pode ser "só humano" (robo_modo = observa | ignora) ou ficar silenciado até uma data
--     (robo_silenciado_ate). O robô não responde enquanto valer um dos dois.
-- Alteração compatível: o código antigo continua funcionando.

alter table contacts
  add column if not exists robo_modo text not null default 'atende',
  add column if not exists robo_silenciado_ate timestamptz;

alter table contacts drop constraint if exists contacts_robo_modo_check;
alter table contacts
  add constraint contacts_robo_modo_check check (robo_modo in ('atende', 'observa', 'ignora'));

alter table conversations
  add column if not exists humano_ultima_em timestamptz;

-- Registra no histórico a mensagem que o administrador mandou pelo celular e pausa o robô.
create or replace function public.whatsapp_registrar_echo_humano(
  p_secret text,
  p_phone_number_id text,
  p_wa_id text,
  p_wa_message_id text,
  p_content text,
  p_contact_name text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_contact record;
  v_conv record;
begin
  perform check_webhook_secret(p_secret);

  select tenant_id into v_tenant_id
  from whatsapp_accounts
  where phone_number_id = p_phone_number_id;

  if v_tenant_id is null then
    return jsonb_build_object('erro', 'tenant_nao_encontrado');
  end if;

  if p_wa_message_id is not null and exists (select 1 from messages where wa_message_id = p_wa_message_id) then
    return jsonb_build_object('ignorado', 'ja_registrada');
  end if;

  select * into v_contact from contacts where tenant_id = v_tenant_id and telefone = p_wa_id;

  if v_contact is null then
    insert into contacts (tenant_id, nome, telefone, status_funil, tipo_relacionamento)
    values (v_tenant_id, coalesce(nullif(p_contact_name, ''), p_wa_id), p_wa_id, 'sem_contato', 'novo')
    returning * into v_contact;
  end if;

  select * into v_conv
  from conversations
  where tenant_id = v_tenant_id and contact_id = v_contact.id and status <> 'encerrada'
  order by created_at desc
  limit 1;

  if v_conv is null then
    insert into conversations (tenant_id, contact_id, status, handoff_motivo, handoff_em, humano_ultima_em)
    values (v_tenant_id, v_contact.id, 'humano', 'Administrador atendeu pelo celular', now(), now())
    returning * into v_conv;
  else
    update conversations
    set status = 'humano',
        handoff_motivo = case when status = 'bot' then 'Administrador respondeu pelo celular' else handoff_motivo end,
        handoff_em = case when status = 'bot' then now() else handoff_em end,
        humano_ultima_em = now(),
        updated_at = now(),
        proposta_pendente_em = null,
        proposta_pendente_resumo = null
    where id = v_conv.id;
  end if;

  insert into messages (conversation_id, remetente, conteudo, wa_message_id)
  values (v_conv.id, 'humano', coalesce(nullif(p_content, ''), '[mensagem sem texto]'), p_wa_message_id);

  return jsonb_build_object('ok', true, 'conversation_id', v_conv.id, 'contact_id', v_contact.id);
end;
$function$;

-- Mensagem do cliente: respeita "só humano" e "silenciado até".
create or replace function public.handle_inbound_whatsapp_message(
  p_secret text,
  p_phone_number_id text,
  p_wa_id text,
  p_wa_message_id text,
  p_contact_name text,
  p_content text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_contact record;
  v_conversation record;
  v_ja_processada boolean;
  v_wa_account record;
  v_tenant record;
  v_historico jsonb;
  v_profissionais jsonb;
  v_bot_pausado boolean;
  v_indicacao_ativo boolean;
  v_indicacao_texto text;
  v_historico_antigo record;
  v_bloqueado boolean;
  v_motivo_bloqueio text;
begin
  perform check_webhook_secret(p_secret);

  select tenant_id into v_tenant_id
  from whatsapp_accounts
  where phone_number_id = p_phone_number_id;

  if v_tenant_id is null then
    return jsonb_build_object('erro', 'tenant_nao_encontrado');
  end if;

  if p_wa_message_id is not null then
    select exists(select 1 from messages where wa_message_id = p_wa_message_id) into v_ja_processada;
    if v_ja_processada then
      return jsonb_build_object('erro', 'ja_processada');
    end if;
  end if;

  select * into v_contact from contacts where tenant_id = v_tenant_id and telefone = p_wa_id;

  if v_contact is null then
    insert into contacts (tenant_id, nome, telefone, status_funil, tipo_relacionamento)
    values (v_tenant_id, coalesce(p_contact_name, p_wa_id), p_wa_id, 'sem_contato', 'novo')
    returning * into v_contact;
  end if;

  select coalesce(bot_pausado, false), coalesce(indicacao_recompensa_ativo, false), indicacao_recompensa_texto
  into v_bot_pausado, v_indicacao_ativo, v_indicacao_texto
  from bot_settings where tenant_id = v_tenant_id;

  -- "Só humano" (observa/ignora) ou silenciado por período: o robô não responde.
  v_bloqueado := coalesce(v_contact.robo_modo, 'atende') <> 'atende'
    or (v_contact.robo_silenciado_ate is not null and v_contact.robo_silenciado_ate > now());
  v_motivo_bloqueio := case
    when coalesce(v_contact.robo_modo, 'atende') <> 'atende' then 'Atendimento só humano (contato marcado)'
    when v_contact.robo_silenciado_ate is not null and v_contact.robo_silenciado_ate > now()
      then 'Silenciado até ' || to_char(v_contact.robo_silenciado_ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' (atendimento humano)'
    else null
  end;

  select * into v_conversation
  from conversations
  where tenant_id = v_tenant_id and contact_id = v_contact.id and status <> 'encerrada'
  order by created_at desc
  limit 1;

  if v_conversation is null then
    insert into conversations (tenant_id, contact_id, status, handoff_motivo, handoff_em)
    values (
      v_tenant_id, v_contact.id,
      case when v_bot_pausado or v_bloqueado then 'humano' else 'bot' end,
      case when v_bloqueado then v_motivo_bloqueio when v_bot_pausado then 'Bot pausado manualmente pelo dono' else null end,
      case when v_bloqueado or v_bot_pausado then now() else null end
    )
    returning * into v_conversation;
  else
    update conversations
    set proposta_pendente_em = null, proposta_pendente_resumo = null,
        recuperacao_1_enviada_em = null, recuperacao_2_enviada_em = null
    where id = v_conversation.id;

    delete from conversation_summaries where conversation_id = v_conversation.id;

    if v_bloqueado and v_conversation.status = 'bot' then
      update conversations
      set status = 'humano', handoff_motivo = v_motivo_bloqueio, handoff_em = now()
      where id = v_conversation.id;
    elsif not v_bloqueado and v_conversation.status = 'humano'
      and (v_conversation.handoff_motivo like 'Silenciado até%' or v_conversation.handoff_motivo like 'Atendimento só humano%') then
      -- o silêncio acabou (ou o dono tirou a marca): devolve ao robô
      update conversations
      set status = 'bot', handoff_motivo = null, handoff_em = null
      where id = v_conversation.id;
    end if;

    select * into v_conversation from conversations where id = v_conversation.id;
  end if;

  insert into messages (conversation_id, remetente, conteudo, wa_message_id)
  values (v_conversation.id, 'contato', p_content, p_wa_message_id);

  update conversations set updated_at = now() where id = v_conversation.id;

  select phone_number_id, access_token into v_wa_account
  from whatsapp_accounts_decrypted where tenant_id = v_tenant_id;

  select nome, plano, identidade_assistente, horario_abertura, horario_fechamento, dias_funcionamento
  into v_tenant from tenants where id = v_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object('remetente', remetente, 'conteudo', conteudo, 'created_at', created_at) order by created_at asc), '[]'::jsonb)
  into v_historico
  from (
    select remetente, conteudo, created_at from messages
    where conversation_id = v_conversation.id
    order by created_at desc
    limit 25
  ) recentes;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nome), '[]'::jsonb)
  into v_profissionais
  from professionals where tenant_id = v_tenant_id;

  select resumo, classificacao_sugerida into v_historico_antigo
  from whatsapp_historico_contatos
  where tenant_id = v_tenant_id and telefone = p_wa_id and resumo is not null;

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'tenant_nome', v_tenant.nome,
    'identidade_assistente', v_tenant.identidade_assistente,
    'horario_abertura', v_tenant.horario_abertura,
    'horario_fechamento', v_tenant.horario_fechamento,
    'dias_funcionamento', v_tenant.dias_funcionamento,
    'conversation_id', v_conversation.id,
    'conversation_status', v_conversation.status,
    'contact_id', v_contact.id,
    'contact_nome', v_contact.nome,
    'contact_telefone', v_contact.telefone,
    'contact_email', v_contact.email,
    'contact_tipo_relacionamento', v_contact.tipo_relacionamento,
    'contact_como_conheceu', v_contact.como_conheceu,
    'contact_is_novo', (v_contact.tipo_relacionamento = 'novo'),
    'contact_robo_modo', v_contact.robo_modo,
    'robo_bloqueado', v_bloqueado,
    'whatsapp_phone_number_id', v_wa_account.phone_number_id,
    'whatsapp_access_token', v_wa_account.access_token,
    'historico', v_historico,
    'profissionais', v_profissionais,
    'indicacao_recompensa_ativo', v_indicacao_ativo,
    'indicacao_recompensa_texto', v_indicacao_texto,
    'historico_antigo_resumo', v_historico_antigo.resumo,
    'historico_antigo_classificacao', v_historico_antigo.classificacao_sugerida
  );
end;
$function$;

grant execute on function public.whatsapp_registrar_echo_humano(text,text,text,text,text,text) to anon, authenticated;
