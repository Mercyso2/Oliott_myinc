-- MYINC TEMPLATES VISUAIS V6.7 — SQL OPCIONAL
-- Use apenas se o importador reclamar de RLS/bucket.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', true, 52428800, array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
alter table if exists public.library_items enable row level security;
alter table if exists public.media_assets enable row level security;
grant select, insert, update, delete on public.library_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.media_assets to anon, authenticated, service_role;
drop policy if exists "myinc_library_items_manage_panel" on public.library_items;
create policy "myinc_library_items_manage_panel" on public.library_items for all to anon, authenticated using (true) with check (true);
drop policy if exists "myinc_media_assets_manage_panel" on public.media_assets;
create policy "myinc_media_assets_manage_panel" on public.media_assets for all to anon, authenticated using (true) with check (true);
commit;
