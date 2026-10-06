-- Visão só para consulta no painel do Supabase (Table Editor > Views > equipe_acessos):
-- quem é quem em cada negócio, com o tipo de acesso em português.
--   role 'dono' = Administrador | role 'profissional' = Usuário
-- security_invoker + sem permissão para anon/authenticated: não aparece pela API do app.
-- Para desfazer: drop view public.equipe_acessos;
create or replace view public.equipe_acessos
with (security_invoker = true) as
select
  t.nome                                   as negocio,
  u.nome                                   as pessoa,
  u.email                                  as email,
  case u.role when 'dono' then 'Administrador' when 'profissional' then 'Usuário' else u.role end as tipo_de_acesso,
  u.role                                   as papel_no_banco,
  coalesce(p.nome, '— (não atende na agenda)') as agenda_como,
  a.last_sign_in_at                        as ultimo_acesso,
  u.created_at                             as entrou_em
from public.users u
join public.tenants t on t.id = u.tenant_id
left join public.professionals p on p.id = u.professional_id
left join auth.users a on a.id = u.id
order by t.nome, u.created_at;

revoke all on public.equipe_acessos from anon, authenticated;
