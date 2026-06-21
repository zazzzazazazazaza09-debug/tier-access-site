const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

// GET  — list messages for an order
// POST — send a message in an order conversation
module.exports = async function handler(req, res) {
  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    if (req.method === "GET") {
      const orderId = String(req.query?.order_id || "").trim();
      if (!orderId) return send(res, 400, { error: "order_id required" });

      const { data: me } = await supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", auth.id)
        .maybeSingle();

      if (!me) return send(res, 404, { error: "User not found" });

      const { data: order, error: orderErr } = await supabase
        .from("custom_orders")
        .select("id, user_id, agreed_price")
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

      return send(res, 200, { messages: messages || [], agreed_price: order.agreed_price || null });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const orderId = String(body.order_id || "").trim();
      const content = String(body.content || "").trim();

      if (!orderId) return send(res, 400, { error: "order_id required" });
      if (content.length < 1) return send(res, 400, { error: "Message cannot be empty." });
      if (content.length > 2000) return send(res, 400, { error: "Message too long." });

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
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" });
  }
};
