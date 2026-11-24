-- Anotações automáticas do robô no contato (aparecem em "Histórico e anotações" do CRM, com o prefixo "ivva:").
-- Reverter: drop function public.ia_anotar_contato(text, uuid, uuid, text); e restaurar record_conversation_summary sem o insert em contact_notes.

create or replace function public.ia_anotar_contato(p_secret text, p_contact_id uuid, p_tenant_id uuid, p_texto text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_texto text := 'ivva: ' || left(btrim(coalesce(p_texto, '')), 500);
begin
  perform check_webhook_secret(p_secret);
  if btrim(coalesce(p_texto, '')) = '' then return; end if;
  if not exists (select 1 from contacts where id = p_contact_id and tenant_id = p_tenant_id) then return; end if;
  -- não repete a mesma anotação em sequência
  if exists (
    select 1 from contact_notes
     where contact_id = p_contact_id and conteudo = v_texto and created_at > now() - interval '1 day'
  ) then return; end if;
  insert into contact_notes (tenant_id, contact_id, tipo, conteudo)
  values (p_tenant_id, p_contact_id, 'nota', v_texto);
end;
$$;
revoke all on function public.ia_anotar_contato(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ia_anotar_contato(text, uuid, uuid, text) to anon;

-- Toda conversa resumida (inclusive as que esfriaram) deixa uma anotação no contato.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'record_conversation_summary' and p.pronamespace = 'public'::regnamespace;
  if position('gerado_em = now();' in d) = 0 then raise exception 'trecho não encontrado'; end if;
  execute replace(d, 'gerado_em = now();',
    $r$gerado_em = now();

  if v_contact_id is not null and nullif(btrim(p_resumo), '') is not null then
    insert into contact_notes (tenant_id, contact_id, tipo, conteudo)
    select v_tenant_id, v_contact_id, 'nota',
           'ivva: ' || left(btrim(p_resumo), 400)
             || case when p_desfecho = 'nao_fechou' then ' (esfriou' || coalesce(': ' || nullif(btrim(p_motivo_perda), ''), '') || ')' else '' end
    where not exists (
      select 1 from contact_notes n
       where n.contact_id = v_contact_id and n.conteudo like 'ivva: ' || left(btrim(p_resumo), 60) || '%'
    );
  end if;$r$);
end $$;
