/* =====================================================================
   SITE CONFIG
   =====================================================================*/
window.SITE_CONFIG = {
  siteName: "Nonaxion Access",
  siteTagline: "Choose your path: Invite friends or purchase instantly!",

  telegramBot: "https://t.me/Nonaxionbot",
  telegramServer: "https://t.me/+ZQDbceeZVUs0ODA8",

  crypto: {
    BTC:  "bc1qrsppgkupuefkf4n562kp0jvus3uk5zmhhvu9t7",
    LTC:  "LMLaJQA9hgz1igXSeL9uQ5NGyViw1gc5TU",
    ETH:  "0x6dd8E61E04b0C52d4DDf84E0ACE55b1d44F3e4dF",
    SOL:  "5y6XhkYWqoDDVJLXCLAHW7wtEdkV7wvEfJg3XRrtRmhe"
  },

  cryptoRates: {
    BTC:  0.00001586,
    ETH:  0.00060430,
    LTC:  0.02347970,
    SOL:  0.15260200
  },

  giftCardPlatforms: [
    { name: "G2A",     note: "Gift Card", url: "https://www.g2a.com/search?query=paypal" },
    { name: "Eneba",   note: "Gift Card", url: "https://www.eneba.com/store/all?text=paypal" },
    { name: "Kinguin", note: "Gift Card", url: "https://www.kinguin.net/catalogsearch/result/?q=paypal" }
  ],

  customPack: {
    title: "Custom Pack",
    subtitle: "Pick a category, choose your size, pay instantly.",
    categories: [
      { id: 1, name: "a",  desc: "Essential collection",  color: "gold" },
      { id: 2, name: "b",  desc: "Premium selection",     color: "amber" },
      { id: 3, name: "c",  desc: "Elite vault",           color: "orange" },
      { id: 4, name: "d",  desc: "Ultra archive",         color: "coral" },
      { id: 5, name: "e",  desc: "VIP exclusive",         color: "rose" },
      { id: 6, name: "f",  desc: "Mega ultimate",         color: "crimson" }
    ],
    sizes: [
      { id: "25gb",  label: "25 GB",  popular: false, mega: false },
      { id: "50gb",  label: "50 GB",  popular: false, mega: false },
      { id: "100gb", label: "100 GB", popular: false, mega: false },
      { id: "250gb", label: "250 GB", popular: true,  mega: false },
      { id: "500gb", label: "500 GB", popular: false, mega: false },
      { id: "1tb",   label: "1 TB",   popular: false, mega: false },
      { id: "5tb",   label: "5 TB",   popular: false, mega: true  }
    ],
    prices: {
      1: { "25gb":  { price: 12,  original: 18  }, "50gb":  { price: 30,  original: 45  }, "100gb": { price: 58,  original: 85  }, "250gb": { price: 95,  original: 140 }, "500gb": { price: 145, original: 210 }, "1tb":   { price: 185, original: 270 }, "5tb":   { price: 250, original: 350 } },
      2: { "25gb":  { price: 14,  original: 20  }, "50gb":  { price: 34,  original: 50  }, "100gb": { price: 62,  original: 90  }, "250gb": { price: 105, original: 155 }, "500gb": { price: 155, original: 225 }, "1tb":   { price: 200, original: 290 }, "5tb":   { price: 260, original: 370 } },
      3: { "25gb":  { price: 14,  original: 20  }, "50gb":  { price: 34,  original: 50  }, "100gb": { price: 62,  original: 90  }, "250gb": { price: 105, original: 155 }, "500gb": { price: 155, original: 225 }, "1tb":   { price: 200, original: 290 }, "5tb":   { price: 260, original: 370 } },
      4: { "25gb":  { price: 15,  original: 22  }, "50gb":  { price: 36,  original: 54  }, "100gb": { price: 66,  original: 96  }, "250gb": { price: 115, original: 168 }, "500gb": { price: 165, original: 240 }, "1tb":   { price: 215, original: 310 }, "5tb":   { price: 270, original: 380 } },
      5: { "25gb":  { price: 20,  original: 30  }, "50gb":  { price: 48,  original: 70  }, "100gb": { price: 82,  original: 118 }, "250gb": { price: 135, original: 195 }, "500gb": { price: 190, original: 275 }, "1tb":   { price: 245, original: 355 }, "5tb":   { price: 300, original: 420 } },
      6: { "25gb":  { price: 25,  original: 38  }, "50gb":  { price: 58,  original: 85  }, "100gb": { price: 105, original: 150 }, "250gb": { price: 170, original: 245 }, "500gb": { price: 245, original: 350 }, "1tb":   { price: 320, original: 460 }, "5tb":   { price: 400, original: 550 } }
    }
  },

  tiers: [
    {
      id: 0,
      name: "Tier 0.5",
      subtitle: "For those who don't want to spend money and don't have a lot of people to share their link with.",
      priceUSD: 0,
      invitesRequired: 2,
      payDisabled: true,
      totalSize: "10 GB",
      color: "silver",
      features: [
        "100+ Unique Videos",
        "10+ New Videos Weekly",
        "Permanent Access",
        "1080p Quality Content"
      ],
      unlockUrl: "https://mega.nz/folder/iTpQjJCI#YjByBLvgIlxYZ7v1lBaG_A"
    },
    {
      id: 1,
      name: "Tier 1",
      priceUSD: 10,
      invitesRequired: 15,
      totalSize: "60 GB",
      color: "blue",
      features: [
        "2,500+ Unique Videos",
        "50+ New Videos Weekly",
        "Permanent Access",
        "HD Quality Content"
      ],
      unlockUrl: "https://mega.nz/folder/kVsVFTpA#Wgc9TG0K0qFP_edSUMfIoQ"
    },
    {
      id: 2,
      name: "Tier 2",
      priceUSD: 20,
      invitesRequired: 30,
      totalSize: "150 GB",
      color: "purple",
      features: [
        "5,800+ Unique Videos",
        "120+ New Videos Weekly",
        "Young :)",
        "Permanent/Instant Access",
        "Exclusive Content"
      ],
      unlockUrl: "https://mega.nz/folder/qpAlFSiC#4A_h0goqIMV0UYPqIpBE1A"
    },
    {
      id: 3,
      name: "Tier 3",
      priceUSD: 40,
      invitesRequired: 50,
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
      unlockUrl: "https://mega.nz/folder/UUs33JwL#A-QboeebPQp-2kGr-6zWsw"
    },
    {
      id: 4,
      name: "Tier 4",
      priceUSD: 80,
      invitesRequired: 100,
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
      unlockUrl: "https://mega.nz/folder/kVsVFTpA#Wgc9TG0K0qFP_edSUMfIoQ"
    },
    {
      id: 5,
      name: "Tier 5",
      priceUSD: 180,
      invitesRequired: 180,
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
      unlockUrl: "https://mega.nz/folder/ycURWbQa#1nB1asXinsTSWe_JWDoQYQ"
    },
    {
      id: 6,
      name: "Tier 6",
      priceUSD: 350,
      invitesRequired: 350,
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
      unlockUrl: "https://mega.nz/folder/AysgBQYC#80bBtBc7yCN7vV_ThXuuZg"
    }
  ]
};
