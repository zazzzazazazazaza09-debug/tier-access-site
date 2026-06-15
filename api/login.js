const bcrypt = require("bcryptjs");
const { getSupabase } = require("./_db");
const { signToken } = require("./_auth");
const { send } = require("./_utils");

// In-memory rate limiter (per Vercel instance — good enough for brute-force deterrence)
// Stores { count, firstAt } per IP hash
const loginAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return false; // not limited
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    if (checkRateLimit(ip)) {
      return send(res, 429, { error: "Too many login attempts. Please wait 15 minutes." });
    }

    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (username.length < 3 || password.length < 4) {
      return send(res, 400, { error: "Invalid username or password." });
    }

    const supabase = getSupabase();
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, username, password_hash, referral_code, referrals_count, reward_unlocked, unlocked_tiers, is_admin")
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

    // Clear rate limit on successful login
    loginAttempts.delete(ip);

    return send(res, 200, {
      token: signToken(user),
      user: {
        id: user.id,
        username: user.username,
        referral_code: user.referral_code,
        referrals_count: user.referrals_count,
        reward_unlocked: user.reward_unlocked,
        unlocked_tiers: user.unlocked_tiers || [],
        is_admin: user.is_admin || false
      }
    });
  } catch (err) {
    return send(res, 500, { error: "Server error" });
  }
};
