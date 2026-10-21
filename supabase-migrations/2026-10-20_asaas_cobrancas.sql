-- Cobrança pelo Asaas (conta do próprio cliente da ivva). SÓ ACRESCENTA: duas tabelas e as funções abaixo.
-- A chave da API do Asaas do negócio fica CRIPTOGRAFADA (pgcrypto, chave = segredo interno do servidor) e nunca volta para o navegador.
-- Para desfazer: drop das funções asaas_* e cobranca_*; drop table public.cobrancas, public.asaas_contas;

create table if not exists public.asaas_contas (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  chave_cifrada bytea not null,
  ambiente text not null check (ambiente in ('sandbox', 'producao')),
  webhook_token text not null unique,
  criada_em timestamptz not null default now()
);
alter table public.asaas_contas enable row level security; -- sem políticas: só as funções abaixo

create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  professional_id uuid,
  appointment_id uuid,
  conversation_id uuid,
  itens jsonb not null,
  desconto numeric not null default 0,
  valor numeric not null check (valor > 0),
  forma text not null check (forma in ('pix', 'link')),
  origem text not null default 'checkout' check (origem in ('checkout', 'robo')),
  asaas_id text not null unique,
  url text,
  pix_copia_cola text,
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'paga_sem_registro', 'expirada', 'cancelada')),
  erro text,
  payment_id uuid,
  criada_em timestamptz not null default now(),
  paga_em timestamptz
);
create index if not exists cobrancas_tenant_idx on public.cobrancas (tenant_id, criada_em desc);
alter table public.cobrancas enable row level security;
drop policy if exists cobrancas_leitura on public.cobrancas;
create policy cobrancas_leitura on public.cobrancas for select to authenticated using (tenant_id = public.current_tenant_id());
grant select on public.cobrancas to authenticated;

create or replace function public.asaas_conta_estado()
returns jsonb language sql security definer set search_path to 'public' as $f$
  select coalesce((select jsonb_build_object('conectada', true, 'ambiente', ambiente) from asaas_contas where tenant_id = current_tenant_id()),
                  jsonb_build_object('conectada', false));
$f$;

create or replace function public.asaas_conta_remover()
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not exists (select 1 from users where id = auth.uid() and role = 'dono') then raise exception 'sem permissao'; end if;
  delete from asaas_contas where tenant_id = current_tenant_id();
end; $f$;

create or replace function public.asaas_conta_salvar(p_secret text, p_tenant uuid, p_chave text, p_ambiente text, p_token text)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
begin
  perform check_webhook_secret(p_secret);
  insert into asaas_contas (tenant_id, chave_cifrada, ambiente, webhook_token)
  values (p_tenant, pgp_sym_encrypt(p_chave, p_secret), p_ambiente, p_token)
  on conflict (tenant_id) do update set chave_cifrada = excluded.chave_cifrada, ambiente = excluded.ambiente, webhook_token = excluded.webhook_token;
end; $f$;

