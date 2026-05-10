alter table profiles
add column if not exists signup_ip_hash text;

alter table profiles
add column if not exists signup_device_hash text;

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

create index if not exists referral_claims_referrer_id_idx
on referral_claims(referrer_id);

create index if not exists referral_claims_ip_hash_idx
on referral_claims(ip_hash);

create index if not exists referral_claims_device_hash_idx
on referral_claims(device_hash);

create unique index if not exists referral_claims_unique_ip_per_referrer
on referral_claims(referrer_id, ip_hash)
where counted = true;

create unique index if not exists referral_claims_unique_device_per_referrer
on referral_claims(referrer_id, device_hash)
where counted = true;
