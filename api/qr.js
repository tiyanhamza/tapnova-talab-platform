const { db, send } = require("./_db");
module.exports = async (req,res) => {
  try {
    const code=String(req.query.code||"").trim().toUpperCase();
    if(!code)return send(res,400,{error:"QR code missing"});
    const pool=db();
    const q=await pool.query("select q.qr_type,q.target_url,r.slug,t.public_token from qr_stock q left join restaurants r on r.id=q.restaurant_id left join dining_tables t on t.id=q.table_id where q.code=$1 and q.status in ('available','assigned') limit 1",[code]);
    if(!q.rowCount)return send(res,404,{error:"QR not found or disabled"});
    const row=q.rows[0];
    let destination=row.qr_type==="external"?row.target_url:(row.slug?"/?slug="+encodeURIComponent(row.slug)+(row.public_token?"&table="+encodeURIComponent(row.public_token):""):null);
    if(!destination)return send(res,409,{error:"QR is not assigned yet"});
    res.setHeader("Cache-Control","no-store");
    res.setHeader("Location",destination);
    return res.status(302).end();
  } catch(e){return send(res,500,{error:e.message});}
};
