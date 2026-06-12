/* eslint-disable */
const API = "/api";
const CFG = window.SITE_CONFIG;

let captchaA = 0, captchaB = 0, captchaOp = "+";
let currentUser = null;
let authMode = "signup";          // signup-first
let serverTiers = [];             // [{id,hasAccess,unlockUrl?}]
let activeTier = null;            // tier object currently in modal
let activeCrypto = "BTC";

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
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
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
  // mix of +, -, *. Always positive small result.
  const ops = ["+", "-", "*"];
  captchaOp = ops[Math.floor(Math.random() * ops.length)];
  if (captchaOp === "*") {
    captchaA = Math.floor(Math.random() * 6) + 2;
    captchaB = Math.floor(Math.random() * 6) + 2;
  } else if (captchaOp === "-") {
    captchaA = Math.floor(Math.random() * 12) + 6;
    captchaB = Math.floor(Math.random() * (captchaA - 1)) + 1;
  } else {
    captchaA = Math.floor(Math.random() * 12) + 2;
    captchaB = Math.floor(Math.random() * 12) + 2;
  }
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

  if (refFromUrl) {
    $("refNotice").classList.remove("hidden");
    $("refNotice").textContent = "Referral link detected. Create an account to validate it.";
  }

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
        body.invite = refFromUrl;
        body.device_id = getDeviceId();
        // Server expects captchaA + captchaB (sum). To stay compatible we normalize:
        // we send the operation result as captchaA, captchaB=0 so A+B == result.
        const expected = captchaExpected();
        const answer = Number($("captchaAnswer").value.trim());
        if (answer !== expected) {
          createCaptcha();
          throw new Error("Wrong calculation. Try again.");
        }
        body.captchaA = expected;
        body.captchaB = 0;
        body.captchaAnswer = expected;
        body.honeypot = $("website").value;
      }

      const data = await request(authMode === "signup" ? "enter" : "login", {
        method: "POST",
        body: JSON.stringify(body)
      });

      localStorage.setItem("token", data.token);
      await loadMe();

      if (data.referral_message) showFlash(data.referral_message);
    } catch (err) {
      setEntryMessage(err.message, true);
      if (authMode === "signup") createCaptcha();
    }
  });

  setMode(authMode);

  if (localStorage.getItem("token")) {
    loadMe().catch(() => {
      localStorage.removeItem("token");
    });
  }
}

function showFlash(msg) {
  setTimeout(() => alert(msg), 50);
}

/* ================================================================
   PANEL
================================================================ */
async function loadMe() {
  const data = await request("me");
  currentUser = data.user;

  // also fetch tiers (server-validated access list)
  try {
    const t = await request("tiers");
    serverTiers = t.tiers || [];
  } catch (_) { serverTiers = []; }

  $("entryPage").classList.add("hidden");
  $("panelPage").classList.remove("hidden");
  $("topbarTitle").textContent = `Welcome, ${currentUser.username}`;

  if (currentUser.is_admin) {
    const btn = $("adminLinkBtn");
    btn.style.display = "";
    btn.addEventListener("click", () => { window.location.href = "/admin.html"; }, { once: true });
  }

  // Referral link
  const link = `${window.location.origin}/?invite=${currentUser.referral_code}`;
  $("refLink").value = link;

  // Total invites
  const count = Number(currentUser.referrals_count || 0);
  $("totalRefs").textContent = count;

  // Next-tier badge
  const nextTier = CFG.tiers.find(t => count < t.invitesRequired && !hasAccess(t.id));
  const badge = $("nextTierBadge");
  if (nextTier) {
    const left = nextTier.invitesRequired - count;
    badge.textContent = `🎯 ${left} more invites to unlock ${nextTier.name}`;
  } else {
    badge.textContent = `🎉 All free unlock thresholds reached`;
  }

  // Telegram alt link
  const tg = $("telegramAlt");
  if (tg) tg.href = CFG.telegramBot;

  renderTierGrid();
  renderDrawerTiers();
}

function hasAccess(tierId) {
  if (currentUser && Array.isArray(currentUser.unlocked_tiers) && currentUser.unlocked_tiers.includes(tierId)) return true;
  const s = serverTiers.find(x => x.id === tierId);
  if (s && s.hasAccess) return true;
  // referral-based check
  const cfg = CFG.tiers.find(t => t.id === tierId);
  const refs = Number((currentUser && currentUser.referrals_count) || 0);
  return cfg ? refs >= cfg.invitesRequired : false;
}

