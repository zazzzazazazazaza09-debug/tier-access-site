/* eslint-disable */
const API = "/api";
const $ = (id) => document.getElementById(id);
let currentStatus = "pending";
let currentView = "purchases";
let activeOrderId = null;
let orderPollTimer = null;
let banLookupTarget = null;
let userListPage = 1;
let userListSearch = "";

let signupsChartInstance = null;
let revenueChartInstance = null;
let methodChartInstance = null;

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

async function tryEnter() {
  const token = localStorage.getItem("token");
  if (!token) return showLogin();
  try {
    const me = await request("me");
    if (!me.user || !me.user.is_admin) {
      $("adminLoginMsg").textContent = "This account is not an admin.";
      $("adminLoginMsg").className = "msg error";
      return showLogin();
    }
    showPanel();
    await refresh();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $("adminLogin").classList.remove("hidden");
  $("adminPanel").classList.add("hidden");
}
function showPanel() {
  $("adminLogin").classList.add("hidden");
  $("adminPanel").classList.remove("hidden");
}

$("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("adminUsername").value.trim();
  const password = $("adminPassword").value;
  $("adminLoginMsg").textContent = "";
  try {
    const data = await request("login", { method: "POST", body: JSON.stringify({ username, password }) });
    if (!data.user || !data.user.is_admin) throw new Error("Not an admin account.");
    localStorage.setItem("token", data.token);
    showPanel();
    await refresh();
  } catch (err) {
    $("adminLoginMsg").textContent = err.message;
    $("adminLoginMsg").className = "msg error";
  }
});

$("adminLogout").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.reload();
});
$("goSite").addEventListener("click", () => { window.location.href = "/"; });

document.querySelectorAll(".admin-tabs button[data-view]").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs button[data-view]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentView = b.dataset.view;
    const isPurchases = currentView === "purchases";
    const isDashboard = currentView === "dashboard";
    const isOrders = currentView === "orders";
    const isUsers = currentView === "users";
    const isVideos = currentView === "videos";
    $("dashboardView").classList.toggle("hidden", !isDashboard);
    $("purchasesView").classList.toggle("hidden", !isPurchases);
    $("ordersView").classList.toggle("hidden", !isOrders);
    $("usersView").classList.toggle("hidden", !isUsers);
    $("videosView").classList.toggle("hidden", !isVideos);
    document.querySelectorAll(".purchase-tab").forEach(x => {
      x.style.display = isPurchases ? "" : "none";
    });
    if (isUsers) {
      populateGrantTiers();
      loadUserList(1, "");
    } else if (isVideos) {
      populateVideoTierSelect();
    } else {
      refresh();
    }
  });
});

document.querySelectorAll(".admin-tabs button[data-status]").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs button[data-status]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentStatus = b.dataset.status;
    refresh();
  });
});
$("adminRefresh").addEventListener("click", () => {
  if (currentView === "users") loadUserList(userListPage, userListSearch);
  else refresh();
});
$("adminChatSend").addEventListener("click", sendAdminChat);
$("adminChatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendAdminChat(); });
$("adminSetPriceBtn").addEventListener("click", adminSetPrice);
$("adminPriceInput").addEventListener("keydown", (e) => { if (e.key === "Enter") adminSetPrice(); });
$("adminCloseOrderBtn").addEventListener("click", adminCloseOrder);

// ---- Ban UI ----
$("banLookupBtn").addEventListener("click", banLookup);
$("banUsernameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") banLookup(); });
$("banBtn").addEventListener("click", () => doBan("ban"));
$("unbanBtn").addEventListener("click", () => doBan("unban"));

// ---- Grant / Revoke UI ----
$("grantTierBtn").addEventListener("click", () => doGrantRevoke("grant_tier"));
$("revokeTierBtn").addEventListener("click", () => doGrantRevoke("revoke_tier"));

// ---- User list UI ----
$("userSearchBtn").addEventListener("click", () => loadUserList(1, $("userSearchInput").value.trim()));
$("userSearchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") loadUserList(1, $("userSearchInput").value.trim()); });
$("userListRefreshBtn").addEventListener("click", () => loadUserList(userListPage, userListSearch));

