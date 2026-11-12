import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma,policyNow } from "../lib/db";
import { orderInclude,startCod,codRespond,courierEvent } from "../lib/operations";
import { executeTool,commitPending,respondAgent } from "../lib/agent";
import { runJob } from "../lib/queue";
import { trackIssue } from "../lib/workflow-rules";
async function fixture(quantity=1){
  const s=await prisma.order.findUniqueOrThrow({where:{id:"WL10239"},include:orderInclude});
  const id=`EVAL-${randomUUID().slice(0,12)}`,i=s.items[0]!,subtotal=Number(i.unitPrice)*quantity;
  const o=await prisma.order.create({data:{id,isEvaluation:true,isDemo:true,customerId:s.customerId,verificationPhone:s.verificationPhone,
    createdAt:policyNow(),deliveredAt:new Date(policyNow().getTime()-3*86400000),status:"DELIVERED",fulfillmentStatus:"FULFILLED",
    scenarioTag:"mandatory_regression",shippingAddress:s.shippingAddress!,notes:[],sourceRecord:{evaluation:true},
    items:{create:{id:`${id}:0`,sourceIndex:0,sku:i.sku,productName:i.productName,size:i.size,quantity,unitPrice:i.unitPrice,isSaleItem:false,isInnerwear:false}},
    payment:{create:{method:"COD",status:"PENDING",subtotal,shippingFee:0,codFee:49,discount:0,total:subtotal+49,amountDueAtDelivery:subtotal+49}}},include:orderInclude});
  const c=await prisma.conversation.create({data:{customerId:o.customerId,orderId:o.id,isEvaluation:true,verifiedAt:new Date(),verifiedPhone:o.verificationPhone.replace(/\D/g,"").slice(-10)}});
  return {o,c,ctx:{conversationId:c.id,customerId:c.customerId,version:c.version}};
}
test("COD return collects refund preference and persists the confirmed quantity and amount",async()=>{
  const {o,ctx}=await fixture();
  const input={orderId:o.id,kind:"RETURN",quantity:1,unused:true,tagsAttached:true};
  const missing=await executeTool(ctx,"create_return_request",input);assert.equal(missing.needsRefundMethod,true);
  assert.equal(await prisma.pendingAction.count({where:{conversationId:ctx.conversationId}}),0);
  const proposal=await executeTool(ctx,"create_return_request",{...input,refundMethod:"STORE_CREDIT"});
  assert.equal(proposal.requiresConfirmation,true);assert.match(proposal.message,/STORE_CREDIT/);
  await commitPending(ctx);
  const request=await prisma.returnRequest.findFirstOrThrow({where:{orderId:o.id}});
  assert.equal(request.quantity,1);assert.equal(request.refundMethod,"STORE_CREDIT");assert.equal(Number(request.refundAmount),1299);
  await assert.rejects(()=>commitPending(ctx),/no current action/i);
});
test("multi-unit refund uses total requested value for mandatory review",async()=>{
  const {o,ctx}=await fixture(2);
  const result=await executeTool(ctx,"evaluate_return_eligibility",{orderId:o.id,kind:"RETURN",quantity:2,unused:true,tagsAttached:true,refundMethod:"BANK_TRANSFER"});
  assert.equal(result.manualReview,true);assert.equal(result.amount,2598);
  assert.equal((await prisma.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}})).status,"NEEDS_HUMAN");
  assert.equal(await prisma.returnRequest.count({where:{orderId:o.id}}),0);
});
test("Hindi consent and result stay Hindi, and audit records real status transitions",async()=>{
  const {o,ctx}=await fixture();
  await prisma.order.update({where:{id:o.id},data:{status:"UNFULFILLED",fulfillmentStatus:"UNFULFILLED"}});
  await prisma.conversation.update({where:{id:ctx.conversationId},data:{language:"Hindi"}});
  const result=await executeTool(ctx,"cancel_order",{orderId:o.id});
  assert.match(result.message,/रद्द/);
  assert.doesNotMatch(result.message,/Please reply/);
  const applied=await commitPending(ctx);assert.match(applied.message,/रद्द/);
  const log=await prisma.auditLog.findFirstOrThrow({where:{orderId:o.id,action:"Confirmed CANCEL"}});
  assert.equal((log.oldValue as any).status,"UNFULFILLED");assert.equal((log.newValue as any).status,"CANCELLED");
});
test("same unresolved issue persists across turns and escalates at its configured limit",async()=>{
  const {ctx}=await fixture();
  await trackIssue(ctx.conversationId,"Refund status please");
  await trackIssue(ctx.conversationId,"It is still not fixed");
  await prisma.message.create({data:{conversationId:ctx.conversationId,role:"user",content:"It is still not fixed"}});
  await respondAgent(ctx.conversationId,"It is still not fixed");
  const c=await prisma.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}});
  assert.equal(c.unresolvedTurns,2);assert.equal(c.status,"NEEDS_HUMAN");
  const ticket=await prisma.supportTicket.findUniqueOrThrow({where:{conversationId:c.id}});
  assert.match(ticket.summary,/Request:.*Refund status/);assert.equal(ticket.summary.split("\n").length,3);
});
test("COD hold and confirmation share a lock and cannot leave contradictory state",async()=>{
  const {o}=await fixture();
  await prisma.order.update({where:{id:o.id},data:{status:"UNFULFILLED",fulfillmentStatus:"UNFULFILLED"}});
  await startCod(o.id);await runJob(`cod-send:${o.id}`);
  await Promise.allSettled([codRespond(o.id,{action:"CONFIRM"}),runJob(`cod-hold:${o.id}`)]);
  const order=await prisma.order.findUniqueOrThrow({where:{id:o.id},include:{cod:true}});
  assert.ok((order.cod?.status==="CONFIRMED"&&order.status==="READY_TO_SHIP")||(order.cod?.status==="ON_HOLD"&&order.status==="ON_HOLD"));
});
test("NDR consent rechecks the date and delivered cases do not trigger stale handovers",async()=>{
  const {o,ctx}=await fixture();
  await prisma.order.update({where:{id:o.id},data:{status:"IN_TRANSIT",fulfillmentStatus:"FULFILLED"}});
  await courierEvent(o.id,{status:"DELIVERY_FAILED",reason:"CUSTOMER_NOT_AVAILABLE",eventId:`failure1-${o.id}`});
  await courierEvent(o.id,{status:"DELIVERY_FAILED",reason:"CUSTOMER_NOT_AVAILABLE",eventId:`failure2-${o.id}`});
  const date=new Date(policyNow().getTime()+86400000).toISOString().slice(0,10);
  const proposed=await executeTool(ctx,"submit_ndr_response",{orderId:o.id,retryDate:date});
  assert.equal(proposed.requiresConfirmation,true);
  const pending=await prisma.pendingAction.findFirstOrThrow({where:{conversationId:ctx.conversationId,status:"PENDING"}});
  await prisma.pendingAction.update({where:{id:pending.id},data:{payload:{orderId:o.id,retryDate:"2000-01-01"}}});
  await assert.rejects(()=>commitPending(ctx),/within the next 3 days/);
  assert.equal(await prisma.courierInstruction.count({where:{orderId:o.id}}),0);
  await courierEvent(o.id,{status:"DELIVERED",eventId:`delivered-${o.id}`});
  await runJob(`ndr-check:failure2-${o.id}`);
  const ticket=await prisma.supportTicket.count({where:{conversation:{orderId:o.id}}});assert.equal(ticket,0);
});
