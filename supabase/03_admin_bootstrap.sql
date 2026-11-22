-- =============================================================================
-- MSAK Portal — make the first administrator (run once)
--
-- Administrators are NOT students: they don't register through the app.
--
-- 1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user".
--    Enter your email and a strong password, and tick "Auto Confirm User".
--    (This creates a login with no member profile. You stay invisible to members:
--    you never appear in member lists, and your announcements show as
--    "MSAK National Office".)
-- 2. Put that email address below (keep the quotes) and run this script in SQL Editor.
-- 3. Log in to the portal with that email and password.
--
-- Later, add more administrators the same way: create the user in the dashboard,
-- then run this script again with their email. An existing member (a student who
-- registered through the app) can also be made admin from the portal's Members page.
-- =============================================================================

do $$
declare
  v_email text := 'colltreks1@gmail.com';   -- ← change this
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No account found for %. Create it first in Authentication → Users → Add user.', v_email;
  end if;
  insert into public.admins (user_id) values (v_id) on conflict do nothing;
  raise notice 'Done: % is now an MSAK administrator.', v_email;
end;
$$;
