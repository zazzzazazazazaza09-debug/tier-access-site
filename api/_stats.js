const { getSupabase } = require("./_db");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return send(res, 200, { users: count || 0 });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
