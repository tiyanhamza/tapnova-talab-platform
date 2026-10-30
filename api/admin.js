const crypto = require("crypto");
const { db, admin, send } = require("./_db");
module.exports = async (req,res) => {
  try {
    admin(req);
    const pool = db();
    if (req.method === "GET") {
      if(String(req.query.list||"")==="1"){
        const all=await pool.query("select id,name,slug from restaurants order by created_at desc");
        return send(res,200,{restaurants:all.rows});
      }
      const slug = String(req.query.slug || "").trim();
      const rr = slug
        ? await pool.query("select * from restaurants where slug=$1 limit 1",[slug])
        : await pool.query("select * from restaurants order by created_at desc limit 1");
      if (!rr.rowCount) return send(res,200,{restaurant:null,categories:[],products:[],tables:[],orders:[],requests:[]});
      const r=rr.rows[0], id=r.id;
      const [categories,products,tables,orders,requests] = await Promise.all([
        pool.query("select * from categories where restaurant_id=$1 order by sort_order,id",[id]),
        pool.query("select * from products where restaurant_id=$1 order by sort_order,id",[id]),
        pool.query("select * from dining_tables where restaurant_id=$1 order by table_number",[id]),
        pool.query("select o.*,coalesce(json_agg(json_build_object('name',i.product_name,'quantity',i.quantity,'total',i.line_total)) filter(where i.id is not null),'[]') items from orders o left join order_items i on i.order_id=o.id where o.restaurant_id=$1 group by o.id order by o.created_at desc limit 100",[id]),
        pool.query("select s.*,coalesce(d.detail,case when s.request_type='waiter' then 'Appeler le serveur' else 'Demander l’addition' end) as request_label from service_requests s left join service_request_details d on d.request_id=s.id where s.restaurant_id=$1 order by s.created_at desc limit 100",[id])
      ]);
      return send(res,200,{restaurant:r,categories:categories.rows,products:products.rows,tables:tables.rows,orders:orders.rows,requests:requests.rows});
    }
    if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "DELETE") return send(res,405,{error:"Method not allowed"});
    const b=req.body||{}, action=String(b.action||"");
    if (req.method==="POST" && action==="restaurant") {
      const name=String(b.name||"").trim(), slug=String(b.slug||"").trim().toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-");
      if (!name||!slug) return send(res,400,{error:"Restaurant name and slug are required"});
      for(const field of ["logo_url","cover_url"])if(typeof b[field]==="string"&&b[field].length>1800000)return send(res,413,{error:"Image too large. Choose a smaller image."});
      const x=await pool.query("insert into restaurants(name,slug,description,phone,address,currency,default_language,logo_url,cover_url) values($1,$2,$3,$4,$5,'MAD',$6,$7,$8) returning *",[name,slug,String(b.description||""),String(b.phone||""),String(b.address||""),b.language==="ar"?"ar":"fr",String(b.logo_url||""),String(b.cover_url||"")]);
      return send(res,201,{restaurant:x.rows[0]});
    }
    const slug=String(b.slug||req.query.slug||"").trim();
    const rr=slug?await pool.query("select id from restaurants where slug=$1 limit 1",[slug]):await pool.query("select id from restaurants order by created_at desc limit 1");
    if(!rr.rowCount)return send(res,404,{error:"Create a restaurant first"});
    const rid=rr.rows[0].id;
    if(req.method==="POST"&&action==="category"){
      const x=await pool.query("insert into categories(restaurant_id,name_ar,name_fr,sort_order) values($1,$2,$3,$4) returning *",[rid,String(b.name_ar||b.name_fr||"").trim(),String(b.name_fr||b.name_ar||"").trim(),Number(b.sort_order)||0]);
      return send(res,201,{category:x.rows[0]});
    }
    if(req.method==="POST"&&action==="product"){
      const price=Number(b.price);
      if(!String(b.name_ar||b.name_fr||"").trim()||!Number.isFinite(price)||price<0)return send(res,400,{error:"Product name and valid price are required"});
      if(String(b.image_url||"").length>1800000)return send(res,413,{error:"Image too large. Choose a smaller image."});
      const x=await pool.query("insert into products(restaurant_id,category_id,name_ar,name_fr,description_ar,description_fr,price,image_url,is_available,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning *",[rid,b.category_id||null,String(b.name_ar||b.name_fr),String(b.name_fr||b.name_ar),String(b.description_ar||""),String(b.description_fr||""),price,String(b.image_url||""),Number(b.sort_order)||0]);
      return send(res,201,{product:x.rows[0]});
    }
    if(req.method==="POST"&&action==="table"){
      const number=String(b.table_number||"").trim();
      if(!number)return send(res,400,{error:"Table number is required"});
      const token=crypto.randomBytes(12).toString("hex");
      const x=await pool.query("insert into dining_tables(restaurant_id,table_number,public_token,is_active) values($1,$2,$3,true) returning *",[rid,number,token]);
      return send(res,201,{table:x.rows[0]});
    }
    if(req.method==="PATCH"&&action==="restaurant"){
      for(const field of ["logo_url","cover_url"])if(typeof b[field]==="string"&&b[field].length>1800000)return send(res,413,{error:"Image too large. Choose a smaller image."});
      const x=await pool.query("update restaurants set name=coalesce($1,name),description=coalesce($2,description),phone=coalesce($3,phone),address=coalesce($4,address),logo_url=coalesce($5,logo_url),cover_url=coalesce($6,cover_url) where id=$7 returning *",[b.name??null,b.description??null,b.phone??null,b.address??null,b.logo_url??null,b.cover_url??null,rid]);
      return send(res,200,{restaurant:x.rows[0]||null});
    }
    if(req.method==="PATCH"&&action==="order"){
      const status=String(b.status||"");
      if(!["new","preparing","ready","delivered","cancelled"].includes(status))return send(res,400,{error:"Invalid order status"});
      const x=await pool.query("update orders set status=$1 where id=$2 and restaurant_id=$3 returning *",[status,b.id,rid]);
      return send(res,200,{order:x.rows[0]||null});
    }
    if(req.method==="PATCH"&&action==="request"){
      const status=String(b.status||"");
      if(!["pending","acknowledged","completed"].includes(status))return send(res,400,{error:"Invalid request status"});
      const x=await pool.query("update service_requests set status=$1 where id=$2 and restaurant_id=$3 returning *",[status,b.id,rid]);
      return send(res,200,{request:x.rows[0]||null});
    }
    if(req.method==="PATCH"&&action==="product"){
      if(b.price!==undefined&&(!Number.isFinite(Number(b.price))||Number(b.price)<0))return send(res,400,{error:"Invalid product price"});
      if(typeof b.image_url==="string"&&b.image_url.length>1800000)return send(res,413,{error:"Image too large. Choose a smaller image."});
      const x=await pool.query("update products set name_ar=coalesce($1,name_ar),name_fr=coalesce($2,name_fr),description_ar=coalesce($3,description_ar),description_fr=coalesce($4,description_fr),price=coalesce($5,price),image_url=coalesce($6,image_url),category_id=coalesce($7,category_id),is_available=coalesce($8,is_available) where id=$9 and restaurant_id=$10 returning *",[b.name_ar??null,b.name_fr??null,b.description_ar??null,b.description_fr??null,b.price===undefined?null:Number(b.price),b.image_url??null,b.category_id??null,b.is_available===undefined?null:Boolean(b.is_available),b.id,rid]);
      return send(res,200,{product:x.rows[0]||null});
    }
    if(req.method==="DELETE"&&action==="product"){
      await pool.query("delete from products where id=$1 and restaurant_id=$2",[b.id,rid]);
      return send(res,200,{ok:true});
    }
    return send(res,400,{error:"Unknown action"});
  } catch(e) { send(res,e.status||500,{error:e.message}); }
};
