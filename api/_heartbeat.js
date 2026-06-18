const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { error } = await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", auth.id);

    if (error) {
      // Column might not exist yet (migration not run) — fail silently.
      return send(res, 200, { ok: true, tracked: false });
    }

    return send(res, 200, { ok: true, tracked: true });
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" });
  }
};
