-- Cada profissional da equipe ganha uma cor própria no calendário.
-- 1) Gatilho: ao cadastrar, pega a primeira cor da paleta que ainda não é usada no negócio.
-- 2) Correção: negócios que já tinham cores repetidas são recoloridos na ordem de cadastro.
create or replace function public.ivva_paleta_prof() returns text[] language sql immutable as $$
  select array['#8B7FE8','#2FBF9F','#FF6B5B','#F5A623','#3B82F6','#EC4899','#14B8A6','#84CC16','#A855F7','#64748B']
$$;

create or replace function public.ivva_cor_profissional() returns trigger language plpgsql as $$
declare
  paleta text[] := public.ivva_paleta_prof();
  usadas text[];
  c text;
begin
  select coalesce(array_agg(upper(cor)), '{}') into usadas from professionals where tenant_id = new.tenant_id;
  foreach c in array paleta loop
    if not (upper(c) = any(usadas)) then new.cor := c; return new; end if;
  end loop;
  new.cor := paleta[1 + (coalesce(array_length(usadas,1),0) % array_length(paleta,1))];
  return new;
end $$;

drop trigger if exists trg_cor_profissional on professionals;
create trigger trg_cor_profissional before insert on professionals
  for each row execute function public.ivva_cor_profissional();

with dup as (
  select tenant_id from professionals group by tenant_id having count(*) <> count(distinct upper(cor))
), ordem as (
  select p.id, row_number() over (partition by p.tenant_id order by p.created_at, p.id) rn
  from professionals p join dup using (tenant_id)
)
update professionals p set cor = (public.ivva_paleta_prof())[1 + ((o.rn - 1) % 10)]
from ordem o where o.id = p.id;
