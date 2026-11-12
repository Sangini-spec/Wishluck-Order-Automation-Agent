import { prisma, json } from "./db";
import { audit, handover, outreachConversation, refresh } from "./operations";
import { logger } from "./logger";
import { say } from "./workflow-rules";
import { acknowledgeCourierInstruction } from "./mock-courier";
// Durable PostgreSQL outbox queue: leases + SKIP LOCKED, bounded retry, deduplicated effects.
export async function runJob(jobId:string){
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "OutboxJob" WHERE id=${jobId} FOR UPDATE`;
    const job=await t.outboxJob.findUniqueOrThrow({where:{id:jobId}}),p=job.payload as any;
    if(job.state==="DONE")return;
    await t.$queryRaw`SELECT id FROM "Order" WHERE id=${p.orderId} FOR UPDATE`;
    const o=await t.order.findUniqueOrThrow({where:{id:p.orderId},include:{cod:true,items:true,payment:true}});
    if(job.kind.startsWith("COD")){
      if(!o.cod||o.cod.status!=="PENDING"){await t.outboxJob.update({where:{id:jobId},data:{state:"DONE",lockedUntil:null}});return;}
      const c=await outreachConversation(t,o.id,o.customerId);
      if(job.kind==="COD_SEND"){
        const summary=o.items.map(i=>`${i.quantity} × ${i.productName} (${i.size})`).join(", ");
        await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:c.id,role:"assistant",dedupeKey:job.id,content:say(c.language,
          `Please confirm order ${o.id}: ${summary}. Amount payable ₹${o.payment?.total}. Choose Confirm, Cancel, Edit address, or Pay online for 5% off merchandise.`,
          `ऑर्डर ${o.id}: ${summary}। देय राशि ₹${o.payment?.total}। पुष्टि करें, रद्द करें, पता बदलें या ऑनलाइन भुगतान करके सामान पर 5% छूट पाएँ।`,
          `Order ${o.id}: ${summary}. Dene hain ₹${o.payment?.total}. Confirm, cancel, address badlein ya online pay karke merchandise par 5% off lein.`)}});
        await t.cODConfirmation.update({where:{orderId:o.id},data:{messageSentAt:new Date()}});
      }else if(job.kind==="COD_REMINDER"){
        await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:c.id,role:"assistant",dedupeKey:job.id,content:say(c.language,`One reminder: please confirm COD order ${o.id}, cancel, edit your address or switch to prepaid for 5% off merchandise.`,`एक अनुस्मारक: COD ऑर्डर ${o.id} की पुष्टि करें, रद्द करें, पता बदलें या ऑनलाइन भुगतान पर 5% छूट लें।`,`Ek reminder: COD order ${o.id} confirm/cancel karein, address badlein ya online pay karke 5% off lein.`)}});
        await t.cODConfirmation.update({where:{orderId:o.id},data:{reminderSentAt:new Date()}});
      }else{
        await t.cODConfirmation.update({where:{orderId:o.id},data:{status:"ON_HOLD",heldAt:new Date()}});
        await t.order.update({where:{id:o.id},data:{status:"ON_HOLD"}});
      }
      await audit(t,"SYSTEM",job.kind.replaceAll("_"," "),o.id,{}, {deliveredThrough:"demo web channel"},c.id);
    }else if(job.kind==="NDR_SEND"){
      if(o.status!=="DELIVERY_FAILED"){await t.outboxJob.update({where:{id:jobId},data:{state:"DONE",lockedUntil:null}});return;}
      const c=await t.conversation.findUniqueOrThrow({where:{id:p.conversationId}});
      await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:p.conversationId,role:"assistant",dedupeKey:job.id,content:say(c.language,
        `Delivery of ${o.id} failed. Courier reason: ${p.reason}. Please share a retry date within the next 3 days, a corrected address/landmark, or an alternate phone. You may also refuse delivery; we will record the reason and request RTO. Please verify the order ID and registered phone before changing details.`,
        `ऑर्डर ${o.id} की डिलीवरी असफल रही। कूरियर का कारण: ${p.reason}। अगले 3 दिन में दोबारा डिलीवरी की तारीख, सही पता/लैंडमार्क या दूसरा फोन दें। मना करने पर कारण लेकर RTO माँगा जाएगा। बदलाव से पहले ऑर्डर आईडी और पंजीकृत फोन से सत्यापन करें।`,
        `Order ${o.id} ki delivery fail hui. Courier reason: ${p.reason}. Agle 3 din ki retry date, sahi address/landmark ya alternate phone batayein. Mana karna ho toh reason dekar RTO maang sakte hain. Pehle order ID aur registered phone verify karein.`)}});
      await audit(t,"SYSTEM","Contacted customer after failed delivery",o.id,{}, {reason:p.reason},p.conversationId);
    }else if(job.kind==="NDR_SUBMIT"){
      const old=await t.courierInstruction.findUniqueOrThrow({where:{id:p.instructionId}});
      const acknowledgement=await acknowledgeCourierInstruction(t,p.instructionId);
      if(acknowledgement.status==="ACKNOWLEDGED"){
        const c=await t.conversation.findUniqueOrThrow({where:{id:p.conversationId}});
        await t.message.upsert({where:{dedupeKey:job.id},update:{},create:{conversationId:c.id,role:"assistant",dedupeKey:job.id,content:say(c.language,`Mock courier acknowledged your instructions for ${o.id}. Reference ${acknowledgement.acknowledgementId}.`,`ऑर्डर ${o.id} के निर्देश कूरियर ने स्वीकार कर लिए हैं। संदर्भ ${acknowledgement.acknowledgementId}।`,`Order ${o.id} ki instructions mock courier ne accept kar li hain. Reference ${acknowledgement.acknowledgementId}.`)}});
        await audit(t,"MOCK_COURIER","Acknowledged customer delivery instructions",o.id,{status:old.status},{status:acknowledgement.status,acknowledgementId:acknowledgement.acknowledgementId},c.id);
      }
    }else if(job.kind==="NDR_CHECK"){
      const ndr=await t.nDRCase.findUnique({where:{eventId:p.eventId}});
      if(o.status==="DELIVERY_FAILED"&&ndr?.status==="AWAITING_CUSTOMER"&&ndr.attemptCount>=2){
        // An incomplete/clarifying reply is still a response. Do not confuse
        // "instructions not submitted yet" with the assignment's "no response".
        const response=await t.message.findFirst({where:{conversationId:p.conversationId,role:"user",createdAt:{gte:ndr.createdAt}},select:{id:true}});
        if(!response)await handover(p.conversationId,"Two failed delivery attempts without a response",undefined,t);
      }
    }
    await t.outboxJob.update({where:{id:jobId},data:{state:"DONE",lockedUntil:null}});
  },{timeout:15000});refresh();
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
    for(const {id} of jobs){try{await runJob(id);}catch(e){const job=await prisma.outboxJob.findUniqueOrThrow({where:{id}});await prisma.outboxJob.update({where:{id},data:{state:job.attempts>=5?"FAILED":"PENDING",lockedUntil:null,dueAt:new Date(Date.now()+Math.min(30000,1000*2**job.attempts)),lastError:"Job failed; see redacted diagnostic category"}});if(job.attempts>=5&&job.kind==="NDR_SUBMIT"){const p=job.payload as any;await prisma.courierInstruction.update({where:{id:p.instructionId},data:{status:"FAILED"}});await handover(p.conversationId,"Mock courier could not acknowledge instructions after repeated retries");}logger.warn({jobId:id,errorType:e instanceof Error?e.name:"unknown"},"Background job failed");}}
  }finally{running=false;}
}
export function startQueue(){const timer=setInterval(()=>{void workQueue().catch(e=>logger.error({errorType:e?.name},"Queue polling failed"));},1000);timer.unref();}
