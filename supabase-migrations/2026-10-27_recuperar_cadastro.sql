-- Recuperação de cadastro abandonado: quem preencheu o cadastro em /planos e não pagou recebe
-- até 2 e-mails (no dia seguinte e 3 dias depois). O cron diário (pos-venda) lista e registra.
-- Para desfazer: drop function leads_para_recuperar, lead_recuperacao_registrar;
--   alter table leads_cadastro drop column recuperacao_enviada, drop column recuperacao_em;

alter table public.leads_cadastro
  add column if not exists recuperacao_enviada int not null default 0,
  add column if not exists recuperacao_em timestamptz;

-- Leads prontos para o próximo e-mail. Ignora quem já tem login na ivva e cadastros com mais de 30 dias.
create or replace function public.leads_para_recuperar(p_secret text)
returns table (email text, nome text, nome_negocio text, plano text, etapa int)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  return query
    select l.email, l.nome, l.nome_negocio, l.plano, l.recuperacao_enviada + 1
    from leads_cadastro l
    where l.status in ('cadastro_iniciado', 'pagamento_aberto')
      and l.created_at > now() - interval '30 days'
      and (
        (l.recuperacao_enviada = 0 and l.updated_at < now() - interval '20 hours')
        or (l.recuperacao_enviada = 1 and l.recuperacao_em < now() - interval '3 days')
      )
      and not exists (select 1 from auth.users u where lower(u.email) = lower(l.email))
    order by l.updated_at
    limit 50;
end $$;

create or replace function public.lead_recuperacao_registrar(p_secret text, p_email text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  update leads_cadastro
     set recuperacao_enviada = recuperacao_enviada + 1, recuperacao_em = now()
   where lower(email) = lower(p_email);
end $$;

-- Execução protegida pela senha interna (check_webhook_secret), como as demais funções de cadastro.
