/* Server-side mirror of the tier config. Keep id/priceUSD/invitesRequired
   and unlockUrl in sync with public/tiers.config.js.

   This file is the only place the API trusts to resolve a tier — it
   never trusts client-side data for unlock URLs, prices or thresholds.
*/
const TIERS = [
  { id: 1, name: "Tier 1", priceUSD: 10,  invitesRequired: 10,  unlockUrl: "https://mega.nz/folder/dyUkiRyD#ooS0qN64DOXkSuli8BXL1A" },
  { id: 2, name: "Tier 2", priceUSD: 20,  invitesRequired: 20,  unlockUrl: "PLACEHOLDER_TIER2_LINK" },
  { id: 3, name: "Tier 3", priceUSD: 40,  invitesRequired: 40,  unlockUrl: "PLACEHOLDER_TIER3_LINK" },
  { id: 4, name: "Tier 4", priceUSD: 80,  invitesRequired: 80,  unlockUrl: "PLACEHOLDER_TIER4_LINK" },
  { id: 5, name: "Tier 5", priceUSD: 120, invitesRequired: 120, unlockUrl: "PLACEHOLDER_TIER5_LINK" },
  { id: 6, name: "Tier 6", priceUSD: 200, invitesRequired: 200, unlockUrl: "PLACEHOLDER_TIER6_LINK" }
];

function getTier(id) {
  const tierId = Number(id);
  return TIERS.find((t) => t.id === tierId) || null;
}

function userHasAccess(user, tierId) {
  if (!user) return false;
  const tier = getTier(tierId);
  if (!tier) return false;

  const unlocked = Array.isArray(user.unlocked_tiers) ? user.unlocked_tiers : [];
  if (unlocked.includes(tier.id)) return true;

  const refs = Number(user.referrals_count || 0);
  if (refs >= tier.invitesRequired) return true;

  return false;
}

module.exports = { TIERS, getTier, userHasAccess };
