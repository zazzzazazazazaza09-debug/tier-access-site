const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    // Heartbeat ping
    try {
      const auth = verifyAuth(req);
      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", auth.id);
      return send(res, 200, { ok: true, tracked: !error });
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

    if (!user) return send(res, 404, { error: "User not found" });

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", auth.id);

    // NOTE: notifications are now fetched via GET /api/notifications (separate endpoint)
    // to avoid race conditions with the inline stats script that also calls /api/me.
    return send(res, 200, { user, notifications: [] });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
