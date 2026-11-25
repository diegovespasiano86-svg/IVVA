-- ia_consultar_disponibilidade: sem dia pedido, devolve até 2 horários por dia em vários dias (antes devolvia 1 só e o robô
-- concluía que os outros dias não tinham horário). Com 1 profissional, não limita a 1 horário. Com dia pedido, mostra o dia todo.
-- Reverter: restaurar a definição anterior da função (ver 2026-11-25_antecedencia_minima_agenda.sql).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'ia_consultar_disponibilidade' and p.pronamespace = 'public'::regnamespace;
  d := replace(d, 'v_max_slots constant integer := 8;', 'v_max_slots constant integer := 8; v_dia_count integer := 0;');
  d := replace(d, 'v_por_profissional := case when p_professional_id is null then 1 else v_max_slots end;',
    'v_por_profissional := case when p_professional_id is null and (select count(*) from professionals where tenant_id = p_tenant_id) > 1 then 1 else v_max_slots end;');
  d := replace(d, 'if v_aberto then', 'if v_aberto then v_dia_count := 0;');
  d := replace(d, 'and v_count < v_por_profissional loop
          select exists', 'and v_count < v_por_profissional and v_dia_count < (case when p_a_partir_de is null then 2 else 99 end) loop
          select exists');
  d := replace(d, 'v_count := v_count + 1;', 'v_count := v_count + 1; v_dia_count := v_dia_count + 1;');
  execute d;
end $$;
