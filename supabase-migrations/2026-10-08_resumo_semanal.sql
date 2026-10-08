-- Resumo semanal por e-mail (v2). SÓ ACRESCENTA: uma coluna nova (ligada por padrão) e uma função nova.
-- Para desfazer: drop function public.resumo_semanal_listar(text); alter table public.tenants drop column resumo_semanal;

alter table public.tenants add column if not exists resumo_semanal boolean not null default true;

create or replace function public.resumo_semanal_listar(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ini timestamptz := now() - interval '7 days';
  v_res jsonb;
begin
  perform check_webhook_secret(p_secret);

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res
  from (
    select
      t.id as tenant_id,
      t.nome as negocio,
      u.email as email,
      u.nome as dono_nome,
      (select count(*) from conversations c where c.tenant_id = t.id and c.created_at >= v_ini) as conversas,
      (select count(*) from conversations c where c.tenant_id = t.id and c.handoff_em >= v_ini) as humano,
      (select count(*) from appointments a where a.tenant_id = t.id and a.created_at >= v_ini and a.status <> 'cancelado') as agendamentos,
      (select count(*) from contacts k where k.tenant_id = t.id and k.created_at >= v_ini) as novos_contatos,
      (select coalesce(sum(p.valor_total), 0) from payments p where p.tenant_id = t.id and p.created_at >= v_ini) as faturamento
    from tenants t
    join users u on u.tenant_id = t.id and u.role = 'dono' and u.email is not null
    where t.resumo_semanal and coalesce(t.acesso_bloqueado, false) = false
  ) x;

  return v_res;
end;
$function$;
