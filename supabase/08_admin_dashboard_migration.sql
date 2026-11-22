-- =====================================================================
-- 08 · Admin dashboard figures + log clean-up
-- Run once in the Supabase SQL Editor (after 06). Safe to re-run.
-- =====================================================================

-- One call returns every figure the admin dashboard needs (admins only).
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
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- Delete log entries older than p_days (admins only). Returns how many rows went.
create or replace function public.purge_logs(p_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a integer;
  v_e integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can clear logs.' using errcode = '42501';
  end if;
  if p_days is null or p_days < 7 then
    raise exception 'Keep at least the last 7 days.' using errcode = '22023';
  end if;
  delete from public.audit_log where at < now() - make_interval(days => p_days);
  get diagnostics v_a = row_count;
  delete from public.error_log where at < now() - make_interval(days => p_days);
  get diagnostics v_e = row_count;
  return v_a + v_e;
end;
$$;
revoke all on function public.purge_logs(integer) from public, anon;
grant execute on function public.purge_logs(integer) to authenticated;
