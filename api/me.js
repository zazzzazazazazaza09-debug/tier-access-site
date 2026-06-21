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

  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, referral_code, referrals_count, reward_unlocked, unlocked_tiers, is_admin, is_banned, created_at")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) return send(res, 404, { error: "User not found" });

    await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", auth.id);

    // Notifications only fetched when ?with_notifications=1
    // This avoids a race condition with the inline stats script that also calls /api/me
    let notifications = [];
    if (req.query && req.query.with_notifications === "1") {
      try {
        const { data: notifs } = await supabase
          .from("admin_notifications")
          .select("id, message, created_at")
          .eq("user_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(10);
        if (notifs && notifs.length) {
          notifications = notifs;
          await supabase
            .from("admin_notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .is("read_at", null);
        }
      } catch (_) {}
    }

    return send(res, 200, { user, notifications });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
