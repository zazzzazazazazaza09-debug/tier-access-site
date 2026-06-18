const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

// Dedicated endpoint for admin notifications.
// Called only by app.js (not the inline stats script), so no race condition.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: notifs, error } = await supabase
      .from("admin_notifications")
      .select("id, message, created_at")
      .eq("user_id", auth.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return send(res, 200, { notifications: [] });

    const notifications = notifs || [];

    if (notifications.length) {
      await supabase
        .from("admin_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", auth.id)
        .is("read_at", null);
    }

    return send(res, 200, { notifications });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
