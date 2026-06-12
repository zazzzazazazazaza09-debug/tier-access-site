const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const orderId = String(req.query?.order_id || "").trim();

    if (!orderId) {
      return send(res, 400, { error: "order_id required" });
    }

    const supabase = getSupabase();

    const { data: me } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me) return send(res, 404, { error: "User not found" });

    const { data: order, error: orderErr } = await supabase
      .from("custom_orders")
      .select("id, user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return send(res, 404, { error: "Order not found" });

    if (!me.is_admin && order.user_id !== me.id) {
      return send(res, 403, { error: "Not allowed" });
    }

    const { data: messages, error } = await supabase
      .from("order_messages")
      .select("id, sender_id, is_admin, content, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return send(res, 200, { messages: messages || [] });
  } catch (err) {
    return send(res, err.status || 401, { error: err.message || "Unauthorized" });
  }
};
