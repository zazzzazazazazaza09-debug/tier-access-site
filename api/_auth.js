const jwt = require("jsonwebtoken");

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

function verifyAuth(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  return jwt.verify(header.replace("Bearer ", ""), getJwtSecret());
}

module.exports = { signToken, verifyAuth };
