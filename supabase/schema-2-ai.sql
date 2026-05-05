-- Closet App — additions for AI photo features.
-- Run this once in the Supabase SQL editor AFTER schema.sql.

alter table color_palettes
  add column if not exists per_season_palettes jsonb,
  add column if not exists undertone text,
  add column if not exists rationale text;

alter table profiles
  add column if not exists undertone text;

-- Optional: a "selfies" bucket so the analyzer photo isn't mixed with closet items.
-- It's separate so the user can mark it private later if desired.
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', true)
on conflict (id) do nothing;

drop policy if exists "public read selfies" on storage.objects;
create policy "public read selfies" on storage.objects
  for select using (bucket_id = 'selfies');

drop policy if exists "auth users upload selfies" on storage.objects;
create policy "auth users upload selfies" on storage.objects
  for insert with check (
    bucket_id = 'selfies' and auth.role() = 'authenticated'
  );

drop policy if exists "users delete own selfies" on storage.objects;
create policy "users delete own selfies" on storage.objects
  for delete using (
    bucket_id = 'selfies' and owner = auth.uid()
  );
