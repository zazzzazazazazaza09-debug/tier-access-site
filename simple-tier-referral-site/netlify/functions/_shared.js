const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  return process.env.JWT_SECRET;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
}

function verifyAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  return jwt.verify(header.replace("Bearer ", ""), getJwtSecret());
}

function makeReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

module.exports = {
  json,
  getSupabase,
  signToken,
  verifyAuth,
  makeReferralCode
};
