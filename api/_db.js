const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

function getSupabase() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !url.startsWith("https://")) throw new Error("Invalid SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket }
  });
}
module.exports = { getSupabase };
