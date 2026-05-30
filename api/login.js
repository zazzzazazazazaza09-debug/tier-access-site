const bcrypt = require("bcryptjs");
const { getSupabase } = require("./_db");
const { signToken } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) return send(res, 400, { error: "Missing username or password" });
    const supabase = getSupabase();
    const { data: user, error } = await supabase.from("profiles").select("id, username, password_hash, referral_code, referrals_count, reward_unlocked").ilike("username", username).limit(1).maybeSingle();
    if (error) throw error;
    if (!user) return send(res, 401, { error: "Invalid username or password" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return send(res, 401, { error: "Invalid username or password" });
    delete user.password_hash;
    return send(res, 200, { token: signToken(user), user });
  } catch (err) {
    console.error("LOGIN API ERROR:", err);
    return send(res, 500, { error: err.message || "Server error" });
  }
};
