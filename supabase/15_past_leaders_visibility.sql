-- =====================================================================
-- 15 · Administrators control who appears on the public Past leaders page
-- =====================================================================
-- - Per entry: "hidden by admin" overrides the member's own "show me publicly" choice.
-- - Whole page: a site setting turns the public Past leaders page off and on.
-- Safe to run more than once.

alter table public.past_roles add column if not exists hidden_by_admin boolean not null default false;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Settings are public" on public.site_settings;
create policy "Settings are public" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins change settings" on public.site_settings;
create policy "Admins change settings" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
insert into public.site_settings (key, value) values ('past_leaders_public', 'true'::jsonb) on conflict (key) do nothing;

drop trigger if exists audit_site_settings on public.site_settings;
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function public.audit_row();

create or replace function public.admin_hide_past_role(p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  update public.past_roles set hidden_by_admin = coalesce(p_hidden, false) where id = p_id;
  if not found then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.admin_hide_past_role(uuid, boolean) from public, anon;
grant execute on function public.admin_hide_past_role(uuid, boolean) to authenticated;

-- The public list: nothing while the page is switched off; never entries an admin has hidden.
create or replace function public.public_past_leaders()
returns table (full_name text, level text, association_code text, association_name text, title text, from_year integer, to_year integer)
language sql stable security definer set search_path = '' as $$
  select p.full_name, r.level, a.code, a.name, r.position, r.from_year, r.to_year
    from public.past_roles r
    join public.profiles p on p.id = r.user_id
    left join public.associations a on a.id = r.association_id
   where r.status = 'confirmed' and r.show_publicly and not r.hidden_by_admin and r.level in ('national', 'regional')
     and coalesce((select s.value = 'true'::jsonb from public.site_settings s where s.key = 'past_leaders_public'), true)
   order by r.to_year desc, r.from_year desc, (r.level = 'national') desc, a.code, p.full_name;
$$;
grant execute on function public.public_past_leaders() to anon, authenticated;
