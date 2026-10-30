const crypto=require("crypto");
const {admin,send}=require("./_db");
module.exports=async(req,res)=>{try{
 admin(req);
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token)return send(res,503,{error:"Add TELEGRAM_BOT_TOKEN to Vercel Production environment variables first"});
 const me=await fetch("https://api.telegram.org/bot"+token+"/getMe").then(r=>r.json());
 if(!me.ok)return send(res,502,{error:"Telegram rejected the bot token"});
 const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();
 const base=process.env.APP_URL||("https://"+host);
 const secret=crypto.createHash("sha256").update(token).digest("hex");
 const hook=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:base.replace(/\\/$/,"")+"/api/telegram-webhook",secret_token:secret,allowed_updates:["message"]})}).then(r=>r.json());
 if(!hook.ok)return send(res,502,{error:hook.description||"Could not register Telegram webhook"});
 return send(res,200,{ok:true,bot_username:me.result.username,webhook:true});
 }catch(e){return send(res,e.status||500,{error:e.message})}};