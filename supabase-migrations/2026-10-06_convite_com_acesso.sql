-- Convite com escolha do tipo de acesso: o administrador define, ao convidar, se a pessoa entra como
-- usuário comum ("profissional": agenda, conversas, CRM próprio, estoque, checkout) ou como
-- administrador ("dono": acesso total, inclusive plano e exclusão da conta).
--  * invites.role: 'profissional' (padrão) ou 'dono'.
--  * invites.atende: se a pessoa também atende clientes (cria o cadastro de profissional, aparece na
--    agenda). Usuário comum sempre atende; para administrador é opcional.
--  * get_invite_public passa a devolver o papel, para a página do convite explicar o acesso.
-- Convites antigos continuam valendo (role 'profissional', atende true).
--
-- Para desfazer: alter table public.invites drop column role, drop column atende;
--   e recriar accept_invite e get_invite_public pelas definições anteriores.

alter table public.invites
  add column if not exists role text not null default 'profissional' check (role in ('profissional', 'dono')),
  add column if not exists atende boolean not null default true;

drop function if exists public.get_invite_public(text);
create function public.get_invite_public(p_token text)
returns table (nome text, email text, tenant_nome text, valido boolean, papel text)
language sql
security definer
set search_path to 'public'
as $function$
  select i.nome, i.email, t.nome as tenant_nome,
         (i.status = 'pendente' and i.expires_at > now()) as valido,
         i.role as papel
  from invites i
  join tenants t on t.id = i.tenant_id
  where i.token = p_token;
$function$;

create or replace function public.accept_invite(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite invites%rowtype;
  v_user_email text;
  v_user_created_at timestamptz;
  v_auth_uid uuid := auth.uid();
  v_professional_id uuid;
begin
  select * into v_invite from invites where token = p_token for update;

  if v_invite is null or v_invite.status <> 'pendente' or v_invite.expires_at < now() then
    raise exception 'convite invalido ou expirado';
  end if;

  select email, created_at into v_user_email, v_user_created_at
  from auth.users where id = p_user_id;

  if v_user_email is null or lower(v_user_email) <> lower(v_invite.email) then
    raise exception 'not allowed';
  end if;

  if v_auth_uid is not null then
    if p_user_id <> v_auth_uid then
      raise exception 'not allowed';
    end if;
  else
    if v_user_created_at is null or v_user_created_at < now() - interval '10 minutes' then
      raise exception 'not allowed';
    end if;
    if exists (select 1 from users where id = p_user_id) then
      raise exception 'not allowed';
    end if;
  end if;

  if v_invite.professional_id is not null then
    -- Convite para um profissional já cadastrado: liga a conta a ele.
    select id into v_professional_id
    from professionals
    where id = v_invite.professional_id and tenant_id = v_invite.tenant_id;
    if v_professional_id is null then
      raise exception 'convite invalido ou expirado';
    end if;
    if exists (select 1 from users where professional_id = v_professional_id) then
      raise exception 'profissional ja possui acesso';
    end if;
  elsif v_invite.role = 'profissional' or v_invite.atende then
    insert into professionals (tenant_id, nome, comissao_pct)
    values (v_invite.tenant_id, v_invite.nome, 0)
    returning id into v_professional_id;
  end if;

  insert into users (id, tenant_id, nome, email, role, professional_id)
  values (p_user_id, v_invite.tenant_id, v_invite.nome, v_invite.email, v_invite.role, v_professional_id);

  update invites set status = 'aceito', accepted_at = now() where id = v_invite.id;

  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = p_user_id;

  return v_invite.tenant_id;
end;
$function$;
