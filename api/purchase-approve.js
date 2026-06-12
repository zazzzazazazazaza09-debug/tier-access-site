const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { getTier } = require("./_tiers");

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
    const purchaseId = String(body.purchase_id || "").trim();
    const action = String(body.action || "").trim();
    const note = String(body.note || "").slice(0, 500);

    if (!purchaseId) return send(res, 400, { error: "purchase_id required" });
    if (!["approve", "reject"].includes(action)) {
      return send(res, 400, { error: "action must be approve or reject" });
    }

    const { data: purchase, error: fetchErr } = await supabase
      .from("purchases")
      .select("*")
      .eq("id", purchaseId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!purchase) return send(res, 404, { error: "Purchase not found" });

    if (purchase.status !== "pending") {
      return send(res, 400, { error: `Already ${purchase.status}` });
    }

    if (action === "reject") {
      const { error } = await supabase
        .from("purchases")
        .update({
          status: "rejected",
          admin_note: note,
          reviewed_at: new Date().toISOString(),
          reviewed_by: me.id
        })
        .eq("id", purchaseId);

      if (error) throw error;
      return send(res, 200, { ok: true, status: "rejected" });
    }

    // approve → unlock the tier on the user's profile
    const tier = getTier(purchase.tier_id);
    if (!tier) return send(res, 400, { error: "Tier no longer exists" });

    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, unlocked_tiers")
      .eq("id", purchase.user_id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return send(res, 404, { error: "User not found" });

    const set = new Set(Array.isArray(user.unlocked_tiers) ? user.unlocked_tiers : []);
    set.add(tier.id);
    const next = Array.from(set).sort((a, b) => a - b);

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ unlocked_tiers: next })
      .eq("id", user.id);

    if (updErr) throw updErr;

    const { error: pErr } = await supabase
      .from("purchases")
      .update({
        status: "approved",
        admin_note: note,
        reviewed_at: new Date().toISOString(),
        reviewed_by: me.id
      })
      .eq("id", purchaseId);

    if (pErr) throw pErr;

    return send(res, 200, { ok: true, status: "approved" });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