function renderTierGrid() {
  const grid = $("tierGrid");
  grid.innerHTML = "";
  const refs = Number((currentUser && currentUser.referrals_count) || 0);

  for (const t of CFG.tiers) {
    const card = el("div", { class: "tier-card", data: { color: t.color, tierId: t.id } });
    const access = hasAccess(t.id);
    const enoughInvites = refs >= t.invitesRequired;

    card.appendChild(el("h3", {}, t.name));
    card.appendChild(el("div", { class: "tier-badges" }, [
      el("span", { class: "tier-badge invites" }, `🎯 ${t.invitesRequired} invites`),
      el("span", { class: "tier-badge price" }, `💳 $${t.priceUSD}`)
    ]));

    const ul = el("ul", { class: "feature-list" });
    for (const f of t.features) ul.appendChild(el("li", {}, f));
    card.appendChild(ul);

    card.appendChild(el("div", { class: "tier-size" }, [
      el("strong", {}, t.totalSize),
      el("span", {}, "TOTAL SIZE")
    ]));

    const actions = el("div", { class: "tier-actions" });

    const buyBtn = el("button", {
      class: "btn-buy", type: "button",
      onclick: () => openPurchaseModal(t)
    }, `💳 Buy $${t.priceUSD}`);

    const inviteBtn = el("button", {
      class: "btn-invites" + (access ? " unlocked" : ""),
      type: "button",
      onclick: () => onInviteButton(t)
    }, access ? `✅ Open ${t.name}` : `🔒 ${t.invitesRequired - refs > 0 ? (t.invitesRequired - refs) + " more" : "Claim"}`);

    actions.appendChild(buyBtn);
    actions.appendChild(inviteBtn);
    card.appendChild(actions);

    grid.appendChild(card);
  }
}

function renderDrawerTiers() {
  const wrap = $("drawerTiers");
  wrap.innerHTML = "";
  for (const t of CFG.tiers) {
    const access = hasAccess(t.id);
    const btn = el("button", {
      class: "drawer-item " + (access ? "unlocked" : "locked"),
      type: "button",
      onclick: () => {
        closeDrawer();
        if (access) {
          openTier(t);
        } else {
          // scroll to card + open modal
          const card = document.querySelector(`.tier-card[data-tier-id="${t.id}"]`);
          if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
          openPurchaseModal(t);
        }
      }
    }, [
      `${t.name}`,
      access ? "  ✅" : ""
    ].join(""));
    wrap.appendChild(btn);
  }
}

async function onInviteButton(tier) {
  if (hasAccess(tier.id)) return openTier(tier);

  const refs = Number((currentUser && currentUser.referrals_count) || 0);
  if (refs >= tier.invitesRequired) {
    // threshold reached but not yet claimed → ask choice
    showChoiceModal(tier);
    return;
  }
  // not enough → open purchase modal
  openPurchaseModal(tier);
}

async function openTier(tier) {
  try {
    const data = await request("claim", {
      method: "POST",
      body: JSON.stringify({ tier_id: tier.id })
    });
    window.open(data.reward_url, "_blank");
    // refresh local state
    if (!currentUser.unlocked_tiers.includes(tier.id)) {
      currentUser.unlocked_tiers = [...currentUser.unlocked_tiers, tier.id];
    }
    renderTierGrid();
    renderDrawerTiers();
  } catch (err) {
    alert(err.message);
  }
}

/* ================================================================
   CHOICE MODAL (referral threshold reached)
================================================================ */
function showChoiceModal(tier) {
  $("choiceTitle").textContent = `${tier.name} ready`;
  $("choiceMsg").textContent = `You have enough invites for ${tier.name}. Claim it for free or pay for instant access anyway.`;
  $("choiceModal").classList.remove("hidden");

  $("choiceClaim").onclick = async () => {
    $("choiceModal").classList.add("hidden");
    await openTier(tier);
  };
  $("choicePay").onclick = () => {
    $("choiceModal").classList.add("hidden");
    openPurchaseModal(tier);
  };
}
function bindChoiceClose() {
  $("choiceClose").addEventListener("click", () => $("choiceModal").classList.add("hidden"));
}

