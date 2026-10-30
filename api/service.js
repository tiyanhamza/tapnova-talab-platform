const { db, send } = require("./_db");
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return send(res,405,{error:"Method not allowed"});
    const { slug, table, request_type } = req.body || {};
    if (!slug || !table || !["waiter","bill"].includes(request_type)) return send(res,400,{error:"slug, table and valid request_type are required"});
    const pool = db();
    const r = await pool.query("select id from restaurants where slug=$1 and is_active=true limit 1",[slug]);
    if (!r.rowCount) return send(res,404,{error:"Restaurant not found"});
    const t = await pool.query("select id,table_number from dining_tables where restaurant_id=$1 and public_token=$2 and is_active=true limit 1",[r.rows[0].id,String(table)]);
    if (!t.rowCount) return send(res,404,{error:"Table not found"});
    const saved = await pool.query("insert into service_requests(restaurant_id,table_id,table_number,request_type,status) values($1,$2,$3,$4,'pending') returning id,request_type,status,created_at",[r.rows[0].id,t.rows[0].id,t.rows[0].table_number,request_type]);
    send(res,201,{ok:true,request:saved.rows[0]});
  } catch(e) { send(res,e.status||500,{error:e.message}); }
};
