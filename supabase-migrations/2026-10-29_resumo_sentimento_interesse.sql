-- Sentimento, interesse (1 a 5) e motivo da perda por conversa resumida.
alter table public.conversation_summaries
  add column if not exists sentimento text check (sentimento in ('positivo','neutro','negativo')),
  add column if not exists interesse smallint check (interesse between 1 and 5),
  add column if not exists motivo_perda text;

drop function if exists public.record_conversation_summary(text, uuid, text, text, text, jsonb);

create or replace function public.record_conversation_summary(
  p_secret text,
  p_conversation_id uuid,
  p_resumo text,
  p_categoria text,
  p_desfecho text,
  p_perguntas_principais jsonb,
  p_sentimento text default null,
  p_interesse smallint default null,
  p_motivo_perda text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_contact_id uuid;
begin
  perform check_webhook_secret(p_secret);

  select tenant_id, contact_id into v_tenant_id, v_contact_id
  from conversations where id = p_conversation_id;

  if v_tenant_id is null then
    return;
  end if;

  insert into conversation_summaries (
    tenant_id, conversation_id, contact_id, resumo, categoria, desfecho, perguntas_principais,
    sentimento, interesse, motivo_perda
  )
  values (
    v_tenant_id, p_conversation_id, v_contact_id, p_resumo, p_categoria, p_desfecho,
    coalesce(p_perguntas_principais, '[]'::jsonb),
    p_sentimento, p_interesse, p_motivo_perda
  )
  on conflict (conversation_id) do update set
    resumo = excluded.resumo,
    categoria = excluded.categoria,
    desfecho = excluded.desfecho,
    perguntas_principais = excluded.perguntas_principais,
    sentimento = excluded.sentimento,
    interesse = excluded.interesse,
    motivo_perda = excluded.motivo_perda,
    gerado_em = now();
end;
$function$;

