-- 16 · Profile photos
-- Run after 15. Members upload one photo; it's stored as "<their user id>/<random name>.jpg".
-- The bucket is "public" so the picture loads quickly by its link, but nobody can list the bucket:
-- only the owner (and admins) can see the file list. Names are random, so links can't be guessed.

alter table public.profiles add column if not exists photo_path text
  check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');

grant update (photo_path) on public.profiles to authenticated;   -- "Update own profile" policy limits it to yourself

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own profile photos: see" on storage.objects;
create policy "Own profile photos: see" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

drop policy if exists "Own profile photos: upload" on storage.objects;
create policy "Own profile photos: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own profile photos: delete" on storage.objects;
create policy "Own profile photos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

notify pgrst, 'reload schema';
