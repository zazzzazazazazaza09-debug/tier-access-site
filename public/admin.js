/* eslint-disable */
const API = "/api";
const $ = (id) => document.getElementById(id);
let currentStatus = "pending";
let currentView = "purchases";
let activeOrderId = null;
let orderPollTimer = null;

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
    $("purchasesView").classList.toggle("hidden", !isPurchases);
    $("ordersView").classList.toggle("hidden", isPurchases);
    document.querySelectorAll(".purchase-tab").forEach(x => {
      x.style.display = isPurchases ? "" : "none";
    });
    refresh();
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
$("adminRefresh").addEventListener("click", refresh);
$("adminChatSend").addEventListener("click", sendAdminChat);
$("adminChatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendAdminChat();
});

async function refresh() {
  $("adminMsg").textContent = "Loading…";
  $("adminMsg").className = "msg";
  try {
    if (currentView === "purchases") {
      const data = await request(`purchases?status=${encodeURIComponent(currentStatus)}`);
      renderRows(data.purchases || []);
      $("adminMsg").textContent = `${data.purchases.length} record(s).`;
    } else {
      const data = await request("custom-orders");
      renderOrders(data.orders || []);
      $("adminMsg").textContent = `${data.orders.length} conversation(s).`;
    }
  } catch (err) {
    $("adminMsg").textContent = err.message;
    $("adminMsg").className = "msg error";
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
  const d = new Date(iso);
  return d.toLocaleString();
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
      actions = `
        <div class="row-actions">
          <button class="btn-approve" data-id="${r.id}" data-action="approve">Approve</button>
          <button class="btn-reject"  data-id="${r.id}" data-action="reject">Reject</button>
        </div>`;
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
  renderOrders((await request("custom-orders")).orders || []);
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
  } catch (err) {
    if (!silent) $("adminMsg").textContent = err.message;
  }
}

async function sendAdminChat() {
  if (!activeOrderId) return;
  const content = $("adminChatInput").value.trim();
  if (!content) return;
  try {
    await request("custom-message", {
      method: "POST",
      body: JSON.stringify({ order_id: activeOrderId, content })
    });
    $("adminChatInput").value = "";
    await loadAdminChat();
  } catch (err) {
    alert(err.message);
  }
}

async function onAction(id, action) {
  let note = "";
  if (action === "reject") {
    note = prompt("Reason (optional):") || "";
  }
  try {
    await request("purchase-approve", {
      method: "POST",
      body: JSON.stringify({ purchase_id: id, action, note })
    });
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* starfield reuse */
function initBackground() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, stars = [];
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.4 + .35, d: Math.random() * .5 + .08
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (const s of stars) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      s.y += s.d; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
    }
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  draw();
}
initBackground();
tryEnter();
