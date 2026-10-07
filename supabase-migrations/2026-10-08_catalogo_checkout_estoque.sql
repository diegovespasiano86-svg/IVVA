-- Catálogo dinâmico (serviço / produto de venda / insumo), histórico de movimentações de estoque,
-- venda e estorno atômicos no Checkout e dados do Pix (copia e cola) de cada negócio.
--
-- Para desfazer:
--   drop function if exists public.pagamento_estornar(uuid);
--   drop function if exists public.pagamento_registrar(uuid, uuid, uuid, jsonb, text, numeric);
--   drop function if exists public.estoque_movimentar(uuid, int, text, text, uuid);
--   drop table if exists public.payments_estornados, public.stock_movements;
--   alter table public.products drop column tipo, drop column controla_estoque, drop column custo, drop column duracao_minutos, drop column ativo;
--   alter table public.tenants drop column pix_chave, drop column pix_beneficiario, drop column pix_cidade;

alter table public.products
  add column if not exists tipo text not null default 'venda' check (tipo in ('servico', 'venda', 'insumo')),
  add column if not exists controla_estoque boolean not null default true,
  add column if not exists custo numeric not null default 0,
  add column if not exists duracao_minutos integer,
  add column if not exists ativo boolean not null default true;

alter table public.tenants
  add column if not exists pix_chave text,
  add column if not exists pix_beneficiario text,
  add column if not exists pix_cidade text;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id(),
  product_id uuid not null references public.products(id) on delete cascade,
  tipo text not null check (tipo in ('venda', 'uso', 'entrada', 'ajuste', 'perda', 'estorno')),
  quantidade integer not null,
  saldo_apos integer not null,
  motivo text,
  payment_id uuid references public.payments(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_tenant_data on public.stock_movements (tenant_id, created_at desc);
create index if not exists stock_movements_produto_data on public.stock_movements (product_id, created_at desc);
alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select using (tenant_id = current_tenant_id());
drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements for insert with check (tenant_id = current_tenant_id());

create table if not exists public.payments_estornados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id(),
  pagamento jsonb not null,
  estornado_por uuid default auth.uid(),
  estornado_em timestamptz not null default now()
);
alter table public.payments_estornados enable row level security;
drop policy if exists payments_estornados_select on public.payments_estornados;
create policy payments_estornados_select on public.payments_estornados for select
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono');
drop policy if exists payments_estornados_insert on public.payments_estornados;
create policy payments_estornados_insert on public.payments_estornados for insert
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');

