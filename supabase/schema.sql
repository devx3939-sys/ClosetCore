-- Closet App — Supabase schema
-- Run this once in the Supabase SQL editor.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  color_season text check (color_season in ('spring','summer','autumn','winter')),
  skin_tone text,
  hair_color text,
  eye_color text,
  style_preferences text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  subcategory text,
  color text,
  color_family text,
  brand text,
  size text,
  season text[] default '{}',
  occasion text[] default '{}',
  image_url text,
  thumbnail_url text,
  purchase_date date,
  purchase_price numeric,
  wear_count int default 0,
  condition text,
  is_favorite boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index if not exists closet_items_user_id_idx on closet_items(user_id);
create index if not exists closet_items_category_idx on closet_items(category);

create table if not exists outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  item_ids uuid[] not null default '{}',
  occasion text,
  season text,
  weather jsonb,
  is_favorite boolean default false,
  times_worn int default 0,
  last_worn date,
  created_at timestamptz default now()
);

create index if not exists outfits_user_id_idx on outfits(user_id);

create table if not exists color_palettes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  season text,
  primary_colors text[] default '{}',
  secondary_colors text[] default '{}',
  accent_colors text[] default '{}',
  neutral_colors text[] default '{}',
  avoid_colors text[] default '{}',
  updated_at timestamptz default now()
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table closet_items enable row level security;
alter table outfits enable row level security;
alter table color_palettes enable row level security;

drop policy if exists "users own profile" on profiles;
create policy "users own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users own items" on closet_items;
create policy "users own items" on closet_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users own outfits" on outfits;
create policy "users own outfits" on outfits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users own palette" on color_palettes;
create policy "users own palette" on color_palettes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET FOR CLOSET PHOTOS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('closet-images', 'closet-images', true)
on conflict (id) do nothing;

drop policy if exists "public read closet images" on storage.objects;
create policy "public read closet images" on storage.objects
  for select using (bucket_id = 'closet-images');

drop policy if exists "auth users upload closet images" on storage.objects;
create policy "auth users upload closet images" on storage.objects
  for insert with check (
    bucket_id = 'closet-images' and auth.role() = 'authenticated'
  );

drop policy if exists "users delete own closet images" on storage.objects;
create policy "users delete own closet images" on storage.objects
  for delete using (
    bucket_id = 'closet-images' and owner = auth.uid()
  );
