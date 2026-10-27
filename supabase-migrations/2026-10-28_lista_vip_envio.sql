-- Envio do e-mail de acesso antecipado da Black Friday (20/11) para a lista VIP.
-- O cron diário (pos-venda) pergunta quem ainda não recebeu e registra o envio, então nunca repete.
-- Para desfazer: drop function lista_vip_para_enviar, lista_vip_marcar_enviado;
--   alter table lista_vip drop column acesso_enviado_em;

alter table public.lista_vip add column if not exists acesso_enviado_em timestamptz;

create or replace function public.lista_vip_para_enviar(p_secret text, p_campanha text)
returns table (email text, nome text)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
    select v.email, v.nome from lista_vip v
    where v.campanha = p_campanha and v.acesso_enviado_em is null
    order by v.created_at
    limit 200;
end $$;

create or replace function public.lista_vip_marcar_enviado(p_secret text, p_campanha text, p_email text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  update lista_vip set acesso_enviado_em = now() where campanha = p_campanha and email = lower(p_email);
end $$;
