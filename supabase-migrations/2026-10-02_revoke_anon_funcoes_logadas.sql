-- Aplicada em produção em 2026-10-02 (migration "revoke_anon_execute_funcoes_logadas").
-- Funções que só fazem sentido para usuário logado: tira a execução de visitantes (anon/PUBLIC).
-- Elas já recusavam por dentro (auth.uid()); isto é defesa em camadas.
-- As funções com p_secret continuam executáveis por anon de propósito: o servidor do app
-- as chama com a chave anon + segredo interno (validado por check_webhook_secret).
revoke execute on function public.admin_chamados_recentes() from public, anon;
revoke execute on function public.admin_resolver_chamado(uuid) from public, anon;
revoke execute on function public.admin_tenants_overview() from public, anon;
revoke execute on function public.excluir_conta_lgpd() from public, anon;
revoke execute on function public.excluir_contato_lgpd(uuid) from public, anon;
grant execute on function public.admin_chamados_recentes() to authenticated, service_role;
grant execute on function public.admin_resolver_chamado(uuid) to authenticated, service_role;
grant execute on function public.admin_tenants_overview() to authenticated, service_role;
grant execute on function public.excluir_conta_lgpd() to authenticated, service_role;
grant execute on function public.excluir_contato_lgpd(uuid) to authenticated, service_role;
-- Função de gatilho: nunca é chamada pela API (o gatilho continua funcionando).
revoke execute on function public.seed_default_funnel_stages() from public, anon, authenticated;
