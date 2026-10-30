const { Pool } = require("pg");

let pool;
function db() {
  if (!process.env.DATABASE_URL) {
    const e = new Error("DATABASE_URL is not configured in Vercel");
    e.status = 503;
    throw e;
  }
  if (!pool) {
    const u = new URL(process.env.DATABASE_URL);
    const config = {
      host: u.hostname,
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
      ssl: { rejectUnauthorized: true },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000
    };
    const appName = u.searchParams.get("application_name");
    const options = u.searchParams.get("options");
    if (appName) config.application_name = appName;
    if (options) config.options = options;
    pool = new Pool(config);
  }
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
