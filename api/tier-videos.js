const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { userHasAccess } = require("./_tiers");

module.exports = async function handler(req, res) {
  const supabase = getSupabase();

  // GET — fetch videos for a tier (requires auth; tier_id=-1 is preview, no access check)
  if (req.method === "GET") {
    try {
      const auth = verifyAuth(req);
      const tierId = req.query && req.query.tier_id != null ? Number(req.query.tier_id) : null;
      if (tierId === null || isNaN(tierId)) return send(res, 400, { error: "tier_id required" });

      const { data: user } = await supabase
        .from("profiles")
        .select("id, referrals_count, unlocked_tiers, is_admin")
        .eq("id", auth.id)
        .maybeSingle();
      if (!user) return send(res, 404, { error: "User not found" });

      // tier_id -1 = preview videos, available to all logged-in users
      if (tierId !== -1 && !user.is_admin && !userHasAccess(user, tierId)) {
        return send(res, 403, { error: "No access to this tier" });
      }

      const { data: videos, error } = await supabase
        .from("tier_videos")
        .select("id, tier_id, title, video_url, created_at")
        .eq("tier_id", tierId)
        .order("created_at");
      if (error) return send(res, 500, { error: error.message });

      return send(res, 200, { videos: videos || [] });
    } catch (err) {
      return send(res, 401, { error: err.message });
    }
  }

  // POST — add a video (admin only)
  if (req.method === "POST") {
    try {
      const auth = verifyAuth(req);
      const { data: user } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", auth.id)
        .maybeSingle();
      if (!user || !user.is_admin) return send(res, 403, { error: "Admin only" });

      const { tier_id, title, video_url } = req.body || {};
      if (!video_url || !video_url.trim()) return send(res, 400, { error: "video_url required" });
      if (tier_id == null) return send(res, 400, { error: "tier_id required" });

      const { data, error } = await supabase
        .from("tier_videos")
        .insert({ tier_id: Number(tier_id), title: (title || "").trim(), video_url: video_url.trim() })
        .select()
        .single();
      if (error) return send(res, 500, { error: error.message });

      return send(res, 200, { video: data });
    } catch (err) {
      return send(res, 401, { error: err.message });
    }
  }

  // DELETE — remove a video (admin only)
  if (req.method === "DELETE") {
    try {
      const auth = verifyAuth(req);
      const { data: user } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", auth.id)
        .maybeSingle();
      if (!user || !user.is_admin) return send(res, 403, { error: "Admin only" });

      const { id } = req.body || {};
      if (!id) return send(res, 400, { error: "id required" });

      const { error } = await supabase.from("tier_videos").delete().eq("id", id);
      if (error) return send(res, 500, { error: error.message });

      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 401, { error: err.message });
    }
  }

  return send(res, 405, { error: "Method not allowed" });
};