// ---- Purchase search + CSV ----
$("purchaseSearchBtn").addEventListener("click", filterPurchases);
$("purchaseSearchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") filterPurchases(); });
$("exportCsvBtn").addEventListener("click", exportCsv);

// ---- Send notification UI ----
$("sendNotifBtn").addEventListener("click", sendNotification);
$("loadNotifHistoryBtn").addEventListener("click", loadNotificationHistory);
$("notifUsernameInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) sendNotification(); });

async function sendNotification() {
  const username = $("notifUsernameInput").value.trim();
  const message = $("notifMessageInput").value.trim();
  const res = $("notifResult");
  if (!username) { res.textContent = "Enter a username."; res.className = "ban-result error"; return; }
  if (!message) { res.textContent = "Enter a message."; res.className = "ban-result error"; return; }
  res.textContent = "Sending…";
  res.className = "ban-result";
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action: "send_notification", username, message })
    });
    res.innerHTML = `✓ Message sent to <strong>${escapeHtml(data.username)}</strong>.`;
    res.className = "ban-result";
    $("notifMessageInput").value = "";
  } catch (err) {
    res.textContent = err.message;
    res.className = "ban-result error";
  }
}

async function loadNotificationHistory() {
  const username = $("notifUsernameInput").value.trim();
  const container = $("notifHistory");
  container.classList.remove("hidden");
  container.innerHTML = "<div style='color:var(--muted);font-size:.83rem;padding:4px 0'>Loading…</div>";
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action: "list_notifications", username, limit: 20 })
    });
    const notifs = data.notifications || [];
    if (!notifs.length) {
      container.innerHTML = "<div style='color:var(--muted);font-size:.83rem;padding:4px 0'>No messages sent yet.</div>";
      return;
    }
    container.innerHTML = notifs.map(n => {
      const uname = (n.profiles && n.profiles.username) ? n.profiles.username : n.user_id;
      const time = n.created_at ? new Date(n.created_at).toLocaleString() : "—";
      const readStatus = n.read_at
        ? `<span class='notif-read'>✓ Read ${new Date(n.read_at).toLocaleString()}</span>`
        : `<span class='notif-unread'>⏳ Not yet read</span>`;
      return `<div class='notif-item'>
        <div class='notif-user'>${escapeHtml(uname || "")}${readStatus}</div>
        <div class='notif-msg'>${escapeHtml(n.message)}</div>
        <div class='notif-time'>${time}</div>
      </div>`;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div style='color:#ff8a9e;font-size:.83rem'>${escapeHtml(err.message)}</div>`;
  }
}

async function banLookup() {
  const username = $("banUsernameInput").value.trim();
  if (!username) return;
  const res = $("banResult");
  const card = $("banDetailCard");
  res.textContent = "Looking up…";
  res.className = "ban-result";
  if (card) card.className = "user-detail-card";
  $("banBtn").disabled = true;
  $("unbanBtn").disabled = true;
  banLookupTarget = null;
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action: "ban_lookup", username })
    });
    const u = data.user;
    banLookupTarget = u;
    const badge = u.is_banned
      ? `<span class="banned-badge">BANNED</span>`
      : `<span class="active-badge">ACTIVE</span>`;
    res.innerHTML = `User found: <strong>${escapeHtml(u.username)}</strong>${badge}`;

    if (card) {
      const tiers = Array.isArray(u.unlocked_tiers) && u.unlocked_tiers.length ? u.unlocked_tiers.join(", ") : "none";
      const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : "—";
      card.innerHTML = `
        <div class="user-detail-row"><span class="muted">Referral code:</span> <strong>${escapeHtml(u.referral_code || "—")}</strong></div>
        <div class="user-detail-row"><span class="muted">Referrals:</span> <strong>${u.referrals_count || 0}</strong></div>
        <div class="user-detail-row"><span class="muted">Unlocked tiers:</span> <strong>${escapeHtml(tiers)}</strong></div>
        <div class="user-detail-row"><span class="muted">Admin:</span> <strong>${u.is_admin ? "Yes" : "No"}</strong></div>
        <div class="user-detail-row"><span class="muted">Joined:</span> <strong>${joined}</strong></div>
      `;
      card.classList.add("visible");
    }

    $("banBtn").disabled = !!u.is_banned || !!u.is_admin;
    $("unbanBtn").disabled = !u.is_banned;
  } catch (err) {
    res.textContent = err.message;
    res.className = "ban-result error";
  }
}

async function doBan(action) {
  if (!banLookupTarget) return;
  const label = action === "ban" ? "ban" : "unban";
  if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} user "${banLookupTarget.username}"?`)) return;
  const res = $("banResult");
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action, username: banLookupTarget.username })
    });
    banLookupTarget.is_banned = data.banned;
    const badge = data.banned
      ? `<span class="banned-badge">BANNED</span>`
      : `<span class="active-badge">ACTIVE</span>`;
    res.innerHTML = `✓ Done. User <strong>${escapeHtml(data.username)}</strong>${badge}`;
    $("banBtn").disabled = data.banned;
    $("unbanBtn").disabled = !data.banned;
  } catch (err) {
    res.textContent = err.message;
    res.className = "ban-result error";
  }
}

