const TIERS = [
  { id: 1, name: "Tier 1",   priceUSD: 10, invitesRequired: 15,  unlockUrl: "https://mega.nz/folder/PUtj3DIb#n_wQW4wD8njQSdfXVQouPQ" },
  { id: 2, name: "Tier 2",   priceUSD: 20, invitesRequired: 30,  unlockUrl: "https://mega.nz/folder/X9BWiLoJ#Dtu36r2Bgsn8nGtyJYvfPQ" },
  { id: 3, name: "Tier 3",   priceUSD: 40, invitesRequired: 50,  unlockUrl: "https://mega.nz/folder/UUs33JwL#A-QboeebPQp-2kGr-6zWsw" },
  { id: 4, name: "Tier 4",   priceUSD: 80, invitesRequired: 100, unlockUrl: "https://mega.nz/folder/qpAlFSiC#4A_h0goqIMV0UYPqIpBE1A" },
  { id: 5, name: "Tier 5",   priceUSD: 120, invitesRequired: 180, unlockUrl: "https://mega.nz/folder/ycURWbQa#1nB1asXinsTSWe_JWDoQYQ" },
  { id: 6, name: "Tier 6",   priceUSD: 200, invitesRequired: 350, unlockUrl: "https://mega.nz/folder/AysgBQYC#80bBtBc7yCN7vV_ThXuuZg" }
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
