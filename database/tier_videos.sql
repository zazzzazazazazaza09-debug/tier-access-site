-- Run this in your Supabase SQL editor

create table if not exists tier_videos (
  id          uuid primary key default gen_random_uuid(),
  tier_id     integer not null,  -- use -1 for preview videos
  title       varchar(255) not null default '',
  video_url   text not null,
  created_at  timestamptz default now()
);

create index if not exists tier_videos_tier_id_idx on tier_videos (tier_id);
