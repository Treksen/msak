-- =============================================================================
-- MSAK Portal — migration 06: leadership terms, alumni, church reports & photos,
-- audit log and error log.
--
-- ONLY run this if your database was set up before this update (your 01_schema.sql
-- has no section "11. Academic year"). Run 04 and 05 first if you haven't.
-- A fresh setup with the current 01_schema.sql already includes it.
-- Safe to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 11. Academic year: leadership terms, alumni, audit & error logs, church reports
--     (everything below is safe to run more than once)
-- -----------------------------------------------------------------------------

-- Kenya's date today, and the academic year end (31 August) on or after a date.
create or replace function public.kenya_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Nairobi')::date;
$$;

create or replace function public.academic_year_end(d date)
returns date language sql immutable set search_path = '' as $$
  select case when d <= make_date(extract(year from d)::int, 8, 31)
              then make_date(extract(year from d)::int, 8, 31)
              else make_date(extract(year from d)::int + 1, 8, 31) end;
$$;
grant execute on function public.kenya_today() to anon, authenticated;
grant execute on function public.academic_year_end(date) to anon, authenticated;

-- ---------- Leadership terms ----------------------------------------------------
-- An approved role is active until term_ends_on (31 August). After that it has no
-- privileges until the leader asks to renew AND the usual approver approves again.
alter table public.leader_roles add column if not exists term_ends_on date;
alter table public.leader_roles add column if not exists renewal_requested_at timestamptz;

-- Roles approved before terms existed: give them the current academic year.
update public.leader_roles
   set term_ends_on = public.academic_year_end(public.kenya_today())
 where status = 'approved' and term_ends_on is null;

create or replace function public.has_role(
  p_level text, p_association_id smallint default null, p_institution_id bigint default null
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leader_roles r
    where r.user_id = auth.uid()
      and r.status = 'approved'
      and (r.term_ends_on is null or r.term_ends_on >= public.kenya_today())
      and r.level = p_level
      and (p_association_id is null or r.association_id = p_association_id)
      and (p_institution_id is null or r.institution_id = p_institution_id)
  );
$$;

