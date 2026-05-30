# Vercel Tier Referral Site

This is the Vercel version.

## Files

- `public/index.html`
- `public/style.css`
- `public/app.js`
- `public/tier1.html`
- `api/enter.js`
- `api/login.js`
- `api/me.js`
- `api/claim.js`
- `database/supabase.sql`

## Vercel settings

Framework: Other

Build Command:

```text
npm run build
```

Output Directory:

```text
public
```

Install Command:

```text
npm install
```

## Environment Variables

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=make_a_long_random_secret
REWARD_URL=/tier1.html
```

## Supabase

Run `database/supabase.sql` in Supabase SQL Editor.

If you already created the database before this update, run the latest
`database/supabase.sql` again. It adds the login index, anti-abuse columns,
referral claim table, and reward click table.

The username index is intentionally not unique because older databases may
already contain duplicate usernames. New duplicates are blocked by the API.
