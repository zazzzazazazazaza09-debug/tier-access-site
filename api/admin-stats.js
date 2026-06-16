const { getSupabase } = require("./_db");
const { verifyAuth } = require("./_auth");
const { send } = require("./_utils");
const { TIERS } = require("./_tiers");

const SERIES_DAYS = 14;

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

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  // ---- POST: ban operations ----
  if (req.method === "POST") {
    try {
      const auth = verifyAuth(req);
      const supabase = getSupabase();
      await requireAdmin(supabase, auth.id);

      const body = req.body || {};
      const action = String(body.action || "").trim();

      if (action === "ban_lookup") {
        const username = String(body.username || "").trim();
        if (!username) return send(res, 400, { error: "username required" });
        const { data: target } = await supabase
          .from("profiles")
          .select("id, username, is_banned")
          .ilike("username", username)
          .maybeSingle();
        if (!target) return send(res, 404, { error: "User not found" });
        return send(res, 200, { user: target });
      }

      if (action === "ban" || action === "unban") {
        const username = String(body.username || "").trim();
        if (!username) return send(res, 400, { error: "username required" });
        const { data: target, error: findErr } = await supabase
          .from("profiles")
          .select("id, username, is_admin, is_banned")
          .ilike("username", username)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!target) return send(res, 404, { error: "User not found" });
        if (target.is_admin) return send(res, 400, { error: "Cannot ban an admin account" });
        const newBanned = action !== "unban";
        const { error: updErr } = await supabase
          .from("profiles")
          .update({ is_banned: newBanned })
          .eq("id", target.id);
        if (updErr) throw updErr;
        return send(res, 200, { ok: true, username: target.username, banned: newBanned });
      }

      return send(res, 400, { error: "Unknown action" });
    } catch (err) {
      return send(res, err.status || 500, { error: err.message || "Server error" });
    }
  }

  // ---- GET: dashboard stats ----
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
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const seriesStart = new Date(startOfToday);
    seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1));

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

    let onlineNow = 0;
    try {
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("last_seen", fiveMinAgo.toISOString());
      if (!error) onlineNow = count || 0;
    } catch (_) {
      onlineNow = 0;
    }

    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("referrals_count, reward_unlocked, unlocked_tiers, referred_by, created_at");

    if (profilesErr) throw profilesErr;

    let totalReferrals = 0;
    let referredUsers = 0;
    let rewardUnlockedCount = 0;
    const tierCounts = {};
    for (const t of TIERS) tierCounts[t.id] = 0;

    const signupSeries = {};
    for (let i = 0; i < SERIES_DAYS; i++) {
      const d = new Date(seriesStart);
      d.setDate(d.getDate() + i);
      signupSeries[dateKey(d)] = 0;
    }

    for (const p of profiles || []) {
      totalReferrals += Number(p.referrals_count || 0);
      if (p.referred_by) referredUsers += 1;
      if (p.reward_unlocked) rewardUnlockedCount += 1;
      if (Array.isArray(p.unlocked_tiers)) {
        for (const tid of p.unlocked_tiers) {
          if (tierCounts[tid] !== undefined) tierCounts[tid] += 1;
        }
      }
      if (p.created_at) {
        const created = new Date(p.created_at);
        if (created >= seriesStart) {
          const key = dateKey(created);
          if (signupSeries[key] !== undefined) signupSeries[key] += 1;
        }
      }
    }

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

    const revenueSeries = {};
    const purchaseCountSeries = {};
    for (let i = 0; i < SERIES_DAYS; i++) {
      const d = new Date(seriesStart);
      d.setDate(d.getDate() + i);
      revenueSeries[dateKey(d)] = 0;
      purchaseCountSeries[dateKey(d)] = 0;
    }

    for (const p of purchases || []) {
      if (p.status === "pending") pendingCount += 1;
      else if (p.status === "approved") approvedCount += 1;
      else if (p.status === "rejected") rejectedCount += 1;

      methodCounts[p.method] = (methodCounts[p.method] || 0) + 1;

      const created = p.created_at ? new Date(p.created_at) : null;
      if (created && created >= seriesStart) {
        const key = dateKey(created);
        if (purchaseCountSeries[key] !== undefined) purchaseCountSeries[key] += 1;
      }

      if (p.status === "approved") {
        const amount = Number(p.amount_usd || 0);
        revenueAll += amount;
        if (created) {
          if (created >= startOfMonth) revenueMonth += amount;
          if (created >= startOfWeek) revenueWeek += amount;
          if (created >= startOfToday) revenueToday += amount;
          if (created >= seriesStart) {
            const key = dateKey(created);
            if (revenueSeries[key] !== undefined) revenueSeries[key] += amount;
          }
        }
        if (p.is_custom) approvedCustomCount += 1;
      }
    }

    for (const key of Object.keys(revenueSeries)) {
      revenueSeries[key] = round2(revenueSeries[key]);
    }

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

    const labels = Object.keys(signupSeries).sort();

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
          rewardUnlocked: rewardUnlockedCount,
          onlineNow
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
        tiers: tierBreakdown,
        series: {
          labels,
          signups: labels.map((k) => signupSeries[k] || 0),
          revenue: labels.map((k) => revenueSeries[k] || 0),
          purchaseCounts: labels.map((k) => purchaseCountSeries[k] || 0)
        }
      }
    });
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" });
  }
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
