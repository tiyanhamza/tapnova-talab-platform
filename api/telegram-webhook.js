const crypto=require("crypto");
const {db,send}=require("./_db");
const {hash}=require("./_tokens");
module.exports=async(req,res)=>{try{
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const botToken=process.env.TELEGRAM_BOT_TOKEN;
 if(!botToken)return send(res,503,{error:"Telegram bot is not configured"});
 const expected=crypto.createHash("sha256").update(botToken).digest("hex");
 const supplied=String(req.headers["x-telegram-bot-api-secret-token"]||"");
 if(supplied!==expected)return send(res,401,{error:"Invalid webhook secret"});
 const msg=req.body?.message,chatId=msg?.chat?.id,text=String(msg?.text||"");
 if(!chatId||!text.startsWith("/start"))return send(res,200,{ok:true});
 const parts=text.trim().split(/\\s+/),raw=parts[1]||"";
 if(!raw){await reply(botToken,chatId,"مرحباً بك في TapNova Talab. افتح رابط الدعوة من هاتف النادل لربط هذا الجهاز.");return send(res,200,{ok:true})}
 const pool=db();
 const linked=await pool.query("update waiter_devices set telegram_chat_id=$1,telegram_username=$2,telegram_link_token_hash=null,telegram_link_expires_at=null where telegram_link_token_hash=$3 and telegram_link_expires_at>now() and active=true returning device_name",( [String(chatId),String(msg.from?.username||""),hash(raw)] ));
 if(!linked.rowCount){await reply(botToken,chatId,"رابط الربط غير صالح أو انتهت صلاحيته. ارجع إلى صفحة النادل واضغط ربط Telegram من جديد.");return send(res,200,{ok:true})}
 await reply(botToken,chatId,"✅ تم ربط هاتفك بنجاح مع TapNova Talab. ستصلك الآن تنبيهات الطلبات ونداءات الطاولات.");
 return send(res,200,{ok:true});
 }catch(e){console.error("telegram webhook error",e.message);return send(res,500,{error:"Webhook processing failed"})}};
async function reply(token,chatId,text){await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text})})}