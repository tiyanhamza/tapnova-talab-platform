const webpush=require("web-push");
async function notify(pool,restaurantId,payload){
 try{
  if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT){
   webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
   const r=await pool.query("select id,subscription from push_subscriptions where restaurant_id=$1 and active=true",[restaurantId]);
   await Promise.allSettled(r.rows.map(async s=>{try{await webpush.sendNotification(s.subscription,JSON.stringify(payload),{TTL:120,timeout:5000})}catch(e){if(e.statusCode===404||e.statusCode===410)await pool.query("update push_subscriptions set active=false where id=$1",[s.id])}}));
  }
 }catch(e){console.error("web push notification failed",e.message)}
 try{
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(token){
   const r=await pool.query("select telegram_chat_id from waiter_devices where restaurant_id=$1 and active=true and telegram_chat_id is not null",[restaurantId]);
   const message="🔔 "+String(payload.title||"TapNova Talab")+"\n"+String(payload.body||"طلب جديد")+"\n\nTapNova Talab";
   await Promise.allSettled(r.rows.map(async d=>{const sent=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:String(d.telegram_chat_id),text:message,disable_web_page_preview:true})});if(!sent.ok)throw new Error("Telegram send failed")}));
  }
 }catch(e){console.error("telegram notification failed",e.message)}
}
module.exports={notify};