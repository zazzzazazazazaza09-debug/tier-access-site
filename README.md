# Simple Tier Referral Site

Simple mobile-friendly version:

- page 1: name + password + anti-bot
- page 2: Tier 1 referral progress
- unique referral link
- unlock Tier 1 at 5 referrals

## Netlify deploy

Upload the whole folder to Netlify.

Netlify should use:

```text
Publish directory: public
Functions directory: netlify/functions
```

## Supabase setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Run `database/supabase.sql`.
4. In Netlify, add environment variables:

```text
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=make_a_long_random_secret
REWARD_URL=https://your-private-link.com
```

## Important

The username is not unique. Many users can choose the same name.
The account is linked to the saved device token in localStorage.


## If Netlify build fails

Use these build settings:

Build command:
npm run build

Publish directory:
public

Functions directory:
netlify/functions

Node version:
20
