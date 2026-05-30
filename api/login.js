const bcrypt = require("bcryptjs");
const { getSupabase } = require("./_db");
const { signToken } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (username.length < 3 || password.length < 4) {
      return send(res, 400, { error: "Invalid username or password." });
    }

    const supabase = getSupabase();
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, username, password_hash, referral_code, referrals_count, reward_unlocked")
      .ilike("username", username)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    let user = null;

    for (const candidate of users || []) {
      if (await bcrypt.compare(password, candidate.password_hash)) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      return send(res, 401, { error: "Incorrect username or password." });
    }

    return send(res, 200, {
      token: signToken(user),
      user: {
        id: user.id,
        username: user.username,
        referral_code: user.referral_code,
        referrals_count: user.referrals_count,
        reward_unlocked: user.reward_unlocked
      }
    });
  } catch (err) {
    return send(res, 500, { error: err.message || "Server error" });
  }
};
