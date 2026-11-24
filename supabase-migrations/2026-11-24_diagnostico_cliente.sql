-- Diagnóstico do cliente (popup obrigatório no 1º acesso) + relatório da IA + histórico da implantação.
-- O cliente só escreve as próprias respostas (diagnostico_salvar). O relatório é gravado pelo servidor (segredo).
-- O painel de implantação (/admin/clientes) lê tudo por funções que exigem is_platform_admin.

create table if not exists public.diagnosticos (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  respondido_por uuid,
  respostas jsonb not null default '{}'::jsonb,
  etapa int not null default 0,
  enviado_em timestamptz,
  relatorio jsonb,
  relatorio_em timestamptz,
  relatorio_erro text,
  lido_em timestamptz,
  reuniao_em timestamptz,
  implantado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diagnosticos enable row level security;

create table if not exists public.cliente_historico (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'reuniao', 'sistema')),
  texto text not null,
  autor text,
  created_at timestamptz not null default now()
);
create index if not exists cliente_historico_tenant_idx on public.cliente_historico (tenant_id, created_at desc);
alter table public.cliente_historico enable row level security;
-- Sem políticas: só as funções abaixo (security definer) leem e escrevem.

-- Negócios criados a partir desta data passam pelo diagnóstico obrigatório.
create or replace function public.diagnostico_inicio() returns timestamptz
language sql immutable as $$ select '2026-11-24T00:00:00-03:00'::timestamptz $$;

-- ---- Lado do cliente ---------------------------------------------------------------------------------

-- Situação do diagnóstico do negócio de quem está logado (o layout usa para abrir ou não o popup).
create or replace function public.diagnostico_meu()
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_criado timestamptz;
  d record;
begin
  if v_tenant is null then return null; end if;
  select created_at into v_criado from tenants where id = v_tenant;
  select * into d from diagnosticos where tenant_id = v_tenant;
  return json_build_object(
    'obrigatorio', v_criado >= diagnostico_inicio() and (d is null or d.enviado_em is null),
    'respostas', coalesce(d.respostas, '{}'::jsonb),
    'etapa', coalesce(d.etapa, 0),
    'enviado', d.enviado_em is not null
  );
end;
$$;

-- Salva as respostas (a cada etapa). p_enviar = true fecha o diagnóstico e libera o sistema.
create or replace function public.diagnostico_salvar(p_respostas jsonb, p_etapa int, p_enviar boolean default false)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_tenant uuid := current_tenant_id();
begin
  if v_tenant is null or current_app_role() <> 'dono' then
    raise exception 'not allowed';
  end if;
  if pg_column_size(p_respostas) > 20000 then
    raise exception 'respostas grandes demais';
  end if;
  insert into diagnosticos (tenant_id, respondido_por, respostas, etapa, enviado_em, updated_at)
  values (v_tenant, auth.uid(), p_respostas, greatest(p_etapa, 0), case when p_enviar then now() end, now())
  on conflict (tenant_id) do update
    set respostas = excluded.respostas,
        etapa = excluded.etapa,
        respondido_por = excluded.respondido_por,
        enviado_em = coalesce(diagnosticos.enviado_em, excluded.enviado_em),
        updated_at = now();
  if p_enviar then
    insert into cliente_historico (tenant_id, tipo, texto, autor)
    values (v_tenant, 'sistema', 'Diagnóstico respondido pelo cliente no primeiro acesso.', 'Sistema');
  end if;
  return v_tenant;
end;
$$;

-- ---- Lado do servidor (relatório da IA) ---------------------------------------------------------------

-- Dados para montar o relatório: respostas + nome, segmento e plano do negócio.
create or replace function public.diagnostico_para_relatorio(p_secret text, p_tenant uuid)
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform check_webhook_secret(p_secret);
  return (
    select json_build_object('respostas', d.respostas, 'negocio', t.nome, 'segmento', t.segmento, 'plano', t.plano)
      from diagnosticos d join tenants t on t.id = d.tenant_id
     where d.tenant_id = p_tenant
  );
end;
$$;

create or replace function public.diagnostico_salvar_relatorio(p_secret text, p_tenant uuid, p_relatorio jsonb, p_erro text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform check_webhook_secret(p_secret);
  if p_relatorio is not null then
    update diagnosticos set relatorio = p_relatorio, relatorio_em = now(), relatorio_erro = null, lido_em = null, updated_at = now()
     where tenant_id = p_tenant;
    insert into cliente_historico (tenant_id, tipo, texto, autor) values (p_tenant, 'sistema', 'Relatório do diagnóstico gerado pela IA.', 'Sistema');
  else
    update diagnosticos set relatorio_erro = left(coalesce(p_erro, 'falha'), 300), updated_at = now() where tenant_id = p_tenant;
  end if;
end;
$$;

-- ---- Painel de implantação (só administradores da plataforma) ---------------------------------------

create or replace function public.admin_exigir() returns void
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from users where id = auth.uid() and is_platform_admin) then
    raise exception 'not allowed';
  end if;
end;
$$;

