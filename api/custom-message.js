const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const body = req.body || {};
    const orderId = String(body.order_id || "").trim();
    const content = String(body.content || "").trim();

    if (!orderId) return send(res, 400, { error: "order_id required" });
    if (content.length < 1) return send(res, 400, { error: "Message cannot be empty." });
    if (content.length > 2000) return send(res, 400, { error: "Message too long." });

    const supabase = getSupabase();

    const { data: me } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me) return send(res, 404, { error: "User not found" });

    const { data: order, error: orderErr } = await supabase
      .from("custom_orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return send(res, 404, { error: "Order not found" });

    const isOwner = order.user_id === me.id;
    if (!me.is_admin && !isOwner) {
      return send(res, 403, { error: "Not allowed" });
    }

    if (order.status === "closed") {
      return send(res, 400, { error: "This conversation is closed." });
    }

    const { data: message, error: msgErr } = await supabase
      .from("order_messages")
      .insert({
        order_id: orderId,
        sender_id: me.id,
        is_admin: me.is_admin,
        content
      })
      .select("id, is_admin, content, created_at")
      .single();

    if (msgErr) throw msgErr;

    await supabase
      .from("custom_orders")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return send(res, 200, { ok: true, message });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
