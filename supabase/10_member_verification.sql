-- =====================================================================
-- 10 · Member confirmation: leaders check that new members are real students
-- =====================================================================
-- - New members start as "pending". Their campus leaders, the regional leaders of their association, or an
--   admin confirm them ("verified") or decline them ("declined"). Approving a leader request also confirms.
-- - While pending (or declined) a member sees national announcements only; campus, regional and alumni
--   announcements and the document library open once they are confirmed.
-- - Moving to another institution sends a member back to "pending" for the new campus to confirm.
-- - Members who registered before this change are counted as confirmed (done once, when the column is added).
-- - Declined members can't request leader roles, suggest or report churches, and don't count in the dashboard.
--   Admins can remove their account; it is removed automatically 30 days after the decision.
-- Safe to run more than once.

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'verification') then
    alter table public.profiles
      add column verification text not null default 'pending' check (verification in ('pending', 'verified', 'declined')),
      add column verified_at timestamptz,
      add column verified_by uuid references auth.users (id) on delete set null,
      add column verification_note text check (char_length(verification_note) <= 300);
    -- everyone already registered keeps their access
    update public.profiles set verification = 'verified', verified_at = now();
  end if;
end $$;

create index if not exists profiles_pending_idx on public.profiles (institution_id) where verification = 'pending';

-- ---------- Helpers ----------------------------------------------------------------
create or replace function public.i_am_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.verification = 'verified' from public.profiles p where p.id = auth.uid()), false);
$$;

