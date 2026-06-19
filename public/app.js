/* eslint-disable */
const API = "/api";
const CFG = window.SITE_CONFIG;

let captchaA = 0, captchaB = 0, captchaOp = "+";
let currentUser = null;
let authMode = "signup";
let serverTiers = [];
let activeTier = null;
let activeCrypto = "BTC";
let selectedCustomPack = null;
let selectedCustomSize = null;
let activeChatOrderId = null;
let chatPollTimer = null;
let myOpenOrders = [];
let orderPollTimer = null;

const params = new URLSearchParams(window.location.search);
const refFromUrl = params.get("invite") || params.get("ref");

function $(id) { return document.getElementById(id); }
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in props) {
    if (k === "class") node.className = props[k];
    else if (k === "html") node.innerHTML = props[k];
    else if (k.startsWith("on") && typeof props[k] === "function") node.addEventListener(k.slice(2), props[k]);
    else if (k === "data") for (const d in props.data) node.dataset[d] = props.data[d];
    else node.setAttribute(k, props[k]);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function getDeviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) { id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`; localStorage.setItem("device_id", id); }
  return id;
}

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

/* ================================================================
   AUTH
================================================================ */
function setEntryMessage(text, error = false) {
  $("entryMsg").textContent = text;
  $("entryMsg").className = error ? "msg error" : "msg success";
}

function createCaptcha() {
  const ops = ["+", "-", "*"];
  captchaOp = ops[Math.floor(Math.random() * ops.length)];
  if (captchaOp === "*") { captchaA = Math.floor(Math.random() * 6) + 2; captchaB = Math.floor(Math.random() * 6) + 2; }
  else if (captchaOp === "-") { captchaA = Math.floor(Math.random() * 12) + 6; captchaB = Math.floor(Math.random() * (captchaA - 1)) + 1; }
  else { captchaA = Math.floor(Math.random() * 12) + 2; captchaB = Math.floor(Math.random() * 12) + 2; }
  $("captchaQuestion").textContent = `${captchaA} ${captchaOp} ${captchaB} = ?`;
}

function captchaExpected() {
  if (captchaOp === "+") return captchaA + captchaB;
  if (captchaOp === "-") return captchaA - captchaB;
  return captchaA * captchaB;
}

function setMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  $("loginTab").classList.toggle("active", !isSignup);
  $("signupTab").classList.toggle("active", isSignup);
  $("captchaBlock").classList.toggle("hidden", !isSignup);
  $("submitBtn").textContent = isSignup ? "Create account" : "Log in";
  $("password").autocomplete = isSignup ? "new-password" : "current-password";
  $("entryMsg").textContent = "";
  if (isSignup) createCaptcha();
}

function initAuth() {
  if (!$("entryForm")) return;
  if (refFromUrl) { $("refNotice").classList.remove("hidden"); $("refNotice").textContent = "Referral link detected. Create an account to validate it."; }
  $("loginTab").addEventListener("click", () => setMode("login"));
  $("signupTab").addEventListener("click", () => setMode("signup"));
  $("entryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const username = $("username").value.trim();
      const password = $("password").value;
      if (username.length < 3) throw new Error("Username must be at least 3 characters.");
      if (password.length < 4) throw new Error("Password must be at least 4 characters.");
      const body = { username, password };
      if (authMode === "signup") {
        body.invite = refFromUrl; body.device_id = getDeviceId();
        const expected = captchaExpected();
        const answer = Number($("captchaAnswer").value.trim());
        if (answer !== expected) { createCaptcha(); throw new Error("Wrong calculation. Try again."); }
        body.captchaA = expected; body.captchaB = 0; body.captchaAnswer = expected;
        body.honeypot = $("website").value;
      }
      const data = await request(authMode === "signup" ? "enter" : "login", { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("token", data.token);
      await loadMe();
      if (data.referral_message) setTimeout(() => alert(data.referral_message), 50);
    } catch (err) {
      setEntryMessage(err.message, true);
      if (authMode === "signup") createCaptcha();
    }
  });
  setMode(authMode);
  if (localStorage.getItem("token")) loadMe().catch(() => { localStorage.removeItem("token"); });
}

/* ================================================================
   ADMIN CHAT — localStorage-backed side panel
================================================================ */
function saveAdminMessages(userId, msgs) {
  const key = `admin_msgs_${userId}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  const existingIds = new Set(existing.map(m => m.id));
  let added = 0;
  for (const m of (msgs || [])) { if (!existingIds.has(m.id)) { existing.unshift(m); added++; } }
  existing.splice(100);
  localStorage.setItem(key, JSON.stringify(existing));
  return { all: existing, added };
}
function getAdminMessages(userId) { return JSON.parse(localStorage.getItem(`admin_msgs_${userId}`) || '[]'); }
function getAdminUnseenCount(userId) {
  const msgs = getAdminMessages(userId);
  if (!msgs.length) return 0;
  const seenAt = localStorage.getItem(`admin_msgs_seen_${userId}`);
  if (!seenAt) return msgs.length;
  return msgs.filter(m => new Date(m.created_at) > new Date(seenAt)).length;
}
function markAdminMessagesSeen(userId) { localStorage.setItem(`admin_msgs_seen_${userId}`, new Date().toISOString()); }
function updateAdminChatBadge(userId) {
  const count = getAdminUnseenCount(userId);
  const msgs = getAdminMessages(userId);
  const floatWrap = $("adminChatFloat");
  const badge = $("adminChatBadge");
  if (!floatWrap || !badge) return;
  if (msgs.length > 0) {
    floatWrap.classList.remove("hidden");
    if (count > 0) { badge.textContent = count > 9 ? "9+" : String(count); badge.classList.remove("hidden"); floatWrap.classList.add("has-new"); }
    else { badge.classList.add("hidden"); floatWrap.classList.remove("has-new"); }
  } else { floatWrap.classList.add("hidden"); }
}
function openAdminChat() {
  if (!currentUser) return;
  const msgs = getAdminMessages(currentUser.id);
  const box = $("adminChatMessages");
  box.innerHTML = "";
  if (!msgs.length) { box.appendChild(el("p", { class: "muted", style: "text-align:center;padding:32px 16px" }, "No messages yet.")); }
  else {
    for (const m of [...msgs].reverse()) {
      const bubble = el("div", { class: "chat-bubble admin" }, m.message);
      const time = el("div", { class: "chat-time" }, formatTime(m.created_at));
      box.appendChild(el("div", { class: "chat-line admin" }, [bubble, time]));
    }
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
  }
  $("adminChatModal").classList.remove("hidden");
  markAdminMessagesSeen(currentUser.id);
  updateAdminChatBadge(currentUser.id);
}
function closeAdminChat() { $("adminChatModal").classList.add("hidden"); }