function populateGrantTiers() {
  const sel = $("grantTierSelect");
  if (!sel || sel.options.length > 1) return;
  const tiers = (window.SITE_CONFIG && window.SITE_CONFIG.tiers) || [];
  for (const t of tiers) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
}

async function doGrantRevoke(action) {
  const username = $("grantUsernameInput").value.trim();
  const tierId = $("grantTierSelect").value;
  const res = $("grantResult");
  if (!username) { res.textContent = "Enter a username."; res.className = "ban-result error"; return; }
  if (!tierId) { res.textContent = "Select a tier."; res.className = "ban-result error"; return; }
  const label = action === "grant_tier" ? "Grant" : "Revoke";
  if (!confirm(`${label} tier "${tierId}" for "${username}"?`)) return;
  res.textContent = "Working…";
  res.className = "ban-result";
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action, username, tier_id: tierId })
    });
    const tiers = (data.unlocked_tiers || []).join(", ") || "none";
    res.innerHTML = `✓ Done. <strong>${escapeHtml(data.username)}</strong> unlocked tiers: <strong>${escapeHtml(tiers)}</strong>`;
    res.className = "ban-result";
  } catch (err) {
    res.textContent = err.message;
    res.className = "ban-result error";
  }
}

async function loadUserList(page = 1, search = "") {
  userListPage = page;
  userListSearch = search;
  const tbody = $("userListTbody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">Loading…</td></tr>`;
  try {
    const data = await request("admin-stats", {
      method: "POST",
      body: JSON.stringify({ action: "users_list", page, limit: 25, search })
    });
    renderUserList(data.users || [], data.total || 0, data.page || 1, data.limit || 25);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ff8a9e;padding:16px">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderUserList(users, total, page, limit) {
  const tbody = $("userListTbody");
  tbody.innerHTML = "";
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">No users found.</td></tr>`;
  } else {
    for (const u of users) {
      const tiers = Array.isArray(u.unlocked_tiers) && u.unlocked_tiers.length ? u.unlocked_tiers.join(", ") : "—";
      const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : "—";
      const statusBadge = u.is_banned
        ? `<span class="banned-badge">BANNED</span>`
        : u.is_admin
          ? `<span class="active-badge" style="background:rgba(123,47,247,.2);color:#b080ff">ADMIN</span>`
          : `<span class="active-badge">ACTIVE</span>`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(u.username)}</strong></td>
        <td>${statusBadge}</td>
        <td style="font-size:.8rem;max-width:140px;word-break:break-all">${escapeHtml(tiers)}</td>
        <td>${u.referrals_count || 0}</td>
        <td>${joined}</td>
        <td>
          <button class="ghost-mini" type="button" data-action="fill-ban" data-username="${escapeHtml(u.username)}" title="Look up in ban panel" style="font-size:.75rem;padding:2px 8px">🔍</button>
          <button class="ghost-mini" type="button" data-action="fill-grant" data-username="${escapeHtml(u.username)}" title="Fill in grant panel" style="font-size:.75rem;padding:2px 8px;margin-left:4px">🎯</button>
          <button class="ghost-mini" type="button" data-action="fill-notif" data-username="${escapeHtml(u.username)}" title="Send message to user" style="font-size:.75rem;padding:2px 8px;margin-left:4px">📬</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const uname = btn.dataset.username;
        if (btn.dataset.action === "fill-ban") {
          $("banUsernameInput").value = uname;
          $("banUsernameInput").scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (btn.dataset.action === "fill-grant") {
          $("grantUsernameInput").value = uname;
          $("grantUsernameInput").scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (btn.dataset.action === "fill-notif") {
          $("notifUsernameInput").value = uname;
          $("notifUsernameInput").scrollIntoView({ behavior: "smooth", block: "center" });
          $("notifMessageInput").focus();
        }
      });
    });
  }
  const pages = Math.ceil(total / limit) || 1;
  const pag = $("userPagination");
  pag.innerHTML = "";
  const info = document.createElement("span");
  info.textContent = `${total} user${total !== 1 ? "s" : ""} — page ${page}/${pages}`;
  pag.appendChild(info);
  if (page > 1) {
    const prev = document.createElement("button");
    prev.className = "ghost-mini";
    prev.style.marginLeft = "8px";
    prev.textContent = "← Prev";
    prev.addEventListener("click", () => loadUserList(page - 1, userListSearch));
    pag.appendChild(prev);
  }
  if (page < pages) {
    const next = document.createElement("button");
    next.className = "ghost-mini";
    next.style.marginLeft = "4px";
    next.textContent = "Next →";
    next.addEventListener("click", () => loadUserList(page + 1, userListSearch));
    pag.appendChild(next);
  }
}

