-- =====================================================================
-- 14 · Administrators can edit and delete everything
-- =====================================================================
-- Members' profiles (every field, confirmation status), member accounts, current leader roles (assign directly,
-- edit position/scope/term, delete), anyone's past leadership, announcements, documents, feedback messages and
-- church reports. Everything is recorded in the Activity log. Only administrators can use these.
-- Safe to run more than once.

-- ---------- Members ---------------------------------------------------------------------------
-- An admin changing someone's institution doesn't send them back to "waiting" (the admin vouches for them).
create or replace function public.profiles_reverify_on_move()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.institution_id is distinct from old.institution_id and new.verification <> 'pending' and not public.is_admin() then
    new.verification := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_note := null;
  end if;
  return new;
end;
$$;

create or replace function public.admin_update_profile(
  p_member uuid, p_full_name text, p_gender text, p_phone text, p_institution_id bigint, p_course text,
  p_admission_year integer, p_year_of_study integer, p_expected_completion_year integer, p_verification text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  old public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  select * into old from public.profiles where id = p_member for update;
  if not found then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;
  if p_verification not in ('pending', 'verified', 'declined') then
    raise exception 'Choose waiting, confirmed or declined.' using errcode = '22023';
  end if;
  if p_verification = 'declined' and exists (
       select 1 from public.leader_roles r where r.user_id = p_member and r.status = 'approved'
         and (r.term_ends_on is null or r.term_ends_on >= public.kenya_today())) then
    raise exception 'This member holds an active leader role. Revoke the role first.' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = btrim(p_full_name), gender = p_gender, phone = btrim(p_phone), institution_id = p_institution_id,
         course = btrim(p_course), admission_year = p_admission_year, year_of_study = p_year_of_study,
         expected_completion_year = p_expected_completion_year,
         verification = p_verification,
         verified_by = case when p_verification is distinct from old.verification then auth.uid() else verified_by end,
         verified_at = case when p_verification is distinct from old.verification then now() else verified_at end,
         verification_note = case when p_verification is distinct from old.verification then
                               case when p_verification = 'declined' then 'Set by an administrator' else null end
                             else verification_note end
   where id = p_member;
end;
$$;

-- Any member account (not administrators): deletes the login and profile; posts and churches stay without the name.
create or replace function public.admin_delete_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  if p_member = auth.uid() or exists (select 1 from public.admins a where a.user_id = p_member) then
    raise exception 'Administrator accounts cannot be removed here.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_member) then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;
  delete from public.profiles where id = p_member;
  delete from auth.users where id = p_member;
end;
$$;

-- ---------- Current leader roles --------------------------------------------------------------
create or replace function public.admin_assign_role(
  p_member uuid, p_level text, p_position text, p_association_id smallint, p_institution_id bigint, p_term_ends_on date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_assoc smallint := p_association_id;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_member) then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;
  if p_level = 'institutional' then
    v_assoc := public.institution_association_id(p_institution_id);
    if v_assoc is null then raise exception 'Choose the institution.' using errcode = '22023'; end if;
  elsif p_level = 'regional' and v_assoc is null then
    raise exception 'Choose the association.' using errcode = '22023';
  elsif p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose campus, regional or national.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_position, ''))) not between 2 and 100 then
    raise exception 'Enter the position (2–100 characters).' using errcode = '22023';
  end if;
  insert into public.leader_roles (user_id, level, position, association_id, institution_id, status, reviewed_by, reviewed_at, term_ends_on, review_note)
  values (
    p_member, p_level, btrim(p_position),
    case when p_level = 'national' then null else v_assoc end,
    case when p_level = 'institutional' then p_institution_id else null end,
    'approved', auth.uid(), now(),
    coalesce(p_term_ends_on, public.academic_year_end(public.kenya_today() + 30)),
    'Assigned by an administrator'
  ) returning id into v_id;
  update public.profiles set verification = 'verified', verified_by = auth.uid(), verified_at = now(), verification_note = null
   where id = p_member and verification <> 'verified';
  return v_id;
end;
$$;