/* ================================================================
   PANEL
================================================================ */
async function loadMe() {
  // ?with_notifications=1 fetches+marks-read unread admin messages in one call
  // The inline stats script calls /api/me WITHOUT this param, so no race condition
  const data = await request("me?with_notifications=1");
  currentUser = data.user;

  if (data.notifications && data.notifications.length) {
    const { added } = saveAdminMessages(currentUser.id, data.notifications);
    if (added > 0) updateAdminChatBadge(currentUser.id);
  }
  updateAdminChatBadge(currentUser.id);

  // Poll for new admin messages every 30s
  (function notifPoll() {
    setTimeout(async () => {
      if (!currentUser) return;
      try {
        const d = await request("me?with_notifications=1");
        if (d.notifications && d.notifications.length) {
          const { added } = saveAdminMessages(currentUser.id, d.notifications);
          if (added > 0) updateAdminChatBadge(currentUser.id);
        }
      } catch (_) {}
      notifPoll();
    }, 30000);
  })();

  try { const t = await request("tiers"); serverTiers = t.tiers || []; } catch (_) { serverTiers = []; }

  $("entryPage").classList.add("hidden");
  $("panelPage").classList.remove("hidden");
  $("topbarTitle").textContent = `Welcome, ${currentUser.username}`;

  if (currentUser.is_admin) {
    const btn = $("adminLinkBtn"); btn.style.display = "";
    btn.addEventListener("click", () => { window.location.href = "/admin.html"; }, { once: true });
  }

  const link = `${window.location.origin}/?invite=${currentUser.referral_code}`;
  $("refLink").value = link;
  const count = Number(currentUser.referrals_count || 0);
  $("totalRefs").textContent = count;
  const nextTier = CFG.tiers.find(t => count < t.invitesRequired && !hasAccess(t.id));
  const badge = $("nextTierBadge");
  if (nextTier) badge.textContent = `🎯 ${nextTier.invitesRequired - count} more invites to unlock ${nextTier.name}`;
  else badge.textContent = `🎉 All free unlock thresholds reached`;
  const tg = $("telegramAlt"); if (tg) tg.href = CFG.telegramBot;

  renderTierGrid(); renderDrawerTiers(); initCustomPack(); initNotifications(); startOrderPoll();
}

function hasAccess(tierId) {
  if (currentUser && Array.isArray(currentUser.unlocked_tiers) && currentUser.unlocked_tiers.includes(tierId)) return true;
  const s = serverTiers.find(x => x.id === tierId); if (s && s.hasAccess) return true;
  const cfg = CFG.tiers.find(t => t.id === tierId);
  return cfg ? Number((currentUser && currentUser.referrals_count) || 0) >= cfg.invitesRequired : false;
}

function switchPanelSection(section) {
  document.querySelectorAll(".panel-tab").forEach(b => b.classList.toggle("active", b.dataset.section === section));
  document.querySelectorAll(".panel-section").forEach(p => p.classList.toggle("hidden", p.dataset.section !== section));
}

