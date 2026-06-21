const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send, escapeHtml } = require("./_utils");
const { notifyAdmin } = require("./_telegram");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const body = req.body || {};
    const message = String(body.message || "").trim();

    if (message.length < 10) {
      return send(res, 400, { error: "Please describe your request (at least 10 characters)." });
    }
    if (message.length > 2000) {
      return send(res, 400, { error: "Message is too long (max 2000 characters)." });
    }

    const supabase = getSupabase();

    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", auth.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return send(res, 404, { error: "User not found" });

    const { data: order, error: orderErr } = await supabase
      .from("custom_orders")
      .insert({
        user_id: user.id,
        username: user.username,
        initial_message: message,
        status: "open"
      })
      .select("id, status, created_at")
      .single();

    if (orderErr) throw orderErr;

    const { error: msgErr } = await supabase.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      is_admin: false,
      content: message
    });

    if (msgErr) throw msgErr;

    const preview = message.length > 300 ? `${message.slice(0, 300)}…` : message;
    notifyAdmin(
      `💬 <b>New custom order request</b>\n` +
      `User: <b>${escapeHtml(user.username)}</b>\n` +
      `Message: ${escapeHtml(preview)}`
    ).catch(() => {});

    return send(res, 200, {
      ok: true,
      order,
      message: "Your custom request was sent. We'll reply here on the site."
    });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
