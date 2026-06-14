const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, referral_code, referrals_count, reward_unlocked, unlocked_tiers, is_admin, created_at")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) {
      return send(res, 404, { error: "User not found" });
    }

    // Presence ping for the admin "online now" stat. Fire-and-forget;
    // if the last_seen column doesn't exist yet (migration not run),
    // this fails silently and the rest of the response is unaffected.
    supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", auth.id)
      .then(() => {}, () => {});

    return send(res, 200, { user });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
