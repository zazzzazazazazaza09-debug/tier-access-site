const bcrypt = require("bcryptjs");
const {
  json,
  getSupabase,
  signToken,
  makeReferralCode
} = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const ref = String(body.ref || "").trim();
    const honeypot = String(body.honeypot || "");

    if (honeypot) {
      return json(400, { error: "Bot detected" });
    }

    const captchaOk =
      Number(body.captchaAnswer) === Number(body.captchaA) + Number(body.captchaB);

    if (!captchaOk) {
      return json(400, { error: "Wrong anti-bot code" });
    }

    if (username.length < 3) {
      return json(400, { error: "Name must be at least 3 letters" });
    }

    if (password.length < 4) {
      return json(400, { error: "Password must be at least 4 characters" });
    }

    const supabase = getSupabase();

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

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        username,
        password_hash,
        referral_code,
        referred_by: referrer ? referrer.id : null
      })
      .select("id, username, referral_code, referrals_count, reward_unlocked")
      .single();

    if (createError) throw createError;

    if (referrer && referrer.id !== created.id) {
      await supabase.from("referrals").insert({
        referrer_id: referrer.id,
        referred_id: created.id
      });

      const newCount = Number(referrer.referrals_count || 0) + 1;

      await supabase
        .from("profiles")
        .update({
          referrals_count: newCount,
          reward_unlocked: newCount >= 5
        })
        .eq("id", referrer.id);
    }

    return json(200, {
      token: signToken(created),
      user: created
    });
  } catch (err) {
    return json(500, { error: err.message || "Server error" });
  }
};