/* ================================================================
   PURCHASE MODAL
================================================================ */
function openPurchaseModal(tier) {
  activeTier = tier;
  activeCrypto = "BTC";
  $("modalTitle").textContent = `Purchase ${tier.name}`;
  $("modalMsg").textContent = "";
  $("purchaseModal").classList.remove("hidden");
  switchTab("giftcard");

  // Gift card pane
  $("gcAmount").innerHTML = `💳 Amount: $${tier.priceUSD}`;
  renderGcPlatforms();
  $("gcCode").value = "";
  updateGcCount();

  // Crypto pane
  $("cryptoAmountUSD").innerHTML = `💰 Amount: $${tier.priceUSD} USD`;
  renderCryptoTickers();
  applyCrypto(activeCrypto);
  $("cryptoTxId").value = "";
  updateCryptoTxCount();

}

function closePurchaseModal() {
  $("purchaseModal").classList.add("hidden");
  activeTier = null;
}

function switchTab(tab) {
  document.querySelectorAll(".modal-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".modal-pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== tab));
}

let selectedPlatform = null;
function renderGcPlatforms() {
  const wrap = $("gcPlatforms");
  wrap.innerHTML = "";
  selectedPlatform = null;
  for (const p of CFG.giftCardPlatforms) {
    const btn = el("button", {
      class: "platform-item", type: "button",
      onclick: () => {
        selectedPlatform = p.name;
        document.querySelectorAll(".platform-item").forEach(x => x.classList.remove("selected"));
        btn.classList.add("selected");
        if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
      }
    }, [
      el("div", {}, [
        el("strong", {}, p.name),
        el("small", {}, `$${activeTier.priceUSD} ${p.note}`)
      ]),
      el("span", { class: "arrow" }, "→")
    ]);
    wrap.appendChild(btn);
  }
}

function updateGcCount() {
  const v = $("gcCode").value.trim();
  $("gcCharCount").textContent = `• ${v.length}/14 characters minimum`;
}

function renderCryptoTickers() {
  const wrap = $("cryptoTickers");
  wrap.innerHTML = "";
  const tickers = ["BTC", "ETH", "LTC", "SOL"];
  for (const t of tickers) {
    const amount = (activeTier.priceUSD * (CFG.cryptoRates[t] || 0)).toFixed(t === "USDT" ? 2 : 8);
    const btn = el("button", {
      class: "ticker-btn" + (t === activeCrypto ? " active" : ""),
      type: "button",
      onclick: () => { activeCrypto = t; applyCrypto(t); renderCryptoTickers(); }
    }, [t, el("small", {}, amount)]);
    wrap.appendChild(btn);
  }
}

function applyCrypto(t) {
  const amount = (activeTier.priceUSD * (CFG.cryptoRates[t] || 0)).toFixed(t === "USDT" ? 2 : 8);
  $("cryptoAmountCrypto").textContent = amount;
  $("cryptoAmountTicker").textContent = t;
  $("cryptoAddrLabel").textContent = `${cryptoFullName(t)} Address:`;
  $("cryptoAddr").value = CFG.crypto[t] || "";
  $("cryptoWarn").innerHTML = `Send exactly <b>${amount} ${t} ($${activeTier.priceUSD} USD)</b>`;
}

function cryptoFullName(t) {
  return ({ BTC: "Bitcoin", ETH: "Ethereum", LTC: "Litecoin", SOL: "Solana", USDT: "USDT (ERC-20)" })[t] || t;
}

function updateCryptoTxCount() {
  const v = $("cryptoTxId").value.trim();
  $("cryptoTxCount").textContent = `• ${v.length} characters`;
}

async function copyToClipboard(text, msgEl) {
  try {
    await navigator.clipboard.writeText(text);
    if (msgEl) msgEl.textContent = "Copied!";
    setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 1300);
  } catch {}
}

async function submitGiftCard() {
  if (!activeTier) return;
  if (!selectedPlatform) return setModalMsg("Choose a platform first.", true);
  const code = $("gcCode").value.trim();
  if (code.length < 14) return setModalMsg("Code must be at least 14 characters.", true);

  await submitPurchase({
    tier_id: activeTier.id,
    method: "giftcard",
    giftcard_platform: selectedPlatform,
    giftcard_code: code
  });
}

