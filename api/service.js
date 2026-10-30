const { db, send } = require("./_db");
const ALLOWED = new Set(["waiter","water","cutlery","clean_table","bill"]);
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return send(res,405,{error:"Method not allowed"});
    const { slug, table, request_type } = req.body || {};
    if (!slug || !table || !ALLOWED.has(request_type)) return send(res,400,{error:"slug, table and valid request_type are required"});
    const pool = db();
    const r = await pool.query("select id from restaurants where slug=$1 and is_active=true limit 1",[slug]);
    if (!r.rowCount) return send(res,404,{error:"Restaurant not found"});
    const t = await pool.query("select id,table_number from dining_tables where restaurant_id=$1 and public_token=$2 and is_active=true limit 1",[r.rows[0].id,String(table)]);
    if (!t.rowCount) return send(res,404,{error:"Table not found"});
    const storedType = request_type === "bill" ? "bill" : "waiter";
    const labels = {waiter:"Appeler le serveur",water:"Demander de l’eau",cutlery:"Demander des couverts",clean_table:"Nettoyer la table",bill:"Demander l’addition"};
    const saved = await pool.query("insert into service_requests(restaurant_id,table_id,table_number,request_type,status) values($1,$2,$3,$4,'pending') returning id,request_type,status,created_at",[r.rows[0].id,t.rows[0].id,t.rows[0].table_number,storedType]);
    if (request_type !== "waiter" && request_type !== "bill") {
      await pool.query("insert into service_request_details(request_id,detail) values($1,$2)",[saved.rows[0].id,labels[request_type]]);
    }
    return send(res,201,{ok:true,request:{...saved.rows[0],label:labels[request_type]}});
  } catch(e) { send(res,e.status||500,{error:e.message}); }
};
