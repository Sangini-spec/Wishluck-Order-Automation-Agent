import { randomUUID, createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Prisma } from "@prisma/client";
import { prisma, json, policyNow, HttpError, demoMode } from "./db";
import { scoreRisk, codEligibility, shippingFee, prepaidQuote, redact, phoneDigits } from "./policy";
export const events=new EventEmitter();events.setMaxListeners(200);
export const refresh=()=>events.emit("refresh");
export const orderInclude={customer:true,payment:true,items:true,shipments:{include:{events:{orderBy:{occurredAt:"asc" as const}}}},returns:true,refunds:true,cod:true} satisfies Prisma.OrderInclude;
export const maskPhone=(v:string)=>`••••••${v.replace(/\D/g,"").slice(-4)}`;
export async function settings(){
  const s=await prisma.appSetting.findUniqueOrThrow({where:{key:"workflow"}});
  const source=await prisma.seedDataset.findUniqueOrThrow({where:{id:"wishluck-source"}});
  return {...s.value as object,demoMode,demoClock:policyNow().toISOString(),policy:source.policy};
}
export async function riskFor(o:any){
  const cfg:any=await settings(),a=o.shippingAddress as any;
  const pin=await prisma.pincodeServiceability.findUnique({where:{pincode:String(a.pincode)}});
  const since=new Date(o.createdAt.getTime()-86400000);
  const recent=await prisma.order.count({where:{customerId:o.customerId,isEvaluation:o.isEvaluation,createdAt:{gte:since,lte:o.createdAt},payment:{method:"COD"}}});
  const risk=scoreRisk({total:Number(o.payment.total),first:(o.sourceRecord as any)?.firstTimeAtPlacement??o.customer.isFirstTimeCustomer,refusals:o.customer.codRefusalsLast12Months,weakAddress:!/\d/.test(a.line1||"")||/near.*(?:temple|mandir)/i.test(a.line1||""),codAvailable:!!pin?.codAvailable,recentOrders:recent},cfg.riskMediumThreshold,cfg.riskHighThreshold);
  const eligibility=codEligibility(Number(o.payment.total),!!pin?.codAvailable);
  return {...risk,eligible:eligibility.eligible,eligibilityReason:eligibility.reason};
}
export async function orderView(o:any,detail=false){
  const risk=o.payment?.method==="COD"?await riskFor(o):undefined;
  const attempts=await prisma.paymentAttempt.findMany({where:{orderId:o.id},orderBy:{createdAt:"desc"},select:{id:true,amount:true,discount:true,status:true,purpose:true,createdAt:true}});
  const v={id:o.id,customerId:o.customerId,customerName:o.customer.name,customerPhone:maskPhone(o.verificationPhone),status:o.status,fulfillmentStatus:o.fulfillmentStatus,paymentMethod:o.payment?.method||"",paymentStatus:o.payment?.status||"",total:Number(o.payment?.total||0),createdAt:o.createdAt.toISOString(),deliveredAt:o.deliveredAt?.toISOString()||null,scenarioTag:o.scenarioTag,isDemo:o.isDemo,origin:o.origin,paymentAttempts:attempts.map(x=>({...x,amount:Number(x.amount),discount:Number(x.discount)})),items:o.items,shippingAddress:o.shippingAddress,payment:o.payment,shipments:o.shipments,returns:o.returns.map(({sourceRecord,...x}:any)=>x),refunds:o.refunds.map(({sourceRecord,...x}:any)=>x),...(o.cod?{cod:((({sourceRecord,...c}:any)=>c)(o.cod))}:{}),...(risk?{risk}:{}),notes:o.notes,
    warnings:await prisma.dataQualityIssue.findMany({where:{entityId:{in:[o.id,o.customerId]}}}),
    ...(detail?{audit:await prisma.auditLog.findMany({where:{orderId:o.id},orderBy:{createdAt:"desc"},take:100})}:{})};
  v.shipments=v.shipments.map(({sourceRecord,...s}:any)=>s);
  const serialized=json(v);
  if(serialized.payment) for(const key of ["subtotal","shippingFee","codFee","discount","total","amountDueAtDelivery"])serialized.payment[key]=Number(serialized.payment[key]);
  serialized.items=serialized.items.map((i:any)=>({...i,unitPrice:Number(i.unitPrice)}));
  return serialized;
}
export async function audit(t:any,actor:string,action:string,orderId:string|null,oldValue:any,newValue:any,conversationId:string|null=null){
  await t.auditLog.create({data:{actor,action,orderId,conversationId,oldValue:json(redact(oldValue??{})),newValue:json(redact(newValue??{}))}});
}
export async function createConversation(customerId:string){
  if(!await prisma.customer.findUnique({where:{id:customerId}}))throw new HttpError(400,"Customer not found.");
  const c=await prisma.conversation.create({data:{customerId,messages:{create:{role:"assistant",content:"Hi! I’m WishLuck’s support assistant. I can help in English, Hindi or Hinglish. For order details, please share your order ID and registered phone number."}}}});
  refresh();return c;
}
export async function conversationView(id:string,team:boolean){
  const c=await prisma.conversation.findUnique({where:{id},include:{customer:true,messages:{orderBy:{createdAt:"asc"}},tools:{orderBy:{createdAt:"asc"}},ticket:true,pendingActions:{where:{status:"PENDING",expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},take:1}}});
  if(!c)throw new HttpError(404,"Conversation not found.");
  return json({id:c.id,customerId:c.customerId,customerName:c.customer.name,customerPhone:maskPhone(c.customer.phone),status:c.status,language:c.language,orderId:c.orderId,verified:!!c.verifiedAt&&Date.now()-c.verifiedAt.getTime()<30*60000,updatedAt:c.updatedAt,lastMessage:c.messages.at(-1)?.content||"",handoverReason:c.handoverReason,messages:c.messages,...(team?{tools:c.tools,ticket:c.ticket?{...c.ticket,customerName:c.customer.name}:undefined}:{}),...(c.pendingActions[0]?{pendingAction:{id:c.pendingActions[0].id,action:c.pendingActions[0].action,orderId:c.pendingActions[0].orderId}}:{})});
}
export async function handover(conversationId:string,reason:string,summary?:string,t:any=prisma){
  const c=await t.conversation.findUniqueOrThrow({where:{id:conversationId},include:{messages:{orderBy:{createdAt:"desc"},take:4}}});
  if(c.status==="NEEDS_HUMAN")return {success:true,message:"A support person will join this conversation."};
  await t.conversation.update({where:{id:conversationId},data:{status:"NEEDS_HUMAN",handoverReason:reason,version:{increment:1}}});
  await t.pendingAction.updateMany({where:{conversationId,status:"PENDING"},data:{status:"INVALIDATED"}});
  await t.supportTicket.upsert({where:{conversationId},update:{status:"OPEN",reason},create:{conversationId,orderId:c.orderId,reason,sentiment:/legal|upset|threat/i.test(reason)?"UPSET":"NEUTRAL",priority:/legal|refund/i.test(reason)?"HIGH":"NORMAL",summary:summary||`Customer needs help with ${c.intent||"an unresolved request"}. ${c.orderId?`Order ${c.orderId}.`:"Order not verified."} ${redact(c.messages.find((m:any)=>m.role==="user")?.content||"Review the conversation for context.")}`,suggestedReply:"Hi, I’m from the WishLuck support team. I’ve reviewed your conversation and will help resolve this. Could you confirm the details of your concern?"}});
  await t.message.create({data:{conversationId,role:"assistant",content:"I’m handing this to a person from our support team. They’ll review the context and join here; I’ll stop replying automatically."}});
  await audit(t,"AI","Handed conversation to support",c.orderId,{}, {reason},conversationId);
  refresh();return {success:true,message:"Handed over to a support person."};
}
export async function outreachConversation(t:any,orderId:string,customerId:string){
  let c=await t.conversation.findFirst({where:{customerId,orderId,status:{not:"RESOLVED"}},orderBy:{createdAt:"desc"}});
  if(!c){const o=await t.order.findUniqueOrThrow({where:{id:orderId}});c=await t.conversation.create({data:{customerId,orderId,isEvaluation:o.isEvaluation}});}
  return c;
}
export async function enqueue(t:any,id:string,kind:string,payload:any,seconds=0){
  await t.outboxJob.upsert({where:{id},update:{},create:{id,kind,payload:json(payload),dueAt:new Date(Date.now()+seconds*1000)}});
}
export async function startCod(orderId:string){
  const o=await prisma.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude});
  if(o.payment?.method!=="COD"||o.fulfillmentStatus!=="UNFULFILLED"||["CANCELLED","ON_HOLD"].includes(o.status))throw new HttpError(409,"Only unshipped, active COD orders can start confirmation.");
  const r=await riskFor(o);if(!r.eligible)throw new HttpError(409,r.eligibilityReason);
  const cfg:any=await settings();
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    const existing=await t.cODConfirmation.findUnique({where:{orderId}});
    if(existing?.messageSentAt)return;
    if(!existing)await t.cODConfirmation.create({data:{orderId,customerId:o.customerId,riskScore:r.score,riskBand:r.band,riskReasons:r.reasons,status:"PENDING",reminderDueAfterMinutes:120,holdAfterMinutes:1440,options:["CONFIRM","CANCEL","EDIT_ADDRESS","PAY_ONLINE_5_PERCENT_OFF"],prepaidDiscountPercent:5,sourceRecord:{runtime:true}}});
    await t.riskAssessment.create({data:{orderId,score:r.score,band:r.band,reasons:r.reasons,version:"rules-1"}});
    await enqueue(t,`cod-send:${orderId}`,"COD_SEND",{orderId});
    await enqueue(t,`cod-reminder:${orderId}`,"COD_REMINDER",{orderId},cfg.codReminderSeconds);
    await enqueue(t,`cod-hold:${orderId}`,"COD_HOLD",{orderId},cfg.codHoldSeconds);
    await audit(t,"SYSTEM","Started COD confirmation",orderId,{},r);
  });refresh();
  return {success:true,message:"Confirmation queued in the demo web channel. Reminder and hold timers are active."};
}
export async function codRespond(orderId:string,input:any){
  if(input.action==="START")return startCod(orderId);
  let message="";let paymentId:string|undefined;
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    const o:any=await t.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude});
    if(!o.cod)throw new HttpError(409,"Start the COD confirmation workflow first.");
    if(o.fulfillmentStatus!=="UNFULFILLED"||["CANCELLED","ON_HOLD"].includes(o.status))throw new HttpError(409,"This order is no longer awaiting pre-dispatch confirmation.");
    if(o.cod.status!=="PENDING")throw new HttpError(409,"This COD confirmation has already been answered.");
    if(!o.cod.messageSentAt)throw new HttpError(409,"Start the workflow and wait for its confirmation message before accepting a response.");
    const r=await riskFor(o);
    if(!r.eligible&&["CONFIRM","EDIT_ADDRESS"].includes(input.action))throw new HttpError(409,r.eligibilityReason);
    if(input.action==="CONFIRM"){
      await t.paymentAttempt.updateMany({where:{orderId,status:"PENDING",purpose:"COD_CONVERSION"},data:{status:"CANCELLED"}});
      await t.cODConfirmation.update({where:{orderId},data:{status:"CONFIRMED"}});await t.order.update({where:{id:orderId},data:{status:"READY_TO_SHIP"}});message="COD confirmed. This order is ready to ship.";
    }
    else if(input.action==="CANCEL"){
      const {releaseReservedStock}=await import("./checkout");
      await releaseReservedStock(t,orderId);
      await t.paymentAttempt.updateMany({where:{orderId,status:"PENDING",purpose:"COD_CONVERSION"},data:{status:"CANCELLED"}});
      await t.cODConfirmation.update({where:{orderId},data:{status:"CANCELLED"}});
      await t.order.update({where:{id:orderId},data:{status:"CANCELLED"}});message="The unshipped COD order has been cancelled.";
    }
    else if(input.action==="EDIT_ADDRESS"){
      const a=input.address;if(!a||!a.line1||!a.city||!a.pincode)throw new HttpError(400,"Provide address line1, city and pincode.");
      const pin=await t.pincodeServiceability.findUnique({where:{pincode:String(a.pincode)}});
      if(!pin?.codAvailable)throw new HttpError(400,"COD is unavailable or serviceability is unknown at the new pincode.");
      const changed=json({...o.shippingAddress,...a});
      await t.order.update({where:{id:orderId},data:{shippingAddress:changed}});
      const cfg:any=await settings(),recent=await t.order.count({where:{customerId:o.customerId,payment:{method:"COD"},isEvaluation:o.isEvaluation,createdAt:{gte:new Date(o.createdAt.getTime()-86400000),lte:o.createdAt}}});
      const r2=scoreRisk({total:Number(o.payment.total),first:(o.sourceRecord as any)?.firstTimeAtPlacement??o.customer.isFirstTimeCustomer,
        refusals:o.customer.codRefusalsLast12Months,weakAddress:!/\d/.test(changed.line1)||/near.*(?:temple|mandir)/i.test(changed.line1),
        codAvailable:true,recentOrders:recent},cfg.riskMediumThreshold,cfg.riskHighThreshold);
      await t.cODConfirmation.update({where:{orderId},data:{riskScore:r2.score,riskBand:r2.band,riskReasons:r2.reasons}});
      await t.riskAssessment.create({data:{orderId,score:r2.score,band:r2.band,reasons:r2.reasons,version:"rules-1"}});
      await audit(t,"CUSTOMER","Updated delivery address before COD dispatch",orderId,{shippingAddress:o.shippingAddress},{shippingAddress:changed});
      message="Address updated before dispatch. Please confirm the COD order separately.";
    }else if(input.action==="PAY_ONLINE"){
      const quote=prepaidQuote(Number(o.payment.subtotal),Number(o.payment.shippingFee),Number(o.payment.discount));
      const pending=await t.paymentAttempt.findFirst({where:{orderId,status:"PENDING",purpose:"COD_CONVERSION"},orderBy:{createdAt:"desc"}});
      const p=pending??await t.paymentAttempt.create({data:{orderId,...quote}});paymentId=p.id;message=`Demo payment created for ₹${quote.amount}. The 5% discount is on merchandise and the COD fee is removed. Complete the explicit payment simulation to mark it paid.`;
    }else if(input.action==="PAYMENT_SUCCESS"){
      const p=await t.paymentAttempt.findUnique({where:{id:input.paymentId||""}});
      if(!p||p.orderId!==orderId||p.status!=="PENDING")throw new HttpError(409,"No matching pending simulated payment.");
      await t.paymentAttempt.update({where:{id:p.id},data:{status:"SUCCEEDED"}});
      await t.orderPayment.update({where:{orderId},data:{method:"PREPAID",status:"PAID",discount:p.discount,total:p.amount,codFee:0,amountDueAtDelivery:0}});
      await t.cODConfirmation.update({where:{orderId},data:{status:"CONVERTED_PREPAID"}});
      await t.order.update({where:{id:orderId},data:{status:"READY_TO_SHIP"}});message="Simulated payment succeeded. The order is prepaid with 5% off merchandise.";
    }else throw new HttpError(400,"Unknown COD response.");
    await audit(t,"DEMO_CUSTOMER",`COD: ${input.action}`,orderId,{status:o.status,paymentStatus:o.payment.status},{message});
  });refresh();return {success:true,message,...(paymentId?{paymentId}:{})};
}
export async function createTestOrder(input:any,webhookId?:string){
  const p=await prisma.product.findUnique({where:{sku:input.sku}}),c=await prisma.customer.findUnique({where:{id:input.customerId}});
  if(!p||!c||!p.sizes.includes(input.size))throw new HttpError(400,"Choose an existing customer, product and valid size.");
  const address=c.address as any;
  if(phoneDigits(c.phone).length!==10||!address?.line1||!address?.city||!address?.state||!/^\d{6}$/.test(address?.pincode||""))throw new HttpError(400,"Ask this customer to complete their phone number and delivery address in Profile before creating an order.");
  const id=webhookId?`DEMO-HOOK-${createHash("sha256").update(webhookId).digest("hex").slice(0,10).toUpperCase()}`:`DEMO-${randomUUID().slice(0,8).toUpperCase()}`,subtotal=Number(p.price)*input.quantity,ship=shippingFee(subtotal),cod=input.paymentMethod==="COD"?49:0;
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Customer" WHERE id=${c.id} FOR UPDATE`;
    if(webhookId){
      const eventKey=`order:${webhookId}`,hash=createHash("sha256").update(JSON.stringify(input)).digest("hex"),existing=await t.webhookEvent.findUnique({where:{id:eventKey}});
      if(existing){if(existing.payloadHash!==hash)throw new HttpError(409,"Webhook ID was reused with different content.");return;}
      await t.webhookEvent.create({data:{id:eventKey,provider:"orders",payloadHash:hash}});
    }
    const stock=await t.inventory.updateMany({where:{sku:p.sku,size:input.size,available:{gte:input.quantity}},data:{available:{decrement:input.quantity}}});if(!stock.count)throw new HttpError(409,"Requested size is out of stock.");
    await t.order.create({data:{id,customerId:c.id,origin:webhookId?"ORDER_WEBHOOK":"TEAM_TEST",scenarioTag:"runtime_test_order",createdAt:policyNow(),status:"UNFULFILLED",fulfillmentStatus:"UNFULFILLED",shippingAddress:c.address!,verificationPhone:c.phone,notes:["Evaluator-created demo order; not part of the 30 source orders."],sourceRecord:{runtime:true},isDemo:true,inventoryReserved:true,items:{create:{id:`${id}:0`,sourceIndex:0,sku:p.sku,productName:p.name,quantity:input.quantity,unitPrice:p.price,size:input.size,isSaleItem:p.sku==="WL-SAL-06",isInnerwear:p.category==="Innerwear"}},payment:{create:{method:input.paymentMethod,status:input.paymentMethod==="COD"?"PENDING":"PAID",subtotal,shippingFee:ship,codFee:cod,discount:0,total:subtotal+ship+cod,amountDueAtDelivery:cod?subtotal+ship+cod:0}}}});
    await audit(t,"TEAM","Created test order",id,{}, {customerId:c.id,sku:p.sku});
  });
  if(cod){const o=await prisma.order.findUniqueOrThrow({where:{id},include:orderInclude});const r=await riskFor(o);if(r.eligible&&(!o.cod||o.cod.status==="PENDING")&&o.fulfillmentStatus==="UNFULFILLED"&&o.status!=="CANCELLED")await startCod(id);else if(!r.eligible&&o.status==="UNFULFILLED")await prisma.order.update({where:{id},data:{status:"ON_HOLD",notes:{push:r.eligibilityReason}}});}
  refresh();return orderView(await prisma.order.findUniqueOrThrow({where:{id},include:orderInclude}),true);
}
export async function courierEvent(orderId:string,input:any){
  const eventId=input.eventId||`courier-${randomUUID()}`;
  let duplicate=false;
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    const seen=await t.webhookEvent.findUnique({where:{id:eventId}}),hash=createHash("sha256").update(JSON.stringify({orderId,status:input.status,reason:input.reason||null})).digest("hex");
    if(seen){if(seen.payloadHash!==hash)throw new HttpError(409,"Event ID was reused with different content.");duplicate=true;return;}
    const o=await t.order.findUniqueOrThrow({where:{id:orderId},include:{shipments:true,payment:true,customer:true}});
    if(o.status==="CANCELLED")throw new HttpError(409,"A cancelled order cannot receive new courier updates.");
    if(o.fulfillmentStatus==="UNFULFILLED"&&(o.status==="ON_HOLD"||(o.payment?.method==="PREPAID"&&o.payment.status!=="PAID")))throw new HttpError(409,"An on-hold or unpaid prepaid order cannot be dispatched.");
    if(o.fulfillmentStatus==="UNFULFILLED"&&input.status!=="PICKED_UP")throw new HttpError(409,"Trigger PICKED_UP before subsequent courier events.");
    if(o.payment?.method==="COD"&&o.fulfillmentStatus==="UNFULFILLED"){const c=await t.cODConfirmation.findUnique({where:{orderId}});if(c?.status!=="CONFIRMED")throw new HttpError(409,"Confirm COD before dispatch.");const pin=await t.pincodeServiceability.findUnique({where:{pincode:String((o.shippingAddress as any).pincode)}});if(!codEligibility(Number(o.payment.total),!!pin?.codAvailable).eligible)throw new HttpError(409,"COD is ineligible for dispatch.");}
    let s=o.shipments[0];
    if(!s)s=await t.shipment.create({data:{id:`SHP-${randomUUID().slice(0,8)}`,orderId,carrier:"WishLuck Mock Courier",trackingNumber:`DEMO-${orderId}`,trackingUrl:`/store/orders`,status:"PICKED_UP",attemptCount:0,sourceRecord:{runtime:true}}});
    const reason=input.status==="DELIVERY_FAILED"?(input.reason||"CUSTOMER_NOT_AVAILABLE"):null;
    await t.webhookEvent.create({data:{id:eventId,provider:"mock-courier",payloadHash:hash}});
    await t.shipmentEvent.create({data:{id:eventId,shipmentId:s.id,status:input.status,reason,occurredAt:policyNow(),source:"MOCK_COURIER",sourceIndex:await t.shipmentEvent.count({where:{shipmentId:s.id}})}});
    await t.shipment.update({where:{id:s.id},data:{status:input.status,...(reason?{lastFailureReason:reason,attemptCount:{increment:1}}:{})}});
    await t.order.update({where:{id:orderId},data:{status:input.status,fulfillmentStatus:"FULFILLED",...(input.status==="DELIVERED"?{deliveredAt:policyNow()}:{}),notes:{push:`Courier: ${input.status}${reason?` (${reason})`:""}`}}});
    if(reason){
      const c=await outreachConversation(t,orderId,o.customerId),cfg:any=await settings();
      await t.nDRCase.create({data:{orderId,shipmentId:s.id,reason,attemptCount:s.attemptCount+1,conversationId:c.id,eventId}});
      await enqueue(t,`ndr-send:${eventId}`,"NDR_SEND",{orderId,conversationId:c.id,reason,eventId});
      await enqueue(t,`ndr-check:${eventId}`,"NDR_CHECK",{orderId,conversationId:c.id,eventId},cfg.ndrFollowupSeconds);
    }
    if(input.status==="DELIVERED")await t.nDRCase.updateMany({where:{orderId,status:"REATTEMPT_REQUESTED"},data:{status:"SAVED_DELIVERED"}});
    await audit(t,"MOCK_COURIER",`Courier: ${input.status}`,orderId,{status:o.status},{status:input.status,reason});
  });refresh();return {success:true,message:duplicate?"Duplicate event acknowledged; no second mutation or notification.":"Courier event recorded. Relevant customer follow-up queued."};
}