create or replace function public.asaas_conta_ler(p_secret text, p_tenant uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v asaas_contas%rowtype;
begin
  perform check_webhook_secret(p_secret);
  select * into v from asaas_contas where tenant_id = p_tenant;
  if v.tenant_id is null then return null; end if;
  return jsonb_build_object('chave', pgp_sym_decrypt(v.chave_cifrada, p_secret), 'ambiente', v.ambiente, 'webhook_token', v.webhook_token);
end; $f$;

create or replace function public.asaas_conta_por_token(p_secret text, p_token text)
returns uuid language plpgsql security definer set search_path to 'public' as $f$
declare v uuid;
begin
  perform check_webhook_secret(p_secret);
  select tenant_id into v from asaas_contas where webhook_token = p_token;
  return v;
end; $f$;

create or replace function public.cobranca_criar(p_secret text, p_tenant uuid, p_contact uuid, p_professional uuid, p_appointment uuid,
  p_conversation uuid, p_itens jsonb, p_desconto numeric, p_valor numeric, p_forma text, p_origem text, p_asaas_id text, p_url text, p_pix text)
returns uuid language plpgsql security definer set search_path to 'public' as $f$
declare v uuid;
begin
  perform check_webhook_secret(p_secret);
  insert into cobrancas (tenant_id, contact_id, professional_id, appointment_id, conversation_id, itens, desconto, valor, forma, origem, asaas_id, url, pix_copia_cola)
  values (p_tenant, p_contact, p_professional, p_appointment, p_conversation, p_itens, coalesce(p_desconto, 0), p_valor, p_forma, p_origem, p_asaas_id, p_url, p_pix)
  returning id into v;
  return v;
end; $f$;

-- Pagamento confirmado pelo Asaas: registra a venda (baixa de estoque, comissão, relatórios) pela mesma função do Checkout.
-- A função do Checkout usa o usuário logado; aqui assumimos o dono do negócio só durante esta chamada.
create or replace function public.cobranca_paga(p_secret text, p_asaas_id text, p_forma text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare c cobrancas%rowtype; v_dono uuid; v_pid uuid; v_itens jsonb;
begin
  perform check_webhook_secret(p_secret);
  select * into c from cobrancas where asaas_id = p_asaas_id for update;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'cobranca_desconhecida'); end if;
  if c.status in ('paga', 'paga_sem_registro') then return jsonb_build_object('ok', true, 'repetido', true); end if;
  select id into v_dono from users where tenant_id = c.tenant_id and role = 'dono' order by created_at limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('product_id', i ->> 'product_id', 'nome', i ->> 'nome', 'qtd', coalesce((i ->> 'qtd')::int, 1), 'preco_unit', (i ->> 'preco_unit')::numeric)), '[]'::jsonb)
    into v_itens from jsonb_array_elements(c.itens) i;
  begin
    perform set_config('request.jwt.claim.sub', v_dono::text, true);
    v_pid := pagamento_registrar(c.contact_id, c.professional_id, c.appointment_id, v_itens,
      case when p_forma in ('credito', 'debito', 'pix') then p_forma else 'pix' end, c.desconto);
    update cobrancas set status = 'paga', payment_id = v_pid, paga_em = now() where id = c.id;
    return jsonb_build_object('ok', true, 'payment_id', v_pid);
  exception when others then
    update cobrancas set status = 'paga_sem_registro', erro = left(sqlerrm, 300), paga_em = now() where id = c.id;
    return jsonb_build_object('ok', true, 'sem_registro', true, 'erro', left(sqlerrm, 300));
  end;
end; $f$;

create or replace function public.cobranca_status(p_secret text, p_asaas_id text, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  perform check_webhook_secret(p_secret);
  if p_status not in ('expirada', 'cancelada') then raise exception 'status invalido'; end if;
  update cobrancas set status = p_status where asaas_id = p_asaas_id and status = 'pendente';
end; $f$;

revoke all on function public.asaas_conta_estado(), public.asaas_conta_remover(),
  public.asaas_conta_salvar(text,uuid,text,text,text), public.asaas_conta_ler(text,uuid), public.asaas_conta_por_token(text,text),
  public.cobranca_criar(text,uuid,uuid,uuid,uuid,uuid,jsonb,numeric,numeric,text,text,text,text,text), public.cobranca_paga(text,text,text), public.cobranca_status(text,text,text) from public;
grant execute on function public.asaas_conta_estado(), public.asaas_conta_remover() to authenticated;
grant execute on function public.asaas_conta_salvar(text,uuid,text,text,text), public.asaas_conta_ler(text,uuid), public.asaas_conta_por_token(text,text),
  public.cobranca_criar(text,uuid,uuid,uuid,uuid,uuid,jsonb,numeric,numeric,text,text,text,text,text), public.cobranca_paga(text,text,text), public.cobranca_status(text,text,text) to anon, authenticated;
