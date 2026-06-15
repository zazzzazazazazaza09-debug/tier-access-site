/* eslint-disable */
const API = "/api";
const CFG = window.SITE_CONFIG;

let captchaA = 0, captchaB = 0, captchaOp = "+";
let currentUser = null;
let authMode = "signup";          // signup-first
let serverTiers = [];             // [{id,hasAccess,unlockUrl?}]
let activeTier = null;            // tier or custom pseudo-tier in modal
let activeCrypto = "BTC";
let selectedCustomPack = null;    // category id
let selectedCustomSize = null;    // size id
let activeChatOrderId = null;
let chatPollTimer = null;
let myOpenOrders = [];
let orderPollTimer = null;
let heartbeatTimer = null;

// ── Notification / unread tracking ──────────────────────────────
let notifQueue = [];              // fake notifs waiting to be shown
let notifShown = [];              // notifs already displayed
let notifQueueTimer = null;
let unreadChatOrderIds = new Set(); // order IDs with unread admin messages
let lastSeenMsgIds = {};          // { orderId: lastMsgId } seen by user

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
   USER COUNT BADGE
================================================================ */
function formatUserCount(n) {
  n = Number(n) || 0;
  if (n >= 1000) {
    const k = n / 1000;
    return (k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")) + "k";
  }
  return String(n);
}

async function loadUserCount() {
  try {
    const data = await request("stats");
    const label = `👥 ${formatUserCount(data.users)} users`;
    const a = $("userCountPill");
    const b = $("userCountPillMini");
    if (a) a.textContent = label;
    if (b) b.textContent = label;
  } catch (_) {}
}

/* ================================================================
   MICRO-INTERACTIONS — 3D tilt + click ripple
================================================================ */
function initTiltEffect() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none)").matches) return;

  const SEL = ".main-btn,.ghost-btn,.btn-buy,.btn-invites,.tier-card,.icon-btn,.tab,.modal-tab," +
    ".custom-cat-btn,.custom-size-btn,.ticker-btn,.platform-item,.share-platform," +
    ".share-action-btn,.share-guide-btn,.chat-float-btn,.drawer-item,.pill,.pill-mini,.panel-tab";

  let current = null;

  document.addEventListener("mousemove", (e) => {
    const target = e.target.closest(SEL);
    if (target !== current) {
      if (current) {
        current.style.removeProperty("--tiltX");
        current.style.removeProperty("--tiltY");
      }
      current = target;
    }
    if (!target) return;
    const r = target.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    target.style.setProperty("--tiltX", `${(-py * 10).toFixed(2)}deg`);
    target.style.setProperty("--tiltY", `${(px * 10).toFixed(2)}deg`);
  });

  document.addEventListener("mouseleave", () => {
    if (current) {
      current.style.removeProperty("--tiltX");
      current.style.removeProperty("--tiltY");
      current = null;
    }
  }, true);
}

