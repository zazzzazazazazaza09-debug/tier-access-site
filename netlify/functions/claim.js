const { json, getSupabase, verifyAuth } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(event);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("reward_unlocked")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) {
      return json(404, { error: "User not found" });
    }

    if (!user.reward_unlocked) {
      return json(403, { error: "Tier 1 is not unlocked yet" });
    }

    return json(200, {
      reward_url: process.env.REWARD_URL || "https://t.me/Nonaxionbot"
    });
  } catch (err) {
    return json(401, { error: err.message || "Unauthorized" });
  }
};
