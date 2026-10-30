const { Pool } = require("pg");

let pool;
function db() {
  if (!process.env.DATABASE_URL) {
    const e = new Error("DATABASE_URL is not configured in Vercel");
    e.status = 503;
    throw e;
  }
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000
  });
  return pool;
}
function admin(req) {
  const expected = process.env.ADMIN_KEY;
  const supplied = req.headers["x-admin-key"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || supplied !== expected) {
    const e = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
}
function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}
module.exports = { db, admin, send };
