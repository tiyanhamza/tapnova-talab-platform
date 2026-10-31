const { db, send } = require("./_db");
const { notify } = require("./_push");
module.exports = async (req, res) => {
  try {
    const pool = db();
    if (req.method === "GET") {
      const slug = String(req.query.slug || "").trim();
      if (!slug) return send(res, 400, { error: "slug is required" });
      const r = await pool.query("select id,name,slug,description,logo_url,cover_url,phone,address,currency,default_language from restaurants where slug=$1 and is_active=true limit 1", [slug]);
      if (!r.rowCount) return send(res, 404, { error: "Restaurant not found" });
      const restaurant = r.rows[0];
      const [categories, products] = await Promise.all([
        pool.query("select id,name_ar,name_fr,sort_order from categories where restaurant_id=$1 and is_active=true order by sort_order,id", [restaurant.id]),
        pool.query("select id,category_id,name_ar,name_fr,description_ar,description_fr,price,image_url from products where restaurant_id=$1 and is_available=true order by sort_order,id", [restaurant.id])
      ]);
      return send(res, 200, { restaurant, categories: categories.rows, products: products.rows });
    }
    if (req.method === "POST") {
      const { slug, table, items, customer_note } = req.body || {};
      if (!slug || !Array.isArray(items) || !items.length) return send(res, 400, { error: "slug and items are required" });
      const client = await pool.connect();
      try {
        await client.query("begin");
        const rr = await client.query("select id,name from restaurants where slug=$1 and is_active=true limit 1", [slug]);
        if (!rr.rowCount) throw Object.assign(new Error("Restaurant not found"), { status: 404 });
        const restaurantId = rr.rows[0].id;
        let tableId = null, tableNumber = null;
        if (table) {
          const tr = await client.query("select id,table_number from dining_tables where restaurant_id=$1 and public_token=$2 and is_active=true limit 1", [restaurantId, String(table)]);
          if (!tr.rowCount) throw Object.assign(new Error("Invalid table QR code"), { status: 400 });
          tableId = tr.rows[0].id;
          tableNumber = tr.rows[0].table_number;
        }
        let subtotal = 0;
        const clean = [];
        for (const item of items) {
          const id = String(item.product_id || item.id || "");
          const qty = Math.max(1, Math.min(50, Number.parseInt(item.quantity, 10) || 1));
          const pr = await client.query("select id,name_ar,name_fr,price,image_url from products where id=$1 and restaurant_id=$2 and is_available=true", [id, restaurantId]);
          if (!pr.rowCount) throw Object.assign(new Error("One product is unavailable"), { status: 400 });
          const p = pr.rows[0], unit = Number(p.price), total = unit * qty;
          subtotal += total;
          clean.push({ product_id:p.id, product_name:p.name_fr || p.name_ar, quantity:qty, unit_price:unit, line_total:total, image_url:p.image_url || "" });
        }
        const order = await client.query("insert into orders(restaurant_id,table_id,table_number,status,customer_note,subtotal,total) values($1,$2,$3,'new',$4,$5,$5) returning id,status,total,created_at", [restaurantId,tableId,tableNumber || "Takeaway",String(customer_note||"").slice(0,500),subtotal]);
        for (const item of clean) await client.query("insert into order_items(order_id,product_id,product_name,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6)", [order.rows[0].id,item.product_id,item.product_name,item.quantity,item.unit_price,item.line_total]);
        await client.query("commit");
        const pieces = clean.reduce((n, x) => n + x.quantity, 0);
        const lines = clean.map(x => "• " + x.product_name + " × " + x.quantity + " — " + x.line_total.toFixed(2) + " DH").join("\n");
        const message = [
          "🛎️ طلبية جديدة",
          "☕ " + rr.rows[0].name,
          "🪑 الطابلة: " + (tableNumber || "طلب خارجي"),
          "🔢 رقم الطلبية: #" + order.rows[0].id,
          "📦 عدد المنتجات: " + clean.length + " | عدد القطع: " + pieces,
          "",
          lines,
          "",
          "💰 المجموع: " + Number(order.rows[0].total).toFixed(2) + " DH",
          customer_note ? "📝 ملاحظة: " + String(customer_note).slice(0,250) : ""
        ].filter(Boolean).join("\n");
        await notify(pool,restaurantId,{title:"طلبية جديدة · طاولة "+(tableNumber || "Takeaway"),body:message,photos:clean.filter(x=>x.image_url).map(x=>({url:x.image_url,name:x.product_name}))});
        return send(res, 201, { ok:true, order:order.rows[0] });
      } catch (e) { await client.query("rollback"); throw e; }
      finally { client.release(); }
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (error) { send(res, error.status || 500, { error: error.message }); }
};
