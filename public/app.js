const API = "/api";

let captchaA = 0;
let captchaB = 0;
let currentUser = null;
let authMode = "login";

const params = new URLSearchParams(window.location.search);
const refFromUrl = params.get("ref");

function $(id) {
  return document.getElementById(id);
}

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");

  if (!deviceId) {
    deviceId = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem("device_id", deviceId);
  }

  return deviceId;
}

function setEntryMessage(text, error = false) {
  $("entryMsg").textContent = text;
  $("entryMsg").className = error ? "msg error" : "msg success";
}

function createCaptcha() {
  captchaA = Math.floor(Math.random() * 8) + 2;
  captchaB = Math.floor(Math.random() * 8) + 2;
  $("captchaQuestion").textContent = `${captchaA} + ${captchaB}`;
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

  if (isSignup) {
    createCaptcha();
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API}/${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Server error");
  }

  return data;
}

function openTelegram() {
  window.open("https://t.me/Nonaxionbot", "_blank");
}

async function loadMe() {
  const data = await request("me");
  currentUser = data.user;

  $("entryPage").classList.add("hidden");
  $("panelPage").classList.remove("hidden");
  $("welcomeName").textContent = `Welcome, ${currentUser.username}`;

  const link = `${window.location.origin}${window.location.pathname}?ref=${currentUser.referral_code}`;
  $("refLink").value = link;

  const count = Number(currentUser.referrals_count || 0);
  const needed = Math.max(0, 5 - count);
  const pct = Math.min(100, (count / 5) * 100);

  $("bar").style.width = `${pct}%`;
  $("progressText").textContent = `${count} / 5`;

  if (currentUser.reward_unlocked) {
    $("rewardTitle").textContent = "Tier 1 unlocked";
    $("rewardText").textContent = "Access is live. Open your Tier 1 content now.";
    $("rewardBtn").classList.remove("hidden");
  } else {
    $("rewardTitle").textContent = "Referral lock active";
    $("rewardText").textContent = `You need ${needed} more referral${needed > 1 ? "s" : ""} to unlock Tier 1.`;
    $("rewardBtn").classList.add("hidden");
  }
}

async function copyLink() {
  await navigator.clipboard.writeText($("refLink").value);
  $("copyMsg").textContent = "Link copied.";
  setTimeout(() => {
    $("copyMsg").textContent = "";
  }, 1500);
}

async function claimReward() {
  try {
    const data = await request("claim", { method: "POST" });
    window.open(data.reward_url, "_blank");
  } catch (err) {
    alert(err.message);
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.reload();
}

function initAuth() {
  if (!$("entryForm")) {
    return;
  }

  if (refFromUrl) {
    $("refNotice").classList.remove("hidden");
    $("refNotice").textContent = "Referral link detected. Create an account to validate it.";
    setMode("signup");
  }

  $("loginTab").addEventListener("click", () => setMode("login"));
  $("signupTab").addEventListener("click", () => setMode("signup"));

  $("entryForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const username = $("username").value.trim();
      const password = $("password").value;

      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }

      if (password.length < 4) {
        throw new Error("Password must be at least 4 characters.");
      }

      const body = { username, password };

      if (authMode === "signup") {
        body.ref = refFromUrl;
        body.device_id = getDeviceId();
        body.captchaA = captchaA;
        body.captchaB = captchaB;
        body.captchaAnswer = $("captchaAnswer").value.trim();
        body.honeypot = $("website").value;
      }

      const data = await request(authMode === "signup" ? "enter" : "login", {
        method: "POST",
        body: JSON.stringify(body)
      });

      localStorage.setItem("token", data.token);
      await loadMe();

      if (data.referral_message) {
        alert(data.referral_message);
      }
    } catch (err) {
      setEntryMessage(err.message, true);

      if (authMode === "signup") {
        createCaptcha();
      }
    }
  });

  setMode(authMode);

  if (localStorage.getItem("token")) {
    loadMe().catch(() => {
      localStorage.removeItem("token");
    });
  }
}

function initBackground() {
  const canvas = $("bgCanvas");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let points = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = Math.min(90, Math.max(42, Math.floor((width * height) / 18000)));

    points = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - .5) * .32,
      vy: (Math.random() - .5) * .32,
      r: Math.random() * 1.6 + .6
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(99, 244, 255, .72)";
    ctx.strokeStyle = "rgba(99, 244, 255, .12)";
    ctx.lineWidth = 1;

    for (const point of points) {
      point.x += point.vx;
      point.y += point.vy;

      if (point.x < 0 || point.x > width) point.vx *= -1;
      if (point.y < 0 || point.y > height) point.vy *= -1;

      ctx.beginPath();
      ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 125) {
          ctx.globalAlpha = 1 - distance / 125;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;

    if (!prefersReducedMotion) {
      requestAnimationFrame(draw);
    }
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

initBackground();
initAuth();
