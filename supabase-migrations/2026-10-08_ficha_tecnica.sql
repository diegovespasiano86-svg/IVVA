-- Ficha técnica: cada serviço lista os insumos que consome; ao receber o pagamento do serviço no Checkout,
-- os insumos baixam sozinhos (sem travar a venda se faltar insumo: baixa o que houver e o alerta de mínimo avisa).
--
-- Para desfazer:
--   drop table if exists public.product_consumos;
--   (recriar estoque_movimentar de 5 parâmetros e pagamento_registrar da migration 2026-10-08_catalogo_checkout_estoque.sql)

create table if not exists public.product_consumos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id(),
  servico_id uuid not null references public.products(id) on delete cascade,
  insumo_id uuid not null references public.products(id) on delete cascade,
  quantidade integer not null check (quantidade between 1 and 1000),
  unique (servico_id, insumo_id)
);
alter table public.product_consumos enable row level security;
drop policy if exists product_consumos_select on public.product_consumos;
create policy product_consumos_select on public.product_consumos for select using (tenant_id = current_tenant_id());
drop policy if exists product_consumos_write on public.product_consumos;
create policy product_consumos_write on public.product_consumos for all
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono')
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');

drop function if exists public.estoque_movimentar(uuid, integer, text, text, uuid);
create or replace function public.estoque_movimentar(
  p_product_id uuid, p_delta integer, p_tipo text, p_motivo text default null, p_payment_id uuid default null,
  p_tolerante boolean default false
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.products%rowtype;
  v_novo integer;
  v_delta integer := p_delta;
begin
  select * into v from public.products where id = p_product_id for update;
  if not found then raise exception 'produto_nao_encontrado'; end if;
  if not v.controla_estoque then return null; end if;
  v_novo := v.estoque_atual + v_delta;
  if v_novo < 0 then
    if not p_tolerante then raise exception 'estoque_insuficiente:%:%', v.nome, v.estoque_atual; end if;
    v_delta := -v.estoque_atual;
    v_novo := 0;
  end if;
  if v_delta = 0 then return v.estoque_atual; end if;
  update public.products set estoque_atual = v_novo where id = p_product_id;
  insert into public.stock_movements (tenant_id, product_id, tipo, quantidade, saldo_apos, motivo, payment_id)
  values (v.tenant_id, p_product_id, p_tipo, v_delta, v_novo, p_motivo, p_payment_id);
  return v_novo;
end;
$$;
revoke all on function public.estoque_movimentar(uuid, integer, text, text, uuid, boolean) from public;
grant execute on function public.estoque_movimentar(uuid, integer, text, text, uuid, boolean) to authenticated;

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
  v_rec record;
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
    elsif (v_item ->> 'product_id') is not null and (v_item ->> 'tipo') = 'servico' then
      -- Ficha técnica: baixa os insumos do serviço (sem travar a venda se faltar).
      for v_rec in select insumo_id, quantidade from public.product_consumos where servico_id = (v_item ->> 'product_id')::uuid loop
        perform public.estoque_movimentar(v_rec.insumo_id, -(v_rec.quantidade * (v_item ->> 'qtd')::integer), 'uso',
                                          'Uso em ' || (v_item ->> 'nome'), v_pid, true);
      end loop;
    end if;
  end loop;

  if p_appointment_id is not null then
    update public.appointments set status = 'concluido' where id = p_appointment_id;
  end if;
  return v_pid;
end;
$$;