function renderTierGrid() {
  const grid = $("tierGrid"); grid.innerHTML = "";
  const refs = Number((currentUser && currentUser.referrals_count) || 0);
  const starterTiers = CFG.tiers.filter(t => t.payDisabled);
  const mainTiers = CFG.tiers.filter(t => !t.payDisabled);
  let starterWrap = $("starterTierWrap");
  if (!starterWrap) { starterWrap = document.createElement("div"); starterWrap.id = "starterTierWrap"; grid.parentElement.insertBefore(starterWrap, grid); }
  starterWrap.innerHTML = "";
  const oldLabel = $("mainTiersLabel"); if (oldLabel) oldLabel.remove();
  if (starterTiers.length) {
    starterWrap.appendChild(el("div", { class: "drawer-section-inline starter-label" }, "🎁 FREE STARTER — INVITE ONLY"));
    const sg = el("div", { class: "tier-grid starter-grid" });
    for (const t of starterTiers) {
      const card = el("div", { class: "tier-card starter-card", data: { color: t.color, tierId: t.id } });
      const access = hasAccess(t.id);
      card.appendChild(el("h3", {}, t.name));
      if (t.subtitle) card.appendChild(el("p", { class: "tier-subtitle" }, t.subtitle));
      card.appendChild(el("div", { class: "tier-badges" }, [el("span", { class: "tier-badge invites" }, `🎯 ${t.invitesRequired} invites only`), el("span", { class: "tier-badge free-badge" }, "🎉 FREE")]));
      const ul = el("ul", { class: "feature-list" }); for (const f of t.features) ul.appendChild(el("li", {}, f)); card.appendChild(ul);
      card.appendChild(el("div", { class: "tier-size" }, [el("strong", {}, t.totalSize), el("span", {}, "TOTAL SIZE")]));
      const left = t.invitesRequired - refs;
      card.appendChild(el("div", { class: "tier-actions" }, [el("button", {
        class: "btn-invites btn-invites-full" + (access ? " unlocked" : ""), type: "button", onclick: () => onInviteButton(t)
      }, access ? `✅ Open ${t.name}` : left > 0 ? `🔗 ${left} more invite${left > 1 ? "s" : ""} to unlock` : "Claim free access")]));
      sg.appendChild(card);
    }
    starterWrap.appendChild(sg); starterWrap.appendChild(el("div", { class: "starter-divider" }));
  }
  grid.parentElement.insertBefore(el("div", { id: "mainTiersLabel", class: "drawer-section-inline" }, "STANDARD TIERS"), grid);
  for (const t of mainTiers) {
    const card = el("div", { class: "tier-card", data: { color: t.color, tierId: t.id } });
    const access = hasAccess(t.id);
    card.appendChild(el("h3", {}, t.name));
    if (t.subtitle) card.appendChild(el("p", { class: "tier-subtitle" }, t.subtitle));
    card.appendChild(el("div", { class: "tier-badges" }, [el("span", { class: "tier-badge invites" }, `🎯 ${t.invitesRequired} invites`), el("span", { class: "tier-badge price" }, `💳 $${t.priceUSD}`)]));
    const ul = el("ul", { class: "feature-list" }); for (const f of t.features) ul.appendChild(el("li", {}, f)); card.appendChild(ul);
    card.appendChild(el("div", { class: "tier-size" }, [el("strong", {}, t.totalSize), el("span", {}, "TOTAL SIZE")]));
    const actions = el("div", { class: "tier-actions" });
    actions.appendChild(el("button", { class: "btn-buy", type: "button", onclick: () => openPurchaseModal(t) }, `💳 Buy $${t.priceUSD}`));
    actions.appendChild(el("button", { class: "btn-invites" + (access ? " unlocked" : ""), type: "button", onclick: () => onInviteButton(t) },
      access ? `✅ Open ${t.name}` : `🔒 ${t.invitesRequired - refs > 0 ? (t.invitesRequired - refs) + " more" : "Claim"}`));
    card.appendChild(actions); grid.appendChild(card);
  }
}

function renderDrawerTiers() {
  const wrap = $("drawerTiers"); wrap.innerHTML = "";
  for (const t of CFG.tiers) {
    const access = hasAccess(t.id);
    wrap.appendChild(el("button", { class: "drawer-item " + (access ? "unlocked" : "locked"), type: "button",
      onclick: () => { closeDrawer(); if (access) openTier(t); else { const card = document.querySelector(`.tier-card[data-tier-id="${t.id}"]`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); if (!t.payDisabled) openPurchaseModal(t); } }
    }, t.name + (access ? "  ✅" : "")));
  }
}

