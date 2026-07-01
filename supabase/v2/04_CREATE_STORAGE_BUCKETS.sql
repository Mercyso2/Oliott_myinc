-- V2 04 - Buckets. Upload final é feito pela Edge Function engine-save-result com service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('creative-media', 'creative-media', true, 104857600, array['image/png','image/jpeg','image/webp','video/mp4','video/webm']::text[]),
  ('brand-assets', 'brand-assets', true, 52428800, array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']::text[]),
  ('library', 'library', false, 104857600, array['image/png','image/jpeg','image/webp','video/mp4','application/pdf']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "creative-media public read" on storage.objects;
create policy "creative-media public read" on storage.objects for select to public using (bucket_id = 'creative-media');

drop policy if exists "brand-assets public read" on storage.objects;
create policy "brand-assets public read" on storage.objects for select to public using (bucket_id = 'brand-assets');

drop policy if exists "authenticated manage library assets" on storage.objects;
create policy "authenticated manage library assets" on storage.objects for all to authenticated
using (bucket_id in ('brand-assets','library')) with check (bucket_id in ('brand-assets','library'));
