const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

// POST { username, action: "ban" | "unban" }
// GET  ?username=xxx  — lookup ban status
module.exports = async function handler(req, res) {
  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: me } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me || !me.is_admin) return send(res, 403, { error: "Admin only" });

    if (req.method === "GET") {
      const username = String(req.query?.username || "").trim();
      if (!username) return send(res, 400, { error: "username required" });
      const { data: target } = await supabase
        .from("profiles")
        .select("id, username, is_banned")
        .ilike("username", username)
        .maybeSingle();
      if (!target) return send(res, 404, { error: "User not found" });
      return send(res, 200, { user: target });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const username = String(body.username || "").trim();
      const action = String(body.action || "ban").trim();

      if (!username) return send(res, 400, { error: "username required" });
      if (!["ban", "unban"].includes(action)) return send(res, 400, { error: "action must be ban or unban" });

      const { data: target, error: findErr } = await supabase
        .from("profiles")
        .select("id, username, is_admin, is_banned")
        .ilike("username", username)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!target) return send(res, 404, { error: "User not found" });
      if (target.is_admin) return send(res, 400, { error: "Cannot ban an admin account" });

      const newBanned = action === "unban" ? false : true;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ is_banned: newBanned })
        .eq("id", target.id);

      if (updErr) throw updErr;

      return send(res, 200, { ok: true, username: target.username, banned: newBanned });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return send(res, err.status || 401, { error: err.message || "Unauthorized" });
  }
};