-- Move o saldo de um item com estoque controlado e registra no histórico. Itens sem controle não mexem.
create or replace function public.estoque_movimentar(
  p_product_id uuid, p_delta integer, p_tipo text, p_motivo text default null, p_payment_id uuid default null
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.products%rowtype;
  v_novo integer;
begin
  select * into v from public.products where id = p_product_id for update;
  if not found then raise exception 'produto_nao_encontrado'; end if;
  if not v.controla_estoque then return null; end if;
  v_novo := v.estoque_atual + p_delta;
  if v_novo < 0 then
    raise exception 'estoque_insuficiente:%:%', v.nome, v.estoque_atual;
  end if;
  update public.products set estoque_atual = v_novo where id = p_product_id;
  insert into public.stock_movements (tenant_id, product_id, tipo, quantidade, saldo_apos, motivo, payment_id)
  values (v.tenant_id, p_product_id, p_tipo, p_delta, v_novo, p_motivo, p_payment_id);
  return v_novo;
end;
$$;

-- Registra o pagamento do carrinho (serviços + produtos), calcula a comissão só sobre serviços,
-- baixa o estoque dos produtos e conclui o agendamento, tudo numa transação.
-- Cada item: {product_id?, nome, qtd, preco_unit}. Item sem product_id é um serviço/valor avulso.
create or replace function public.pagamento_registrar(
  p_contact_id uuid, p_professional_id uuid, p_appointment_id uuid,
  p_itens jsonb, p_forma text, p_desconto numeric default 0
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_prod public.products%rowtype;
  v_itens jsonb := '[]'::jsonb;
  v_qtd integer;
  v_preco numeric;
  v_valor numeric;
  v_nome text;
  v_bruto numeric := 0;
  v_servicos numeric := 0;
  v_total numeric;
  v_pct numeric := 0;
  v_comissao numeric;
  v_tenant uuid := current_tenant_id();
  v_pid uuid;
begin
  if p_forma not in ('pix', 'credito', 'debito', 'dinheiro') then raise exception 'forma_invalida'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'carrinho_vazio'; end if;
  if jsonb_array_length(p_itens) > 50 then raise exception 'carrinho_grande'; end if;
  if coalesce(p_desconto, 0) < 0 then raise exception 'desconto_invalido'; end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((v_item ->> 'qtd')::integer, 1);
    v_preco := coalesce((v_item ->> 'preco_unit')::numeric, 0);
    if v_qtd < 1 or v_qtd > 9999 or v_preco < 0 or v_preco > 1000000 then raise exception 'item_invalido'; end if;
    v_valor := round(v_qtd * v_preco, 2);
    v_nome := nullif(trim(coalesce(v_item ->> 'nome', '')), '');
    if (v_item ->> 'product_id') is not null then
      select * into v_prod from public.products where id = (v_item ->> 'product_id')::uuid and tenant_id = v_tenant;
      if not found then raise exception 'produto_nao_encontrado'; end if;
      v_nome := v_prod.nome;
      v_itens := v_itens || jsonb_build_object('product_id', v_prod.id, 'tipo', v_prod.tipo, 'nome', v_prod.nome,
                   'servico', v_prod.nome, 'qtd', v_qtd, 'preco_unit', v_preco, 'valor', v_valor);
      if v_prod.tipo = 'servico' then v_servicos := v_servicos + v_valor; end if;
    else
      if v_nome is null then raise exception 'item_sem_nome'; end if;
      v_itens := v_itens || jsonb_build_object('tipo', 'servico', 'nome', v_nome, 'servico', v_nome,
                   'qtd', v_qtd, 'preco_unit', v_preco, 'valor', v_valor);
      v_servicos := v_servicos + v_valor;
    end if;
    v_bruto := v_bruto + v_valor;
  end loop;

  if p_desconto > v_bruto then raise exception 'desconto_maior_que_total'; end if;
  v_total := round(v_bruto - coalesce(p_desconto, 0), 2);
  if v_total <= 0 then raise exception 'total_invalido'; end if;

  select coalesce(comissao_pct, 0) into v_pct from public.professionals where id = p_professional_id;
  v_comissao := case when v_bruto > 0 then round(v_servicos * (v_total / v_bruto) * (coalesce(v_pct, 0) / 100), 2) else 0 end;

  insert into public.payments (tenant_id, contact_id, professional_id, appointment_id, itens, desconto, forma_pagamento, valor_total, comissao_calculada)
  values (v_tenant, p_contact_id, p_professional_id, p_appointment_id, v_itens, coalesce(p_desconto, 0), p_forma, v_total, v_comissao)
  returning id into v_pid;

  for v_item in select * from jsonb_array_elements(v_itens) loop
    if (v_item ->> 'product_id') is not null and (v_item ->> 'tipo') = 'venda' then
      perform public.estoque_movimentar((v_item ->> 'product_id')::uuid, -((v_item ->> 'qtd')::integer), 'venda', 'Venda no Checkout', v_pid);
    end if;
  end loop;

  if p_appointment_id is not null then
    update public.appointments set status = 'concluido' where id = p_appointment_id;
  end if;
  return v_pid;
end;
$$;

-- Estorna um pagamento (só o administrador): devolve os produtos ao estoque e guarda uma cópia para auditoria.
create or replace function public.pagamento_estornar(p_payment_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pag public.payments%rowtype;
  v_item jsonb;
begin
  if current_app_role() <> 'dono' then raise exception 'somente_administrador'; end if;
  select * into v_pag from public.payments where id = p_payment_id;
  if not found then raise exception 'pagamento_nao_encontrado'; end if;

  for v_item in select * from jsonb_array_elements(coalesce(v_pag.itens, '[]'::jsonb)) loop
    if (v_item ->> 'product_id') is not null and (v_item ->> 'tipo') = 'venda' then
      if exists (select 1 from public.products where id = (v_item ->> 'product_id')::uuid) then
        perform public.estoque_movimentar((v_item ->> 'product_id')::uuid, (v_item ->> 'qtd')::integer, 'estorno', 'Estorno de pagamento', null);
      end if;
    end if;
  end loop;

  insert into public.payments_estornados (tenant_id, pagamento) values (v_pag.tenant_id, to_jsonb(v_pag));
  delete from public.payments where id = p_payment_id;
end;
$$;

revoke all on function public.estoque_movimentar(uuid, integer, text, text, uuid) from public;
revoke all on function public.pagamento_registrar(uuid, uuid, uuid, jsonb, text, numeric) from public;
revoke all on function public.pagamento_estornar(uuid) from public;
grant execute on function public.estoque_movimentar(uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.pagamento_registrar(uuid, uuid, uuid, jsonb, text, numeric) to authenticated;
grant execute on function public.pagamento_estornar(uuid) to authenticated;
