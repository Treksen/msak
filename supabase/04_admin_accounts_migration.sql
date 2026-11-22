-- =============================================================================
-- MSAK Portal — migration 04: administrator accounts without a member profile
--
-- ONLY run this if you already ran the OLD 01_schema.sql before 22 Nov 2026.
-- (A fresh setup using the current 01_schema.sql already includes all of this.)
--
-- What it changes:
--  * Accounts created without member details (e.g. an admin added in the Supabase
--    dashboard) no longer fail: they get no profile and are invisible to members.
--  * Only registered members (or admins) can read announcements and documents,
--    suggest churches or send feedback.
--  * Announcements posted by an administrator show "MSAK National Office", never a name.
-- Safe to run more than once.
-- =============================================================================

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

create or replace function public.churches_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_manager boolean := public.can_manage_churches(new.association_id);
begin
  -- Rows written from the SQL editor / service role (no logged-in user) are trusted as-is.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), 'MSAK');
    if not v_manager then
      new.status := 'suggested';
      new.location_verified := false;
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.verified_by := auth.uid();
    new.verified_at := now();
  end if;
  return new;
end;
$$;

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
  if p_audience not in ('institutional', 'regional', 'national') then
    raise exception 'Choose an audience.' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 3 and 160 then
    raise exception 'Title must be 3–160 characters.' using errcode = '22023';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 5000 then
    raise exception 'Message must be 1–5000 characters.' using errcode = '22023';
  end if;

  select * into v_role from public.leader_roles
   where user_id = v_uid and level = p_audience and status = 'approved' limit 1;

  if v_role.id is not null then
    v_assoc := v_role.association_id;
    v_inst := v_role.institution_id;
  elsif v_admin then
    v_inst := case when p_audience = 'institutional' then p_institution_id end;
    v_assoc := case
      when p_audience = 'national' then null
      when p_audience = 'institutional' then public.institution_association_id(p_institution_id)
      else p_association_id end;
    if p_audience = 'institutional' and v_inst is null then
      raise exception 'Choose the institution.' using errcode = '22023';
    end if;
    if p_audience = 'regional' and v_assoc is null then
      raise exception 'Choose the association.' using errcode = '22023';
    end if;
  else
    raise exception 'You need an approved % leader role to post this.', p_audience using errcode = '42501';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = v_uid;
  select a.code into v_code from public.associations a where a.id = v_assoc;
  -- Leaders sign with their name and role. Administrators are never named to members.
  if v_role.id is not null then
    v_title := initcap(p_audience) || ' leader · ' || v_role.position || coalesce(' · ' || v_code, '');
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

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_inst bigint := nullif(m ->> 'institution_id', '')::bigint;
  v_level text := nullif(m ->> 'leader_level', '');
  v_position text := nullif(btrim(coalesce(m ->> 'leader_position', '')), '');
  v_assoc smallint;
begin
  -- Accounts created without member details (e.g. an administrator added in the Supabase
  -- dashboard) get no profile: they are not members, see nothing until made admin, and are
  -- never listed to anyone.
  if v_inst is null then
    return new;
  end if;
  if not exists (select 1 from public.institutions where id = v_inst) then
    raise exception 'Choose a valid institution.' using errcode = '22023';
  end if;
  insert into public.profiles (
    id, full_name, gender, phone, institution_id, course,
    admission_year, year_of_study, expected_completion_year, terms_accepted_at
  ) values (
    new.id,
    btrim(m ->> 'full_name'),
    m ->> 'gender',
    btrim(m ->> 'phone'),
    v_inst,
    btrim(m ->> 'course'),
    (m ->> 'admission_year')::integer,
    (m ->> 'year_of_study')::integer,
    (m ->> 'expected_completion_year')::integer,
    coalesce(nullif(m ->> 'terms_accepted_at', '')::timestamptz, now())
  );

  if v_level in ('institutional', 'regional', 'national') and v_position is not null then
    v_assoc := public.institution_association_id(v_inst);
    insert into public.leader_roles (user_id, level, position, association_id, institution_id)
    values (
      new.id, v_level, left(v_position, 100),
      case when v_level = 'national' then null else v_assoc end,
      case when v_level = 'institutional' then v_inst else null end
    );
  end if;
  return new;
end;
$$;

drop policy if exists "Read announcements for my audience" on public.announcements;
create policy "Read announcements for my audience" on public.announcements for select to authenticated
  using (
    public.is_admin()
    or (public.is_member() and (
      audience = 'national'
      or (audience = 'regional' and association_id = public.my_association_id())
      or (audience = 'institutional' and institution_id = public.my_institution_id())
      or author_id = (select auth.uid())
      or (audience <> 'national' and public.has_role('regional', association_id))
      or public.has_role('national')
    ))
  );

drop policy if exists "Members suggest, leaders publish" on public.churches;
create policy "Members suggest, leaders publish" on public.churches for insert to authenticated
  with check (
    (status = 'suggested' and (public.is_member() or public.is_admin()))
    or (status = 'published' and public.can_manage_churches(association_id))
  );

drop policy if exists "Members read documents" on public.documents;
create policy "Members read documents" on public.documents for select to authenticated
  using (public.is_member() or public.is_admin());

drop policy if exists "Members send feedback" on public.feedback;
create policy "Members send feedback" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and (public.is_member() or public.is_admin()));

drop policy if exists "Members download documents" on storage.objects;
create policy "Members download documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.is_member() or public.is_admin()));

-- Earlier admin posts: stop showing the administrator's name
update public.announcements a
   set author_name = 'MSAK', author_title = 'MSAK National Office'
 where a.author_title = 'MSAK administrator';