async function onInviteButton(tier) {
  if (hasAccess(tier.id)) return openTier(tier);
  const refs = Number((currentUser && currentUser.referrals_count) || 0);
  if (refs >= tier.invitesRequired) { if (tier.payDisabled) { await openTier(tier); return; } showChoiceModal(tier); return; }
  if (tier.payDisabled) { switchPanelSection("invites"); return; }
  openPurchaseModal(tier);
}

async function openTier(tier) {
  try {
    const data = await request("claim", { method: "POST", body: JSON.stringify({ tier_id: tier.id }) });
    window.open(data.reward_url, "_blank");
    if (!currentUser.unlocked_tiers.includes(tier.id)) currentUser.unlocked_tiers = [...currentUser.unlocked_tiers, tier.id];
    renderTierGrid(); renderDrawerTiers();
  } catch (err) { alert(err.message); }
}

function showChoiceModal(tier) {
  $("choiceTitle").textContent = `${tier.name} ready`;
  $("choiceMsg").textContent = `You have enough invites for ${tier.name}. Claim it for free or pay for instant access anyway.`;
  $("choiceModal").classList.remove("hidden");
  $("choiceClaim").onclick = async () => { $("choiceModal").classList.add("hidden"); await openTier(tier); };
  $("choicePay").onclick = () => { $("choiceModal").classList.add("hidden"); openPurchaseModal(tier); };
}
function bindChoiceClose() { $("choiceClose").addEventListener("click", () => $("choiceModal").classList.add("hidden")); }

function openPurchaseModal(tier) {
  activeTier = tier; activeCrypto = "BTC";
  $("modalTitle").textContent = `Purchase ${tier.name}`; $("modalMsg").textContent = "";
  $("purchaseModal").classList.remove("hidden"); switchTab("crypto");
  $("gcAmount").innerHTML = `💳 Amount: $${tier.priceUSD}`;
  renderGcPlatforms(); $("gcCode").value = ""; updateGcCount();
  $("cryptoAmountUSD").innerHTML = `💰 Amount: $${tier.priceUSD} USD`;
  renderCryptoTickers(); applyCrypto(activeCrypto); $("cryptoTxId").value = ""; updateCryptoTxCount();
}
function closePurchaseModal() { $("purchaseModal").classList.add("hidden"); activeTier = null; }
function switchTab(tab) {
  document.querySelectorAll(".modal-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".modal-pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== tab));
}
let selectedPlatform = null;
function renderGcPlatforms() {
  const wrap = $("gcPlatforms"); wrap.innerHTML = ""; selectedPlatform = null;
  for (const p of CFG.giftCardPlatforms) {
    const btn = el("button", { class: "platform-item", type: "button", onclick: () => {
      selectedPlatform = p.name; document.querySelectorAll(".platform-item").forEach(x => x.classList.remove("selected")); btn.classList.add("selected");
      if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
    }}, [el("div", {}, [el("strong", {}, p.name), el("small", {}, `$${activeTier.priceUSD} ${p.note}`)]), el("span", { class: "arrow" }, "→")]);
    wrap.appendChild(btn);
  }
}
function updateGcCount() { $("gcCharCount").textContent = `• ${$("gcCode").value.trim().length}/14 characters minimum`; }
function renderCryptoTickers() {
  const wrap = $("cryptoTickers"); wrap.innerHTML = "";
  for (const t of ["BTC", "ETH", "LTC", "SOL"]) {
    const amount = (activeTier.priceUSD * (CFG.cryptoRates[t] || 0)).toFixed(8);
    const btn = el("button", { class: "ticker-btn" + (t === activeCrypto ? " active" : ""), type: "button",
      onclick: () => { activeCrypto = t; applyCrypto(t); renderCryptoTickers(); }
    }, [t, el("small", {}, amount)]);
    wrap.appendChild(btn);
  }
}
function applyCrypto(t) {
  const amount = (activeTier.priceUSD * (CFG.cryptoRates[t] || 0)).toFixed(8);
  $("cryptoAmountCrypto").textContent = amount; $("cryptoAmountTicker").textContent = t;
  $("cryptoAddrLabel").textContent = `${ ({BTC:"Bitcoin",ETH:"Ethereum",LTC:"Litecoin",SOL:"Solana"})[t]||t } Address:`;
  $("cryptoAddr").value = CFG.crypto[t] || "";
  $("cryptoWarn").innerHTML = `Send exactly <b>${amount} ${t} ($${activeTier.priceUSD} USD)</b>`;
}
function updateCryptoTxCount() { $("cryptoTxCount").textContent = `• ${$("cryptoTxId").value.trim().length} characters`; }
async function copyToClipboard(text, msgEl) {
  try { await navigator.clipboard.writeText(text); if (msgEl) { msgEl.textContent = "Copied!"; setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 1300); } } catch {}
}
function purchasePayload(method, extra) {
  const base = { method, ...extra };
  if (activeTier.isCustom) { base.is_custom = true; base.custom_pack_id = activeTier.packId; base.custom_size_id = activeTier.sizeId; }
  else { base.tier_id = activeTier.id; }
  return base;
}
async function submitGiftCard() {
  if (!activeTier) return;
  if (!selectedPlatform) return setModalMsg("Choose a platform first.", true);
  const code = $("gcCode").value.trim();
  if (code.length < 14) return setModalMsg("Code must be at least 14 characters.", true);
  await submitPurchase(purchasePayload("giftcard", { giftcard_platform: selectedPlatform, giftcard_code: code }));
}
async function submitCrypto() {
  if (!activeTier) return;
  const txId = $("cryptoTxId").value.trim();
  if (txId.length < 10) return setModalMsg("Transaction ID looks too short.", true);
  await submitPurchase(purchasePayload("crypto", { crypto_currency: activeCrypto, crypto_amount: (activeTier.priceUSD * (CFG.cryptoRates[activeCrypto] || 0)).toString(), tx_id: txId }));
}
async function submitPurchase(payload) {
  setModalMsg("Submitting…");
  try { const data = await request("purchase", { method: "POST", body: JSON.stringify(payload) }); setModalMsg(data.message || "Submitted. Waiting for review.", false); setTimeout(() => closePurchaseModal(), 2200); }
  catch (err) { setModalMsg(err.message, true); }
}
function setModalMsg(text, error = false) { const m = $("modalMsg"); m.textContent = text; m.className = error ? "msg error" : "msg success"; }

