const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { TIERS, userHasAccess } = require("./_tiers");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, referrals_count, unlocked_tiers")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) return send(res, 404, { error: "User not found" });

    const result = TIERS.map((t) => {
      const access = userHasAccess(user, t.id);
      return {
        id: t.id,
        invitesRequired: t.invitesRequired,
        priceUSD: t.priceUSD,
        hasAccess: access,
        unlockUrl: access ? t.unlockUrl : null
      };
    });

    return send(res, 200, { tiers: result });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
