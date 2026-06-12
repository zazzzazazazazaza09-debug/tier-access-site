const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

async function requireAdmin(supabase, authId) {
  const { data: me } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", authId)
    .maybeSingle();

  if (!me || !me.is_admin) {
    const err = new Error("Admin only");
    err.status = 403;
    throw err;
  }
  return me;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: me } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me) return send(res, 404, { error: "User not found" });

    let query = supabase
      .from("custom_orders")
      .select("id, user_id, username, initial_message, status, agreed_price, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (!me.is_admin) {
      query = query.eq("user_id", me.id);
    }

    const status = String(req.query?.status || "").trim();
    if (status && ["open", "closed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return send(res, 200, { orders: data || [] });
  } catch (err) {
    return send(res, err.status || 401, { error: err.message || "Unauthorized" });
  }
};
