-- Fonte da resposta do robô: trechos da base de conhecimento usados em cada mensagem do bot.
alter table public.messages add column if not exists fontes jsonb;

drop function if exists public.record_bot_reply(text, uuid, text, text);

create or replace function public.record_bot_reply(
  p_secret text,
  p_conversation_id uuid,
  p_conteudo text,
  p_wa_message_id text,
  p_fontes jsonb default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform check_webhook_secret(p_secret);

  insert into messages (conversation_id, remetente, conteudo, wa_message_id, fontes)
  values (p_conversation_id, 'bot', p_conteudo, p_wa_message_id,
          case when jsonb_typeof(p_fontes) = 'array' and jsonb_array_length(p_fontes) > 0 then p_fontes end);

  update conversations set updated_at = now() where id = p_conversation_id;
end;
$function$;
