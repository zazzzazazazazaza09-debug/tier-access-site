CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  referral_code text UNIQUE NOT NULL,
  referred_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  referrals_count integer NOT NULL DEFAULT 0,
  reward_unlocked boolean NOT NULL DEFAULT false,
  signup_ip_hash text,
  signup_device_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  unlocked_tiers integer[] NOT NULL DEFAULT '{}',
  is_admin boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE TABLE IF NOT EXISTS referral_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  device_hash text NOT NULL,
  counted boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON profiles(lower(username));
CREATE INDEX IF NOT EXISTS referral_claims_referrer_id_idx ON referral_claims(referrer_id);
CREATE INDEX IF NOT EXISTS referral_claims_ip_hash_idx ON referral_claims(ip_hash);
CREATE INDEX IF NOT EXISTS referral_claims_device_hash_idx ON referral_claims(device_hash);
CREATE UNIQUE INDEX IF NOT EXISTS referral_claims_unique_ip_per_referrer ON referral_claims(referrer_id, ip_hash) WHERE counted = true;
CREATE UNIQUE INDEX IF NOT EXISTS referral_claims_unique_device_per_referrer ON referral_claims(referrer_id, device_hash) WHERE counted = true;

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username text,
  tier_id integer NOT NULL,
  method text NOT NULL CHECK (method IN ('crypto','giftcard','cashapp')),
  amount_usd numeric NOT NULL,
  crypto_currency text,
  crypto_amount text,
  tx_id text,
  giftcard_platform text,
  giftcard_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_custom boolean NOT NULL DEFAULT false,
  custom_pack_id integer,
  custom_size_id text,
  custom_label text
);

CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases(user_id);

CREATE TABLE IF NOT EXISTS custom_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username text,
  initial_message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_orders_user_idx ON custom_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_orders_status_idx ON custom_orders(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES custom_orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_messages_order_idx ON order_messages(order_id, created_at ASC);