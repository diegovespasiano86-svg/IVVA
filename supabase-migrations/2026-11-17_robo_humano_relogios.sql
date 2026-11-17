-- Robô x humano, parte 2 (17/11/2026): observador e relógios de encerramento.
--   15 min  -> o robô lê a conversa do administrador e anota (revisado)
--   1 h     -> se resolvido, pergunta se pode encerrar
--   8 h     -> se aguardando o cliente, lembrete gentil (uma vez)
--   ~21 h   -> aviso de encerramento e encerra (sempre dentro da janela de 24 h do WhatsApp)
-- Nada aqui envia mensagem: só guarda estado e entrega a lista ao job (/api/cron/robo-humano).

alter table conversations
  add column if not exists humano_revisado_em timestamptz,
  add column if not exists humano_situacao text,
  add column if not exists lembrete_humano_em timestamptz,
  add column if not exists encerramento_perguntado_em timestamptz,
  add column if not exists aviso_encerramento_em timestamptz;

alter table conversations drop constraint if exists conversations_humano_situacao_check;
alter table conversations
  add constraint conversations_humano_situacao_check check (humano_situacao is null or humano_situacao in ('resolvido', 'aguardando_cliente'));

-- Cada mensagem do administrador (celular ou painel) reinicia os relógios.
create or replace function public.trg_mensagem_humano_reinicia_relogios()
returns trigger
language plpgsql
as $$
begin
  if new.remetente = 'humano' then
    update conversations
    set humano_ultima_em = now(),
        humano_revisado_em = null,
        humano_situacao = null,
        lembrete_humano_em = null,
        encerramento_perguntado_em = null,
        aviso_encerramento_em = null
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists mensagem_humano_reinicia_relogios on messages;
create trigger mensagem_humano_reinicia_relogios
after insert on messages
for each row execute function public.trg_mensagem_humano_reinicia_relogios();

