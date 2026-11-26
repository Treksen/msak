-- =====================================================================
-- 11 · Admins see members' login emails and can correct a mistyped one
-- =====================================================================
-- Login emails live in Supabase's auth tables, which the app can't read. These two functions let
-- administrators (only) list them next to members and change one when a member typed it wrong.
-- The member then logs in with the corrected email and their usual password. Changes go in the Activity log.
-- Safe to run more than once.

create or replace function public.admin_member_emails()
returns table (id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can see members'' emails.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text from auth.users u join public.profiles p on p.id = u.id;
end;
$$;
revoke all on function public.admin_member_emails() from public, anon;
grant execute on function public.admin_member_emails() to authenticated;

create or replace function public.admin_change_email(p_member uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_old text;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change a member''s email.' using errcode = '42501';
  end if;
  select p.full_name into v_name from public.profiles p where p.id = p_member;
  if v_name is null then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;
  if v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'That email address doesn''t look right.' using errcode = '22023';
  end if;
  select u.email into v_old from auth.users u where u.id = p_member;
  if lower(v_old) = v_email then
    return; -- nothing to change
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> p_member) then
    raise exception 'Another account already uses that email.' using errcode = '23505';
  end if;

  update auth.users
     set email = v_email,
         email_confirmed_at = coalesce(email_confirmed_at, now()),  -- an admin vouches for it
         updated_at = now()
   where id = p_member;
  -- the email sign-in identity keeps its own copy of the address
  update auth.identities
     set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)),
         updated_at = now()
   where user_id = p_member and provider = 'email';

  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, summary, changes)
  values (
    v_uid,
    coalesce((select 'Admin · ' || coalesce(p.full_name, u.email) from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid), 'Admin'),
    'update', 'profiles', p_member::text, v_name,
    jsonb_build_object('login email', v_email)
  );
end;
$$;
revoke all on function public.admin_change_email(uuid, text) from public, anon;
grant execute on function public.admin_change_email(uuid, text) to authenticated;
