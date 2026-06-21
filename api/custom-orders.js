const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send, escapeHtml } = require("./_utils");
const { notifyAdmin } = require("./_telegram");

// GET  — list orders (admin sees all, user sees own)
// POST — no action / message: create new order (user)
// POST — action: "set_price" | "close" (admin only)
module.exports = async function handler(req, res) {
  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: me } = await supabase
      .from("profiles")
      .select("id, username, is_admin, is_banned")
      .eq("id", auth.id)
      .maybeSingle();

    if (!me) return send(res, 404, { error: "User not found" });

    if (req.method === "GET") {
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
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "").trim();

      // Non-admin: create a new custom order
      if (!me.is_admin) {
        if (me.is_banned) return send(res, 403, { error: "Your account is restricted." });
        const message = String(body.message || "").trim();
        if (message.length < 10) return send(res, 400, { error: "Please describe your request (at least 10 characters)." });
        if (message.length > 2000) return send(res, 400, { error: "Message is too long (max 2000 characters)." });

        const { data: order, error: orderErr } = await supabase
          .from("custom_orders")
          .insert({ user_id: me.id, username: me.username, initial_message: message, status: "open" })
          .select("id, status, created_at")
          .single();
        if (orderErr) throw orderErr;

        const { error: msgErr } = await supabase.from("order_messages").insert({
          order_id: order.id, sender_id: me.id, is_admin: false, content: message
        });
        if (msgErr) throw msgErr;

        const preview = message.length > 300 ? `${message.slice(0, 300)}…` : message;
        notifyAdmin(
          `💬 <b>New custom order request</b>\nUser: <b>${escapeHtml(me.username)}</b>\nMessage: ${escapeHtml(preview)}`
        ).catch(() => {});

        return send(res, 200, { ok: true, order, message: "Your custom request was sent. We'll reply here on the site." });
      }

      if (action === "set_price") {
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
      }

      if (action === "close") {
        const orderId = String(body.order_id || "").trim();
        if (!orderId) return send(res, 400, { error: "order_id required" });

        const { data: order, error: orderErr } = await supabase
          .from("custom_orders")
          .select("id, status")
          .eq("id", orderId)
          .maybeSingle();

        if (orderErr) throw orderErr;
        if (!order) return send(res, 404, { error: "Order not found" });
        if (order.status === "closed") {
          return send(res, 400, { error: "Already closed." });
        }

        await supabase.from("order_messages").insert({
          order_id: orderId,
          sender_id: me.id,
          is_admin: true,
          content: "This conversation has been closed by the admin."
        });

        const { error: updErr } = await supabase
          .from("custom_orders")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("id", orderId);

        if (updErr) throw updErr;

        return send(res, 200, { ok: true });
      }

      return send(res, 400, { error: "Unknown action" });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return send(res, err.status || 401, { error: err.message || "Unauthorized" });
  }
};
