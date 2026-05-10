create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  referral_code text unique not null,
  referred_by uuid references profiles(id) on delete set null,
  referrals_count integer not null default 0,
  reward_unlocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(referred_id)
);

create index if not exists profiles_referral_code_idx on profiles(referral_code);
create index if not exists profiles_referred_by_idx on profiles(referred_by);