function filterPurchases() {
  const q = ($("purchaseSearchInput").value || "").toLowerCase().trim();
  const tbody = $("adminTbody");
  const rows = tbody.querySelectorAll("tr");
  let shown = 0;
  rows.forEach(tr => {
    if (!q || tr.textContent.toLowerCase().includes(q)) {
      tr.style.display = "";
      shown++;
    } else {
      tr.style.display = "none";
    }
  });
  $("adminMsg").textContent = q ? `Showing ${shown} matching row(s).` : "";
}

function exportCsv() {
  const tbody = $("adminTbody");
  const rows = Array.from(tbody.querySelectorAll("tr")).filter(tr => tr.style.display !== "none");
  if (!rows.length) { alert("No rows to export."); return; }
  const headers = ["Date", "User", "Product", "Method", "Amount", "Details", "Status"];
  const lines = [headers.join(",")];
  rows.forEach(tr => {
    const cells = tr.querySelectorAll("td");
    if (cells.length < 7) return;
    const row = Array.from(cells).slice(0, 7).map(td => {
      let text = td.textContent.replace(/\s+/g, " ").trim();
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        text = '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    });
    lines.push(row.join(","));
  });
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchases-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function refresh() {
  $("adminMsg").textContent = "Loading…";
  $("adminMsg").className = "msg";
  try {
    if (currentView === "dashboard") {
      await loadDashboard();
      $("adminMsg").textContent = "";
    } else if (currentView === "purchases") {
      const data = await request(`purchases?status=${encodeURIComponent(currentStatus)}`);
      renderRows(data.purchases || []);
      $("adminMsg").textContent = `${data.purchases.length} record(s).`;
      if ($("purchaseSearchInput")) $("purchaseSearchInput").value = "";
    } else if (currentView === "orders") {
      const data = await request("custom-orders");
      renderOrders(data.orders || []);
      $("adminMsg").textContent = `${data.orders.length} conversation(s).`;
    } else {
      $("adminMsg").textContent = "";
    }
  } catch (err) {
    $("adminMsg").textContent = err.message;
    $("adminMsg").className = "msg error";
  }
}

async function loadDashboard() {
  const data = await request("admin-stats");
  const s = data.stats || {};
  const u = s.users || {};
  const r = s.revenue || {};
  const p = s.purchases || {};
  const c = s.customOrders || {};

  const cards = [
    { label: "Online now", value: u.onlineNow ?? 0, accent: "green" },
    { label: "Total accounts", value: u.total ?? 0 },
    { label: "New users today", value: u.newToday ?? 0 },
    { label: "New users (7d)", value: u.newThisWeek ?? 0 },
    { label: "Admins", value: u.admins ?? 0 },
    { label: "Total referrals", value: u.totalReferrals ?? 0 },
    { label: "Referred users", value: u.referredUsers ?? 0 },
    { label: "Reward unlocked", value: u.rewardUnlocked ?? 0 },
    { label: "Revenue today", value: `$${(r.today ?? 0).toFixed(2)}` },
    { label: "Revenue (7d)", value: `$${(r.thisWeek ?? 0).toFixed(2)}` },
    { label: "Revenue (month)", value: `$${(r.thisMonth ?? 0).toFixed(2)}` },
    { label: "Revenue (all time)", value: `$${(r.allTime ?? 0).toFixed(2)}` },
    { label: "Pending purchases", value: p.pending ?? 0, accent: "yellow" },
    { label: "Approved purchases", value: p.approved ?? 0, accent: "green" },
    { label: "Rejected purchases", value: p.rejected ?? 0, accent: "red" },
    { label: "Total purchases", value: p.total ?? 0 },
    { label: "Approved custom packs", value: p.approvedCustom ?? 0 },
    { label: "Open custom orders", value: c.open ?? 0, accent: "cyan" },
    { label: "Total custom orders", value: c.total ?? 0 }
  ];

  $("statsGrid").innerHTML = cards.map(card => `
    <div class="stat-card${card.accent ? " accent-" + card.accent : ""}">
      <div class="stat-value">${escapeHtml(String(card.value))}</div>
      <div class="stat-label">${escapeHtml(card.label)}</div>
    </div>
  `).join("");

  const tiers = s.tiers || [];
  $("tierStatsGrid").innerHTML = tiers.map(t => `
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(String(t.unlockedCount))}</div>
      <div class="stat-label">${escapeHtml(t.name)} unlocked ($${t.priceUSD})</div>
    </div>
  `).join("");

  renderCharts(s);
}

function fmtDateLabel(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function chartOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#a1a1c2" } } },
    scales: {
      x: { ticks: { color: "#a1a1c2" }, grid: { color: "rgba(255,255,255,.05)" } },
      y: { ticks: { color: "#a1a1c2" }, grid: { color: "rgba(255,255,255,.05)" }, beginAtZero: true }
    }
  }, extra);
}

function renderCharts(s) {
  if (typeof Chart === "undefined") return;
  const series = s.series || {};
  const labels = (series.labels || []).map(fmtDateLabel);

  const signupsCanvas = $("signupsChart");
  if (signupsCanvas) {
    if (signupsChartInstance) signupsChartInstance.destroy();
    signupsChartInstance = new Chart(signupsCanvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets: [{ label: "New signups", data: series.signups || [], borderColor: "#00f5ff", backgroundColor: "rgba(0,245,255,.15)", tension: 0.3, fill: true, pointRadius: 3 }] },
      options: chartOptions({ scales: { x: { ticks: { color: "#a1a1c2" }, grid: { color: "rgba(255,255,255,.05)" } }, y: { ticks: { color: "#a1a1c2", precision: 0 }, grid: { color: "rgba(255,255,255,.05)" }, beginAtZero: true } } })
    });
  }

  const revenueCanvas = $("revenueChart");
  if (revenueCanvas) {
    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(revenueCanvas.getContext("2d"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Approved revenue ($)", data: series.revenue || [], backgroundColor: "rgba(123,47,247,.55)", borderRadius: 6 }] },
      options: chartOptions()
    });
  }

  const methodCanvas = $("methodChart");
  if (methodCanvas) {
    if (methodChartInstance) methodChartInstance.destroy();
    const byMethod = (s.purchases && s.purchases.byMethod) || {};
    const methodLabels = Object.keys(byMethod);
    const methodColors = ["#00f5ff", "#7b2ff7", "#00ff9c", "#ff5fb3", "#ffd166"];
    methodChartInstance = new Chart(methodCanvas.getContext("2d"), {
      type: "doughnut",
      data: { labels: methodLabels, datasets: [{ data: methodLabels.map(k => byMethod[k]), backgroundColor: methodLabels.map((_, i) => methodColors[i % methodColors.length]), borderColor: "rgba(8,10,28,.8)", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#a1a1c2" } } } }
    });
  }
}

function productName(r) {
  if (r.is_custom && r.custom_label) return r.custom_label;
  if (r.is_custom) return `Custom Pack ${r.custom_pack_id || ""} · ${r.custom_size_id || ""}`;
  return tierName(r.tier_id);
}
function tierName(id) {
  const t = (window.SITE_CONFIG && window.SITE_CONFIG.tiers || []).find(x => x.id === id);
  return t ? t.name : `Tier ${id}`;
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

function renderRows(rows) {
  const tb = $("adminTbody");
  tb.innerHTML = "";
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">No records.</td></tr>`;
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    let details = "";
    if (r.method === "crypto" || r.method === "cashapp") {
      details = `<div><b>${r.crypto_currency || ""}</b> ${r.crypto_amount || ""}</div><div class="mono">${escapeHtml(r.tx_id || "")}</div>`;
    } else if (r.method === "giftcard") {
      details = `<div>${escapeHtml(r.giftcard_platform || "")}</div><div class="mono">${escapeHtml(r.giftcard_code || "")}</div>`;
    }
    let actions = "";
    if (r.status === "pending") {
      actions = `<div class="row-actions"><button class="btn-approve" data-id="${r.id}" data-action="approve">Approve</button><button class="btn-reject" data-id="${r.id}" data-action="reject">Reject</button></div>`;
    } else {
      actions = `<small class="muted">${escapeHtml(r.admin_note || "")}</small>`;
    }
    tr.innerHTML = `
      <td>${fmtDate(r.created_at)}</td>
      <td>${escapeHtml(r.username || r.user_id || "")}</td>
      <td>${escapeHtml(productName(r))}</td>
      <td>${escapeHtml(r.method)}</td>
      <td>$${Number(r.amount_usd).toFixed(2)}</td>
      <td>${details}</td>
      <td class="status-${r.status}">${r.status}</td>
      <td>${actions}</td>
    `;
    tb.appendChild(tr);
  }
  tb.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => onAction(btn.dataset.id, btn.dataset.action));
  });
}

