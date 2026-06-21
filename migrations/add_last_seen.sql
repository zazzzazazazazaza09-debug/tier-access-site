-- Run this once in your Supabase SQL editor to enable the "online now" feature.
-- Go to: Supabase dashboard → SQL Editor → New query → paste → Run

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx
  ON profiles (last_seen);
