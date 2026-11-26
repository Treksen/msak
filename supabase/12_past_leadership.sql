-- =====================================================================
-- 12 · Past leadership: members record positions they held; leaders confirm; public honour roll
-- =====================================================================
-- - Any member can add positions they held before (level, campus/association, position, years). Each one is a
--   confirmation request. Past positions never give posting or approval rights.
-- - Regional leaders confirm campus and regional positions in their association; administrators confirm any,
--   and are the only ones who confirm national positions.
-- - Confirmed national and regional positions appear on the public "Past leaders" page only if the member ticked
--   "show me publicly" (their consent, per the Data Protection Act). Leaders and admins see confirmed ones in Members.
-- Safe to run more than once.

create table if not exists public.past_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level in ('institutional', 'regional', 'national')),
  association_id smallint references public.associations (id) on delete restrict,
  institution_id bigint references public.institutions (id) on delete restrict,
  position text not null check (length(btrim(position)) between 2 and 100),
  from_year integer not null check (from_year between 1990 and 2100),
  to_year integer not null check (to_year between 1990 and 2100),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  show_publicly boolean not null default false,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 300),
  created_at timestamptz not null default now(),
  constraint past_roles_years_check check (to_year >= from_year and to_year - from_year <= 10),
  constraint past_roles_scope_check check (
    (level = 'institutional' and institution_id is not null and association_id is not null)
    or (level = 'regional' and association_id is not null and institution_id is null)
    or (level = 'national' and association_id is null and institution_id is null)
  )
);
create index if not exists past_roles_user_idx on public.past_roles (user_id);
create index if not exists past_roles_pending_idx on public.past_roles (association_id) where status = 'pending';
alter table public.past_roles enable row level security;

/** Regional leaders of the association (campus and regional positions) and admins (any). Never your own. */
create or replace function public.can_review_past_role(p_level text, p_association_id smallint, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is distinct from auth.uid() and (
    public.is_admin()
    or (p_level in ('institutional', 'regional') and public.has_role('regional', p_association_id))
  );
$$;
revoke all on function public.can_review_past_role(text, smallint, uuid) from public;
grant execute on function public.can_review_past_role(text, smallint, uuid) to authenticated;

drop policy if exists "Read past leadership" on public.past_roles;
create policy "Read past leadership" on public.past_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or public.can_review_past_role(level, association_id, user_id)
    -- any active leader can see confirmed history (to find experienced alumni)
    or (status = 'confirmed' and exists (
          select 1 from public.leader_roles r
           where r.user_id = (select auth.uid()) and r.status = 'approved'
             and (r.term_ends_on is null or r.term_ends_on >= public.kenya_today())))
  );
-- all writes go through the functions below
revoke insert, update, delete on public.past_roles from authenticated, anon;
grant select on public.past_roles to authenticated;

-- ---------- Add / remove / show publicly (the member) ---------------------------------------
create or replace function public.add_past_role(
  p_level text, p_institution_id bigint, p_association_id smallint, p_position text,
  p_from integer, p_to integer, p_show_publicly boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_assoc smallint := p_association_id;
  v_id uuid;
begin
  if not public.is_member() then
    raise exception 'Complete your profile first.' using errcode = '42501';
  end if;
  if public.i_am_declined() then
    raise exception 'A leader could not confirm your membership, so you can''t do this. Contact MSAK through Help & feedback.' using errcode = '42501';
  end if;
  if p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose campus, regional or national.' using errcode = '22023';
  end if;
  if p_level = 'institutional' then
    v_assoc := public.institution_association_id(p_institution_id);
    if v_assoc is null then
      raise exception 'Choose the institution.' using errcode = '22023';
    end if;
  elsif p_level = 'regional' and v_assoc is null then
    raise exception 'Choose the association.' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'The end year must be the same as or after the start year.' using errcode = '22023';
  end if;
  if p_to - p_from > 10 then
    raise exception 'A single position can cover at most 10 years; add separate entries.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_position, ''))) not between 2 and 100 then
    raise exception 'Enter the position (2–100 characters).' using errcode = '22023';
  end if;
  if p_to > extract(year from public.kenya_today())::integer then
    raise exception 'Past positions must have ended by this year.' using errcode = '22023';
  end if;
  if (select count(*) from public.past_roles where user_id = v_uid) >= 20 then
    raise exception 'You can add up to 20 past positions.' using errcode = '22023';
  end if;
  insert into public.past_roles (user_id, level, association_id, institution_id, position, from_year, to_year, show_publicly)
  values (
    v_uid, p_level,
    case when p_level = 'national' then null else v_assoc end,
    case when p_level = 'institutional' then p_institution_id else null end,
    btrim(p_position), p_from, p_to, coalesce(p_show_publicly, false)
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_past_role(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.past_roles where id = p_id and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_past_role_public(p_id uuid, p_show boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.past_roles set show_publicly = coalesce(p_show, false) where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- Confirm / decline (regional leaders, admins) ------------------------------------
create or replace function public.review_past_role(p_id uuid, p_confirm boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.past_roles;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into r from public.past_roles where id = p_id for update;
  if not found then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
  if not public.can_review_past_role(r.level, r.association_id, r.user_id) then
    raise exception 'You are not allowed to confirm this.' using errcode = '42501';
  end if;
  if not p_confirm and coalesce(char_length(v_note), 0) < 3 then
    raise exception 'Say briefly why you are declining (at least 3 characters).' using errcode = '22023';
  end if;
  update public.past_roles
     set status = case when p_confirm then 'confirmed' else 'declined' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(v_note, 300)
   where id = p_id;
end;
$$;

revoke all on function public.add_past_role(text, bigint, smallint, text, integer, integer, boolean) from public, anon;
revoke all on function public.remove_past_role(uuid) from public, anon;
revoke all on function public.set_past_role_public(uuid, boolean) from public, anon;
revoke all on function public.review_past_role(uuid, boolean, text) from public, anon;
grant execute on function public.add_past_role(text, bigint, smallint, text, integer, integer, boolean) to authenticated;
grant execute on function public.remove_past_role(uuid) to authenticated;
grant execute on function public.set_past_role_public(uuid, boolean) to authenticated;
grant execute on function public.review_past_role(uuid, boolean, text) to authenticated;

-- ---------- Public honour roll ----------------------------------------------------------------
-- Confirmed national and regional positions of people who agreed to be listed. Names and positions only.
create or replace function public.public_past_leaders()
returns table (full_name text, level text, association_code text, association_name text, title text, from_year integer, to_year integer)
language sql stable security definer set search_path = '' as $$
  select p.full_name, r.level, a.code, a.name, r.position, r.from_year, r.to_year
    from public.past_roles r
    join public.profiles p on p.id = r.user_id
    left join public.associations a on a.id = r.association_id
   where r.status = 'confirmed' and r.show_publicly and r.level in ('national', 'regional')
   order by r.to_year desc, r.from_year desc, (r.level = 'national') desc, a.code, p.full_name;
$$;
grant execute on function public.public_past_leaders() to anon, authenticated;

-- ---------- Activity log ----------------------------------------------------------------------
drop trigger if exists audit_past_roles on public.past_roles;
create trigger audit_past_roles after insert or update or delete on public.past_roles
  for each row execute function public.audit_row();