function renderOrders(orders) {
  const wrap = $("adminOrdersList");
  wrap.innerHTML = "";
  if (!orders.length) {
    wrap.innerHTML = "<p class='muted'>No custom orders yet.</p>";
    return;
  }
  for (const o of orders) {
    const btn = document.createElement("button");
    btn.className = "custom-order-item" + (activeOrderId === o.id ? " active-order" : "");
    btn.type = "button";
    btn.innerHTML = `
      <span class="co-status ${o.status}">${o.status}</span>
      <strong>${escapeHtml(o.username || "")}</strong>
      <span class="co-preview">${escapeHtml((o.initial_message || "").slice(0, 100))}</span>
      <small class="muted">${fmtDate(o.updated_at)}</small>
    `;
    btn.addEventListener("click", () => openAdminChat(o));
    wrap.appendChild(btn);
  }
}

async function openAdminChat(order) {
  activeOrderId = order.id;
  $("adminChatPanel").classList.remove("hidden");
  $("adminChatTitle").textContent = `Chat with ${order.username || "user"}`;
  const closeBtn = $("adminCloseOrderBtn");
  if (closeBtn) {
    const isClosed = order.status === "closed";
    closeBtn.disabled = isClosed;
    closeBtn.textContent = isClosed ? "🔒 Closed" : "🔒 Close conversation";
    closeBtn.style.opacity = isClosed ? "0.45" : "1";
  }
  await refresh();
  await loadAdminChat();
  if (orderPollTimer) clearInterval(orderPollTimer);
  orderPollTimer = setInterval(() => loadAdminChat(true), 6000);
}