function initClickRipple() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - size / 2}px`;
    ripple.style.top = `${e.clientY - size / 2}px`;
    document.body.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
}

/* ================================================================
   PANEL TABS (declutter — group sections)
================================================================ */
function switchPanelTab(name) {
  document.querySelectorAll(".panel-tab").forEach(b =>
    b.classList.toggle("active", b.dataset.section === name)
  );
  document.querySelectorAll(".panel-section").forEach(s => {
    const match = s.dataset.section === name;
    s.classList.toggle("hidden", !match);
    if (match) {
      s.classList.remove("panel-section-in");
      requestAnimationFrame(() => s.classList.add("panel-section-in"));
    }
  });
}

function initPanelTabs() {
  document.querySelectorAll(".panel-tab").forEach(btn => {
    btn.addEventListener("click", () => switchPanelTab(btn.dataset.section));
  });
}

/* ================================================================
   AUTH
================================================================ */
function setEntryMessage(text, error = false) {
  $("entryMsg").textContent = text;
  $("entryMsg").className = error ? "msg error" : "msg success";
}

function createCaptcha() {
  // Keep it to small additions only — easy for real users, still
  // enough to stop trivial bots.
  captchaOp = "+";
  captchaA = Math.floor(Math.random() * 9) + 1; // 1-9
  captchaB = Math.floor(Math.random() * 9) + 1; // 1-9
  $("captchaQuestion").textContent = `${captchaA} ${captchaOp} ${captchaB} = ?`;
}

function captchaExpected() {
  return captchaA + captchaB;
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

      if (authMode === "signup") {
        showWelcomeAnimation(currentUser.username, data.referral_message);
      } else if (data.referral_message) {
        showFlash(data.referral_message);
      }
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

  const link = `${window.location.origin}/?invite=${currentUser.referral_code}`;
  $("refLink").value = link;

  const count = Number(currentUser.referrals_count || 0);
  $("totalRefs").textContent = count;

  const nextTier = CFG.tiers.find(t => count < t.invitesRequired && !hasAccess(t.id));
  const badge = $("nextTierBadge");
  if (nextTier) {
    const left = nextTier.invitesRequired - count;
    badge.textContent = `🎯 ${left} more invites to unlock ${nextTier.name}`;
  } else {
    badge.textContent = `🎉 All free unlock thresholds reached`;
  }

  const tg = $("telegramAlt");
  if (tg) tg.href = CFG.telegramBot;

  renderTierGrid();
  renderDrawerTiers();
  initCustomPack();
  initNotifications();
  startOrderPoll();
  startHeartbeat();
}

function hasAccess(tierId) {
  if (currentUser && Array.isArray(currentUser.unlocked_tiers) && currentUser.unlocked_tiers.includes(tierId)) return true;
  const s = serverTiers.find(x => x.id === tierId);
  if (s && s.hasAccess) return true;
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
          switchPanelTab("tiers");
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
    showChoiceModal(tier);
    return;
  }
  openPurchaseModal(tier);
}

async function openTier(tier) {
  // Open a blank tab synchronously (still inside the click gesture) so mobile
  // browsers (iOS Safari / Chrome Android) don't block the popup. We redirect
  // this tab to the real reward URL once the claim request resolves.
  const win = window.open("", "_blank");
  try {
    const data = await request("claim", {
      method: "POST",
      body: JSON.stringify({ tier_id: tier.id })
    });
    if (win && !win.closed) {
      win.location.href = data.reward_url;
    } else {
      // Popup got blocked anyway — fall back to same-tab navigation.
      window.location.href = data.reward_url;
    }
    if (!currentUser.unlocked_tiers.includes(tier.id)) {
      currentUser.unlocked_tiers = [...currentUser.unlocked_tiers, tier.id];
    }
    renderTierGrid();
    renderDrawerTiers();
  } catch (err) {
    if (win && !win.closed) win.close();
    alert(err.message);
  }
}

/* ================================================================
   CHOICE MODAL
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
  switchTab("crypto");

  $("gcAmount").innerHTML = `💳 Amount: $${tier.priceUSD}`;
  renderGcPlatforms();
  $("gcCode").value = "";
  updateGcCount();

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

function purchasePayload(method, extra) {
  const base = { method, ...extra };
  if (activeTier.isCustom) {
    base.is_custom = true;
    base.custom_pack_id = activeTier.packId;
    base.custom_size_id = activeTier.sizeId;
  } else {
    base.tier_id = activeTier.id;
  }
  return base;
}

async function submitGiftCard() {
  if (!activeTier) return;
  if (!selectedPlatform) return setModalMsg("Choose a platform first.", true);
  const code = $("gcCode").value.trim();
  if (code.length < 14) return setModalMsg("Code must be at least 14 characters.", true);

  await submitPurchase(purchasePayload("giftcard", {
    giftcard_platform: selectedPlatform,
    giftcard_code: code
  }));
}

async function submitCrypto() {
  if (!activeTier) return;
  const txId = $("cryptoTxId").value.trim();
  if (txId.length < 10) return setModalMsg("Transaction ID looks too short.", true);

  const amount = (activeTier.priceUSD * (CFG.cryptoRates[activeCrypto] || 0)).toString();
  await submitPurchase(purchasePayload("crypto", {
    crypto_currency: activeCrypto,
    crypto_amount: amount,
    tx_id: txId
  }));
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
      switchPanelTab("tiers");
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "preview": {
      window.open(
        "https://mega.nz/folder/dyUkiRyD#ooS0qN64DOXkSuli8BXL1A",
        "_blank",
        "noopener,noreferrer"
      );
      break;
    }
    case "menu":
      switchPanelTab("custom");
      document.getElementById("customPackSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "more-videos":
      switchPanelTab("custom");
      document.getElementById("customPackSection")?.scrollIntoView({ behavior: "smooth" });
      break;
    case "invites":
      switchPanelTab("invites");
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
   CUSTOM PACK BUILDER
================================================================ */
function getCustomPriceEntry(packId, sizeId) {
  const cp = CFG.customPack;
  if (!cp || !cp.prices) return null;
  return cp.prices[packId]?.[sizeId] || null;
}

function updateCustomPriceDisplay() {
  const origEl = $("customPriceOriginal");
  const curEl = $("customPriceCurrent");
  const buyBtn = $("customBuyBtn");
  if (!selectedCustomPack || !selectedCustomSize) {
    origEl.textContent = "";
    curEl.textContent = "$—";
    buyBtn.disabled = true;
    return;
  }
  const entry = getCustomPriceEntry(selectedCustomPack, selectedCustomSize);
  if (!entry) {
    origEl.textContent = "";
    curEl.textContent = "$—";
    buyBtn.disabled = true;
    return;
  }
  origEl.textContent = entry.original > entry.price ? `$${entry.original}` : "";
  curEl.textContent = `$${entry.price}`;
  buyBtn.disabled = false;
  buyBtn.textContent = `💳 Buy custom pack · $${entry.price}`;
}

function initCustomPack() {
  const cp = CFG.customPack;
  if (!cp || !$("customPackSection")) return;

  $("customPackTitle").textContent = cp.title || "Custom Pack";
  $("customPackSub").textContent = cp.subtitle || "";

  selectedCustomPack = cp.categories[0]?.id || null;
  selectedCustomSize = cp.sizes.find(s => s.popular)?.id || cp.sizes[0]?.id || null;

  renderCustomCategories();
  renderCustomSizes();
  updateCustomPriceDisplay();

  $("customBuyBtn").addEventListener("click", () => {
    if (!selectedCustomPack || !selectedCustomSize) return;
    const entry = getCustomPriceEntry(selectedCustomPack, selectedCustomSize);
    const cat = cp.categories.find(c => c.id === selectedCustomPack);
    const size = cp.sizes.find(s => s.id === selectedCustomSize);
    if (!entry || !cat || !size) return;
    openPurchaseModal({
      isCustom: true,
      packId: cat.id,
      sizeId: size.id,
      name: `Custom · ${cat.name} · ${size.label}`,
      priceUSD: entry.price
    });
  });

  $("customRequestBtn").addEventListener("click", openCustomOrderModal);
  $("customOrderClose").addEventListener("click", () => $("customOrderModal").classList.add("hidden"));
  $("customOrderSubmit").addEventListener("click", submitCustomOrder);
  $("chatClose").addEventListener("click", closeChatModal);
  $("chatSend").addEventListener("click", sendChatMessage);
  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

function renderCustomCategories() {
  const wrap = $("customCategories");
  const cp = CFG.customPack;
  if (!wrap || !cp) return;
  wrap.innerHTML = "";
  for (const c of cp.categories) {
    const btn = el("button", {
      class: "custom-cat-btn" + (selectedCustomPack === c.id ? " active" : ""),
      type: "button",
      onclick: () => {
        selectedCustomPack = c.id;
        renderCustomCategories();
        updateCustomPriceDisplay();
      }
    }, [
      el("strong", {}, c.name),
      el("small", {}, c.desc || "")
    ]);
    if (c.color) btn.dataset.color = c.color;
    wrap.appendChild(btn);
  }
}

function renderCustomSizes() {
  const wrap = $("customSizes");
  const cp = CFG.customPack;
  if (!wrap || !cp) return;
  wrap.innerHTML = "";
  for (const s of cp.sizes) {
    const btn = el("button", {
      class: "custom-size-btn" + (selectedCustomSize === s.id ? " active" : ""),
      type: "button",
      onclick: () => {
        selectedCustomSize = s.id;
        renderCustomSizes();
        updateCustomPriceDisplay();
      }
    }, s.label);
    if (s.popular) {
      const tag = el("span", { class: "size-tag popular" }, "Most popular");
      btn.appendChild(tag);
    }
    if (s.mega) {
      const tag = el("span", { class: "size-tag mega" }, "MEGA");
      btn.appendChild(tag);
    }
    wrap.appendChild(btn);
  }
}

/* ================================================================
   CUSTOM ORDER + CHAT
================================================================ */
async function openCustomOrderModal() {
  $("customOrderModal").classList.remove("hidden");
  $("customOrderMsg").textContent = "";
  $("customOrderText").value = "";
  await loadMyCustomOrders();
}

async function submitCustomOrder() {
  const message = $("customOrderText").value.trim();
  if (message.length < 10) {
    $("customOrderMsg").textContent = "Please write at least 10 characters.";
    $("customOrderMsg").className = "msg error";
    return;
  }
  $("customOrderMsg").textContent = "Sending…";
  try {
    const data = await request("custom-order", {
      method: "POST",
      body: JSON.stringify({ message })
    });
    $("customOrderMsg").textContent = data.message || "Sent!";
    $("customOrderMsg").className = "msg success";
    $("customOrderText").value = "";
    setTimeout(() => {
      $("customOrderModal").classList.add("hidden");
    }, 1200);
    await loadMyCustomOrders();
    startOrderPoll();
  } catch (err) {
    $("customOrderMsg").textContent = err.message;
    $("customOrderMsg").className = "msg error";
  }
}

async function loadMyCustomOrders() {
  const wrap = $("myCustomOrders");
  if (!wrap) return;
  wrap.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const data = await request("custom-orders");
    const orders = data.orders || [];
    if (!orders.length) {
      wrap.innerHTML = "<p class='muted'>No conversations yet.</p>";
      return;
    }
    wrap.innerHTML = "";
    for (const o of orders) {
      const hasUnread = unreadChatOrderIds.has(o.id);
      const btn = el("button", {
        class: "custom-order-item" + (hasUnread ? " has-unread" : ""),
        type: "button",
        onclick: () => openChatModal(o.id)
      }, [
        el("span", { class: "co-status " + o.status }, o.status),
        el("span", { class: "co-preview" }, (o.initial_message || "").slice(0, 80)),
        ...(hasUnread ? [el("span", { class: "co-unread-badge" }, "●")] : [])
      ]);
      wrap.appendChild(btn);
    }
  } catch (err) {
    wrap.innerHTML = `<p class='msg error'>${err.message}</p>`;
  }
}

function closeChatModal() {
  $("chatModal").classList.add("hidden");
  if (activeChatOrderId) {
    // Mark this order as read when closing
    unreadChatOrderIds.delete(activeChatOrderId);
    updateNotifBellFromChat();
  }
  activeChatOrderId = null;
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

async function loadChatMessages(silent) {
  if (!activeChatOrderId) return;
  try {
    const data = await request(`custom-messages?order_id=${encodeURIComponent(activeChatOrderId)}`);
    const msgs = data.messages || [];
    const box = $("chatMessages");
    box.innerHTML = "";

    for (const m of msgs) {
      const bubble = el("div", {
        class: "chat-bubble " + (m.is_admin ? "admin" : "user")
      }, m.content);
      const time = el("div", { class: "chat-time" }, formatTime(m.created_at));
      const wrap = el("div", { class: "chat-line " + (m.is_admin ? "admin" : "user") }, [bubble, time]);
      box.appendChild(wrap);
    }

    // Track last seen message for unread detection
    if (msgs.length > 0) {
      lastSeenMsgIds[activeChatOrderId] = msgs[msgs.length - 1].id;
      // Opening/viewing the chat = mark as read
      unreadChatOrderIds.delete(activeChatOrderId);
      updateNotifBellFromChat();
    }

    // Show agreed price + pay button if admin set a price
    const agreedPrice = data.agreed_price;
    const payBar = $("chatPayBar");
    if (payBar) payBar.remove();

    if (agreedPrice && agreedPrice > 0) {
      const bar = el("div", { class: "chat-pay-bar", id: "chatPayBar" }, [
        el("div", { class: "chat-pay-info" }, [
          el("strong", {}, `Agreed price: $${agreedPrice}`),
          el("span", { class: "muted" }, "Click below to proceed with payment")
        ]),
        el("button", {
          class: "main-btn chat-pay-btn", type: "button",
          onclick: () => {
            closeChatModal();
            openPurchaseModal({
              isCustom: true,
              packId: 0,
              sizeId: "custom_order",
              name: "Custom Order",
              priceUSD: agreedPrice
            });
          }
        }, `💳 Pay $${agreedPrice}`)
      ]);
      box.parentElement.insertBefore(bar, box.nextSibling);
    }

    box.scrollTop = box.scrollHeight;
  } catch (err) {
    if (!silent) $("chatMsg").textContent = err.message;
  }
}

async function sendChatMessage() {
  if (!activeChatOrderId) return;
  const content = $("chatInput").value.trim();
  if (!content) return;
  try {
    await request("custom-messages", {
      method: "POST",
      body: JSON.stringify({ order_id: activeChatOrderId, content })
    });
    $("chatInput").value = "";
    await loadChatMessages();
  } catch (err) {
    $("chatMsg").textContent = err.message;
    $("chatMsg").className = "msg error";
  }
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ================================================================
   FLOATING CHAT INDICATOR + ORDER POLLING
================================================================ */
function startOrderPoll() {
  if (orderPollTimer) clearInterval(orderPollTimer);
  pollMyOrders();
  orderPollTimer = setInterval(pollMyOrders, 10000);
}

async function pollMyOrders() {
  if (!currentUser) return;
  try {
    const data = await request("custom-orders");
    const newOrders = data.orders || [];

    // Detect new admin messages (unread) for each order
    for (const o of newOrders) {
      if (o.status !== "open") continue;
      // Fetch messages to check for new admin replies
      try {
        const msgData = await request(`custom-messages?order_id=${encodeURIComponent(o.id)}`);
        const msgs = msgData.messages || [];
        if (!msgs.length) continue;

        const lastMsg = msgs[msgs.length - 1];
        const prevLastId = lastSeenMsgIds[o.id];

        // If there's a new message from admin AND the chat is not currently open
        if (lastMsg.is_admin && lastMsg.id !== prevLastId && activeChatOrderId !== o.id) {
          // Only mark unread if we've seen this order before (not first load)
          if (prevLastId !== undefined) {
            unreadChatOrderIds.add(o.id);
          } else {
            // First load - just record the last msg id without marking unread
            lastSeenMsgIds[o.id] = lastMsg.id;
          }
        }
      } catch (_) {}
    }

    myOpenOrders = newOrders;
    renderChatFloat();
    updateNotifBellFromChat();
  } catch (_) {}
}

/* Update the bell badge count based on unread chat messages */
function updateNotifBellFromChat() {
  const dot = $("notifDot");
  const count = unreadChatOrderIds.size;
  if (!dot) return;

  if (count > 0) {
    dot.textContent = count > 9 ? "9+" : String(count);
    dot.classList.add("has-count");
  } else {
    // Keep dot visible for fake activity (just without count)
    dot.textContent = "";
    dot.classList.remove("has-count");
  }
}

function renderChatFloat() {
  let wrap = $("chatFloatWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "chatFloatWrap";
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = "";
  const openOrders = myOpenOrders.filter(o => o.status === "open");
  if (!openOrders.length) return;

  for (const o of openOrders) {
    const hasPrice = o.agreed_price && o.agreed_price > 0;
    const hasUnread = unreadChatOrderIds.has(o.id);
    const btn = el("button", {
      class: "chat-float-btn" + (hasPrice ? " has-price" : "") + (hasUnread ? " has-unread" : ""),
      type: "button",
      onclick: () => openChatModal(o.id)
    }, [
      el("span", { class: "chat-float-icon" }, hasPrice ? "💳" : "💬"),
      el("span", { class: "chat-float-text" }, hasPrice ? `Pay $${o.agreed_price}` : "Chat"),
      el("span", { class: "chat-float-dot" }),
      ...(hasUnread ? [el("span", { class: "chat-float-unread" }, "!")] : [])
    ]);
    wrap.appendChild(btn);
  }
}

async function openChatModal(orderId) {
  activeChatOrderId = orderId;
  // Mark as read immediately when opening
  unreadChatOrderIds.delete(orderId);
  updateNotifBellFromChat();
  renderChatFloat();

  $("chatModal").classList.remove("hidden");
  $("chatMsg").textContent = "";
  $("chatInput").value = "";
  $("chatTitle").textContent = "Custom order";
  $("chatSub").textContent = "Reply here — we usually answer within minutes.";
  await loadChatMessages();
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(() => loadChatMessages(true), 8000);
}

/* ================================================================
   PRESENCE HEARTBEAT (admin "online now" stat)
================================================================ */
function startHeartbeat() {
  sendHeartbeat();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(sendHeartbeat, 60000);

  // Send one extra heartbeat when the tab becomes visible again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sendHeartbeat();
  });
}

async function sendHeartbeat() {
  try { await request("heartbeat", { method: "POST" }); } catch (_) {}
}

/* ================================================================
   NOTIFICATIONS (activity feed — live stream effect)
================================================================ */
const FAKE_NAMES = [
  "mike92", "sarah_k", "joshT", "emma.w", "liam_x", "nina_07", "alexM", "zoey99",
  "carlos_r", "mia_b", "noah_22", "lilyrose", "tylerJ", "ava_s", "ethan_p", "chloe_v"
];
const PACK_LABELS = ["Pack 1", "Pack 2", "Pack 3", "Pack 4", "Pack 5", "Pack 6", "Tier 2", "Tier 4"];
const SIZE_LABELS = ["25 GB", "50 GB", "100 GB", "250 GB", "500 GB", "1 TB", "5 TB"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateOneNotif() {
  const types = ["purchase", "invite", "custom"];
  const name = randomItem(FAKE_NAMES);
  const type = randomItem(types);
  const mins = Math.floor(Math.random() * 55) + 1;
  let text = "";
  if (type === "purchase") {
    const pack = randomItem(PACK_LABELS);
    const size = randomItem(SIZE_LABELS);
    text = `<b>${name}</b> purchased ${pack} · ${size}`;
  } else if (type === "invite") {
    const n = Math.floor(Math.random() * 8) + 3;
    text = `<b>${name}</b> invited ${n} friends today`;
  } else {
    text = `<b>${name}</b> started a custom order`;
  }
  return { text, mins, icon: type === "purchase" ? "💳" : type === "invite" ? "👥" : "✏️" };
}

function addNotifToPanel(n, prepend = false) {
  const list = $("notifList");
  if (!list) return;
  const item = el("div", { class: "notif-item notif-item-new" }, [
    el("span", { class: "notif-icon" }, n.icon),
    el("div", { class: "notif-body" }, [
      el("div", { html: n.text }),
      el("small", { class: "muted" }, n.mins <= 1 ? "just now" : `${n.mins} min ago`)
    ])
  ]);

  if (prepend) {
    list.prepend(item);
    // Animate in
    requestAnimationFrame(() => item.classList.add("notif-item-visible"));
  } else {
    list.appendChild(item);
    item.classList.add("notif-item-visible");
  }

  // Keep max 40 items
  const items = list.querySelectorAll(".notif-item");
  if (items.length > 40) items[items.length - 1].remove();
}

function updateNotifDot(count) {
  const dot = $("notifDot");
  if (!dot) return;
  // Only show fake count if no real unread chat messages
  if (unreadChatOrderIds.size === 0 && count > 0) {
    dot.textContent = count > 9 ? "9+" : String(count);
    dot.classList.add("has-count");
  }
}

function initNotifications() {
  const btn = $("notifBtn");
  const panel = $("notifPanel");
  const list = $("notifList");
  if (!btn || !panel || !list) return;

  // Pre-populate with some "older" notifs (already happened)
  const initialCount = 8;
  const initial = Array.from({ length: initialCount }, () => {
    const n = generateOneNotif();
    n.mins = Math.floor(Math.random() * 50) + 5; // 5–55 min ago
    return n;
  }).sort((a, b) => a.mins - b.mins);

  list.innerHTML = "";
  for (const n of initial) addNotifToPanel(n);

  let unseenCount = initialCount;
  updateNotifDot(unseenCount);

  let panelOpen = false;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    panel.classList.toggle("hidden", !panelOpen);
    if (panelOpen) {
      // Clear fake dot count when opening (real chat unread takes priority)
      unseenCount = 0;
      if (unreadChatOrderIds.size === 0) {
        const dot = $("notifDot");
        if (dot) { dot.textContent = ""; dot.classList.remove("has-count"); }
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!$("notifWrap").contains(e.target)) {
      panel.classList.add("hidden");
      panelOpen = false;
    }
  });

  // Stream new notifications live every 15–45 seconds
  function scheduleNext() {
    const delay = (Math.random() * 30 + 15) * 1000; // 15–45 sec
    notifQueueTimer = setTimeout(() => {
      const n = generateOneNotif();
      n.mins = Math.floor(Math.random() * 3); // 0–2 min ago (fresh)
      if (n.mins === 0) n.mins = 0; // "just now"
      addNotifToPanel(n, true); // prepend (newest on top)

      if (!panelOpen) {
        unseenCount++;
        updateNotifDot(unseenCount);
      }

      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

/* ================================================================
   SHARE GUIDE (how to share the referral link on each platform)
================================================================ */
const SHARE_PLATFORMS = [
  {
    id: "x", name: "X (Twitter)", icon: "fa-brands fa-x-twitter", type: "intent",
    url: (link, msg) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(link)}`,
    tip: "Opens a ready-made post — just hit \"Post\"."
  },
  {
    id: "telegram", name: "Telegram", icon: "fa-brands fa-telegram", type: "intent",
    url: (link, msg) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`,
    tip: "Pick a friend, group or channel to send it to."
  },
  {
    id: "reddit", name: "Reddit", icon: "fa-brands fa-reddit-alien", type: "intent",
    url: (link, msg) => `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(msg)}`,
    tip: "Post it in a relevant subreddit (check the rules first)."
  },
  {
    id: "facebook", name: "Facebook", icon: "fa-brands fa-facebook-f", type: "intent",
    url: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    tip: "Share to your feed, a group, or send it in Messenger."
  },
  {
    id: "whatsapp", name: "WhatsApp", icon: "fa-brands fa-whatsapp", type: "intent",
    url: (link, msg) => `https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}`,
    tip: "Send it to a contact, a group, or post it to your status."
  },
  {
    id: "tumblr", name: "Tumblr", icon: "fa-brands fa-tumblr", type: "intent",
    url: (link, msg) => `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent(link)}&caption=${encodeURIComponent(msg)}`,
    tip: "Reblog it or post it straight to your blog."
  },
  {
    id: "discord", name: "Discord", icon: "fa-brands fa-discord", type: "copy",
    tip: "Paste your link in a server, your DMs, or set it as your custom status."
  },
  {
    id: "tiktok", name: "TikTok", icon: "fa-brands fa-tiktok", type: "copy",
    tip: "Add it to your bio, or mention it in your video caption / comments."
  },
  {
    id: "instagram", name: "Instagram", icon: "fa-brands fa-instagram", type: "copy",
    tip: "Add it to your bio, or share it in your Story with the link sticker."
  }
];

function shareMessage() {
  return "🔥 Get free premium access — join with my invite link and unlock tiers instantly!";
}

function renderSharePlatforms() {
  const wrap = $("sharePlatforms");
  if (!wrap) return;
  wrap.innerHTML = "";

  const link = ($("refLink") && $("refLink").value) ||
    (currentUser ? `${window.location.origin}/?invite=${currentUser.referral_code}` : "");
  const msg = shareMessage();

  for (const p of SHARE_PLATFORMS) {
    const card = el("div", { class: "share-platform", data: { platform: p.id } }, [
      el("div", { class: "share-platform-head" }, [
        el("span", { class: "share-platform-icon" }, [
          el("i", { class: p.icon, "aria-hidden": "true" })
        ]),
        el("strong", {}, p.name)
      ]),
      el("p", { class: "muted share-platform-tip" }, p.tip)
    ]);

    if (p.type === "intent") {
      card.appendChild(el("button", {
        class: "main-btn share-action-btn", type: "button",
        onclick: () => window.open(p.url(link, msg), "_blank", "noopener,noreferrer")
      }, `Share on ${p.name}`));
    } else {
      card.appendChild(el("button", {
        class: "ghost-btn share-action-btn", type: "button",
        onclick: async () => {
          await copyToClipboard(link, null);
          $("shareGuideMsg").textContent = `Link copied! ${p.tip}`;
          $("shareGuideMsg").className = "msg success";
        }
      }, `Copy link for ${p.name}`));
    }

    wrap.appendChild(card);
  }
}

function initShareGuide() {
  const btn = $("howToShareBtn");
  if (!btn || !$("shareGuideModal")) return;

  btn.addEventListener("click", () => {
    renderSharePlatforms();
    $("shareGuideMsg").textContent = "";
    $("shareGuideModal").classList.remove("hidden");
  });
  $("shareGuideClose").addEventListener("click", () => $("shareGuideModal").classList.add("hidden"));
}

/* ================================================================
   COPY LINK + GENERIC BIND
================================================================ */
function bindStaticUI() {
  $("copyLinkBtn").addEventListener("click", async () => {
    await copyToClipboard($("refLink").value, $("copyMsg"));
  });

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
  initShareGuide();
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
   WELCOME ANIMATION (post-signup "wow" moment)
================================================================ */
function launchConfetti() {
  const canvas = $("confettiCanvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = window.innerWidth, H = window.innerHeight;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const colors = ["#7b2ff7", "#00f5ff", "#ff5fb3", "#36e08e", "#ffd166", "#6366f1", "#ffffff"];
  const count = Math.min(220, Math.max(110, Math.floor(W / 5)));
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.7,
      y: H * 0.4 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5) * 11,
      vy: -(Math.random() * 13 + 5),
      g: 0.25 + Math.random() * 0.2,
      size: 5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 18,
      shape: Math.random() < 0.5 ? "rect" : "circle",
      life: 0,
      maxLife: 110 + Math.random() * 50
    });
  }

  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.life > p.maxLife) continue;
      alive = true;
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.rot += p.vr;
      const fadeStart = p.maxLife - 30;
      const alpha = p.life > fadeStart ? Math.max(0, (p.maxLife - p.life) / 30) : 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive && frame < 280) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, W, H);
      window.removeEventListener("resize", resize);
    }
  }
  requestAnimationFrame(tick);
}

function showWelcomeAnimation(username, message) {
  const overlay = $("welcomeOverlay");
  if (!overlay) return;

  $("welcomeUsername").textContent = username || "there";
  $("welcomeSub").textContent = message ||
    "Your account is ready. Share your link to earn free invites or unlock tiers instantly.";

  overlay.classList.remove("hidden");
  requestAnimationFrame(() => overlay.classList.add("show"));
  launchConfetti();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove("show");
    setTimeout(() => overlay.classList.add("hidden"), 400);
  };

  $("welcomeContinue").onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  setTimeout(close, 6500);
}

/* ================================================================
   BOOT
================================================================ */
initBackground();
initTelegramFloat();
bindDrawer();
bindStaticUI();
initAuth();
loadUserCount();
initTiltEffect();
initClickRipple();
initPanelTabs();
