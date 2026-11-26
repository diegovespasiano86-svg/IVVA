-- Trava de expediente no robô (marcar/remarcar), prazo de agendamento por dia da semana e opção de não mostrar o profissional.
-- Só afeta as funções usadas pelo robô; a agenda manual do dono continua livre.
-- Reverter: restaurar as 5 funções anteriores; drop function ia_bloqueio_agenda; drop das 2 colunas.

alter table public.tenants add column if not exists prazo_agendamento jsonb;
alter table public.tenants add column if not exists agenda_ocultar_profissional boolean not null default false;
comment on column public.tenants.prazo_agendamento is 'Ex.: {"6":{"dias_antes":1,"hora":"17:00"},"aviso":"..."} (chave = dia ISO; 6 = sábado)';

create or replace function public.ia_bloqueio_agenda(p_tenant_id uuid, p_inicio timestamptz, p_duracao integer)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $fn$
declare
  t record; v_local timestamp; v_dia date; v_dow text; v_h jsonb; v_abre time; v_fecha time; v_cfg jsonb;
begin
  select horario_abertura, horario_fechamento, dias_funcionamento, horarios_semana, prazo_agendamento into t from tenants where id = p_tenant_id;
  v_local := p_inicio at time zone 'America/Sao_Paulo';
  v_dia := v_local::date;
  v_dow := extract(isodow from v_dia)::integer::text;
  if t.horarios_semana is not null then
    v_h := t.horarios_semana -> v_dow;
    v_abre := (v_h->>'abre')::time; v_fecha := (v_h->>'fecha')::time;
  elsif v_dow::integer = any(t.dias_funcionamento) then
    v_abre := t.horario_abertura; v_fecha := t.horario_fechamento;
  end if;
  if v_abre is null or v_fecha is null or v_local < v_dia + v_abre
     or v_local + make_interval(mins => coalesce(p_duracao, 30)) > v_dia + v_fecha then
    return jsonb_build_object('erro', 'fora_do_horario', 'aviso_para_voce',
      'Esse dia ou horário está fora do funcionamento do negócio. Nada foi marcado. Explique ao cliente e consulte a disponibilidade para oferecer outro horário.');
  end if;
  v_cfg := t.prazo_agendamento -> v_dow;
  if v_cfg is not null and now() > ((v_dia - (v_cfg->>'dias_antes')::integer) + (v_cfg->>'hora')::time) at time zone 'America/Sao_Paulo' then
    return jsonb_build_object('erro', 'prazo_encerrado', 'aviso_para_voce',
      'O prazo para marcar nesse dia já encerrou. Nada foi marcado. ' || coalesce(t.prazo_agendamento->>'aviso', '') || ' Explique ao cliente e ofereça a próxima data disponível.');
  end if;
  return null;
end
$fn$;
revoke all on function public.ia_bloqueio_agenda(uuid, timestamptz, integer) from public, anon, authenticated;