async function loadAdminChat(silent) {
  if (!activeOrderId) return;
  try {
    const data = await request(`custom-messages?order_id=${encodeURIComponent(activeOrderId)}`);
    const box = $("adminChatMessages");
    box.innerHTML = "";
    for (const m of data.messages || []) {
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (m.is_admin ? "admin" : "user");
      bubble.textContent = m.content;
      const time = document.createElement("div");
      time.className = "chat-time";
      time.textContent = fmtDate(m.created_at);
      const line = document.createElement("div");
      line.className = "chat-line " + (m.is_admin ? "admin" : "user");
      line.appendChild(bubble);
      line.appendChild(time);
      box.appendChild(line);
    }
    box.scrollTop = box.scrollHeight;
    const agreedPrice = data.agreed_price;
    const priceDisplay = $("adminAgreedPrice");
    if (priceDisplay) {
      if (agreedPrice && agreedPrice > 0) {
        priceDisplay.textContent = `Agreed price: $${agreedPrice}`;
        priceDisplay.className = "admin-price-set";
      } else {
        priceDisplay.textContent = "No price set yet";
        priceDisplay.className = "muted";
      }
    }
  } catch (err) {
    if (!silent) $("adminMsg").textContent = err.message;
  }
}

async function adminCloseOrder() {
  if (!activeOrderId) return;
  if (!confirm("Close this conversation? The user won't be able to send more messages.")) return;
  try {
    await request("custom-orders", { method: "POST", body: JSON.stringify({ action: "close", order_id: activeOrderId }) });
    await loadAdminChat();
    const closeBtn = $("adminCloseOrderBtn");
    if (closeBtn) { closeBtn.disabled = true; closeBtn.textContent = "🔒 Closed"; closeBtn.style.opacity = "0.45"; }
    const input = $("adminChatInput"); const sendBtn = $("adminChatSend");
    if (input) { input.disabled = true; input.placeholder = "Conversation closed"; }
    if (sendBtn) sendBtn.disabled = true;
    await refresh();
  } catch (err) { alert(err.message); }
}