-- Quadro: leads da lista /60-dias que ainda não assinaram + negócios novos (desde diagnostico_inicio) com a situação.
create or replace function public.admin_implantacao_quadro()
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  return json_build_object(
    'leads', coalesce((
      select json_agg(x order by x.created_at desc) from (
        select l.id, l.nome, l.email, l.telefone, l.segmento, l.created_at, l.acesso_enviado_em
          from lista_vip l
         where l.campanha = 'lista-60-dias'
           and not exists (select 1 from users u where lower(u.email) = lower(l.email))
      ) x), '[]'::json),
    'clientes', coalesce((
      select json_agg(x order by x.criado_em desc) from (
        select t.id as tenant_id, t.nome, t.segmento, t.plano, t.created_at as criado_em,
               u.nome as dono_nome, u.email as dono_email,
               (select lc.telefone from leads_cadastro lc where lower(lc.email) = lower(u.email) order by lc.created_at desc limit 1) as telefone,
               s.status as assinatura_status,
               d.enviado_em, d.etapa, d.relatorio_em, d.relatorio_erro, d.lido_em, d.reuniao_em, d.implantado_em,
               d.relatorio -> 'resumo' as resumo,
               d.relatorio -> 'plano_recomendado' as plano_recomendado,
               d.relatorio -> 'potencial' as potencial,
               (select count(*) from cliente_historico h where h.tenant_id = t.id and h.tipo <> 'sistema') as anotacoes
          from tenants t
          left join users u on u.tenant_id = t.id and u.role = 'dono'
          left join subscriptions s on s.tenant_id = t.id
          left join diagnosticos d on d.tenant_id = t.id
         where t.created_at >= diagnostico_inicio() or d.tenant_id is not null
      ) x), '[]'::json)
  );
end;
$$;

create or replace function public.admin_cliente_ficha(p_tenant uuid)
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  return (
    select json_build_object(
      'tenant_id', t.id, 'nome', t.nome, 'segmento', t.segmento, 'plano', t.plano, 'criado_em', t.created_at,
      'dono_nome', u.nome, 'dono_email', u.email,
      'telefone', (select lc.telefone from leads_cadastro lc where lower(lc.email) = lower(u.email) order by lc.created_at desc limit 1),
      'assinatura_status', s.status,
      'whatsapp_conectado', exists (select 1 from whatsapp_accounts wa where wa.tenant_id = t.id and wa.status = 'ativo'),
      'diagnostico', (select row_to_json(d) from diagnosticos d where d.tenant_id = t.id),
      'historico', coalesce((select json_agg(h order by h.created_at desc) from cliente_historico h where h.tenant_id = t.id), '[]'::json)
    )
    from tenants t
    left join users u on u.tenant_id = t.id and u.role = 'dono'
    left join subscriptions s on s.tenant_id = t.id
    where t.id = p_tenant
  );
end;
$$;

create or replace function public.admin_cliente_marcar_lido(p_tenant uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  update diagnosticos set lido_em = coalesce(lido_em, now()) where tenant_id = p_tenant and relatorio is not null;
end;
$$;

create or replace function public.admin_cliente_anotar(p_tenant uuid, p_tipo text, p_texto text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  if p_tipo not in ('nota', 'reuniao') or length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'anotação inválida';
  end if;
  insert into cliente_historico (tenant_id, tipo, texto, autor)
  values (p_tenant, p_tipo, left(trim(p_texto), 8000), (select nome from users where id = auth.uid()));
end;
$$;

-- Marca (ou desmarca, com null) a reunião de implantação.
create or replace function public.admin_cliente_reuniao(p_tenant uuid, p_quando timestamptz) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  insert into diagnosticos (tenant_id, reuniao_em) values (p_tenant, p_quando)
  on conflict (tenant_id) do update set reuniao_em = excluded.reuniao_em, updated_at = now();
  insert into cliente_historico (tenant_id, tipo, texto, autor)
  values (p_tenant, 'sistema',
          case when p_quando is null then 'Reunião de implantação desmarcada.'
               else 'Reunião de implantação marcada para ' || to_char(p_quando at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || '.' end,
          (select nome from users where id = auth.uid()));
end;
$$;

create or replace function public.admin_cliente_implantado(p_tenant uuid, p_feito boolean) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform admin_exigir();
  insert into diagnosticos (tenant_id, implantado_em) values (p_tenant, case when p_feito then now() end)
  on conflict (tenant_id) do update set implantado_em = case when p_feito then now() end, updated_at = now();
  if p_feito then
    insert into cliente_historico (tenant_id, tipo, texto, autor)
    values (p_tenant, 'sistema', 'Implantação concluída.', (select nome from users where id = auth.uid()));
  end if;
end;
$$;

-- Permissões: o anon só chama as funções com segredo; logado chama as do cliente e as de admin (que conferem o papel).
revoke all on function public.diagnostico_meu() from public;
revoke all on function public.diagnostico_salvar(jsonb, int, boolean) from public;
revoke all on function public.diagnostico_para_relatorio(text, uuid) from public;
revoke all on function public.diagnostico_salvar_relatorio(text, uuid, jsonb, text) from public;
revoke all on function public.admin_exigir() from public;
revoke all on function public.admin_implantacao_quadro() from public;
revoke all on function public.admin_cliente_ficha(uuid) from public;
revoke all on function public.admin_cliente_marcar_lido(uuid) from public;
revoke all on function public.admin_cliente_anotar(uuid, text, text) from public;
revoke all on function public.admin_cliente_reuniao(uuid, timestamptz) from public;
revoke all on function public.admin_cliente_implantado(uuid, boolean) from public;
grant execute on function public.diagnostico_meu() to authenticated;
grant execute on function public.diagnostico_salvar(jsonb, int, boolean) to authenticated;
grant execute on function public.diagnostico_para_relatorio(text, uuid) to anon, authenticated;
grant execute on function public.diagnostico_salvar_relatorio(text, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.admin_exigir() to authenticated;
grant execute on function public.admin_implantacao_quadro() to authenticated;
grant execute on function public.admin_cliente_ficha(uuid) to authenticated;
grant execute on function public.admin_cliente_marcar_lido(uuid) to authenticated;
grant execute on function public.admin_cliente_anotar(uuid, text, text) to authenticated;
grant execute on function public.admin_cliente_reuniao(uuid, timestamptz) to authenticated;
grant execute on function public.admin_cliente_implantado(uuid, boolean) to authenticated;
