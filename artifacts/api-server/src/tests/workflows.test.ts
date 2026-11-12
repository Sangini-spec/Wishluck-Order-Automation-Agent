import { test,after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID,createHmac } from "node:crypto";
import { createServer } from "node:http";
import { prisma,policyNow } from "../lib/db";
import { orderInclude, riskFor, startCod, codRespond, courierEvent } from "../lib/operations";
import { runJob } from "../lib/queue";
import { executeTool, commitPending } from "../lib/agent";
import app from "../app";

async function clone(sourceId:string,weak=false){
  const source=await prisma.order.findUniqueOrThrow({where:{id:sourceId},include:orderInclude});
  const id=`EVAL-${randomUUID().slice(0,8).toUpperCase()}`;
  const {orderId,...payment}=source.payment!;
  return prisma.order.create({data:{
    id,isEvaluation:true,isDemo:true,customerId:source.customerId,verificationPhone:source.verificationPhone,createdAt:policyNow(),
    status:"UNFULFILLED",fulfillmentStatus:"UNFULFILLED",scenarioTag:"automated_workflow_fixture",shippingAddress:weak?{...source.shippingAddress as object,line1:"near Shiv mandir"}:source.shippingAddress!,
    notes:["Automated evaluation fixture; source record and IDs remain unchanged."],sourceRecord:{evaluation:true,sourceId},
    payment:{create:{method:payment.method,status:payment.status,subtotal:payment.subtotal,shippingFee:payment.shippingFee,codFee:payment.codFee,discount:payment.discount,total:payment.total,amountDueAtDelivery:payment.amountDueAtDelivery}},
    items:{create:source.items.map((i,index)=>({id:`${id}:${index}`,sourceIndex:index,sku:i.sku,productName:i.productName,quantity:i.quantity,unitPrice:i.unitPrice,size:i.size,isSaleItem:i.isSaleItem,isInnerwear:i.isInnerwear}))}
  },include:orderInclude});
}
after(async()=>{await prisma.$disconnect();});

