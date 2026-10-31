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
   const caption=String(payload.body||payload.title||"طلب جديد").slice(0,1000);
   await Promise.allSettled(r.rows.map(async d=>{
    const photos=Array.isArray(payload.photos)?payload.photos.filter(x=>x&&x.url).slice(0,10):[];
    let sent;
    if(photos.length>=2){
     const form=new FormData();
     const media=[];
     for(let i=0;i<photos.length;i++){
      const p=photos[i],url=String(p.url);
      if(url.startsWith("data:image/")){
       const match=url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
       if(!match)continue;
       const ext=(match[1].split("/")[1]||"jpg").replace("jpeg","jpg");
       const field="photo"+i;
       form.append(field,new Blob([Buffer.from(match[2],"base64")],{type:match[1]}), "product-"+i+"."+ext);
       media.push({type:"photo",media:"attach://"+field,...(media.length===0?{caption}:{})});
      }else if(/^https:\/\//i.test(url)){
       media.push({type:"photo",media:url,...(media.length===0?{caption,parse_mode:"HTML"}:{})});
      }
     }
     if(media.length>=2){
      form.append("chat_id",String(d.telegram_chat_id));
      form.append("media",JSON.stringify(media));
      sent=await fetch("https://api.telegram.org/bot"+token+"/sendMediaGroup",{method:"POST",body:form});
     }
    }
    if(!sent&&photos.length){
     const p=photos[0],url=String(p.url);
     if(url.startsWith("data:image/")){
      const match=url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
      if(match){
       const form=new FormData();
       const ext=(match[1].split("/")[1]||"jpg").replace("jpeg","jpg");
       form.append("chat_id",String(d.telegram_chat_id));
       form.append("photo",new Blob([Buffer.from(match[2],"base64")],{type:match[1]}),"product."+ext);
       form.append("caption",caption);
       sent=await fetch("https://api.telegram.org/bot"+token+"/sendPhoto",{method:"POST",body:form});
      }
     }else if(/^https:\/\//i.test(url)){
      sent=await fetch("https://api.telegram.org/bot"+token+"/sendPhoto",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:String(d.telegram_chat_id),photo:url,caption,disable_notification:false})});
     }
    }
    if(!sent||!sent.ok){
     sent=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:String(d.telegram_chat_id),text:caption,disable_web_page_preview:true})});
    }
    if(!sent.ok)throw new Error("Telegram send failed");
   }));
  }
 }catch(e){console.error("telegram notification failed",e.message)}
}
module.exports={notify};
