-- Indique e ganhe (v2). SÓ ACRESCENTA: coluna, tabela e funções novas.
-- Regras: quem indica ganha R$ 150 de desconto na mensalidade seguinte quando o indicado contrata um plano MENSAL
-- e a assinatura dele segue ativa 30 dias depois da contratação.
-- Para desfazer: drop table public.indicacoes; drop function public.indicacao_codigo(), indicacao_registrar(text,text,text),
--   indicacoes_a_pagar(text), indicacao_resolver(text,uuid,text,text); alter table public.tenants drop column codigo_indicacao;

alter table public.tenants add column if not exists codigo_indicacao text;
create unique index if not exists tenants_codigo_indicacao_key on public.tenants (codigo_indicacao) where codigo_indicacao is not null;

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_indicador_id uuid not null references public.tenants(id) on delete cascade,
  email_indicado text not null,
  status text not null default 'aguardando' check (status in ('aguardando', 'paga', 'recusada', 'expirada')),
  motivo text,
  valor_centavos integer not null default 15000,
  created_at timestamptz not null default now(),
  resolvida_em timestamptz,
  unique (email_indicado)
);
alter table public.indicacoes enable row level security;
drop policy if exists indicacoes_ver_proprias on public.indicacoes;
create policy indicacoes_ver_proprias on public.indicacoes for select using (tenant_indicador_id = current_tenant_id());

-- Código de indicação do negócio logado (cria na primeira vez). Só o dono.
create or replace function public.indicacao_codigo()
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant uuid;
  v_role text;
  v_cod text;
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  select tenant_id, role into v_tenant, v_role from users where id = auth.uid();
  if v_tenant is null or v_role <> 'dono' then return null; end if;
  select codigo_indicacao into v_cod from tenants where id = v_tenant;
  if v_cod is not null then return v_cod; end if;
  loop
    v_cod := '';
    for i in 1..7 loop
      v_cod := v_cod || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    begin
      update tenants set codigo_indicacao = v_cod where id = v_tenant and codigo_indicacao is null;
      exit;
    exception when unique_violation then
      -- código repetido: sorteia outro
    end;
  end loop;
  select codigo_indicacao into v_cod from tenants where id = v_tenant;
  return v_cod;
end;
$$;

-- Registra a indicação quando o indicado preenche o cadastro. Ignora (sem erro) auto-indicação, conta já existente e código inválido.
create or replace function public.indicacao_registrar(p_secret text, p_codigo text, p_email text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform check_webhook_secret(p_secret);
  if v_email = '' or p_codigo is null or length(p_codigo) > 20 then return jsonb_build_object('ok', false); end if;
  select id into v_tenant from tenants where codigo_indicacao = upper(trim(p_codigo));
  if v_tenant is null then return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido'); end if;
  if exists (select 1 from users u where u.tenant_id = v_tenant and lower(u.email) = v_email) then
    return jsonb_build_object('ok', false, 'motivo', 'auto_indicacao');
  end if;
  if exists (select 1 from users u where lower(u.email) = v_email) then
    return jsonb_build_object('ok', false, 'motivo', 'conta_existente');
  end if;
  insert into indicacoes (tenant_indicador_id, email_indicado) values (v_tenant, v_email) on conflict (email_indicado) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- Indicações prontas para conferir: o indicado tem negócio criado há 30 dias ou mais. Também expira as que ficaram 60 dias sem virar cliente.
create or replace function public.indicacoes_a_pagar(p_secret text)
returns table (
  indicacao_id uuid,
  valor_centavos integer,
  indicador_customer_id text,
  indicado_customer_id text,
  indicado_desde timestamptz
)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);

  update indicacoes i
     set status = 'expirada', motivo = 'nao_virou_cliente', resolvida_em = now()
   where i.status = 'aguardando'
     and i.created_at < now() - interval '60 days'
     and not exists (select 1 from users u where lower(u.email) = i.email_indicado);

  return query
  select i.id, i.valor_centavos,
         (select s.stripe_customer_id from subscriptions s where s.tenant_id = i.tenant_indicador_id order by s.created_at desc limit 1),
         sub.stripe_customer_id,
         sub.created_at
    from indicacoes i
    join users u on lower(u.email) = i.email_indicado
    join lateral (
      select s.stripe_customer_id, s.created_at from subscriptions s where s.tenant_id = u.tenant_id order by s.created_at desc limit 1
    ) sub on true
   where i.status = 'aguardando'
     and sub.created_at <= now() - interval '30 days';
end;
$$;

create or replace function public.indicacao_resolver(p_secret text, p_id uuid, p_status text, p_motivo text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform check_webhook_secret(p_secret);
  if p_status not in ('paga', 'recusada') then raise exception 'status inválido'; end if;
  update indicacoes set status = p_status, motivo = left(p_motivo, 80), resolvida_em = now() where id = p_id and status = 'aguardando';
end;
$$;
