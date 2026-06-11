const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { getTier, userHasAccess } = require("./_tiers");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    // tier_id is optional (defaults to 1 for backward compatibility)
    const tierId = Number((req.body && req.body.tier_id) || 1);
    const tier = getTier(tierId);

    if (!tier) return send(res, 400, { error: "Invalid tier" });

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, referrals_count, unlocked_tiers")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) return send(res, 404, { error: "User not found" });

    if (!userHasAccess(user, tier.id)) {
      return send(res, 403, {
        error: `You need ${tier.invitesRequired} invites or a paid unlock to access ${tier.name}.`
      });
    }

    // If user reached the threshold via referrals, persist it.
    const unlocked = Array.isArray(user.unlocked_tiers) ? user.unlocked_tiers : [];
    if (!unlocked.includes(tier.id)) {
      const next = Array.from(new Set([...unlocked, tier.id])).sort((a, b) => a - b);
      await supabase
        .from("profiles")
        .update({ unlocked_tiers: next, reward_unlocked: true })
        .eq("id", user.id);
    }

    await supabase.from("reward_clicks").insert({
      user_id: user.id,
      username: user.username
    });

    return send(res, 200, {
      reward_url: tier.unlockUrl,
      tier_id: tier.id
    });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
