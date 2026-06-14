# Nonaxion Access — Vercel Tier Site

Personal tier-access site with referrals + direct on-site payment
(Crypto / Gift Card / Cash App). Admin reviews and approves payments
manually. Telegram bot is kept as a fallback.

## Files

```
public/
  index.html       # Landing (signup-first) + Instant Access dashboard
  admin.html       # Admin panel (purchases review)
  app.js           # Frontend logic
  admin.js         # Admin panel logic
  style.css
  tiers.config.js  # ← edit tiers, prices, descriptions, links here
api/
  enter.js         # Sign up + auto-login
  login.js
  me.js
  claim.js         # Per-tier claim (referrals OR approved purchase)
  tiers.js         # Returns tier list + access map for current user
  purchase.js      # User submits a payment for review
  purchases.js     # (admin) list purchases
  purchase-approve.js  # (admin) approve/reject
  _tiers.js        # Server-side tier config (must mirror public/tiers.config.js)
  _auth.js / _db.js / _utils.js
database/
  supabase.sql     # Run this in Supabase SQL Editor
```

## Editing tiers, prices, descriptions, links

Open `public/tiers.config.js`. You can rename tiers, change `priceUSD`,
`invitesRequired`, `features`, `totalSize`, `unlockUrl`, etc.

Tier 1 ships with the existing Mega link
(`https://mega.nz/folder/dyUkiRyD#ooS0qN64DOXkSuli8BXL1A`).
Tiers 2–6 contain `PLACEHOLDER_TIERX_LINK` that you should replace
with your real Mega/Drive/whatever URLs.

If you change `priceUSD` or `invitesRequired`, **also update** the same
fields in `api/_tiers.js` (and `unlockUrl`). The server validates
prices and resolves unlock URLs from `_tiers.js` only — never from the
client — to prevent tampering.

## Admin panel

1. Sign up normally on the site to create your account.
2. In Supabase, set `is_admin = true` for that profile:

   ```sql
   update profiles set is_admin = true where username = 'YOUR_USERNAME';
   ```
3. Go to `/admin.html`. You'll see all pending payments with the user,
   tier, method, transaction id / gift card code, and **Approve** /
   **Reject** buttons.

Approving a payment automatically adds the tier id to the user's
`unlocked_tiers` array, so they get instant access.

## Vercel settings

Framework: **Other**

Build Command: `npm run build`
Output Directory: `public`
Install Command: `npm install`

## Environment Variables

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=make_a_long_random_secret
```

`REWARD_URL` is no longer used (the unlock URL now comes from
`api/_tiers.js`).

## Supabase

Run `database/supabase.sql` in the SQL Editor. If you already
created the database before, run it again — it adds the
`unlocked_tiers` and `is_admin` columns and the `purchases` table
idempotently.

## How payments work

1. User clicks **Buy $X** on a tier card → modal opens with 3 tabs:
   Gift Card / Crypto / Cash App.
2. User picks a method, sends the payment to the address shown
   (or buys a gift card), pastes the transaction id / code, submits.
3. Status = `pending`. Admin sees it in `/admin.html`.
4. Admin verifies on-chain (or with the gift card platform) and clicks
   **Approve**. The tier appears in the user's account immediately.

## Captcha

Sign-up captcha is a **math calculation** (`A + B`, `A − B`, or
`A × B`). The server still validates the answer; the client converts
the answer into the legacy `captchaA + captchaB` shape so no API
change is needed.

## Telegram bot fallback

`SITE_CONFIG.telegramBot` (in `tiers.config.js`) controls the link.
It appears in the sidebar (Support) and as an alternative on the
"How to Purchase" footer.