function openDrawer() { $("drawer").classList.remove("hidden"); $("drawerBackdrop").classList.remove("hidden"); }
function closeDrawer() { $("drawer").classList.add("hidden"); $("drawerBackdrop").classList.add("hidden"); }
function bindDrawer() {
  $("drawerOpen").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);
  document.querySelectorAll(".drawer-item[data-action]").forEach(btn => btn.addEventListener("click", () => handleDrawerAction(btn.dataset.action)));
}
function handleDrawerAction(action) {
  closeDrawer();
  switch (action) {
    case "home": window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "preview": window.open("https://mega.nz/folder/dyUkiRyD#ooS0qN64DOXkSuli8BXL1A", "_blank", "noopener,noreferrer"); break;
    case "menu": case "more-videos": switchPanelSection("custom"); break;
    case "invites": switchPanelSection("invites"); break;
    case "reviews": alert("Reviews section is coming soon."); break;
    case "support": window.open(CFG.telegramBot, "_blank"); break;
    case "logout": localStorage.removeItem("token"); window.location.reload(); break;
  }
}

function getCustomPriceEntry(packId, sizeId) { const cp = CFG.customPack; return cp && cp.prices ? cp.prices[packId]?.[sizeId] || null : null; }
function updateCustomPriceDisplay() {
  const origEl = $("customPriceOriginal"), curEl = $("customPriceCurrent"), buyBtn = $("customBuyBtn");
  if (!selectedCustomPack || !selectedCustomSize) { origEl.textContent = ""; curEl.textContent = "$—"; buyBtn.disabled = true; return; }
  const entry = getCustomPriceEntry(selectedCustomPack, selectedCustomSize);
  if (!entry) { origEl.textContent = ""; curEl.textContent = "$—"; buyBtn.disabled = true; return; }
  origEl.textContent = entry.original > entry.price ? `$${entry.original}` : "";
  curEl.textContent = `$${entry.price}`; buyBtn.disabled = false; buyBtn.textContent = `💳 Buy custom pack · $${entry.price}`;
}
function initCustomPack() {
  const cp = CFG.customPack; if (!cp || !$("customPackSection")) return;
  $("customPackTitle").textContent = cp.title || "Custom Pack"; $("customPackSub").textContent = cp.subtitle || "";
  selectedCustomPack = cp.categories[0]?.id || null;
  selectedCustomSize = cp.sizes.find(s => s.popular)?.id || cp.sizes[0]?.id || null;
  renderCustomCategories(); renderCustomSizes(); updateCustomPriceDisplay();
  $("customBuyBtn").addEventListener("click", () => {
    if (!selectedCustomPack || !selectedCustomSize) return;
    const entry = getCustomPriceEntry(selectedCustomPack, selectedCustomSize);
    const cat = cp.categories.find(c => c.id === selectedCustomPack);
    const size = cp.sizes.find(s => s.id === selectedCustomSize);
    if (!entry || !cat || !size) return;
    openPurchaseModal({ isCustom: true, packId: cat.id, sizeId: size.id, name: `Custom · ${cat.name} · ${size.label}`, priceUSD: entry.price });
  });
  $("customRequestBtn").addEventListener("click", openCustomOrderModal);
  $("customOrderClose").addEventListener("click", () => $("customOrderModal").classList.add("hidden"));
  $("customOrderSubmit").addEventListener("click", submitCustomOrder);
  $("chatClose").addEventListener("click", closeChatModal);
  $("chatSend").addEventListener("click", sendChatMessage);
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChatMessage(); });
}
function renderCustomCategories() {
  const wrap = $("customCategories"), cp = CFG.customPack; if (!wrap || !cp) return; wrap.innerHTML = "";
  for (const c of cp.categories) {
    const btn = el("button", { class: "custom-cat-btn" + (selectedCustomPack === c.id ? " active" : ""), type: "button",
      onclick: () => { selectedCustomPack = c.id; renderCustomCategories(); updateCustomPriceDisplay(); }
    }, [el("strong", {}, c.name), el("small", {}, c.desc || "")]);
    if (c.color) btn.dataset.color = c.color;
    wrap.appendChild(btn);
  }
}
function renderCustomSizes() {
  const wrap = $("customSizes"), cp = CFG.customPack; if (!wrap || !cp) return; wrap.innerHTML = "";
  for (const s of cp.sizes) {
    const btn = el("button", { class: "custom-size-btn" + (selectedCustomSize === s.id ? " active" : ""), type: "button",
      onclick: () => { selectedCustomSize = s.id; renderCustomSizes(); updateCustomPriceDisplay(); }
    }, s.label);
    if (s.popular) btn.appendChild(el("span", { class: "size-tag popular" }, "Most popular"));
    if (s.mega) btn.appendChild(el("span", { class: "size-tag mega" }, "MEGA"));
    wrap.appendChild(btn);
  }
}

