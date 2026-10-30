const crypto=require("crypto");
const {db,send}=require("./_db");
const {hash}=require("./_tokens");
module.exports=async(req,res)=>{try{
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const token=String(req.headers.authorization||"").replace(/^Bearer\\s+/i,"").trim();
 if(!token)return send(res,401,{error:"Device session required"});
 if(!process.env.TELEGRAM_BOT_TOKEN)return send(res,503,{error:"Telegram bot is not configured yet"});
 const pool=db();
 const d=await pool.query("select id from waiter_devices where session_token_hash=$1 and active=true",[hash(token)]);
 if(!d.rowCount)return send(res,401,{error:"Device session expired"});
 const me=await fetch("https://api.telegram.org/bot"+process.env.TELEGRAM_BOT_TOKEN+"/getMe").then(r=>r.json());
 if(!me.ok||!me.result?.username)return send(res,502,{error:"Telegram bot is unavailable"});
 const raw=crypto.randomBytes(32).toString("base64url");
 await pool.query("update waiter_devices set telegram_link_token_hash=$1,telegram_link_expires_at=now()+interval '10 minutes' where id=$2",[hash(raw),d.rows[0].id]);
 return send(res,200,{ok:true,bot_username:me.result.username,telegram_url:"https://t.me/"+me.result.username+"?start="+raw});
 }catch(e){return send(res,e.status||500,{error:e.message})}};