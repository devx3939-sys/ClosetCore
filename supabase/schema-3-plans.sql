-- Closet App — paid plans + usage tracking.
-- Run this once in the Supabase SQL editor AFTER schema-2-ai.sql.
-- Idempotent: safe to re-run.

------------------------------------------------------------------------------
-- 1. Profile columns for plan + Stripe-ready fields
------------------------------------------------------------------------------

alter table profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro', 'lifetime')),
  add column if not exists plan_period_end timestamptz,
  add column if not exists lifetime_purchased_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_plan_idx on profiles(plan);
create index if not exists profiles_stripe_customer_idx
  on profiles(stripe_customer_id);

------------------------------------------------------------------------------
-- 2. Usage counters — one row per (user, feature, period_key)
-- period_key is 'YYYY-MM' for monthly limits, 'all' for lifetime limits.
------------------------------------------------------------------------------

create table if not exists usage_counters (
  user_id uuid references auth.users(id) on delete cascade not null,
  feature text not null,
  period_key text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, period_key)
);

alter table usage_counters enable row level security;

drop policy if exists "users read own usage" on usage_counters;
create policy "users read own usage"
  on usage_counters for select using (auth.uid() = user_id);

-- Edge functions hit this with the service_role key, which bypasses RLS — but
-- we add an explicit policy for clarity if anyone ever switches it off.
drop policy if exists "service role manages usage" on usage_counters;
create policy "service role manages usage"
  on usage_counters for all using (auth.role() = 'service_role');

------------------------------------------------------------------------------
-- 3. Atomic check-and-increment RPC
-- Edge functions call this BEFORE making the AI call. Returns whether the
-- call is allowed and the new count. Uses row-level locking to be race-safe.
--
-- p_limit is bigint so we can pass JS Number.MAX_SAFE_INTEGER (~9e15) for
-- "unlimited" tiers without overflowing Postgres int (max ~2.1e9).
------------------------------------------------------------------------------

-- Drop any prior version (early installs used `int` for p_limit).
drop function if exists check_and_increment_usage(uuid, text, text, int);
drop function if exists check_and_increment_usage(uuid, text, text, bigint);

create function check_and_increment_usage(
  p_user_id uuid,
  p_feature text,
  p_period_key text,
  p_limit bigint
)
returns table (allowed boolean, used int, lim bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  select count into current_count
    from usage_counters
    where user_id = p_user_id
      and feature = p_feature
      and period_key = p_period_key
    for update;

  if current_count is null then
    if p_limit <= 0 then
      return query select false, 0, p_limit;
      return;
    end if;
    insert into usage_counters (user_id, feature, period_key, count)
      values (p_user_id, p_feature, p_period_key, 1);
    return query select true, 1, p_limit;
    return;
  end if;

  if current_count >= p_limit then
    return query select false, current_count, p_limit;
    return;
  end if;

  update usage_counters
    set count = count + 1, updated_at = now()
    where user_id = p_user_id
      and feature = p_feature
      and period_key = p_period_key;

  return query select true, current_count + 1, p_limit;
end;
$$;

grant execute on function check_and_increment_usage(uuid, text, text, bigint)
  to service_role;

-- Optional helper for clients to read their full usage in one round-trip.
-- Kept simple — the get-usage edge function does the plan-aware version.
create or replace function get_my_usage()
returns table (feature text, period_key text, count int)
language sql
security definer
set search_path = public
as $$
  select feature, period_key, count
    from usage_counters
    where user_id = auth.uid();
$$;

grant execute on function get_my_usage() to authenticated;

------------------------------------------------------------------------------
-- 4. Closet item-count limit for Free plan
-- Trigger checks before insert. Pro/Lifetime: unlimited.
------------------------------------------------------------------------------

create or replace function enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  item_count int;
  free_limit constant int := 30;
begin
  select plan into user_plan from profiles where id = new.user_id;
  if user_plan is null then user_plan := 'free'; end if;
  if user_plan <> 'free' then
    return new;
  end if;
  select count(*) into item_count
    from closet_items where user_id = new.user_id;
  if item_count >= free_limit then
    raise exception
      'Free plan is limited to % closet items. Upgrade to Pro for unlimited items.',
      free_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_item_limit on closet_items;
create trigger trg_enforce_item_limit
  before insert on closet_items
  for each row execute function enforce_item_limit();

------------------------------------------------------------------------------
-- 5. Helper: which plan is currently effective?
-- Lifetime is forever. Pro requires plan_period_end > now(). Else 'free'.
------------------------------------------------------------------------------

create or replace function effective_plan(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when lifetime_purchased_at is not null then 'lifetime'
    when plan = 'pro' and (plan_period_end is null or plan_period_end > now()) then 'pro'
    else 'free'
  end
  from profiles where id = p_user_id;
$$;

grant execute on function effective_plan(uuid) to authenticated, service_role;
