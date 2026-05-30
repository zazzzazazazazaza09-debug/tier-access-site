const API = "/api";
let captchaA = 0;
let captchaB = 0;
let currentUser = null;
const params = new URLSearchParams(window.location.search);
const refFromUrl = params.get("ref");
function $(id) { return document.getElementById(id); }
function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}
function showEntryMessage(text, error = false) {
  $("entryMsg").textContent = text;
  $("entryMsg").style.color = error ? "#ff9aa8" : "#a7f3d0";
}
function createCaptcha() {
  captchaA = Math.floor(Math.random() * 8) + 2;
  captchaB = Math.floor(Math.random() * 8) + 2;
  $("captchaQuestion").textContent = `${captchaA} + ${captchaB}`;
}
async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function openTelegram() { window.open("https://t.me/Nonaxionbot", "_blank"); }
if (refFromUrl) {
  $("refNotice").classList.remove("hidden");
  $("refNotice").textContent = `Referral detected: ${refFromUrl}`;
}
$("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const username = $("username").value.trim();
    const password = $("password").value;
    const captchaAnswer = $("captchaAnswer").value.trim();
    const honeypot = $("website").value;
    if (username.length < 3) throw new Error("Name must be at least 3 letters.");
    if (password.length < 4) throw new Error("Password must be at least 4 characters.");
    const data = await request("enter", {
      method: "POST",
      body: JSON.stringify({ username, password, ref: refFromUrl, device_id: getDeviceId(), captchaA, captchaB, captchaAnswer, honeypot })
    });
    localStorage.setItem("token", data.token);
    await loadMe();
    if (data.referral_message) setTimeout(() => alert(data.referral_message), 300);
  } catch (err) {
    showEntryMessage(err.message, true);
    createCaptcha();
  }
});
async function loadMe() {
  const data = await request("me");
  currentUser = data.user;
  $("entryPage").classList.add("hidden");
  $("panelPage").classList.remove("hidden");
  $("welcomeName").textContent = currentUser.username;
  const link = `${window.location.origin}${window.location.pathname}?ref=${currentUser.referral_code}`;
  $("refLink").value = link;
  const count = Number(currentUser.referrals_count || 0);
  const needed = Math.max(0, 5 - count);
  const pct = Math.min(100, (count / 5) * 100);
  $("bar").style.width = `${pct}%`;
  $("progressText").textContent = `${count} / 5`;
  $("totalRefs").textContent = count;
  $("neededRefs").textContent = needed;
  if (currentUser.reward_unlocked) {
    $("rewardBox").classList.remove("locked");
    $("rewardBox").classList.add("unlocked");
    $("rewardTitle").textContent = "Tier 1 unlocked";
    $("rewardText").textContent = "You reached 5 referrals. Open Telegram Bot to access Tier 1.";
    $("rewardBtn").classList.remove("hidden");
  } else {
    $("rewardBox").classList.add("locked");
    $("rewardBox").classList.remove("unlocked");
    $("rewardTitle").textContent = "Tier 1 locked";
    $("rewardText").textContent = `You need ${needed} more referral(s) to unlock Tier 1.`;
    $("rewardBtn").classList.add("hidden");
  }
}
async function copyLink() {
  await navigator.clipboard.writeText($("refLink").value);
  $("copyMsg").textContent = "Copied!";
  setTimeout(() => $("copyMsg").textContent = "", 1500);
}
async function claimReward() {
  try {
    const data = await request("claim", { method: "POST" });
    window.open(data.reward_url, "_blank");
  } catch (err) { alert(err.message); }
}
function logout() { localStorage.removeItem("token"); location.reload(); }
const canvas = $("bgCanvas");
const ctx = canvas.getContext("2d");
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener("resize", resize);
let stars = Array.from({ length: 130 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.6, d: Math.random() * 0.75 + 0.1 }));
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    s.y += s.d;
    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
  });
  requestAnimationFrame(animate);
}
animate();
createCaptcha();
if (localStorage.getItem("token")) {
  loadMe().catch(() => { localStorage.removeItem("token"); });
}
