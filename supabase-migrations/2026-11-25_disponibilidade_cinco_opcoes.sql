-- ia_consultar_disponibilidade: até 5 opções espaçadas de 2 em 2 horas (10h, 12h, 14h, 16h, 18h), completando com os dias seguintes.
-- Reverter: restaurar v_max_slots := 8 e remover o salto de 90 min (ver 2026-11-25_disponibilidade_varios_dias.sql).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.proname = 'ia_consultar_disponibilidade' and p.pronamespace = 'public'::regnamespace;
  d := replace(d, 'v_max_slots constant integer := 8; v_dia_count integer := 0;', 'v_max_slots constant integer := 5; v_dia_count integer := 0;');
  d := replace(d, 'v_count := v_count + 1; v_dia_count := v_dia_count + 1;', 'v_count := v_count + 1; v_dia_count := v_dia_count + 1; v_cursor := v_cursor + interval ''90 min'';');
  execute d;
end $$;
