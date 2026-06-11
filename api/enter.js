const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getSupabase } = require("./_db");
const { signToken } = require("./_auth");
const { makeReferralCode, send } = require("./_utils");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function hashValue(value) {
  const secret = process.env.JWT_SECRET || "fallback_secret";

  return crypto
    .createHmac("sha256", secret)
    .update(String(value || "unknown"))
    .digest("hex");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const ref = String(body.ref || body.invite || "").trim();
    const deviceId = String(body.device_id || "").trim();
    const honeypot = String(body.honeypot || "");

    if (honeypot) {
      return send(res, 400, { error: "Bot detected" });
    }

    const captchaOk =
      Number(body.captchaAnswer) === Number(body.captchaA) + Number(body.captchaB);

    if (!captchaOk) {
      return send(res, 400, { error: "Wrong anti-bot code" });
    }

    if (username.length < 3) {
      return send(res, 400, { error: "Name must be at least 3 letters" });
    }

    if (password.length < 4) {
      return send(res, 400, { error: "Password must be at least 4 characters" });
    }

    if (!deviceId || deviceId.length < 10) {
      return send(res, 400, { error: "Device verification failed. Refresh and try again." });
    }

    const supabase = getSupabase();

    const { data: existingUser, error: existingUserError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .limit(1)
      .maybeSingle();

    if (existingUserError) throw existingUserError;

    if (existingUser) {
      return send(res, 409, { error: "This username already exists. Log in instead." });
    }

    let referrer = null;

    if (ref) {
      const { data } = await supabase
        .from("profiles")
        .select("id, referrals_count")
        .eq("referral_code", ref)
        .maybeSingle();

      referrer = data || null;
    }

    const password_hash = await bcrypt.hash(password, 12);

    let referral_code = makeReferralCode();

    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", referral_code)
        .maybeSingle();

      if (!exists) break;
      referral_code = makeReferralCode();
    }

    const ip = getClientIp(req);
    const ipHash = hashValue(ip);
    const deviceHash = hashValue(deviceId);

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        username,
        password_hash,
        referral_code,
        referred_by: referrer ? referrer.id : null,
        signup_ip_hash: ipHash,
        signup_device_hash: deviceHash
      })
      .select("id, username, referral_code, referrals_count, reward_unlocked, unlocked_tiers, is_admin")
      .single();

    if (createError) throw createError;

    let referralMessage = "";

    if (referrer && referrer.id !== created.id) {
      const { data: alreadyUsed } = await supabase
        .from("referral_claims")
        .select("id, reason")
        .eq("referrer_id", referrer.id)
        .or(`ip_hash.eq.${ipHash},device_hash.eq.${deviceHash}`)
        .limit(1);

      if (alreadyUsed && alreadyUsed.length > 0) {
        await supabase.from("referral_claims").insert({
          referrer_id: referrer.id,
          referred_id: created.id,
          ip_hash: ipHash,
          device_hash: deviceHash,
          counted: false,
          reason: "duplicate_ip_or_device"
        });

        referralMessage =
          "Account created, but this referral was not counted because this IP/device already used this referral link.";
      } else {
        await supabase.from("referrals").insert({
          referrer_id: referrer.id,
          referred_id: created.id
        });

        await supabase.from("referral_claims").insert({
          referrer_id: referrer.id,
          referred_id: created.id,
          ip_hash: ipHash,
          device_hash: deviceHash,
          counted: true,
          reason: "counted"
        });

        const newCount = Number(referrer.referrals_count || 0) + 1;

        await supabase
          .from("profiles")
          .update({
            referrals_count: newCount,
            reward_unlocked: newCount >= 5
          })
          .eq("id", referrer.id);

        referralMessage = "Referral counted successfully.";
      }
    }

    return send(res, 200, {
      token: signToken(created),
      user: created,
      referral_counted: referralMessage === "Referral counted successfully.",
      referral_message: referralMessage
    });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
