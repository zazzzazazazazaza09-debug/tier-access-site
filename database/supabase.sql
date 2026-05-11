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
