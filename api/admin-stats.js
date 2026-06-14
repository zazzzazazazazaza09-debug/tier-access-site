const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { TIERS } = require("./_tiers");

async function requireAdmin(supabase, authId) {
  const { data: me } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", authId)
    .maybeSingle();

  if (!me || !me.is_admin) {
    const err = new Error("Admin only");
    err.status = 403;
    throw err;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const auth = verifyAuth(req);
    const supabase = getSupabase();

    await requireAdmin(supabase, auth.id);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6); // last 7 days incl. today
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- Users ---
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const { count: newUsersToday } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString());

    const { count: newUsersWeek } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfWeek.toISOString());

    const { count: adminCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);

    // --- Referrals & unlocked tiers (need per-row data) ---
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("referrals_count, reward_unlocked, unlocked_tiers, referred_by");

    if (profilesErr) throw profilesErr;

    let totalReferrals = 0;
    let referredUsers = 0;
    let rewardUnlockedCount = 0;
    const tierCounts = {};
    for (const t of TIERS) tierCounts[t.id] = 0;

    for (const p of profiles || []) {
      totalReferrals += Number(p.referrals_count || 0);
      if (p.referred_by) referredUsers += 1;
      if (p.reward_unlocked) rewardUnlockedCount += 1;
      if (Array.isArray(p.unlocked_tiers)) {
        for (const tid of p.unlocked_tiers) {
          if (tierCounts[tid] !== undefined) tierCounts[tid] += 1;
        }
      }
    }

    // --- Purchases ---
    const { data: purchases, error: purchasesErr } = await supabase
      .from("purchases")
      .select("status, amount_usd, method, is_custom, created_at");

    if (purchasesErr) throw purchasesErr;

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let revenueToday = 0;
    let revenueWeek = 0;
    let revenueMonth = 0;
    let revenueAll = 0;
    let approvedCustomCount = 0;
    const methodCounts = {};

    for (const p of purchases || []) {
      if (p.status === "pending") pendingCount += 1;
      else if (p.status === "approved") approvedCount += 1;
      else if (p.status === "rejected") rejectedCount += 1;

      methodCounts[p.method] = (methodCounts[p.method] || 0) + 1;

      if (p.status === "approved") {
        const amount = Number(p.amount_usd || 0);
        const created = new Date(p.created_at);
        revenueAll += amount;
        if (created >= startOfMonth) revenueMonth += amount;
        if (created >= startOfWeek) revenueWeek += amount;
        if (created >= startOfToday) revenueToday += amount;
        if (p.is_custom) approvedCustomCount += 1;
      }
    }

    // --- Custom orders ---
    const { count: openOrders } = await supabase
      .from("custom_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    const { count: totalOrders } = await supabase
      .from("custom_orders")
      .select("id", { count: "exact", head: true });

    const tierBreakdown = TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      priceUSD: t.priceUSD,
      unlockedCount: tierCounts[t.id] || 0
    }));

    return send(res, 200, {
      ok: true,
      stats: {
        users: {
          total: totalUsers || 0,
          newToday: newUsersToday || 0,
          newThisWeek: newUsersWeek || 0,
          admins: adminCount || 0,
          referredUsers,
          totalReferrals,
          rewardUnlocked: rewardUnlockedCount
        },
        revenue: {
          today: round2(revenueToday),
          thisWeek: round2(revenueWeek),
          thisMonth: round2(revenueMonth),
          allTime: round2(revenueAll)
        },
        purchases: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: (purchases || []).length,
          approvedCustom: approvedCustomCount,
          byMethod: methodCounts
        },
        customOrders: {
          open: openOrders || 0,
          total: totalOrders || 0
        },
        tiers: tierBreakdown
      }
    });
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" });
  }
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
