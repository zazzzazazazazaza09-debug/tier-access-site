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
    const body = req.body || {};

    const tierId = Number(body.tier_id);
    const method = String(body.method || "").trim();
    const tier = getTier(tierId);

    if (!tier) {
      return send(res, 400, { error: "Invalid tier" });
    }

    if (!["crypto", "giftcard", "cashapp"].includes(method)) {
      return send(res, 400, { error: "Invalid payment method" });
    }

    const supabase = getSupabase();

    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, username, unlocked_tiers")
      .eq("id", auth.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return send(res, 404, { error: "User not found" });

    if (Array.isArray(user.unlocked_tiers) && user.unlocked_tiers.includes(tierId)) {
      return send(res, 400, { error: "You already have access to this tier." });
    }

    const insert = {
      user_id: user.id,
      username: user.username,
      tier_id: tierId,
      method,
      amount_usd: tier.priceUSD,
      status: "pending"
    };

    if (method === "crypto" || method === "cashapp") {
      const currency = String(body.crypto_currency || (method === "cashapp" ? "BTC" : "")).toUpperCase().trim();
      const txId = String(body.tx_id || "").trim();

      if (!["BTC", "ETH", "LTC", "SOL", "USDT"].includes(currency)) {
        return send(res, 400, { error: "Invalid cryptocurrency" });
      }

      if (txId.length < 10 || txId.length > 200) {
        return send(res, 400, { error: "Transaction ID looks invalid." });
      }

      insert.crypto_currency = currency;
      insert.crypto_amount = String(body.crypto_amount || "").slice(0, 64);
      insert.tx_id = txId;
    } else if (method === "giftcard") {
      const platform = String(body.giftcard_platform || "").slice(0, 80).trim();
      const code = String(body.giftcard_code || "").trim();

      if (!platform) {
        return send(res, 400, { error: "Choose a platform." });
      }

      if (code.length < 14 || code.length > 200) {
        return send(res, 400, { error: "Gift card code must be at least 14 characters." });
      }

      insert.giftcard_platform = platform;
      insert.giftcard_code = code;
    }

    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert(insert)
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    return send(res, 200, {
      ok: true,
      purchase,
      message: "Your payment is under review. You'll get access once an admin confirms it."
    });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
