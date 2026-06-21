/* Server-side custom pack config — keep prices in sync with public/tiers.config.js */

const CATEGORIES = [
  { id: 1, name: "Pack 1" },
  { id: 2, name: "Pack 2" },
  { id: 3, name: "Pack 3" },
  { id: 4, name: "Pack 4" },
  { id: 5, name: "Pack 5" },
  { id: 6, name: "Pack 6" }
];

const SIZES = [
  { id: "25gb",  label: "25 GB" },
  { id: "50gb",  label: "50 GB" },
  { id: "100gb", label: "100 GB" },
  { id: "250gb", label: "250 GB" },
  { id: "500gb", label: "500 GB" },
  { id: "1tb",   label: "1 TB" },
  { id: "5tb",   label: "5 TB" }
];

const PRICES = {
  1: { "25gb": 12,  "50gb": 30,  "100gb": 58,  "250gb": 95,  "500gb": 145, "1tb": 185, "5tb": 250 },
  2: { "25gb": 14,  "50gb": 34,  "100gb": 62,  "250gb": 105, "500gb": 155, "1tb": 200, "5tb": 260 },
  3: { "25gb": 14,  "50gb": 34,  "100gb": 62,  "250gb": 105, "500gb": 155, "1tb": 200, "5tb": 260 },
  4: { "25gb": 15,  "50gb": 36,  "100gb": 66,  "250gb": 115, "500gb": 165, "1tb": 215, "5tb": 270 },
  5: { "25gb": 20,  "50gb": 48,  "100gb": 82,  "250gb": 135, "500gb": 190, "1tb": 245, "5tb": 300 },
  6: { "25gb": 25,  "50gb": 58,  "100gb": 105, "250gb": 170, "500gb": 245, "1tb": 320, "5tb": 400 }
};

function getCategory(id) {
  const n = Number(id);
  return CATEGORIES.find((c) => c.id === n) || null;
}

function getSize(id) {
  const s = String(id || "").trim();
  return SIZES.find((x) => x.id === s) || null;
}

function getCustomPrice(packId, sizeId) {
  const cat = getCategory(packId);
  const size = getSize(sizeId);
  if (!cat || !size) return null;
  const price = PRICES[cat.id]?.[size.id];
  if (!price) return null;
  return {
    packId: cat.id,
    packName: cat.name,
    sizeId: size.id,
    sizeLabel: size.label,
    priceUSD: price,
    label: `Custom · ${cat.name} · ${size.label}`
  };
}

module.exports = { CATEGORIES, SIZES, PRICES, getCategory, getSize, getCustomPrice };
