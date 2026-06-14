function makeReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function send(res, status, body) {
  return res.status(status).json(body);
}

// Escapes text for safe use inside Telegram HTML-formatted messages
// (and anywhere else a basic HTML escape is needed).
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { makeReferralCode, send, escapeHtml };