do $mig$
declare d text; n text;
begin
  -- marcar
  d := pg_get_functiondef('public.ia_criar_agendamento'::regproc);
  n := replace(d, 'select exists(', 'if public.ia_bloqueio_agenda(p_tenant_id, p_data_hora, p_duracao_minutos) is not null then
    return public.ia_bloqueio_agenda(p_tenant_id, p_data_hora, p_duracao_minutos);
  end if;

  select exists(');
  n := replace(n, '''professional_nome'', v_prof.nome', '''professional_nome'', case when (select agenda_ocultar_profissional from tenants where id = p_tenant_id) then '''' else v_prof.nome end');
  if position('ia_bloqueio_agenda' in n) = 0 or position('agenda_ocultar_profissional' in n) = 0 then raise exception 'ia_criar_agendamento: trecho não encontrado'; end if;
  execute n;

  -- remarcar (passa a respeitar também a antecedência mínima)
  d := pg_get_functiondef('public.ia_remarcar_ou_cancelar_agendamento'::regproc);
  n := replace(d, 'select exists(', 'if p_nova_data_hora < now() + make_interval(hours => coalesce((select antecedencia_minima_horas from tenants where id = p_tenant_id), 0)) then
    return jsonb_build_object(''erro'', ''antecedencia_minima'', ''horas'', (select antecedencia_minima_horas from tenants where id = p_tenant_id));
  end if;

  if public.ia_bloqueio_agenda(p_tenant_id, p_nova_data_hora, v_agendamento.duracao_minutos) is not null then
    return public.ia_bloqueio_agenda(p_tenant_id, p_nova_data_hora, v_agendamento.duracao_minutos);
  end if;

  select exists(');
  n := replace(n, '''professional_nome'', v_prof.nome', '''professional_nome'', case when (select agenda_ocultar_profissional from tenants where id = p_tenant_id) then '''' else v_prof.nome end');
  if position('ia_bloqueio_agenda' in n) = 0 or position('agenda_ocultar_profissional' in n) = 0 then raise exception 'ia_remarcar: trecho não encontrado'; end if;
  execute n;

  -- consultar: respeita o prazo e, sem profissional visível, devolve horários distintos
  d := pg_get_functiondef('public.ia_consultar_disponibilidade'::regproc);
  n := replace(d, 'antecedencia_minima_horas into v_tenant', 'antecedencia_minima_horas, prazo_agendamento, agenda_ocultar_profissional into v_tenant');
  n := replace(n, 'p_professional_id is null and (select count(*)', 'p_professional_id is null and not v_tenant.agenda_ocultar_profissional and (select count(*)');
  n := replace(n, 'if v_aberto then v_dia_count := 0;', 'if v_aberto and v_tenant.prazo_agendamento -> extract(isodow from v_dia)::integer::text is not null
         and now() > ((v_dia - (v_tenant.prazo_agendamento -> extract(isodow from v_dia)::integer::text ->> ''dias_antes'')::integer)
           + (v_tenant.prazo_agendamento -> extract(isodow from v_dia)::integer::text ->> ''hora'')::time) at time zone ''America/Sao_Paulo'' then
        v_aberto := false;
      end if;

      if v_aberto then v_dia_count := 0;');
  n := replace(n, 'return jsonb_build_object(''slots'', v_slots, ', 'if v_tenant.agenda_ocultar_profissional then
    select coalesce(jsonb_agg(y.s || jsonb_build_object(''professional_nome'', '''') order by y.quando), ''[]''::jsonb) into v_slots
    from (select distinct on ((x.s->>''data_hora'')::timestamptz) x.s, (x.s->>''data_hora'')::timestamptz as quando
            from jsonb_array_elements(v_slots) as x(s)
           order by (x.s->>''data_hora'')::timestamptz
           limit v_max_slots) y;
  end if;
  return jsonb_build_object(''regra_de_prazo'', v_tenant.prazo_agendamento->>''aviso'', ''slots'', v_slots, ');
  if position('prazo_agendamento, agenda_ocultar_profissional into' in n) = 0 or position('and not v_tenant.agenda_ocultar_profissional' in n) = 0
     or position('v_aberto := false;
      end if;' in n) = 0 or position('regra_de_prazo' in n) = 0 then
    raise exception 'ia_consultar_disponibilidade: trecho não encontrado';
  end if;
  execute n;

  -- lembrete e lista de espera também sem o nome
  d := pg_get_functiondef('public.list_lembrete_pendentes'::regproc);
  n := replace(d, '''professional_nome'', p.nome', '''professional_nome'', case when (select agenda_ocultar_profissional from tenants where id = a.tenant_id) then null else p.nome end');
  if n = d then raise exception 'list_lembrete_pendentes: trecho não encontrado'; end if;
  execute n;

  d := pg_get_functiondef('public.ia_notificar_proximo_lista_espera'::regproc);
  n := replace(d, '''professional_nome'', v_prof_nome', '''professional_nome'', case when (select agenda_ocultar_profissional from tenants where id = p_tenant_id) then null else v_prof_nome end');
  if n = d then raise exception 'lista_espera: trecho não encontrado'; end if;
  execute n;
end
$mig$;

-- Espaço Évora: sábado até sexta 17h; cliente não escolhe nem vê o profissional.
update public.tenants set
  prazo_agendamento = '{"6":{"dias_antes":1,"hora":"17:00"},"aviso":"Sábado precisa ser agendado até sexta-feira às 17h."}'::jsonb,
  agenda_ocultar_profissional = true,
  identidade_assistente = jsonb_set(identidade_assistente, '{regras}',
    (identidade_assistente->'regras') || to_jsonb('Nunca diga nem pergunte o nome de quem vai atender: confirme apenas o dia e o horário.'::text))
where id = 'adba59ea-3658-4a6b-b236-e36e7a65aa41';
