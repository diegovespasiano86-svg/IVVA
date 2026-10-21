-- Cobranças que ninguém pagou viram "expirada": Pix e maquininha após 2 horas, link após 4 dias. Roda no cron diário.
-- Se o cliente pagar depois de expirada, a baixa ainda acontece (cobranca_paga não exige status pendente).
-- Para desfazer: drop function public.cobrancas_expirar(text);
create or replace function public.cobrancas_expirar(p_secret text)
returns integer language plpgsql security definer set search_path to 'public' as $f$
declare n integer;
begin
  perform check_webhook_secret(p_secret);
  update cobrancas set status = 'expirada'
   where status = 'pendente'
     and ((forma in ('pix', 'maquininha') and criada_em < now() - interval '2 hours')
       or (forma = 'link' and criada_em < now() - interval '4 days'));
  get diagnostics n = row_count;
  return n;
end; $f$;
revoke all on function public.cobrancas_expirar(text) from public;
grant execute on function public.cobrancas_expirar(text) to anon, authenticated;
