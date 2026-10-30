const { db, send } = require("./_db");
module.exports = async (req, res) => {
  try {
    const result = await db().query("select current_timestamp as time");
    send(res, 200, { ok: true, database: "connected", time: result.rows[0].time });
  } catch (error) {
    send(res, error.status || 503, { ok: false, database: "unavailable", error: error.message });
  }
};
