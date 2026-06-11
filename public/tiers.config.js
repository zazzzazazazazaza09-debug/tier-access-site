/* =====================================================================
   SITE CONFIG — single place to edit tier names, prices, links, copy.
   You can rename tiers, change prices, change referral thresholds and
   replace placeholder unlock links right here.
   The same values are used by the admin panel and by the API
   (see api/_tiers.js — keep both in sync if you change something
    that the server validates: priceUSD and invitesRequired).
   =====================================================================*/
window.SITE_CONFIG = {
  siteName: "Nonaxion Access",
  siteTagline: "Choose your path: Invite friends or purchase instantly!",

  // Telegram bot kept as a fallback — shown in sidebar (Support) and
  // on the purchase modal as an alternative.
  telegramBot: "https://t.me/Nonaxionbot",

  // Crypto deposit addresses (middle-man wallet — edit if needed).
  crypto: {
    BTC:  "bc1qrsppgkupuefkf4n562kp0jvus3uk5zmhhvu9t7",
    LTC:  "LMLaJQA9hgz1igXSeL9uQ5NGyViw1gc5TU",
    ETH:  "0x6dd8E61E04b0C52d4DDf84E0ACE55b1d44F3e4dF",
    SOL:  "5y6XhkYWqoDDVJLXCLAHW7wtEdkV7wvEfJg3XRrtRmhe"
  },

  // Indicative USD → crypto conversion rates. Edit when you need a
  // refresh — these are only used for display ("≈ X BTC"). The amount
  // the user actually owes is the USD price of the tier.
  cryptoRates: {
    BTC:  0.00001586,
    ETH:  0.00060430,
    LTC:  0.02347970,
    SOL:  0.15260200
  },

  // Gift card platforms shown in the modal.
  // Clicking a platform opens the store with a "paypal" search.
  // Add or remove entries here — each needs name, note, and url.
  giftCardPlatforms: [
    { name: "G2A",     note: "Gift Card", url: "https://www.g2a.com/search?query=paypal" },
    { name: "Eneba",   note: "Gift Card", url: "https://www.eneba.com/store/all?text=paypal" },
    { name: "Kinguin", note: "Gift Card", url: "https://www.kinguin.net/catalogsearch/result/?q=paypal" },
    { name: "Driffle", note: "Gift Card", url: "https://driffle.com/search?q=paypal" }
  ],

  // ----- TIERS -----
  // Edit name, priceUSD, invitesRequired, totalSize, color, features,
  // and unlockUrl freely.
  // unlockUrl is what the user gets when they have access (via referrals
  // OR a purchase approved by an admin).
  tiers: [
    {
      id: 1,
      name: "Tier 1",
      priceUSD: 10,
      invitesRequired: 10,
      totalSize: "60 GB",
      color: "blue",
      features: [
        "2,500+ Unique Videos",
        "50+ New Videos Weekly",
        "Permanent Access",
        "HD Quality Content"
      ],
      unlockUrl: "https://mega.nz/folder/dyUkiRyD#ooS0qN64DOXkSuli8BXL1A"
    },
    {
      id: 2,
      name: "Tier 2",
      priceUSD: 20,
      invitesRequired: 20,
      totalSize: "150 GB",
      color: "purple",
      features: [
        "5,800+ Unique Videos",
        "120+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Exclusive Content"
      ],
      unlockUrl: "PLACEHOLDER_TIER2_LINK"
    },
    {
      id: 3,
      name: "Tier 3",
      priceUSD: 40,
      invitesRequired: 40,
      totalSize: "300 GB",
      color: "pink",
      features: [
        "11,192+ Unique Videos",
        "168+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Rare Collections",
        "Priority Updates"
      ],
      unlockUrl: "PLACEHOLDER_TIER3_LINK"
    },
    {
      id: 4,
      name: "Tier 4",
      priceUSD: 80,
      invitesRequired: 80,
      totalSize: "500 GB",
      color: "cyan",
      features: [
        "18,500+ Unique Videos",
        "250+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Exclusive Archives",
        "VIP Early Access",
        "Special Editions"
      ],
      unlockUrl: "PLACEHOLDER_TIER4_LINK"
    },
    {
      id: 5,
      name: "Tier 5",
      priceUSD: 120,
      invitesRequired: 120,
      totalSize: "800 GB",
      color: "green",
      features: [
        "28,000+ Unique Videos",
        "350+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Ultimate Collections",
        "VIP Support",
        "Lifetime Updates",
        "All Previous Tiers"
      ],
      unlockUrl: "PLACEHOLDER_TIER5_LINK"
    },
    {
      id: 6,
      name: "Tier 6",
      priceUSD: 200,
      invitesRequired: 200,
      totalSize: "1.2 TB",
      color: "red",
      features: [
        "45,000+ Unique Videos",
        "500+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Complete Vault Access",
        "VIP Priority Support",
        "Lifetime Updates",
        "All Tiers Included"
      ],
      unlockUrl: "PLACEHOLDER_TIER6_LINK"
    }
  ]
};
