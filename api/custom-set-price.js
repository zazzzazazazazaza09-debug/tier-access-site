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

    const { data: me } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me || !me.is_admin) {
      return send(res, 403, { error: "Admin only" });
    }

    const body = req.body || {};
    const orderId = String(body.order_id || "").trim();
    const price = Number(body.price);

    if (!orderId) return send(res, 400, { error: "order_id required" });
    if (!price || price < 1 || price > 10000) {
      return send(res, 400, { error: "Price must be between $1 and $10,000." });
    }

    const { data: order, error: orderErr } = await supabase
      .from("custom_orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) return send(res, 404, { error: "Order not found" });
    if (order.status === "closed") {
      return send(res, 400, { error: "This conversation is closed." });
    }

    const { error: updErr } = await supabase
      .from("custom_orders")
      .update({
        agreed_price: price,
        price_set_by: me.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updErr) throw updErr;

    const priceLabel = `$${price}`;
    const { error: msgErr } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: me.id,
      is_admin: true,
      content: `Price set: ${priceLabel}. Click "Pay Now" below to proceed with payment.`
    });

    if (msgErr) throw msgErr;

    return send(res, 200, { ok: true, agreed_price: price });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