async function adminSetPrice() {
  if (!activeOrderId) return;
  const input = $("adminPriceInput");
  const price = Number(input.value);
  if (!price || price < 1) {
    $("adminPriceMsg").textContent = "Enter a valid price (min $1)";
    $("adminPriceMsg").className = "msg error";
    return;
  }
  try {
    await request("custom-orders", { method: "POST", body: JSON.stringify({ action: "set_price", order_id: activeOrderId, price }) });
    input.value = "";
    $("adminPriceMsg").textContent = "Price set!";
    $("adminPriceMsg").className = "msg success";
    await loadAdminChat();
  } catch (err) {
    $("adminPriceMsg").textContent = err.message;
    $("adminPriceMsg").className = "msg error";
  }
}

async function sendAdminChat() {
  if (!activeOrderId) return;
  const content = $("adminChatInput").value.trim();
  if (!content) return;
  try {
    await request("custom-messages", { method: "POST", body: JSON.stringify({ order_id: activeOrderId, content }) });
    $("adminChatInput").value = "";
    await loadAdminChat();
  } catch (err) { alert(err.message); }
}

async function onAction(id, action) {
  let note = "";
  if (action === "reject") { note = prompt("Reason (optional):") || ""; }
  try {
    await request("purchase-approve", { method: "POST", body: JSON.stringify({ purchase_id: id, action, note }) });
    await refresh();
  } catch (err) { alert(err.message); }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ================================================================
   VIDEO MANAGEMENT
================================================================ */
function populateVideoTierSelect() {
  const sel = $("videoTierSelect");
  if (!sel) return;
  // Keep the Preview (-1) option, add tiers from config
  while (sel.options.length > 1) sel.remove(1);
  const tiers = (window.SITE_CONFIG && window.SITE_CONFIG.tiers) || [];
  for (const t of tiers) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.id})`;
    sel.appendChild(opt);
  }
}

async function loadVideos() {
  const sel = $("videoTierSelect");
  const wrap = $("videosList");
  const msg = $("addVideoMsg");
  if (!sel || !wrap) return;
  const tierId = sel.value;
  wrap.innerHTML = "<p class='muted' style='font-size:.83rem'>Loading…</p>";
  if (msg) { msg.textContent = ""; msg.className = "ban-result"; }
  try {
    const data = await request(`tier-videos?tier_id=${encodeURIComponent(tierId)}`);
    const videos = data.videos || [];
    wrap.innerHTML = "";
    if (!videos.length) {
      wrap.innerHTML = "<p class='muted' style='font-size:.83rem'>No videos in this tier yet.</p>";
      return;
    }
    for (const v of videos) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:flex-start;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px";
      row.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.85rem;color:#e8e8f0;margin-bottom:3px">${escapeHtml(v.title || "(no title)")}</div>
          <div style="font-size:.75rem;color:var(--muted);word-break:break-all">${escapeHtml(v.video_url)}</div>
        </div>
        <button class="ghost-mini" data-video-id="${escapeHtml(v.id)}" style="color:#ff8a9e;border-color:rgba(255,80,80,.35);flex-shrink:0">🗑 Delete</button>
      `;
      row.querySelector("button[data-video-id]").addEventListener("click", async () => {
        if (!confirm("Delete this video?")) return;
        await deleteVideo(v.id);
      });
      wrap.appendChild(row);
    }
  } catch (err) {
    wrap.innerHTML = `<p style="color:#ff8a9e;font-size:.83rem">${escapeHtml(err.message)}</p>`;
  }
}

