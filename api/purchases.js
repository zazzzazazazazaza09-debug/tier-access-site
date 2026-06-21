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
  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    await requireAdmin(supabase, auth.id);

    if (req.method !== "GET") {
      return send(res, 405, { error: "Method not allowed" });
    }

    const status = String(req.query?.status || "pending");
    let query = supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (["pending", "approved", "rejected"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return send(res, 200, { purchases: data || [] });
  } catch (err) {
    return send(res, err.status || 401, { error: err.message || "Unauthorized" });
  }
};
