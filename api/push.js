const crypto=require("crypto");
const {db,send,admin}=require("./_db");
const {hash}=require("./_tokens");
module.exports=async(req,res)=>{try{
 const telegram=String(req.query?.telegram||"");
 if(telegram==="setup")return await telegramSetup(req,res);
 if(telegram==="link")return await telegramLink(req,res);
 if(telegram==="webhook")return await telegramWebhook(req,res);
 if(req.method==="GET")return send(res,200,{publicKey:process.env.VAPID_PUBLIC_KEY||null});
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=bearer(req),pool=db();
 const d=await pool.query("select id,restaurant_id from waiter_devices where session_token_hash=$1 and active=true",[hash(token)]);
 if(!token)return send(res,401,{error:"Device session required"});
 if(!d.rowCount)return send(res,401,{error:"Device session expired"});
 const sub=(req.body||{}).subscription;
 if(!sub||!sub.endpoint||!sub.keys||!sub.keys.p256dh||!sub.keys.auth)return send(res,400,{error:"Invalid subscription"});
 await pool.query("insert into push_subscriptions(restaurant_id,device_id,endpoint,subscription,active) values($1,$2,$3,$4,true) on conflict(endpoint) do update set restaurant_id=excluded.restaurant_id,device_id=excluded.device_id,subscription=excluded.subscription,active=true,updated_at=now()",[d.rows[0].restaurant_id,d.rows[0].id,sub.endpoint,JSON.stringify(sub)]);
 return send(res,201,{ok:true});
 }catch(e){console.error("push api error",e.message);return send(res,e.status||500,{error:e.message})}};
function bearer(req){const a=String(req.headers.authorization||"");return a.toLowerCase().startsWith("bearer ")?a.slice(7).trim():""}
function botToken(){return process.env.TELEGRAM_BOT_TOKEN||""}
async function telegramSetup(req,res){
 admin(req);if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=botToken();if(!token)return send(res,503,{error:"Add TELEGRAM_BOT_TOKEN to Vercel Production environment variables first"});
 const me=await fetch("https://api.telegram.org/bot"+token+"/getMe").then(r=>r.json());
 if(!me.ok)return send(res,502,{error:"Telegram rejected the bot token"});
 const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim(),base=process.env.APP_URL||("https://"+host);
 const secret=crypto.createHash("sha256").update(token).digest("hex");
 const hook=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:(base.endsWith("/")?base.slice(0,-1):base)+"/api/push?telegram=webhook",secret_token:secret,allowed_updates:["message"]})}).then(r=>r.json());
 if(!hook.ok)return send(res,502,{error:hook.description||"Could not register Telegram webhook"});
 return send(res,200,{ok:true,bot_username:me.result.username,webhook:true});
}
async function telegramLink(req,res){
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=bearer(req);if(!token)return send(res,401,{error:"Device session required"});
 if(!botToken())return send(res,503,{error:"Telegram bot is not configured yet"});
 const pool=db(),d=await pool.query("select id from waiter_devices where session_token_hash=$1 and active=true",[hash(token)]);
 if(!d.rowCount)return send(res,401,{error:"Device session expired"});
 const me=await fetch("https://api.telegram.org/bot"+botToken()+"/getMe").then(r=>r.json());
 if(!me.ok||!me.result?.username)return send(res,502,{error:"Telegram bot is unavailable"});
 const raw=crypto.randomBytes(32).toString("base64url");
 await pool.query("update waiter_devices set telegram_link_token_hash=$1,telegram_link_expires_at=now()+interval '10 minutes' where id=$2",[hash(raw),d.rows[0].id]);
 return send(res,200,{ok:true,bot_username:me.result.username,telegram_url:"https://t.me/"+me.result.username+"?start="+raw});
}
async function telegramWebhook(req,res){
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=botToken();if(!token)return send(res,503,{error:"Telegram bot is not configured"});
 const expected=crypto.createHash("sha256").update(token).digest("hex");
 if(String(req.headers["x-telegram-bot-api-secret-token"]||"")!==expected)return send(res,401,{error:"Invalid webhook secret"});
 const msg=req.body?.message,chatId=msg?.chat?.id,text=String(msg?.text||"");
 if(!chatId||!text.startsWith("/start"))return send(res,200,{ok:true});
 const raw=text.trim().split(" ")[1]||"";
 if(!raw){await telegramReply(token,chatId,"مرحباً بك في TapNova Talab. افتح رابط الدعوة من هاتف النادل لربط هذا الجهاز.");return send(res,200,{ok:true})}
 const pool=db();
 const linked=await pool.query("update waiter_devices set telegram_chat_id=$1,telegram_username=$2,telegram_link_token_hash=null,telegram_link_expires_at=null where telegram_link_token_hash=$3 and telegram_link_expires_at>now() and active=true returning device_name",[String(chatId),String(msg.from?.username||""),hash(raw)]);
 if(!linked.rowCount){await telegramReply(token,chatId,"رابط الربط غير صالح أو انتهت صلاحيته. ارجع إلى صفحة النادل واضغط ربط Telegram من جديد.");return send(res,200,{ok:true})}
 await telegramReply(token,chatId,"✅ تم ربط هاتفك بنجاح مع TapNova Talab. ستصلك الآن تنبيهات الطلبات ونداءات الطاولات.");
 return send(res,200,{ok:true});
}
async function telegramReply(token,chatId,text){await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:String(chatId),text})})}
