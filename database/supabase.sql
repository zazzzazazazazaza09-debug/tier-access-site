create extension if not exists pgcrypto;
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  referral_code text unique not null,
  referred_by uuid references profiles(id) on delete set null,
  referrals_count integer not null default 0,
  reward_unlocked boolean not null default false,
  signup_ip_hash text,
  signup_device_hash text,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(referred_id)
);

create table if not exists referral_claims (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid references profiles(id) on delete cascade,
  ip_hash text not null,
  device_hash text not null,
  counted boolean not null default false,
  reason text not null default 'unknown',
  created_at timestamptz not null default now()
);

create table if not exists reward_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  username text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_referral_code_idx on profiles(referral_code);
create index if not exists profiles_referred_by_idx on profiles(referred_by);
create index if not exists profiles_username_lower_idx on profiles(lower(username));
create index if not exists referral_claims_referrer_id_idx on referral_claims(referrer_id);
create index if not exists referral_claims_ip_hash_idx on referral_claims(ip_hash);
create index if not exists referral_claims_device_hash_idx on referral_claims(device_hash);
create unique index if not exists referral_claims_unique_ip_per_referrer
on referral_claims(referrer_id, ip_hash)
where counted = true;
create unique index if not exists referral_claims_unique_device_per_referrer
on referral_claims(referrer_id, device_hash)
where counted = true;

-- Multi-tier access + admin flag.
alter table profiles
  add column if not exists unlocked_tiers integer[] not null default '{}';

alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Presence tracking (for "online now" admin stat).
alter table profiles
  add column if not exists last_seen timestamptz;

create index if not exists profiles_last_seen_idx on profiles(last_seen);

-- Purchases (manual review).
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  username text,
  tier_id integer not null,
  method text not null check (method in ('crypto','giftcard','cashapp')),
  amount_usd numeric not null,
  -- crypto / cashapp
  crypto_currency text,
  crypto_amount text,
  tx_id text,
  -- giftcard
  giftcard_platform text,
  giftcard_code text,
  -- review
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null
);

create index if not exists purchases_status_idx on purchases(status, created_at desc);
create index if not exists purchases_user_idx on purchases(user_id);

-- Custom pack purchases (tier_id = 0).
alter table purchases
  add column if not exists is_custom boolean not null default false;

alter table purchases
  add column if not exists custom_pack_id integer;

alter table purchases
  add column if not exists custom_size_id text;

alter table purchases
  add column if not exists custom_label text;

-- Custom orders (free-form requests + on-site chat).
create table if not exists custom_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  username text,
  initial_message text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_orders_user_idx on custom_orders(user_id, created_at desc);
create index if not exists custom_orders_status_idx on custom_orders(status, updated_at desc);

create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references custom_orders(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  is_admin boolean not null default false,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_idx on order_messages(order_id, created_at asc);
