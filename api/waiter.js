const { db, admin, send } = require("./_db");

module.exports = async (req, res) => {
  try {
    admin(req);
    const pool = db();

    if (req.method === "GET") {
      const slug = String(req.query.slug || "").trim();
      if (!slug) return send(res,400,{error:"slug is required"});
      const rr = await pool.query("select id,name,slug from restaurants where slug=$1 and is_active=true limit 1",[slug]);
      if (!rr.rowCount) return send(res,404,{error:"Restaurant not found"});
      const rid = rr.rows[0].id;
      const [requests,orders] = await Promise.all([
        pool.query("select s.id,s.table_number,s.request_type,s.status,s.created_at,coalesce(d.detail,case when s.request_type='waiter' then 'Appeler le serveur' else 'Demander l’addition' end) as request_label from service_requests s left join service_request_details d on d.request_id=s.id where s.restaurant_id=$1 and s.status <> 'completed' order by s.created_at desc limit 100",[rid]),
        pool.query("select o.id,o.table_number,o.status,o.total,o.created_at,coalesce(json_agg(json_build_object('name',i.product_name,'quantity',i.quantity,'total',i.line_total)) filter(where i.id is not null),'[]') items from orders o left join order_items i on i.order_id=o.id where o.restaurant_id=$1 and o.status in ('new','preparing','ready') group by o.id order by o.created_at desc limit 100",[rid])
      ]);
      return send(res,200,{restaurant:rr.rows[0],requests:requests.rows,orders:orders.rows});
    }

    if (req.method === "PATCH") {
      const b=req.body||{}, slug=String(b.slug||"").trim(), id=b.id;
      const rr=await pool.query("select id from restaurants where slug=$1 and is_active=true limit 1",[slug]);
      if(!rr.rowCount)return send(res,404,{error:"Restaurant not found"});
      const rid=rr.rows[0].id;
      if(b.kind==="request"){
        const status=String(b.status||"");
        if(!["acknowledged","completed"].includes(status))return send(res,400,{error:"Invalid request status"});
        const x=await pool.query("update service_requests set status=$1 where id=$2 and restaurant_id=$3 returning id,status",[status,id,rid]);
        return send(res,200,{request:x.rows[0]||null});
      }
      if(b.kind==="order"){
        const status=String(b.status||"");
        if(!["preparing","ready","delivered","cancelled"].includes(status))return send(res,400,{error:"Invalid order status"});
        const x=await pool.query("update orders set status=$1 where id=$2 and restaurant_id=$3 returning id,status",[status,id,rid]);
        return send(res,200,{order:x.rows[0]||null});
      }
      return send(res,400,{error:"Unknown action"});
    }
    return send(res,405,{error:"Method not allowed"});
  } catch(e) { return send(res,e.status||500,{error:e.message}); }
};
