// Sends a notification to the admin's Telegram via the Bot API.
// Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as Vercel env vars.
// If either is missing, this silently no-ops so the rest of the
// request (purchase, custom order, etc.) is never affected.

async function notifyAdmin(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Telegram notify failed:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Telegram notify error:", err.message);
    return false;
  }
}

module.exports = { notifyAdmin };