async function submitCrypto() {
  if (!activeTier) return;
  const txId = $("cryptoTxId").value.trim();
  if (txId.length < 10) return setModalMsg("Transaction ID looks too short.", true);

  const amount = (activeTier.priceUSD * (CFG.cryptoRates[activeCrypto] || 0)).toString();
  await submitPurchase({
    tier_id: activeTier.id,
    method: "crypto",
    crypto_currency: activeCrypto,
    crypto_amount: amount,
    tx_id: txId
  });
}

async function submitPurchase(payload) {
  setModalMsg("Submitting…");
  try {
    const data = await request("purchase", { method: "POST", body: JSON.stringify(payload) });
    setModalMsg(data.message || "Submitted. Waiting for review.", false);
    setTimeout(() => closePurchaseModal(), 2200);
  } catch (err) {
    setModalMsg(err.message, true);
  }
}

function setModalMsg(text, error = false) {
  const m = $("modalMsg");
  m.textContent = text;
  m.className = error ? "msg error" : "msg success";
}

/* ================================================================
   DRAWER
================================================================ */
function openDrawer() {
  $("drawer").classList.remove("hidden");
  $("drawerBackdrop").classList.remove("hidden");
}
function closeDrawer() {
  $("drawer").classList.add("hidden");
  $("drawerBackdrop").classList.add("hidden");
}

function bindDrawer() {
  $("drawerOpen").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);

  document.querySelectorAll(".drawer-item[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleDrawerAction(btn.dataset.action));
  });
}

function handleDrawerAction(action) {
  closeDrawer();
  switch (action) {
    case "home":
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "preview": {
      // Always open Tier 1's link as the "Preview" sample
      const tier1 = CFG.tiers[0];
      if (tier1 && tier1.unlockUrl) window.open(tier1.unlockUrl, "_blank");
      break;
    }
    case "menu":
      document.querySelector(".tier-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "more-videos":
      document.querySelector(".tier-grid")?.scrollIntoView({ behavior: "smooth" });
      break;
    case "invites":
      document.querySelector(".referral-card")?.scrollIntoView({ behavior: "smooth" });
      break;
    case "reviews":
      alert("Reviews section is coming soon.");
      break;
    case "support":
      window.open(CFG.telegramBot, "_blank");
      break;
    case "logout":
      localStorage.removeItem("token");
      window.location.reload();
      break;
  }
}

/* ================================================================
   COPY LINK + GENERIC BIND
================================================================ */
function bindStaticUI() {
  $("copyLinkBtn").addEventListener("click", async () => {
    await copyToClipboard($("refLink").value, $("copyMsg"));
  });

  // modal binds
  $("modalClose").addEventListener("click", closePurchaseModal);
  document.querySelectorAll(".modal-tab").forEach(b =>
    b.addEventListener("click", () => switchTab(b.dataset.tab))
  );
  $("gcCode").addEventListener("input", updateGcCount);
  $("gcSubmit").addEventListener("click", submitGiftCard);

  $("cryptoTxId").addEventListener("input", updateCryptoTxCount);
  $("cryptoCopy").addEventListener("click", () => copyToClipboard($("cryptoAddr").value, $("modalMsg")));
  $("cryptoRefresh").addEventListener("click", () => { renderCryptoTickers(); applyCrypto(activeCrypto); });
  $("cryptoSubmit").addEventListener("click", submitCrypto);

  bindChoiceClose();
}

/* ================================================================
   STARFIELD
================================================================ */
function initBackground() {
  const canvas = $("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0, height = 0, stars = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = Math.min(140, Math.max(60, Math.floor((width * height) / 11000)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      r: Math.random() * 1.6 + .35, d: Math.random() * .65 + .08
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (const s of stars) {
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      s.y += s.d;
      if (s.y > height) { s.y = 0; s.x = Math.random() * width; }
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  draw();
}

/* ================================================================
   FLOATING TELEGRAM SERVER
================================================================ */
function initTelegramFloat() {
  const link = $("tgServerFloat");
  if (link && CFG.telegramServer) link.href = CFG.telegramServer;
}

/* ================================================================
   BOOT
================================================================ */
initBackground();
initTelegramFloat();
bindDrawer();
bindStaticUI();
initAuth();
