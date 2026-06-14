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
  admin-stats.js   # (admin) dashboard stats
  heartbeat.js     # Presence ping (updates profiles.last_seen)
  _tiers.js        # Server-side tier config (must mirror public/tiers.config.js)
  _telegram.js     # Telegram admin notification helper
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
TELEGRAM_BOT_TOKEN=your-telegram-bot-token   # optional, for admin notifications
TELEGRAM_CHAT_ID=your-telegram-chat-id       # optional, for admin notifications
```

`REWARD_URL` is no longer used (the unlock URL now comes from
`api/_tiers.js`).

## Supabase

Run `database/supabase.sql` in the SQL Editor. If you already
created the database before, run it again — it adds the
`unlocked_tiers`, `is_admin` and `last_seen` columns and the
`purchases` table idempotently.

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

## Admin notifications on Telegram (new purchases & custom orders)

You (the admin) can get a Telegram message on your phone every time
someone submits a payment or a custom order request.

1. **Create a bot:**
   - Open Telegram, search for **@BotFather**, start a chat.
   - Send `/newbot`, give it a name and a username (must end in `bot`).
   - BotFather replies with a token like `123456789:AAH...` — this is
     your `TELEGRAM_BOT_TOKEN`.

2. **Get your chat id:**
   - Search for **@userinfobot** (or **@getidsbot**) on Telegram,
     start a chat with it, and it will reply with your numeric user
     id — this is your `TELEGRAM_CHAT_ID`.
   - Then open a chat with **your new bot** (search its username) and
     send it any message (e.g. `/start`), so it's allowed to message
     you back.

3. **Add the env vars on Vercel:**
   - Project → Settings → Environment Variables.
   - Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` with the values
     above, then redeploy.

4. **That's it.** New purchase submissions and new custom order
   requests will now ping your bot's chat with the user, item, amount
   and method. If the env vars aren't set, this is silently skipped —
   nothing else is affected.

## Admin dashboard

`/admin.html` has a **Dashboard** tab showing live stats and graphs:

- **Online now** — number of users active in the last 5 minutes
  (based on a heartbeat ping sent every 60s by logged-in users via
  `api/heartbeat.js`, stored in `profiles.last_seen`).
- Total accounts, new signups (today / 7 days), admins, total
  referrals, referred users, reward-unlocked count.
- Revenue (today / 7 days / month / all time).
- Purchase counts by status (pending / approved / rejected / total),
  approved custom packs, open and total custom orders.
- How many users have unlocked each tier.
- **Charts** (powered by Chart.js, loaded from CDN):
  - Line chart of new signups over the last 14 days.
  - Bar chart of approved revenue over the last 14 days.
  - Doughnut chart of purchases by payment method.

If the `last_seen` column hasn't been added yet (i.e. you haven't
re-run `database/supabase.sql`), "Online now" simply shows `0` and
the heartbeat endpoint fails silently — nothing else is affected.

## Mobile fixes

- Tapping a tier's reward button now opens the destination reliably
  on mobile browsers (the tab is opened synchronously inside the tap
  gesture, then redirected once the unlock request completes, with a
  same-tab fallback if the popup is blocked).
- The notifications panel now renders as a fixed sheet under the top
  bar on small screens instead of overflowing off-screen.
- General responsive tightening of the top bar and modals on screens
  under 700px wide.
