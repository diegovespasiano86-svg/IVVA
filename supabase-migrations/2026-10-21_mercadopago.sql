-- Mercado Pago (conta do próprio cliente da ivva, conectada por OAuth). SÓ ACRESCENTA: uma tabela, uma coluna e funções.
-- Os tokens ficam CRIPTOGRAFADOS (pgcrypto, chave = segredo interno do servidor) e nunca voltam para o navegador.
-- Para desfazer: drop das funções mp_* e cobranca_externo/cobranca_paga_id; alter table cobrancas drop column provedor;
--   restaurar cobrancas_forma_check (pix, link); drop table public.mercadopago_contas.

create table if not exists public.mercadopago_contas (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  mp_user_id bigint not null unique,
  access_cifrado bytea not null,
  refresh_cifrado bytea,
  expira_em timestamptz,
  terminal_id text,
  criada_em timestamptz not null default now()
);
alter table public.mercadopago_contas enable row level security; -- sem políticas: só as funções abaixo

alter table public.cobrancas add column if not exists provedor text not null default 'asaas';
alter table public.cobrancas drop constraint if exists cobrancas_provedor_check;
alter table public.cobrancas add constraint cobrancas_provedor_check check (provedor in ('asaas', 'mercadopago'));
alter table public.cobrancas drop constraint if exists cobrancas_forma_check;
alter table public.cobrancas add constraint cobrancas_forma_check check (forma in ('pix', 'link', 'maquininha'));

create or replace function public.mp_conta_estado()
returns jsonb language sql security definer set search_path to 'public' as $f$
  select coalesce((select jsonb_build_object('conectada', true, 'terminal_id', terminal_id) from mercadopago_contas where tenant_id = current_tenant_id()),
                  jsonb_build_object('conectada', false));
$f$;

create or replace function public.mp_conta_remover()
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not exists (select 1 from users where id = auth.uid() and role = 'dono') then raise exception 'sem permissao'; end if;
  delete from mercadopago_contas where tenant_id = current_tenant_id();
end; $f$;

create or replace function public.mp_terminal_definir(p_terminal text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not exists (select 1 from users where id = auth.uid() and role = 'dono') then raise exception 'sem permissao'; end if;
  update mercadopago_contas set terminal_id = nullif(trim(p_terminal), '') where tenant_id = current_tenant_id();
end; $f$;

create or replace function public.mp_conta_salvar(p_secret text, p_tenant uuid, p_user bigint, p_access text, p_refresh text, p_expira timestamptz)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
begin
  perform check_webhook_secret(p_secret);
  insert into mercadopago_contas (tenant_id, mp_user_id, access_cifrado, refresh_cifrado, expira_em)
  values (p_tenant, p_user, pgp_sym_encrypt(p_access, p_secret), case when p_refresh is null then null else pgp_sym_encrypt(p_refresh, p_secret) end, p_expira)
  on conflict (tenant_id) do update set mp_user_id = excluded.mp_user_id, access_cifrado = excluded.access_cifrado,
    refresh_cifrado = excluded.refresh_cifrado, expira_em = excluded.expira_em;
end; $f$;

create or replace function public.mp_conta_ler(p_secret text, p_tenant uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v mercadopago_contas%rowtype;
begin
  perform check_webhook_secret(p_secret);
  select * into v from mercadopago_contas where tenant_id = p_tenant;
  if v.tenant_id is null then return null; end if;
  return jsonb_build_object('access', pgp_sym_decrypt(v.access_cifrado, p_secret),
    'refresh', case when v.refresh_cifrado is null then null else pgp_sym_decrypt(v.refresh_cifrado, p_secret) end,
    'expira_em', v.expira_em, 'terminal_id', v.terminal_id, 'mp_user_id', v.mp_user_id);
end; $f$;

create or replace function public.mp_conta_por_usuario(p_secret text, p_user bigint)
returns uuid language plpgsql security definer set search_path to 'public' as $f$
declare v uuid;
begin
  perform check_webhook_secret(p_secret);
  select tenant_id into v from mercadopago_contas where mp_user_id = p_user;
  return v;
end; $f$;

-- Segunda fase da criação: a cobrança nasce antes (o id dela vai como external_reference), e depois recebe o id do provedor.
create or replace function public.cobranca_externo(p_secret text, p_id uuid, p_provedor text, p_externo text, p_url text, p_pix text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  perform check_webhook_secret(p_secret);
  update cobrancas set provedor = p_provedor, asaas_id = p_externo, url = p_url, pix_copia_cola = p_pix where id = p_id and status = 'pendente';
end; $f$;

-- Pagamento confirmado pelo Mercado Pago: confere o negócio e o valor e reaproveita a mesma baixa do Asaas (cobranca_paga).
create or replace function public.cobranca_paga_id(p_secret text, p_id uuid, p_tenant uuid, p_valor numeric, p_forma text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare c cobrancas%rowtype;
begin
  perform check_webhook_secret(p_secret);
  select * into c from cobrancas where id = p_id and tenant_id = p_tenant;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'cobranca_desconhecida'); end if;
  if c.valor <> p_valor then return jsonb_build_object('ok', false, 'motivo', 'valor_divergente'); end if;
  return cobranca_paga(p_secret, c.asaas_id, p_forma);
end; $f$;

revoke all on function public.mp_conta_estado(), public.mp_conta_remover(), public.mp_terminal_definir(text),
  public.mp_conta_salvar(text,uuid,bigint,text,text,timestamptz), public.mp_conta_ler(text,uuid), public.mp_conta_por_usuario(text,bigint),
  public.cobranca_externo(text,uuid,text,text,text,text), public.cobranca_paga_id(text,uuid,uuid,numeric,text) from public;
grant execute on function public.mp_conta_estado(), public.mp_conta_remover(), public.mp_terminal_definir(text) to authenticated;
grant execute on function public.mp_conta_salvar(text,uuid,bigint,text,text,timestamptz), public.mp_conta_ler(text,uuid), public.mp_conta_por_usuario(text,bigint),
  public.cobranca_externo(text,uuid,text,text,text,text), public.cobranca_paga_id(text,uuid,uuid,numeric,text) to anon, authenticated;