create or replace function public.admin_update_role(
  p_role_id uuid, p_level text, p_position text, p_association_id smallint, p_institution_id bigint,
  p_status text, p_term_ends_on date
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_assoc smallint := p_association_id;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  if p_level = 'institutional' then
    v_assoc := public.institution_association_id(p_institution_id);
    if v_assoc is null then raise exception 'Choose the institution.' using errcode = '22023'; end if;
  elsif p_level = 'regional' and v_assoc is null then
    raise exception 'Choose the association.' using errcode = '22023';
  elsif p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose campus, regional or national.' using errcode = '22023';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'revoked') then
    raise exception 'Choose a valid status.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_position, ''))) not between 2 and 100 then
    raise exception 'Enter the position (2–100 characters).' using errcode = '22023';
  end if;
  update public.leader_roles
     set level = p_level, position = btrim(p_position),
         association_id = case when p_level = 'national' then null else v_assoc end,
         institution_id = case when p_level = 'institutional' then p_institution_id else null end,
         status = p_status,
         term_ends_on = case when p_status = 'approved'
                             then coalesce(p_term_ends_on, term_ends_on, public.academic_year_end(public.kenya_today() + 30))
                             else p_term_ends_on end,
         renewal_requested_at = case when p_status = 'approved' then renewal_requested_at else null end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_role_id;
  if not found then
    raise exception 'That role was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_role(p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  delete from public.leader_roles where id = p_role_id;
  if not found then
    raise exception 'That role was not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------- Past leadership (anyone's) --------------------------------------------------------
create or replace function public.admin_update_past_role(
  p_id uuid, p_level text, p_institution_id bigint, p_association_id smallint, p_position text,
  p_from integer, p_to integer, p_status text, p_show_publicly boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_assoc smallint := p_association_id;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  if p_level = 'institutional' then
    v_assoc := public.institution_association_id(p_institution_id);
    if v_assoc is null then raise exception 'Choose the institution.' using errcode = '22023'; end if;
  elsif p_level = 'regional' and v_assoc is null then
    raise exception 'Choose the association.' using errcode = '22023';
  elsif p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose campus, regional or national.' using errcode = '22023';
  end if;
  if p_status not in ('pending', 'confirmed', 'declined') then
    raise exception 'Choose a valid status.' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 10 then
    raise exception 'Check the years (end on or after start, at most 10 years).' using errcode = '22023';
  end if;
  update public.past_roles
     set level = p_level,
         association_id = case when p_level = 'national' then null else v_assoc end,
         institution_id = case when p_level = 'institutional' then p_institution_id else null end,
         position = btrim(p_position), from_year = p_from, to_year = p_to,
         status = p_status, show_publicly = coalesce(p_show_publicly, false) and p_level <> 'institutional',
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if not found then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text, text, bigint, text, integer, integer, integer, text) from public, anon;
revoke all on function public.admin_delete_member(uuid) from public, anon;
revoke all on function public.admin_assign_role(uuid, text, text, smallint, bigint, date) from public, anon;
revoke all on function public.admin_update_role(uuid, text, text, smallint, bigint, text, date) from public, anon;
revoke all on function public.admin_delete_role(uuid) from public, anon;
revoke all on function public.admin_update_past_role(uuid, text, bigint, smallint, text, integer, integer, text, boolean) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text, text, bigint, text, integer, integer, integer, text) to authenticated;
grant execute on function public.admin_delete_member(uuid) to authenticated;
grant execute on function public.admin_assign_role(uuid, text, text, smallint, bigint, date) to authenticated;
grant execute on function public.admin_update_role(uuid, text, text, smallint, bigint, text, date) to authenticated;
grant execute on function public.admin_delete_role(uuid) to authenticated;
grant execute on function public.admin_update_past_role(uuid, text, bigint, smallint, text, integer, integer, text, boolean) to authenticated;

-- ---------- Announcements, documents, feedback, church reports ---------------------------------
drop policy if exists "Admins edit announcements" on public.announcements;
create policy "Admins edit announcements" on public.announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant update (title, body) on public.announcements to authenticated;

grant update (title, description) on public.documents to authenticated;  -- "Admins manage documents" policy covers it

drop policy if exists "Admins delete feedback" on public.feedback;
create policy "Admins delete feedback" on public.feedback for delete to authenticated using (public.is_admin());
grant delete on public.feedback to authenticated;

drop policy if exists "Admins delete church reports" on public.church_reports;
create policy "Admins delete church reports" on public.church_reports for delete to authenticated using (public.is_admin());
grant delete on public.church_reports to authenticated;

-- Activity log for the tables that didn't have it yet
drop trigger if exists audit_feedback on public.feedback;
create trigger audit_feedback after delete on public.feedback for each row execute function public.audit_row();
drop trigger if exists audit_counties on public.counties;
create trigger audit_counties after insert or update or delete on public.counties for each row execute function public.audit_row();
drop trigger if exists audit_associations on public.associations;
create trigger audit_associations after insert or update or delete on public.associations for each row execute function public.audit_row();

-- Log every profile change (admins can now edit names, phones, courses…)
drop trigger if exists audit_profiles_upd on public.profiles;
create trigger audit_profiles_upd after update of full_name, gender, phone, institution_id, course, admission_year, year_of_study,
  expected_completion_year, verification on public.profiles
  for each row execute function public.audit_row();