test("B7 high-risk ₹4,600 COD confirmation and exactly one reminder/hold",async()=>{
  const o=await clone("WL10236",true),risk=await riskFor(o);
  assert.equal(Number(o.payment?.total),4600);assert.equal(risk.band,"HIGH");assert.equal(risk.eligible,true);
  await startCod(o.id);
  await runJob(`cod-send:${o.id}`);await runJob(`cod-send:${o.id}`);
  const messages=await prisma.message.findMany({where:{dedupeKey:`cod-send:${o.id}`}});
  assert.equal(messages.length,1);assert.match(messages[0]!.content,/₹4600/);
  const jobs=await prisma.outboxJob.findMany({where:{id:{in:[`cod-reminder:${o.id}`,`cod-hold:${o.id}`]}}});
  assert.equal(jobs.length,2);assert.ok(jobs[0]!.dueAt>new Date());
  await runJob(`cod-reminder:${o.id}`);await runJob(`cod-reminder:${o.id}`);
  assert.equal(await prisma.message.count({where:{dedupeKey:`cod-reminder:${o.id}`}}),1);
  await runJob(`cod-hold:${o.id}`);
  assert.equal((await prisma.order.findUniqueOrThrow({where:{id:o.id}})).status,"ON_HOLD");
});
test("COD confirmation dispatch, then duplicate response blocked",async()=>{
  const o=await clone("WL10236",true);await startCod(o.id);await runJob(`cod-send:${o.id}`);
  assert.match((await codRespond(o.id,{action:"CONFIRM"})).message,/ready to ship/i);
  await assert.rejects(()=>codRespond(o.id,{action:"CONFIRM"}),/already been answered/);
  await courierEvent(o.id,{status:"PICKED_UP",eventId:`ship-${o.id}`});
  assert.equal((await prisma.order.findUniqueOrThrow({where:{id:o.id}})).fulfillmentStatus,"FULFILLED");
});
test("prepaid conversion never charges or marks PAID before success",async()=>{
  const o=await clone("WL10236",true);await startCod(o.id);await runJob(`cod-send:${o.id}`);
  const quote=await codRespond(o.id,{action:"PAY_ONLINE"});
  assert.ok("paymentId" in quote && quote.paymentId);
  assert.equal((await prisma.orderPayment.findUniqueOrThrow({where:{orderId:o.id}})).method,"COD");
  await codRespond(o.id,{action:"PAYMENT_SUCCESS",paymentId:quote.paymentId});
  const payment=await prisma.orderPayment.findUniqueOrThrow({where:{orderId:o.id}});
  assert.equal(payment.method,"PREPAID");assert.equal(payment.status,"PAID");assert.equal(Number(payment.total),4306.15);
  assert.equal((await prisma.cODConfirmation.findUniqueOrThrow({where:{orderId:o.id}})).status,"CONVERTED_PREPAID");
});
test("B8 failed delivery sends reason, accepts verified retry, updates mock courier",async()=>{
  const o=await clone("WL10234");
  await courierEvent(o.id,{status:"PICKED_UP",eventId:`pick-${o.id}`});
  await courierEvent(o.id,{status:"IN_TRANSIT",eventId:`transit-${o.id}`});
  await courierEvent(o.id,{status:"OUT_FOR_DELIVERY",eventId:`ofd-${o.id}`});
  const eventId=`failed-${o.id}`;
  await courierEvent(o.id,{status:"DELIVERY_FAILED",reason:"CUSTOMER_NOT_AVAILABLE",eventId});
  await runJob(`ndr-send:${eventId}`);
  const ndr=await prisma.nDRCase.findUniqueOrThrow({where:{eventId}});
  const sent=await prisma.message.findUniqueOrThrow({where:{dedupeKey:`ndr-send:${eventId}`}});
  assert.match(sent.content,/CUSTOMER_NOT_AVAILABLE/);
  const c=await prisma.conversation.update({where:{id:ndr.conversationId},data:{orderId:o.id,verifiedAt:new Date(),verifiedPhone:o.verificationPhone.replace(/\D/g,"").slice(-10)}});
  const date=new Date(policyNow().getTime()+86400000).toISOString().slice(0,10);
  const response=await executeTool({conversationId:c.id,customerId:o.customerId,version:c.version},"submit_ndr_response",{orderId:o.id,retryDate:date,landmark:"Office reception",address:{line1:"Demo office 22",city:"Mumbai",state:"Maharashtra",pincode:"400001"}});
  assert.equal(response.requiresConfirmation,true);
  assert.equal((await prisma.nDRCase.findUniqueOrThrow({where:{eventId}})).status,"AWAITING_CUSTOMER");
  await commitPending({conversationId:c.id,customerId:o.customerId,version:c.version});
  assert.equal((await prisma.nDRCase.findUniqueOrThrow({where:{eventId}})).status,"REATTEMPT_REQUESTED");
  assert.equal(((await prisma.order.findUniqueOrThrow({where:{id:o.id}})).shippingAddress as {line1:string}).line1,"Demo office 22");
  assert.equal(await prisma.shipmentEvent.count({where:{id:{startsWith:"ndr-response-"}}})>0,true);
});
test("customer API scopes orders, preserves source profiles and saves a new-account profile",async()=>{
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  let runtimeUserId:string|undefined,runtimeCustomerId:string|undefined;
  try{
    const address=server.address();assert.ok(address&&typeof address==="object");
    const base=`http://127.0.0.1:${address.port}/api`;
    const post=(path:string,body:unknown,cookie="")=>fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
    assert.equal((await fetch(base+"/profile")).status,401);
    const demo=await post("/auth/demo",{role:"CUSTOMER",customerId:"CUST-1006"});
    assert.equal(demo.status,200);const demoCookie=demo.headers.get("set-cookie")!.split(";")[0]!;
    const profile=await fetch(base+"/profile",{headers:{Cookie:demoCookie}});assert.equal(profile.status,200);
    assert.equal(((await profile.json()) as {editable:boolean}).editable,false);
    assert.equal((await fetch(base+"/orders/WL10234",{headers:{Cookie:demoCookie}})).status,404);
    assert.equal((await fetch(base+"/dashboard",{headers:{Cookie:demoCookie}})).status,403);
    assert.equal((await fetch(base+"/profile",{method:"PATCH",headers:{Cookie:demoCookie,"Content-Type":"application/json"},body:JSON.stringify({phone:"9000099999",address:{line1:"Demo house 1",city:"Mumbai",state:"Maharashtra",pincode:"400001"}})})).status,403);
    const reg=await post("/auth/register",{role:"CUSTOMER",username:`evalprofile${Date.now()}`,email:`evalprofile${Date.now()}@example.test`,password:"EvaluationProfile!2026"});
    assert.equal(reg.status,201);
    const user=((await reg.json()) as {user:{id:string;customerId:string}}).user;runtimeUserId=user.id;runtimeCustomerId=user.customerId;
    const cookie=reg.headers.get("set-cookie")!.split(";")[0]!;
    const saved=await fetch(base+"/profile",{method:"PATCH",headers:{Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({phone:"+91-9000099999",address:{line1:"Demo house 1",city:"Mumbai",state:"Maharashtra",pincode:"400001"}})});
    assert.equal(saved.status,200);
    assert.equal(((await saved.json()) as {phone:string}).phone,"+91-9000099999");
    assert.equal((await prisma.customer.findUniqueOrThrow({where:{id:"CUST-1006"}})).phone,"+91-9000010005");
  }finally{
    server.close();
    if(runtimeUserId){await prisma.session.deleteMany({where:{userId:runtimeUserId}});await prisma.user.delete({where:{id:runtimeUserId}});}
    if(runtimeCustomerId)await prisma.customer.delete({where:{id:runtimeCustomerId}});
  }
});
test("signed courier webhook is idempotent; bad signature cannot mutate",async()=>{
  const o=await clone("WL10234"),eventId=`web-${o.id}`,payload=JSON.stringify({orderId:o.id,eventId,status:"PICKED_UP"});
  const secret=process.env.WEBHOOK_SECRET||process.env.SESSION_SECRET;
  assert.ok(secret,"Webhook signing secret is required for this test.");
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    const address=server.address();assert.ok(address&&typeof address==="object");
    const url=`http://127.0.0.1:${address.port}/api/webhooks/courier`;
    const send=(signature:string)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-wishluck-signature":signature},body:payload});
    const bad=await send("0".repeat(64));assert.equal(bad.status,401);
    const signed=createHmac("sha256",secret).update(payload).digest("hex");
    const first=await send(signed);assert.equal(first.status,200);
    const second=await send(signed);assert.equal(second.status,200);assert.match(((await second.json()) as {message:string}).message,/Duplicate/);
    assert.equal(await prisma.shipmentEvent.count({where:{id:eventId}}),1);
  }finally{server.close();}
});
test("imported source relationships and IDs still exist after workflow simulations",async()=>{
  assert.equal(await prisma.order.count({where:{isEvaluation:false,isDemo:false}}),30);
  assert.equal(await prisma.customer.count({where:{id:{startsWith:"CUST-1"}}}),30);
  assert.equal(await prisma.returnRecord.count(),12);
  assert.equal(await prisma.refund.count(),4);
  assert.equal((await prisma.seedDataset.findUniqueOrThrow({where:{id:"wishluck-original"}})).hash,"b494fd9ec725a12ae6a937de54b12fa9ba11c0965ac2520b8eb5020f4adac196");
  assert.equal(await prisma.dataQualityIssue.count(),0);
});
