const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    // Heartbeat ping, routed here from /api/heartbeat
    try {
      const auth = verifyAuth(req);
      const supabase = getSupabase();

      const { error } = await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", auth.id);

      if (error) {
        return send(res, 200, { ok: true, tracked: false });
      }

      return send(res, 200, { ok: true, tracked: true });
    } catch (err) {
      return send(res, err.status || 401, { error: err.message || "Unauthorized" });
    }
  }

  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, referral_code, referrals_count, reward_unlocked, unlocked_tiers, is_admin, is_banned, created_at")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) {
      return send(res, 404, { error: "User not found" });
    }

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", auth.id);

    return send(res, 200, { user });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
