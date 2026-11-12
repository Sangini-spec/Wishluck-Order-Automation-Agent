import { prisma, json } from "./db";
import { audit, handover, outreachConversation, refresh } from "./operations";
import { logger } from "./logger";
// Durable PostgreSQL outbox queue: leases + SKIP LOCKED, bounded retry, deduplicated effects.
export async function runJob(jobId:string){
  await prisma.$transaction(async t=>{
    const job=await t.outboxJob.findUniqueOrThrow({where:{id:jobId}}),p=job.payload as any;
    if(job.state==="DONE")return;
    const o=await t.order.findUniqueOrThrow({where:{id:p.orderId},include:{cod:true,items:true,payment:true}});
    if(job.kind.startsWith("COD")){
      if(!o.cod||o.cod.status!=="PENDING"){await t.outboxJob.update({where:{id:jobId},data:{state:"DONE",lockedUntil:null}});return;}
      const c=await outreachConversation(t,o.id,o.customerId);
      if(job.kind==="COD_SEND"){
        await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:c.id,role:"assistant",dedupeKey:job.id,content:`Please confirm order ${o.id}: ${o.items.map(i=>`${i.quantity} × ${i.productName} (${i.size})`).join(", ")}. Amount payable ₹${o.payment?.total}. Choose Confirm, Cancel, Edit address, or Pay online for 5% off merchandise.`}});
        await t.cODConfirmation.update({where:{orderId:o.id},data:{messageSentAt:new Date()}});
      }else if(job.kind==="COD_REMINDER"){
        await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:c.id,role:"assistant",dedupeKey:job.id,content:`One reminder: please confirm COD order ${o.id}, cancel, edit your address or switch to prepaid for 5% off merchandise.`}});
        await t.cODConfirmation.update({where:{orderId:o.id},data:{reminderSentAt:new Date()}});
      }else{
        await t.cODConfirmation.update({where:{orderId:o.id},data:{status:"ON_HOLD",heldAt:new Date()}});
        await t.order.update({where:{id:o.id},data:{status:"ON_HOLD"}});
      }
      await audit(t,"SYSTEM",job.kind.replaceAll("_"," "),o.id,{}, {deliveredThrough:"demo web channel"},c.id);
    }else if(job.kind==="NDR_SEND"){
      await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:p.conversationId,role:"assistant",dedupeKey:job.id,content:`Delivery of ${o.id} failed. Courier reason: ${p.reason}. Please share a retry date within the next 3 days, a corrected address/landmark, or an alternate phone. You may also refuse delivery; we will record the reason and request RTO. Please verify the order ID and registered phone before changing details.`}});
      await audit(t,"SYSTEM","Contacted customer after failed delivery",o.id,{}, {reason:p.reason},p.conversationId);
    }else if(job.kind==="NDR_CHECK"){
      const ndr=await t.nDRCase.findUnique({where:{eventId:p.eventId}});
      if(ndr?.status==="AWAITING_CUSTOMER"&&ndr.attemptCount>=2)await handover(p.conversationId,"Two failed delivery attempts without a response",undefined,t);
    }
    await t.outboxJob.update({where:{id:jobId},data:{state:"DONE",lockedUntil:null}});
  });refresh();
}
let running=false;
export async function workQueue(){
  if(running)return;running=true;
  try{
    const jobs=await prisma.$queryRaw<{id:string}[]>`
      UPDATE "OutboxJob" SET state='PROCESSING', "lockedUntil"=NOW()+INTERVAL '60 seconds', attempts=attempts+1
      WHERE id IN (SELECT id FROM "OutboxJob"
        WHERE ("state"='PENDING' OR ("state"='PROCESSING' AND "lockedUntil"<NOW())) AND "dueAt"<=NOW()
        ORDER BY "dueAt" FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING id`;
    for(const {id} of jobs){try{await runJob(id);}catch(e){const job=await prisma.outboxJob.findUniqueOrThrow({where:{id}});await prisma.outboxJob.update({where:{id},data:{state:job.attempts>=5?"FAILED":"PENDING",lockedUntil:null,dueAt:new Date(Date.now()+Math.min(30000,1000*2**job.attempts)),lastError:"Job failed; see redacted diagnostic category"}});logger.warn({jobId:id,errorType:e instanceof Error?e.name:"unknown"},"Background job failed");}}
  }finally{running=false;}
}
export function startQueue(){const timer=setInterval(()=>{void workQueue().catch(e=>logger.error({errorType:e?.name},"Queue polling failed"));},1000);timer.unref();}
