const { json, getSupabase, verifyAuth } = require("./_shared");

exports.handler = async (event) => {
  try {
    const auth = verifyAuth(event);
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from("profiles")
      .select("id, username, referral_code, referrals_count, reward_unlocked, created_at")
      .eq("id", auth.id)
      .maybeSingle();

    if (!user) {
      return json(404, { error: "User not found" });
    }

    return json(200, { user });
  } catch (err) {
    return json(401, { error: err.message || "Unauthorized" });
  }
};
