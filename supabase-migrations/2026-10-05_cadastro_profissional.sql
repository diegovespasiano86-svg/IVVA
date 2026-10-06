-- Cadastro de profissional pelo dono + convite por e-mail que liga o acesso ao cadastro existente.
--
-- Antes: o único jeito de ter um profissional era convidar alguém por e-mail (a conta nascia junto
-- com o profissional), e o dono não podia se cadastrar como profissional. Agora:
--  * o dono cadastra o profissional (nome, cor, comissão) sem precisar de e-mail;
--  * depois, opcionalmente, convida essa pessoa por e-mail: o convite aponta para o cadastro já
--    existente (invites.professional_id) e, ao aceitar, a conta nova vira usuário com o papel
--    'profissional' ligado a esse cadastro. O papel NUNCA é 'dono' por convite.
--  * convites antigos (sem professional_id) continuam funcionando como antes.
--
-- Defesa em camadas (acesso só como usuário, não administrador): a base de conhecimento do robô
-- passa a aceitar escrita só do dono; o profissional segue podendo ler. As demais tabelas de
-- administração já exigiam o dono (WhatsApp, assinatura, campanhas, etiquetas, funil, usuários...).
-- As rotas de administração são bloqueadas no servidor (src/lib/supabase/middleware.ts).
--
-- Para desfazer:
--   alter table public.invites drop column professional_id;
--   -- recriar accept_invite pela definição anterior (sempre inserir professionals) e as policies
--   -- kb_all / knowledge_files_all (for all using (tenant_id = current_tenant_id())).

alter table public.invites
  add column if not exists professional_id uuid references public.professionals(id) on delete set null;
create index if not exists invites_professional_idx on public.invites (professional_id)
  where professional_id is not null;

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
    -- Convite para um profissional já cadastrado pelo dono: liga a conta a ele.
    select id into v_professional_id
    from professionals
    where id = v_invite.professional_id and tenant_id = v_invite.tenant_id;
    if v_professional_id is null then
      raise exception 'convite invalido ou expirado';
    end if;
    if exists (select 1 from users where professional_id = v_professional_id) then
      raise exception 'profissional ja possui acesso';
    end if;
  else
    insert into professionals (tenant_id, nome, comissao_pct)
    values (v_invite.tenant_id, v_invite.nome, 0)
    returning id into v_professional_id;
  end if;

  insert into users (id, tenant_id, nome, email, role, professional_id)
  values (p_user_id, v_invite.tenant_id, v_invite.nome, v_invite.email, 'profissional', v_professional_id);

  update invites set status = 'aceito', accepted_at = now() where id = v_invite.id;

  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = p_user_id;

  return v_invite.tenant_id;
end;
$function$;

-- Base de conhecimento do robô: todos do negócio leem; só o dono altera.
drop policy if exists kb_all on public.knowledge_base;
create policy kb_select on public.knowledge_base for select
  using (tenant_id = current_tenant_id());
create policy kb_insert_owner on public.knowledge_base for insert
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');
create policy kb_update_owner on public.knowledge_base for update
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono')
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');
create policy kb_delete_owner on public.knowledge_base for delete
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono');

drop policy if exists knowledge_files_all on public.knowledge_files;
create policy knowledge_files_select on public.knowledge_files for select
  using (tenant_id = current_tenant_id());
create policy knowledge_files_insert_owner on public.knowledge_files for insert
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');
create policy knowledge_files_update_owner on public.knowledge_files for update
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono')
  with check (tenant_id = current_tenant_id() and current_app_role() = 'dono');
create policy knowledge_files_delete_owner on public.knowledge_files for delete
  using (tenant_id = current_tenant_id() and current_app_role() = 'dono');
