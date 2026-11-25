-- Antecedência mínima para o robô agendar (em horas). Padrão 0 = comportamento de sempre.
-- Reverter: alter table public.tenants drop column antecedencia_minima_horas; e restaurar as duas funções (ia_consultar_disponibilidade, ia_criar_agendamento).
alter table public.tenants
  add column if not exists antecedencia_minima_horas integer not null default 0
  check (antecedencia_minima_horas between 0 and 720);

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'ia_consultar_disponibilidade' and p.pronamespace = 'public'::regnamespace;
  if position('horarios_semana into v_tenant from tenants' in d) = 0
     or position('v_inicio := greatest(coalesce(p_a_partir_de, now()), now());' in d) = 0
     or position('return jsonb_build_object(''slots'', v_slots);' in d) = 0 then
    raise exception 'trechos de ia_consultar_disponibilidade não encontrados';
  end if;
  d := replace(d, 'horarios_semana into v_tenant from tenants', 'horarios_semana, antecedencia_minima_horas into v_tenant from tenants');
  d := replace(d, 'v_inicio := greatest(coalesce(p_a_partir_de, now()), now());',
    'v_inicio := greatest(coalesce(p_a_partir_de, now()), now() + make_interval(hours => coalesce(v_tenant.antecedencia_minima_horas, 0)));');
  d := replace(d, 'return jsonb_build_object(''slots'', v_slots);',
    'return jsonb_build_object(''slots'', v_slots, ''antecedencia_minima_horas'', coalesce(v_tenant.antecedencia_minima_horas, 0), ''primeiro_horario_possivel'', v_inicio);');
  execute d;

  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'ia_criar_agendamento' and p.pronamespace = 'public'::regnamespace;
  if position('horario_no_passado' in d) = 0 then raise exception 'trecho de ia_criar_agendamento não encontrado'; end if;
  d := replace(d, '  select exists(
    select 1 from appointments a
    where a.professional_id = p_professional_id',
'  if p_data_hora < now() + make_interval(hours => coalesce((select antecedencia_minima_horas from tenants where id = p_tenant_id), 0)) then
    return jsonb_build_object(''erro'', ''antecedencia_minima'', ''horas'', coalesce((select antecedencia_minima_horas from tenants where id = p_tenant_id), 0));
  end if;

  select exists(
    select 1 from appointments a
    where a.professional_id = p_professional_id');
  if position('antecedencia_minima' in d) = 0 then raise exception 'ajuste de ia_criar_agendamento não aplicado'; end if;
  execute d;
end $$;