async function openCustomOrderModal() {
  $("customOrderModal").classList.remove("hidden"); $("customOrderMsg").textContent = ""; $("customOrderText").value = "";
  await loadMyCustomOrders();
}
async function submitCustomOrder() {
  const message = $("customOrderText").value.trim();
  if (message.length < 10) { $("customOrderMsg").textContent = "Please write at least 10 characters."; $("customOrderMsg").className = "msg error"; return; }
  $("customOrderMsg").textContent = "Sending…";
  try {
    const data = await request("custom-order", { method: "POST", body: JSON.stringify({ message }) });
    $("customOrderMsg").textContent = data.message || "Sent!"; $("customOrderMsg").className = "msg success";
    $("customOrderText").value = "";
    setTimeout(() => { $("customOrderModal").classList.add("hidden"); }, 1200);
    await loadMyCustomOrders(); startOrderPoll();
  } catch (err) { $("customOrderMsg").textContent = err.message; $("customOrderMsg").className = "msg error"; }
}
async function loadMyCustomOrders() {
  const wrap = $("myCustomOrders"); if (!wrap) return; wrap.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const data = await request("custom-orders"); const orders = data.orders || [];
    if (!orders.length) { wrap.innerHTML = "<p class='muted'>No conversations yet.</p>"; return; }
    wrap.innerHTML = "";
    for (const o of orders) {
      wrap.appendChild(el("button", { class: "custom-order-item", type: "button", onclick: () => openChatModal(o.id) }, [
        el("span", { class: "co-status " + o.status }, o.status),
        el("span", { class: "co-preview" }, (o.initial_message || "").slice(0, 80))
      ]));
    }
  } catch (err) { wrap.innerHTML = `<p class='msg error'>${err.message}</p>`; }
}
function closeChatModal() { $("chatModal").classList.add("hidden"); activeChatOrderId = null; if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; } }
async function loadChatMessages(silent) {
  if (!activeChatOrderId) return;
  try {
    const data = await request(`custom-messages?order_id=${encodeURIComponent(activeChatOrderId)}`);
    const box = $("chatMessages"); box.innerHTML = "";
    for (const m of data.messages || []) {
      const bubble = el("div", { class: "chat-bubble " + (m.is_admin ? "admin" : "user") }, m.content);
      box.appendChild(el("div", { class: "chat-line " + (m.is_admin ? "admin" : "user") }, [bubble, el("div", { class: "chat-time" }, formatTime(m.created_at))]));
    }
    const agreedPrice = data.agreed_price; const payBar = $("chatPayBar"); if (payBar) payBar.remove();
    if (agreedPrice && agreedPrice > 0) {
      const bar = el("div", { class: "chat-pay-bar", id: "chatPayBar" }, [
        el("div", { class: "chat-pay-info" }, [el("strong", {}, `Agreed price: $${agreedPrice}`), el("span", { class: "muted" }, "Click below to proceed with payment")]),
        el("button", { class: "main-btn chat-pay-btn", type: "button", onclick: () => { closeChatModal(); openPurchaseModal({ isCustom: true, packId: 0, sizeId: "custom_order", name: "Custom Order", priceUSD: agreedPrice }); } }, `💳 Pay $${agreedPrice}`)
      ]);
      box.parentElement.insertBefore(bar, box.nextSibling);
    }
    box.scrollTop = box.scrollHeight;
  } catch (err) { if (!silent) $("chatMsg").textContent = err.message; }
}
async function sendChatMessage() {
  if (!activeChatOrderId) return;
  const content = $("chatInput").value.trim(); if (!content) return;
  try { await request("custom-messages", { method: "POST", body: JSON.stringify({ order_id: activeChatOrderId, content }) }); $("chatInput").value = ""; await loadChatMessages(); }
  catch (err) { $("chatMsg").textContent = err.message; $("chatMsg").className = "msg error"; }
}
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function startOrderPoll() { if (orderPollTimer) clearInterval(orderPollTimer); pollMyOrders(); orderPollTimer = setInterval(pollMyOrders, 10000); }
async function pollMyOrders() {
  if (!currentUser) return;
  try { const data = await request("custom-orders"); myOpenOrders = data.orders || []; renderChatFloat(); } catch (_) {}
}
function renderChatFloat() {
  let wrap = $("chatFloatWrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "chatFloatWrap"; document.body.appendChild(wrap); }
  wrap.innerHTML = "";
  for (const o of myOpenOrders.filter(o => o.status === "open")) {
    const hasPrice = o.agreed_price && o.agreed_price > 0;
    wrap.appendChild(el("button", { class: "chat-float-btn" + (hasPrice ? " has-price" : ""), type: "button", onclick: () => openChatModal(o.id) }, [
      el("span", { class: "chat-float-icon" }, hasPrice ? "💳" : "💬"),
      el("span", { class: "chat-float-text" }, hasPrice ? `Pay $${o.agreed_price}` : "Chat"),
      el("span", { class: "chat-float-dot" })
    ]));
  }
}
async function openChatModal(orderId) {
  activeChatOrderId = orderId; $("chatModal").classList.remove("hidden");
  $("chatMsg").textContent = ""; $("chatInput").value = "";
  $("chatTitle").textContent = "Custom order"; $("chatSub").textContent = "Reply here — we usually answer within minutes.";
  await loadChatMessages();
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(() => loadChatMessages(true), 8000);
}

const FAKE_NAMES = ["mike92","sarah_k","joshT","emma.w","liam_x","nina_07","alexM","zoey99","carlos_r","mia_b","noah_22","lilyrose","tylerJ","ava_s","ethan_p","chloe_v"];
const PACK_LABELS = ["Pack 1","Pack 2","Pack 3","Pack 4","Tier 2","Tier 4"];
const SIZE_LABELS = ["25 GB","50 GB","100 GB","250 GB","500 GB","1 TB"];
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function initNotifications() {
  const btn = $("notifBtn"), panel = $("notifPanel"), list = $("notifList");
  if (!btn || !panel || !list) return;
  list.innerHTML = "";
  const types = ["purchase","invite","custom"];
  const items = [];
  for (let i = 0; i < 30; i++) {
    const name = randomItem(FAKE_NAMES), type = randomItem(types), mins = Math.floor(Math.random() * 55) + 1;
    let text = "", icon = "💳";
    if (type === "purchase") { text = `<b>${name}</b> purchased ${randomItem(PACK_LABELS)} · ${randomItem(SIZE_LABELS)}`; }
    else if (type === "invite") { text = `<b>${name}</b> invited ${Math.floor(Math.random() * 8) + 3} friends today`; icon = "👥"; }
    else { text = `<b>${name}</b> started a custom order`; icon = "✏️"; }
    const item = el("div", { class: "notif-item" }, [el("span", { class: "notif-icon" }, icon), el("div", { class: "notif-body" }, [el("div", { html: text }), el("small", { class: "muted" }, `${mins} min ago`)])]);
    if (i < 2) item.classList.add("notif-item-new");
    list.appendChild(item);
    items.push(item);
  }
  // CSS renders .notif-item at opacity:0 by default (entrance animation) and reveals it
  // via .notif-item-visible — stagger that here so the feed fades/cascades into view.
  items.forEach((item, i) => { setTimeout(() => item.classList.add("notif-item-visible"), 40 + i * 25); });
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.classList.toggle("hidden"); });
  document.addEventListener("click", (e) => { if (!$("notifWrap").contains(e.target)) panel.classList.add("hidden"); });
}

