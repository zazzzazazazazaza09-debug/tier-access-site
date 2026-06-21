const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send, escapeHtml } = require("./_utils");
const { getTier } = require("./_tiers");
const { getCustomPrice } = require("./_custom");
const { notifyAdmin } = require("./_telegram");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const body = req.body || {};

    const method = String(body.method || "").trim();
    const isCustom = Boolean(body.is_custom);

    if (!["crypto", "giftcard"].includes(method)) {
      return send(res, 400, { error: "Invalid payment method" });
    }

    let tierId = 0;
    let amountUSD = 0;
    let customPackId = null;
    let customSizeId = null;
    let customLabel = null;

    if (isCustom) {
      const packId = Number(body.custom_pack_id);
      const sizeId = String(body.custom_size_id || "").trim();
      const custom = getCustomPrice(packId, sizeId);
      if (!custom) {
        return send(res, 400, { error: "Invalid custom pack selection" });
      }
      tierId = 0;
      amountUSD = custom.priceUSD;
      customPackId = custom.packId;
      customSizeId = custom.sizeId;
      customLabel = custom.label;
    } else {
      tierId = Number(body.tier_id);
      const tier = getTier(tierId);
      if (!tier) {
        return send(res, 400, { error: "Invalid tier" });
      }
      amountUSD = tier.priceUSD;
    }

    const supabase = getSupabase();

    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, username, unlocked_tiers")
      .eq("id", auth.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return send(res, 404, { error: "User not found" });

    if (!isCustom) {
      if (Array.isArray(user.unlocked_tiers) && user.unlocked_tiers.includes(tierId)) {
        return send(res, 400, { error: "You already have access to this tier." });
      }
    }

    const insert = {
      user_id: user.id,
      username: user.username,
      tier_id: tierId,
      method,
      amount_usd: amountUSD,
      status: "pending",
      is_custom: isCustom,
      custom_pack_id: customPackId,
      custom_size_id: customSizeId,
      custom_label: customLabel
    };

    if (method === "crypto") {
      const currency = String(body.crypto_currency || "").toUpperCase().trim();
      const txId = String(body.tx_id || "").trim();

      if (!["BTC", "ETH", "LTC", "SOL"].includes(currency)) {
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

    const productLabel = isCustom
      ? (customLabel || `Custom Pack ${customPackId || ""} · ${customSizeId || ""}`)
      : (getTier(tierId)?.name || `Tier ${tierId}`);

    let methodLine = `Method: ${escapeHtml(method)}`;
    if (method === "crypto") {
      methodLine += ` (${escapeHtml(insert.crypto_currency)} ${escapeHtml(insert.crypto_amount)})`;
    } else if (method === "giftcard") {
      methodLine += ` (${escapeHtml(insert.giftcard_platform)})`;
    }

    notifyAdmin(
      `🛒 <b>New purchase</b>\n` +
      `User: <b>${escapeHtml(user.username)}</b>\n` +
      `Item: ${escapeHtml(productLabel)}\n` +
      `Amount: $${Number(amountUSD).toFixed(2)}\n` +
      `${methodLine}\n` +
      `Status: pending review`
    ).catch(() => {});

    return send(res, 200, {
      ok: true,
      purchase,
      message: "Your payment is under review. You'll get access once an admin confirms it."
    });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