/** Campus leaders of that institution, regional leaders of its association, and admins. */
create or replace function public.can_verify_member(p_institution_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or public.has_role('regional', public.institution_association_id(p_institution_id))
    or public.has_role('institutional', null, p_institution_id);
$$;

revoke all on function public.i_am_verified() from public;
revoke all on function public.can_verify_member(bigint) from public;
grant execute on function public.i_am_verified() to authenticated;
grant execute on function public.can_verify_member(bigint) to authenticated;

-- ---------- Confirm / decline (defined further down, with the declined-member rules) -------------

-- ---------- Moving campus: back to pending ------------------------------------------------
create or replace function public.profiles_reverify_on_move()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.institution_id is distinct from old.institution_id and new.verification <> 'pending' then
    new.verification := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_note := null;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_reverify on public.profiles;
create trigger profiles_reverify before update of institution_id on public.profiles
  for each row execute function public.profiles_reverify_on_move();

-- Log confirmations in the activity log too.
drop trigger if exists audit_profiles_upd on public.profiles;
create trigger audit_profiles_upd after update of institution_id, expected_completion_year, verification on public.profiles
  for each row execute function public.audit_row();

-- ---------- Approving a leader also confirms them as a member ------------------------------
create or replace function public.review_leader_role(p_role_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  r public.leader_roles;
begin
  select * into r from public.leader_roles where id = p_role_id for update;
  if not found or not (r.status = 'pending' or (r.status = 'approved' and r.renewal_requested_at is not null)) then
    raise exception 'That request is no longer waiting.' using errcode = 'P0002';
  end if;
  if r.user_id = v_uid then
    raise exception 'You cannot review your own request.' using errcode = '42501';
  end if;
  if not (public.is_admin() or (r.level = 'institutional' and public.has_role('regional', r.association_id))) then
    raise exception 'You are not allowed to review this request.' using errcode = '42501';
  end if;

  if r.status = 'pending' then
    update public.leader_roles
       set status = case when p_approve then 'approved' else 'rejected' end,
           term_ends_on = case when p_approve then public.academic_year_end(public.kenya_today() + 30) else null end,
           reviewed_by = v_uid, reviewed_at = now(),
           review_note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_role_id;
    if p_approve then
      update public.profiles
         set verification = 'verified', verified_by = v_uid, verified_at = now(), verification_note = null
       where id = r.user_id and verification <> 'verified';
    end if;
  else
    -- Renewal: approving extends the term to the next 31 August; declining leaves it to run out.
    update public.leader_roles
       set term_ends_on = case when p_approve
                               then public.academic_year_end(greatest(public.kenya_today(), coalesce(term_ends_on, public.kenya_today()) + 1))
                               else term_ends_on end,
           renewal_requested_at = null,
           reviewed_by = v_uid, reviewed_at = now(),
           review_note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_role_id;
  end if;
end;
$$;

-- ---------- What unconfirmed members can read ----------------------------------------------
drop policy if exists "Read announcements for my audience" on public.announcements;
create policy "Read announcements for my audience" on public.announcements for select to authenticated
  using (
    public.is_admin()
    or (public.is_member() and (
      audience = 'national'
      or author_id = (select auth.uid())
      or (public.i_am_verified() and (
        (audience = 'alumni' and public.i_am_alumni())
        or (audience = 'regional' and association_id = public.my_association_id())
        or (audience = 'institutional' and institution_id = public.my_institution_id() and not public.i_am_alumni())
        or (audience in ('regional', 'institutional') and public.has_role('regional', association_id))
        or public.has_role('national')
      ))
    ))
  );

drop policy if exists "Members read documents" on public.documents;
create policy "Members read documents" on public.documents for select to authenticated
  using (public.i_am_verified() or public.is_admin());

drop policy if exists "Members download documents" on storage.objects;
create policy "Members download documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.i_am_verified() or public.is_admin()));

-- ---------- Declined members: limits, removal --------------------------------------------
-- A leader can't decline someone who is an approved leader or an administrator (revoke the role first).
create or replace function public.review_member(p_member uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into p from public.profiles where id = p_member for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
  if p_member = v_uid then
    raise exception 'You cannot confirm your own membership.' using errcode = '42501';
  end if;
  if not public.can_verify_member(p.institution_id) then
    raise exception 'You are not allowed to confirm this member.' using errcode = '42501';
  end if;
  if not p_approve then
    if coalesce(char_length(v_note), 0) < 3 then
      raise exception 'Say briefly why you are declining (at least 3 characters).' using errcode = '22023';
    end if;
    if exists (select 1 from public.admins a where a.user_id = p_member)
       or exists (select 1 from public.leader_roles r
                   where r.user_id = p_member and r.status = 'approved'
                     and (r.term_ends_on is null or r.term_ends_on >= public.kenya_today())) then
      raise exception 'This member holds an active leader role. Revoke the role first.' using errcode = '42501';
    end if;
  end if;
  update public.profiles
     set verification = case when p_approve then 'verified' else 'declined' end,
         verified_by = v_uid,
         verified_at = now(),
         verification_note = left(v_note, 300)
   where id = p_member;
end;
$$;

revoke all on function public.review_member(uuid, boolean, text) from public, anon;
grant execute on function public.review_member(uuid, boolean, text) to authenticated;

create or replace function public.i_am_declined()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.verification = 'declined');
$$;
revoke all on function public.i_am_declined() from public;
grant execute on function public.i_am_declined() to authenticated;

-- Declined members can't ask for leader roles, suggest churches or report churches.
create or replace function public.block_declined_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.i_am_declined() then
    raise exception 'A leader could not confirm your membership, so you can''t do this. Contact MSAK through Help & feedback.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists leader_roles_block_declined on public.leader_roles;
create trigger leader_roles_block_declined before insert on public.leader_roles
  for each row execute function public.block_declined_members();
drop trigger if exists churches_block_declined on public.churches;
create trigger churches_block_declined before insert on public.churches
  for each row execute function public.block_declined_members();
drop trigger if exists church_reports_block_declined on public.church_reports;
create trigger church_reports_block_declined before insert on public.church_reports
  for each row execute function public.block_declined_members();

-- Admins: delete a declined member's login and profile completely (their roles and feedback go too;
-- posts, churches and reports they touched stay, without their name).
create or replace function public.remove_declined_account(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can remove accounts.' using errcode = '42501';
  end if;
  if p_member = auth.uid() or exists (select 1 from public.admins a where a.user_id = p_member) then
    raise exception 'Administrator accounts cannot be removed here.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_member and p.verification = 'declined') then
    raise exception 'Only members a leader has declined can be removed.' using errcode = '42501';
  end if;
  delete from public.profiles where id = p_member;   -- logged in the activity log
  delete from auth.users where id = p_member;
end;
$$;
revoke all on function public.remove_declined_account(uuid) from public, anon;
grant execute on function public.remove_declined_account(uuid) to authenticated;

-- Declined for 30 days and nobody reversed it: remove the account. Run daily by the scheduler (below)
-- and also whenever an administrator opens the dashboard. Returns how many accounts were removed.
create or replace function public.purge_declined_accounts()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_ids
    from public.profiles p
   where p.verification = 'declined' and p.verified_at < now() - interval '30 days'
     and not exists (select 1 from public.admins a where a.user_id = p.id);
  delete from public.profiles where id = any (v_ids);
  delete from auth.users where id = any (v_ids);
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
revoke all on function public.purge_declined_accounts() from public, anon;
grant execute on function public.purge_declined_accounts() to authenticated;

-- Daily at 04:15 Kenya time (01:15 UTC). Needs the pg_cron extension (Database → Extensions in Supabase);
-- if it isn't available this step is skipped and the dashboard clean-up still works.
do $cron$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron is not available (%). Declined accounts will be removed when an administrator opens the dashboard.', sqlerrm;
    return;
  end;
  perform cron.schedule('msak-remove-declined-accounts', '15 1 * * *', 'select public.purge_declined_accounts()');
exception when others then
  raise notice 'Could not schedule the daily clean-up (%). It will still run when an administrator opens the dashboard.', sqlerrm;
end $cron$;

-- Dashboard figures leave out declined people.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.kenya_today();
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can see the dashboard.' using errcode = '42501';
  end if;

  with m as (
    select p.id, p.created_at, c.association_id,
           (v_today > make_date(p.expected_completion_year, 8, 31)) as alumni
    from public.profiles p
    join public.institutions i on i.id = p.institution_id
    join public.counties c on c.id = i.county_id
    where p.verification <> 'declined'   -- people a leader found not to be students don't count
  ),
  months as (
    select to_char(d, 'YYYY-MM') as month
    from generate_series(date_trunc('month', v_today::timestamp) - interval '11 months',
                         date_trunc('month', v_today::timestamp), interval '1 month') d
  )
  select jsonb_build_object(
    'members', (select count(*) from m),
    'students', (select count(*) from m where not alumni),
    'alumni', (select count(*) from m where alumni),
    'by_association', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'association_id', a.id, 'code', a.code, 'name', a.name,
               'students', (select count(*) from m where m.association_id = a.id and not m.alumni),
               'alumni', (select count(*) from m where m.association_id = a.id and m.alumni),
               'churches', (select count(*) from public.churches ch where ch.association_id = a.id and ch.status = 'published'),
               'churches_confirmed', (select count(*) from public.churches ch where ch.association_id = a.id and ch.status = 'published' and ch.location_verified)
             ) order by a.code), '[]'::jsonb)
      from public.associations a
    ),
    'signups', (
      select jsonb_agg(jsonb_build_object('month', months.month,
               'count', (select count(*) from m where to_char(m.created_at at time zone 'Africa/Nairobi', 'YYYY-MM') = months.month))
             order by months.month)
      from months
    ),
    'leaders', jsonb_build_object(
      'national', (select count(*) from public.leader_roles r where r.status = 'approved' and r.level = 'national' and (r.term_ends_on is null or r.term_ends_on >= v_today)),
      'regional', (select count(*) from public.leader_roles r where r.status = 'approved' and r.level = 'regional' and (r.term_ends_on is null or r.term_ends_on >= v_today)),
      'institutional', (select count(*) from public.leader_roles r where r.status = 'approved' and r.level = 'institutional' and (r.term_ends_on is null or r.term_ends_on >= v_today)),
      'waiting', (select count(*) from public.leader_roles r where r.status = 'pending' or (r.status = 'approved' and r.renewal_requested_at is not null)),
      'expired', (select count(*) from public.leader_roles r where r.status = 'approved' and r.term_ends_on < v_today)
    ),
    'churches_suggested', (select count(*) from public.churches where status = 'suggested'),
    'open_reports', (select count(*) from public.church_reports where status = 'open'),
    'errors_7d', (select count(*) from public.error_log where at > now() - interval '7 days'),
    'activity_7d', (select count(*) from public.audit_log where at > now() - interval '7 days')
  ) into v_out;
  return v_out;
end;
$$;