/* ================================================================
   SHARE GUIDE — populate the platform grid in #sharePlatforms
================================================================ */
const SHARE_PLATFORMS = [
  { id: "x", name: "X (Twitter)", icon: "fa-brands fa-x-twitter", tip: "Post your invite link where your followers will see it.", action: "share",
    buildUrl: (link) => `https://twitter.com/intent/tweet?text=${encodeURIComponent("Join me on Nonaxion — here's my invite link:")}&url=${encodeURIComponent(link)}` },
  { id: "telegram", name: "Telegram", icon: "fa-brands fa-telegram", tip: "Share to a chat, group, or channel in one tap.", action: "share",
    buildUrl: (link) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join me on Nonaxion:")}` },
  { id: "whatsapp", name: "WhatsApp", icon: "fa-brands fa-whatsapp", tip: "Send your link straight to a contact or group.", action: "share",
    buildUrl: (link) => `https://wa.me/?text=${encodeURIComponent("Join me on Nonaxion: " + link)}` },
  { id: "facebook", name: "Facebook", icon: "fa-brands fa-facebook", tip: "Post it on your timeline or in a group.", action: "share",
    buildUrl: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  { id: "reddit", name: "Reddit", icon: "fa-brands fa-reddit-alien", tip: "Drop it in a relevant subreddit's self-promo thread.", action: "share",
    buildUrl: (link) => `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent("Join me on Nonaxion")}` },
  { id: "tumblr", name: "Tumblr", icon: "fa-brands fa-tumblr", tip: "Make a quick post linking your invite.", action: "share",
    buildUrl: (link) => `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent(link)}&caption=${encodeURIComponent("Join me on Nonaxion")}` },
  { id: "discord", name: "Discord", icon: "fa-brands fa-discord", tip: "Copy the link and paste it in a server or DM.", action: "copy" },
  { id: "tiktok", name: "TikTok", icon: "fa-brands fa-tiktok", tip: "Copy the link and drop it in your bio.", action: "copy" },
  { id: "instagram", name: "Instagram", icon: "fa-brands fa-instagram", tip: "Copy the link for your bio or a story sticker.", action: "copy" }
];
function renderSharePlatforms() {
  const wrap = $("sharePlatforms"); if (!wrap) return;
  wrap.innerHTML = "";
  const link = $("refLink") ? $("refLink").value : "";
  for (const p of SHARE_PLATFORMS) {
    const head = el("div", { class: "share-platform-head" }, [
      el("span", { class: "share-platform-icon" }, [el("i", { class: p.icon, "aria-hidden": "true" })]),
      el("strong", {}, p.name)
    ]);
    const tip = el("p", { class: "share-platform-tip muted" }, p.tip);
    const btn = el("button", { class: "main-btn share-action-btn", type: "button", onclick: () => {
      if (p.action === "share") window.open(p.buildUrl(link), "_blank", "noopener,noreferrer");
      else copyToClipboard(link, $("shareGuideMsg"));
    } }, p.action === "share" ? "Share" : "Copy link");
    wrap.appendChild(el("div", { class: "share-platform", data: { platform: p.id } }, [head, tip, btn]));
  }
}

function bindStaticUI() {
  document.querySelectorAll(".panel-tab").forEach(btn => btn.addEventListener("click", () => switchPanelSection(btn.dataset.section)));
  const acfBtn = $("adminChatFloatBtn"); if (acfBtn) acfBtn.addEventListener("click", openAdminChat);
  const acClose = $("adminChatClose"); if (acClose) acClose.addEventListener("click", closeAdminChat);
  $("copyLinkBtn").addEventListener("click", async () => { await copyToClipboard($("refLink").value, $("copyMsg")); });
  $("modalClose").addEventListener("click", closePurchaseModal);
  document.querySelectorAll(".modal-tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $("gcCode").addEventListener("input", updateGcCount);
  $("gcSubmit").addEventListener("click", submitGiftCard);
  $("cryptoTxId").addEventListener("input", updateCryptoTxCount);
  $("cryptoCopy").addEventListener("click", () => copyToClipboard($("cryptoAddr").value, $("modalMsg")));
  $("cryptoRefresh").addEventListener("click", () => { renderCryptoTickers(); applyCrypto(activeCrypto); });
  $("cryptoSubmit").addEventListener("click", submitCrypto);
  bindChoiceClose();
  const howToShareBtn = $("howToShareBtn");
  if (howToShareBtn) {
    howToShareBtn.addEventListener("click", () => { renderSharePlatforms(); $("shareGuideModal").classList.remove("hidden"); });
    $("shareGuideClose").addEventListener("click", () => $("shareGuideModal").classList.add("hidden"));
  }
}

function initBackground() {
  const canvas = $("bgCanvas"); if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0, height = 0, stars = [];
  function resize() {
    width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight;
    stars = Array.from({ length: Math.min(140, Math.max(60, Math.floor((width * height) / 11000))) },
      () => ({ x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.6 + .35, d: Math.random() * .65 + .08 }));
  }
  function draw() {
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = "rgba(255,255,255,.6)";
    for (const s of stars) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); s.y += s.d; if (s.y > height) { s.y = 0; s.x = Math.random() * width; } }
    if (!reduced) requestAnimationFrame(draw);
  }
  resize(); window.addEventListener("resize", resize); draw();
}

function initTelegramFloat() { const link = $("tgServerFloat"); if (link && CFG.telegramServer) link.href = CFG.telegramServer; }

initBackground(); initTelegramFloat(); bindDrawer(); bindStaticUI(); initAuth();
