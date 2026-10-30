const {send}=require("./_db");
module.exports=async(req,res)=>send(res,410,{error:"This legacy master-key waiter endpoint is disabled. Use the private waiter device invitation link."});