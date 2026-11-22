-- =============================================================================
-- MSAK Portal — make the first administrator (run 3 of 3, once)
--
-- 1. Register an account in the app as usual and confirm the email.
-- 2. Put that account's email address below (keep the quotes).
-- 3. Run this script in Supabase → SQL Editor.
-- After this, that admin can add more admins from the portal (Members page).
-- =============================================================================

do $$
declare
  v_email text := 'colltreks3@gmail.com';   -- ← change this
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No account found for %. Register in the app first.', v_email;
  end if;
  insert into public.admins (user_id) values (v_id) on conflict do nothing;
  raise notice 'Done: % is now an MSAK administrator.', v_email;
end;
$$;
