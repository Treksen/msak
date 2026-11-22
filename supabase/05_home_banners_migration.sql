-- =============================================================================
-- MSAK Portal — migration 05: homepage banner (event countdown strip)
--
-- ONLY run this if you set up the database before 22 Nov 2026 (i.e. your
-- 01_schema.sql did not yet include section "10. Homepage banner").
-- A fresh setup using the current 01_schema.sql already includes it.
-- Safe to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10. Homepage banner (event strip with countdown), managed by administrators
-- -----------------------------------------------------------------------------
create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 120),
  venue text check (venue is null or length(venue) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  link_url text check (link_url is null or link_url ~* '^https://'),
  link_label text check (link_label is null or length(link_label) <= 40),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_banners_dates_check check (ends_at is null or ends_at >= starts_at)
);
create index if not exists home_banners_live_idx on public.home_banners (is_active, starts_at);

drop trigger if exists home_banners_touch on public.home_banners;
create trigger home_banners_touch before update on public.home_banners
  for each row execute function public.touch_updated_at();

alter table public.home_banners enable row level security;

-- Visitors see a banner while it is switched on and the event hasn't ended
-- (no end date: it stays up until one day after the start).
drop policy if exists "Live banners are public" on public.home_banners;
create policy "Live banners are public" on public.home_banners for select to anon, authenticated
  using (is_active and coalesce(ends_at, starts_at + interval '1 day') > now());

drop policy if exists "Admins manage banners" on public.home_banners;
create policy "Admins manage banners" on public.home_banners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.home_banners from anon, authenticated;
grant select on public.home_banners to anon, authenticated;
grant insert (title, venue, starts_at, ends_at, link_url, link_label, is_active),
      update (title, venue, starts_at, ends_at, link_url, link_label, is_active),
      delete
  on public.home_banners to authenticated;