-- Lista o que o job precisa olhar agora (sem enviar nada).
create or replace function public.robo_humano_pendentes(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_res jsonb;
begin
  perform check_webhook_secret(p_secret);

  select coalesce(jsonb_agg(linha), '[]'::jsonb) into v_res
  from (
    select
      c.id as conversation_id,
      c.tenant_id,
      c.contact_id,
      c.status,
      c.humano_ultima_em,
      c.humano_revisado_em,
      c.humano_situacao,
      c.lembrete_humano_em,
      c.encerramento_perguntado_em,
      c.aviso_encerramento_em,
      ct.nome as contact_nome,
      ct.telefone as contact_telefone,
      ct.email as contact_email,
      ct.data_nascimento as contact_nascimento,
      coalesce(ct.aceita_mensagem_automatica, true) as aceita_mensagem_automatica,
      t.nome as tenant_nome,
      wa.phone_number_id,
      wa.access_token,
      (select max(m.created_at) from messages m where m.conversation_id = c.id) as ultima_msg_em,
      (select m.remetente from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as ultima_msg_remetente,
      (select max(m.created_at) from messages m where m.conversation_id = c.id and m.remetente = 'contato') as ultima_cliente_em,
      (
        select string_agg(
          case m.remetente when 'contato' then 'Cliente' when 'humano' then 'Atendente' else 'Robô' end || ': ' || m.conteudo,
          E'\n' order by m.created_at
        )
        from (
          select remetente, conteudo, created_at from messages
          where conversation_id = c.id
          order by created_at desc limit 40
        ) m
      ) as transcript
    from conversations c
    join contacts ct on ct.id = c.contact_id
    join tenants t on t.id = c.tenant_id
    left join whatsapp_accounts_decrypted wa on wa.tenant_id = c.tenant_id
    where c.status <> 'encerrada'
      and (
        (c.status = 'humano' and c.humano_ultima_em is not null)
        or (c.status = 'bot' and c.encerramento_perguntado_em is not null)
      )
    order by c.updated_at asc
    limit 60
  ) linha;

  return v_res;
end;
$function$;

-- Aplica uma ação do job. Mensagens do robô entram no histórico como "bot".
create or replace function public.robo_humano_aplicar(
  p_secret text,
  p_conversation_id uuid,
  p_acao text,
  p_dados jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conv record;
  v_texto text := nullif(p_dados->>'texto', '');
  v_wa text := nullif(p_dados->>'wa_message_id', '');
  v_email text := nullif(btrim(coalesce(p_dados->>'email', '')), '');
  v_nasc date;
begin
  perform check_webhook_secret(p_secret);

  select * into v_conv from conversations where id = p_conversation_id;
  if v_conv is null then
    return jsonb_build_object('erro', 'conversa_nao_encontrada');
  end if;

  if p_acao = 'revisado' then
    update conversations
    set humano_revisado_em = now(),
        humano_situacao = case when p_dados->>'situacao' in ('resolvido', 'aguardando_cliente') then p_dados->>'situacao' else 'aguardando_cliente' end
    where id = p_conversation_id;

    if v_texto is not null then
      insert into contact_notes (tenant_id, contact_id, autor_id, tipo, conteudo)
      values (v_conv.tenant_id, v_conv.contact_id, null, 'nota', left('Anotação da ivva: ' || v_texto, 2000));
    end if;

    -- Só completa dados que estão vazios no cadastro; nunca sobrescreve o que o dono já tem.
    if v_email is not null and v_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      update contacts set email = v_email where id = v_conv.contact_id and (email is null or email = '');
    end if;
    begin
      v_nasc := nullif(p_dados->>'data_nascimento', '')::date;
    exception when others then
      v_nasc := null;
    end;
    if v_nasc is not null and v_nasc < current_date and v_nasc > date '1900-01-01' then
      update contacts set data_nascimento = v_nasc where id = v_conv.contact_id and data_nascimento is null;
    end if;

  elsif p_acao = 'lembrete' then
    update conversations set lembrete_humano_em = now() where id = p_conversation_id;
    if v_texto is not null then
      insert into messages (conversation_id, remetente, conteudo, wa_message_id) values (p_conversation_id, 'bot', v_texto, v_wa);
    end if;

  elsif p_acao = 'perguntar_encerrar' then
    -- a conversa volta para o robô: a resposta do cliente ("pode encerrar", novo assunto...) é tratada por ele
    update conversations
    set status = 'bot', handoff_motivo = null, handoff_em = null, encerramento_perguntado_em = now()
    where id = p_conversation_id;
    if v_texto is not null then
      insert into messages (conversation_id, remetente, conteudo, wa_message_id) values (p_conversation_id, 'bot', v_texto, v_wa);
    end if;

  elsif p_acao in ('avisar_encerrar', 'confirmar_encerrar') then
    update conversations
    set status = 'encerrada', handoff_em = null, aviso_encerramento_em = now(), encerramento_perguntado_em = null, updated_at = now()
    where id = p_conversation_id;
    if v_texto is not null then
      insert into messages (conversation_id, remetente, conteudo, wa_message_id) values (p_conversation_id, 'bot', v_texto, v_wa);
    end if;

  elsif p_acao = 'encerrar_silencio' then
    update conversations
    set status = 'encerrada', handoff_em = null, encerramento_perguntado_em = null, updated_at = now()
    where id = p_conversation_id;

  else
    return jsonb_build_object('erro', 'acao_invalida');
  end if;

  return jsonb_build_object('ok', true);
end;
$function$;

-- Resposta do cliente depois da pergunta "posso encerrar?": confirma (encerra) ou segue (limpa a pergunta).
create or replace function public.robo_humano_resposta_cliente(
  p_secret text,
  p_conversation_id uuid,
  p_confirma boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pergunta timestamptz;
begin
  perform check_webhook_secret(p_secret);

  select encerramento_perguntado_em into v_pergunta from conversations where id = p_conversation_id;
  if v_pergunta is null then
    return jsonb_build_object('pendente', false);
  end if;

  update conversations set encerramento_perguntado_em = null where id = p_conversation_id;
  return jsonb_build_object('pendente', true, 'confirma', p_confirma);
end;
$function$;

grant execute on function public.robo_humano_pendentes(text) to anon, authenticated;
grant execute on function public.robo_humano_aplicar(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.robo_humano_resposta_cliente(text, uuid, boolean) to anon, authenticated;
