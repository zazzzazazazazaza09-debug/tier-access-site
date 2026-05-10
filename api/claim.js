const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("reward_unlocked")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) {
      return send(res, 404, { error: "User not found" });
    }

    if (!user.reward_unlocked) {
      return send(res, 403, { error: "Tier 1 is not unlocked yet" });
    }

    return send(res, 200, {
      reward_url: process.env.REWARD_URL || "/tier1.html"
    });
  } catch (err) {
    return send(res, 401, { error: err.message || "Unauthorized" });
  }
};