async function addVideo() {
  const sel = $("videoTierSelect");
  const titleInput = $("videoTitleInput");
  const urlInput = $("videoUrlInput");
  const msg = $("addVideoMsg");
  if (!sel || !urlInput || !msg) return;
  const tierId = sel.value;
  const url = urlInput.value.trim();
  const title = titleInput ? titleInput.value.trim() : "";
  if (!url) { msg.textContent = "Enter a video URL."; msg.className = "ban-result error"; return; }
  msg.textContent = "Adding…"; msg.className = "ban-result";
  try {
    await request("tier-videos", { method: "POST", body: JSON.stringify({ tier_id: tierId, title, video_url: url }) });
    msg.textContent = "✓ Added!"; msg.className = "ban-result";
    if (urlInput) urlInput.value = "";
    if (titleInput) titleInput.value = "";
    await loadVideos();
  } catch (err) {
    msg.textContent = err.message; msg.className = "ban-result error";
  }
}

async function deleteVideo(id) {
  const msg = $("addVideoMsg");
  try {
    await request("tier-videos", { method: "DELETE", body: JSON.stringify({ id }) });
    if (msg) { msg.textContent = "✓ Deleted."; msg.className = "ban-result"; }
    await loadVideos();
  } catch (err) {
    if (msg) { msg.textContent = err.message; msg.className = "ban-result error"; }
  }
}

// Bind video management buttons
(function bindVideoButtons() {
  const loadBtn = $("loadVideosBtn");
  const addBtn = $("addVideoBtn");
  if (loadBtn) loadBtn.addEventListener("click", loadVideos);
  if (addBtn) addBtn.addEventListener("click", addVideo);
  const urlInput = $("videoUrlInput");
  if (urlInput) urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addVideo(); });
})();

function initBackground() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, stars = [];
  function resize() {
    w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight;
    stars = Array.from({ length: 80 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + .35, d: Math.random() * .5 + .08 }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (const s of stars) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); s.y += s.d; if (s.y > h) { s.y = 0; s.x = Math.random() * w; } }
    requestAnimationFrame(draw);
  }
  resize(); window.addEventListener("resize", resize); draw();
}
initBackground();
tryEnter();
