-- Horário da agenda por dia da semana. null = usa horario_abertura/fechamento/dias_funcionamento (como antes).
-- Formato: {"1":{"abre":"11:00","fecha":"16:00"}, "6":{"abre":"09:00","fecha":"18:00"}} — dia ausente = fechado (1=seg ... 7=dom).
alter table tenants add column if not exists horarios_semana jsonb;

create or replace function public.ia_horario_texto(p_secret text, p_tenant_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare t record; d int; nomes text[] := array['seg','ter','qua','qui','sex','sáb','dom']; r text := ''; h jsonb;
begin
  perform check_webhook_secret(p_secret);
  select horario_abertura, horario_fechamento, dias_funcionamento, horarios_semana into t from tenants where id = p_tenant_id;
  if t is null then return null; end if;
  if t.horarios_semana is null then return null; end if;
  for d in 1..7 loop
    h := t.horarios_semana -> d::text;
    r := r || case when h is null then nomes[d] || ' fechado' else nomes[d] || ' ' || (h->>'abre') || ' às ' || (h->>'fecha') end || '; ';
  end loop;
  return rtrim(r, '; ');
end $$;

create or replace function public.ia_consultar_disponibilidade(
  p_secret text, p_tenant_id uuid, p_duracao_minutos integer default 30,
  p_professional_id uuid default null, p_a_partir_de timestamptz default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant record; v_inicio timestamptz; v_hoje date; v_slots jsonb := '[]'::jsonb; v_prof record;
  v_cursor timestamptz; v_dia date; v_abre timestamptz; v_fecha timestamptz; v_conflito boolean;
  v_count integer; v_por_profissional integer; v_h jsonb; v_aberto boolean; v_t_abre time; v_t_fecha time;
  v_max_slots constant integer := 8; v_dias_busca constant integer := 14;
begin
  perform check_webhook_secret(p_secret);
  select horario_abertura, horario_fechamento, dias_funcionamento, horarios_semana into v_tenant from tenants where id = p_tenant_id;
  if v_tenant is null then return jsonb_build_object('erro','tenant_nao_encontrado'); end if;

  v_inicio := greatest(coalesce(p_a_partir_de, now()), now());
  v_hoje := (v_inicio at time zone 'America/Sao_Paulo')::date;
  v_por_profissional := case when p_professional_id is null then 1 else v_max_slots end;

  for v_prof in select id, nome from professionals where tenant_id = p_tenant_id and (p_professional_id is null or id = p_professional_id) order by nome
  loop
    v_count := 0; v_dia := v_hoje;
    while v_dia <= v_hoje + v_dias_busca and v_count < v_por_profissional loop
      v_aberto := false;
      if v_tenant.horarios_semana is not null then
        v_h := v_tenant.horarios_semana -> extract(isodow from v_dia)::integer::text;
        if v_h is not null then v_aberto := true; v_t_abre := (v_h->>'abre')::time; v_t_fecha := (v_h->>'fecha')::time; end if;
      elsif extract(isodow from v_dia)::integer = any(v_tenant.dias_funcionamento) then
        v_aberto := true; v_t_abre := v_tenant.horario_abertura; v_t_fecha := v_tenant.horario_fechamento;
      end if;

      if v_aberto then
        v_abre := (v_dia + v_t_abre) at time zone 'America/Sao_Paulo';
        v_fecha := (v_dia + v_t_fecha) at time zone 'America/Sao_Paulo';
        v_cursor := greatest(v_abre, v_inicio);
        v_cursor := v_abre + ceil(extract(epoch from (v_cursor - v_abre)) / 1800.0) * interval '30 min';
        while v_cursor + make_interval(mins => p_duracao_minutos) <= v_fecha and v_count < v_por_profissional loop
          select exists(select 1 from appointments a where a.professional_id = v_prof.id and a.status <> 'cancelado'
            and a.data_hora < v_cursor + make_interval(mins => p_duracao_minutos)
            and a.data_hora + make_interval(mins => a.duracao_minutos) > v_cursor) into v_conflito;
          if not v_conflito then
            v_slots := v_slots || jsonb_build_object('professional_id', v_prof.id, 'professional_nome', v_prof.nome, 'data_hora', v_cursor);
            v_count := v_count + 1;
          end if;
          v_cursor := v_cursor + interval '30 min';
        end loop;
      end if;
      v_dia := v_dia + 1;
    end loop;
  end loop;
  return jsonb_build_object('slots', v_slots);
end $$;

-- Espaço Évora: o que o dono escreveu nas regras do robô (seg-sex 11h-16h; sábado 9h-18h).
update tenants set horarios_semana = '{"1":{"abre":"11:00","fecha":"16:00"},"2":{"abre":"11:00","fecha":"16:00"},"3":{"abre":"11:00","fecha":"16:00"},"4":{"abre":"11:00","fecha":"16:00"},"5":{"abre":"11:00","fecha":"16:00"},"6":{"abre":"09:00","fecha":"18:00"}}'::jsonb
where id = 'adba59ea-3658-4a6b-b236-e36e7a65aa41';