-- Ask for a role, or (if you already hold it) ask to renew it for the next year.
create or replace function public.request_leader_role(p_level text, p_position text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inst bigint;
  v_assoc smallint;
  v_id uuid;
  r public.leader_roles;
begin
  if v_uid is null then raise exception 'Please log in first.' using errcode = '28000'; end if;
  if p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose institutional, regional or national.' using errcode = '22023';
  end if;
  if p_position is null or length(btrim(p_position)) not between 2 and 100 then
    raise exception 'Enter your position (2–100 characters).' using errcode = '22023';
  end if;
  select p.institution_id into v_inst from public.profiles p where p.id = v_uid;
  if v_inst is null then raise exception 'Complete your profile first.' using errcode = 'P0002'; end if;
  v_assoc := public.institution_association_id(v_inst);

  select * into r from public.leader_roles
   where user_id = v_uid and level = p_level and status in ('pending', 'approved') for update;
  if found then
    if r.status = 'pending' then
      raise exception 'You already have a % request waiting for approval.', p_level using errcode = '23505';
    end if;
    update public.leader_roles
       set renewal_requested_at = now(), position = btrim(p_position), review_note = null
     where id = r.id;
    return r.id;
  end if;

  insert into public.leader_roles (user_id, level, position, association_id, institution_id)
  values (
    v_uid, p_level, btrim(p_position),
    case when p_level = 'national' then null else v_assoc end,
    case when p_level = 'institutional' then v_inst else null end
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Ask to renew a role you hold (before or after it expires).
create or replace function public.renew_leader_role(p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.leader_roles
     set renewal_requested_at = now(), review_note = null
   where id = p_role_id and user_id = auth.uid() and status = 'approved';
  if not found then
    raise exception 'Only an approved role of yours can be renewed.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.renew_leader_role(uuid) from public, anon;
grant execute on function public.renew_leader_role(uuid) to authenticated;

-- Approve/decline a new request OR a renewal. Same approvers as before:
-- admins for everything; regional leaders for institutional roles in their association.
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

-- ---------- Alumni ---------------------------------------------------------------
-- A member is alumni once the 31 August of their expected completion year has passed.
-- Repeating or deferring? They update their completion year and are a student again.
create or replace function public.i_am_alumni()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select public.kenya_today() > make_date(p.expected_completion_year, 8, 31)
       from public.profiles p where p.id = auth.uid()),
    false);
$$;
revoke all on function public.i_am_alumni() from public;
grant execute on function public.i_am_alumni() to authenticated;

-- Announcements get a fourth audience: 'alumni' (all alumni members).
alter table public.announcements drop constraint if exists announcements_audience_check;
alter table public.announcements add constraint announcements_audience_check
  check (audience in ('institutional', 'regional', 'national', 'alumni'));
alter table public.announcements drop constraint if exists announcements_scope_check;
alter table public.announcements add constraint announcements_scope_check check (
  (audience = 'institutional' and institution_id is not null and association_id is not null)
  or (audience = 'regional' and association_id is not null and institution_id is null)
  or (audience in ('national', 'alumni') and association_id is null and institution_id is null)
);

-- Who reads what:
--   students: national + their association + their campus
--   alumni:   national + their association + alumni (not their old campus)
drop policy if exists "Read announcements for my audience" on public.announcements;
create policy "Read announcements for my audience" on public.announcements for select to authenticated
  using (
    public.is_admin()
    or (public.is_member() and (
      audience = 'national'
      or (audience = 'alumni' and public.i_am_alumni())
      or (audience = 'regional' and association_id = public.my_association_id())
      or (audience = 'institutional' and institution_id = public.my_institution_id() and not public.i_am_alumni())
      or author_id = (select auth.uid())
      or (audience in ('regional', 'institutional') and public.has_role('regional', association_id))
      or public.has_role('national')
    ))
  );

-- Posting: leaders to their (current-term) scope; alumni posts by national leaders and admins.
create or replace function public.post_announcement(
  p_audience text, p_title text, p_body text,
  p_association_id smallint default null, p_institution_id bigint default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_role public.leader_roles;
  v_assoc smallint;
  v_inst bigint;
  v_name text;
  v_title text;
  v_code text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Please log in first.' using errcode = '28000'; end if;
  if p_audience not in ('institutional', 'regional', 'national', 'alumni') then
    raise exception 'Choose an audience.' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 3 and 160 then
    raise exception 'Title must be 3–160 characters.' using errcode = '22023';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 5000 then
    raise exception 'Message must be 1–5000 characters.' using errcode = '22023';
  end if;

  -- The role that entitles this post (alumni posts ride on a national role).
  select * into v_role from public.leader_roles
   where user_id = v_uid
     and level = case when p_audience = 'alumni' then 'national' else p_audience end
     and status = 'approved'
     and (term_ends_on is null or term_ends_on >= public.kenya_today())
   limit 1;

  if v_role.id is not null then
    v_assoc := case when p_audience = 'alumni' then null else v_role.association_id end;
    v_inst := case when p_audience = 'alumni' then null else v_role.institution_id end;
  elsif v_admin then
    v_inst := case when p_audience = 'institutional' then p_institution_id end;
    v_assoc := case
      when p_audience in ('national', 'alumni') then null
      when p_audience = 'institutional' then public.institution_association_id(p_institution_id)
      else p_association_id end;
    if p_audience = 'institutional' and v_inst is null then
      raise exception 'Choose the institution.' using errcode = '22023';
    end if;
    if p_audience = 'regional' and v_assoc is null then
      raise exception 'Choose the association.' using errcode = '22023';
    end if;
  else
    raise exception 'You need an active % leader role to post this.',
      case when p_audience = 'alumni' then 'national' else p_audience end using errcode = '42501';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = v_uid;
  select a.code into v_code from public.associations a where a.id = v_assoc;

  -- Leaders sign with their name and role. Administrators are never named to members.
  if v_role.id is not null then
    v_title := initcap(v_role.level) || ' leader · ' || v_role.position || coalesce(' · ' || v_code, '');
    v_name := coalesce(v_name, 'MSAK');
  else
    v_title := 'MSAK National Office';
    v_name := 'MSAK';
  end if;

  insert into public.announcements (author_id, author_name, author_title, audience, association_id, institution_id, title, body)
  values (v_uid, v_name, v_title, p_audience, v_assoc, v_inst, btrim(p_title), btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- Church reports & photos ---------------------------------------------
create table if not exists public.church_reports (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  reporter_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (length(btrim(message)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz
);
create index if not exists church_reports_open_idx on public.church_reports (status, church_id);
alter table public.church_reports enable row level security;

drop policy if exists "Members report churches" on public.church_reports;
create policy "Members report churches" on public.church_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and (public.is_member() or public.is_admin()));
drop policy if exists "Reporters and church managers read reports" on public.church_reports;
create policy "Reporters and church managers read reports" on public.church_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or public.can_manage_churches((select c.association_id from public.churches c where c.id = church_id))
  );
drop policy if exists "Church managers resolve reports" on public.church_reports;
create policy "Church managers resolve reports" on public.church_reports for update to authenticated
  using (public.can_manage_churches((select c.association_id from public.churches c where c.id = church_id)))
  with check (public.can_manage_churches((select c.association_id from public.churches c where c.id = church_id)));

revoke all on public.church_reports from anon, authenticated;
grant select on public.church_reports to authenticated;
grant insert (church_id, message) on public.church_reports to authenticated;
grant update (status) on public.church_reports to authenticated;

create or replace function public.church_reports_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists church_reports_stamp on public.church_reports;
create trigger church_reports_stamp before update on public.church_reports
  for each row execute function public.church_reports_stamp();

-- Church photos: public bucket; files are stored as "<association id>/<file>" and only
-- people who manage churches in that association (or admins) may add or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('church-photos', 'church-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Church photos are public" on storage.objects;
create policy "Church photos are public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'church-photos');
drop policy if exists "Church managers upload photos" on storage.objects;
create policy "Church managers upload photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'church-photos'
    and (storage.foldername(name))[1] ~ '^[0-9]+$'
    and public.can_manage_churches(((storage.foldername(name))[1])::smallint)
  );
drop policy if exists "Church managers delete photos" on storage.objects;
create policy "Church managers delete photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'church-photos'
    and (storage.foldername(name))[1] ~ '^[0-9]+$'
    and public.can_manage_churches(((storage.foldername(name))[1])::smallint)
  );

-- ---------- Audit log (admins only) ----------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_label text not null,
  action text not null,
  entity text not null,
  entity_id text,
  summary text,
  changes jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log for select to authenticated using (public.is_admin());
drop policy if exists "Admins clear audit log" on public.audit_log;
create policy "Admins clear audit log" on public.audit_log for delete to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated;
grant select, delete on public.audit_log to authenticated;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_changes jsonb;
  v_label text;
begin
  -- Only actions taken in the app are logged (not seeding or fixes in the SQL editor).
  if v_uid is null then return null; end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into v_changes
      from jsonb_each(to_jsonb(new)) n
     where (to_jsonb(old) -> n.key) is distinct from n.value
       and n.key not in ('updated_at');
    if v_changes is null then return null; end if;
  end if;
  v_label := coalesce(
    (select case when exists (select 1 from public.admins a where a.user_id = v_uid) then 'Admin · ' else '' end
            || coalesce(p.full_name, u.email)
       from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid),
    'System');
  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, summary, changes)
  values (
    v_uid, v_label, lower(tg_op), tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id'),
    left(coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'full_name',
                  concat_ws(' · ', v_row ->> 'level', v_row ->> 'position', v_row ->> 'status')), 200),
    case when tg_op = 'UPDATE' then v_changes else null end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['leader_roles', 'announcements', 'churches', 'admins', 'home_banners',
                           'documents', 'institutions', 'church_reports'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;
-- Profiles: log new members, deletions and campus / completion-year changes (not every edit).
drop trigger if exists audit_profiles_insdel on public.profiles;
create trigger audit_profiles_insdel after insert or delete on public.profiles
  for each row execute function public.audit_row();
drop trigger if exists audit_profiles_upd on public.profiles;
create trigger audit_profiles_upd after update of institution_id, expected_completion_year on public.profiles
  for each row execute function public.audit_row();

-- ---------- Error log (admins only) ----------------------------------------------
create table if not exists public.error_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  message text not null,
  stack text,
  url text,
  user_agent text
);
create index if not exists error_log_at_idx on public.error_log (at desc);
alter table public.error_log enable row level security;
drop policy if exists "Admins read error log" on public.error_log;
create policy "Admins read error log" on public.error_log for select to authenticated using (public.is_admin());
drop policy if exists "Admins clear error log" on public.error_log;
create policy "Admins clear error log" on public.error_log for delete to authenticated using (public.is_admin());
revoke all on public.error_log from anon, authenticated;
grant select, delete on public.error_log to authenticated;

-- The app reports crashes here (anyone, logged in or not). Long text is cut, and a
-- burst of more than 30 errors a minute is dropped so the log can't be flooded.
create or replace function public.log_client_error(p_message text, p_stack text, p_url text, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  if (select count(*) from public.error_log where at > now() - interval '1 minute') >= 30 then return; end if;
  insert into public.error_log (user_id, message, stack, url, user_agent)
  values (auth.uid(), left(p_message, 1000), left(p_stack, 4000), left(p_url, 500), left(p_user_agent, 300));
end;
$$;
revoke all on function public.log_client_error(text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text) to anon, authenticated;
