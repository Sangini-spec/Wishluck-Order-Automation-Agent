import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import app from "../app";
import { prisma } from "../lib/db";
import { runJob } from "../lib/queue";
import { releaseReservedStock } from "../lib/checkout";

test("a new customer checks out, responds to COD, and owns the whole flow",async()=>{
  const server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();assert.ok(address&&typeof address==="object");
  const base=`http://127.0.0.1:${address.port}/api`;
  const id=randomUUID().slice(0,12),orders:string[]=[];
  let customerId:string|undefined,userId:string|undefined;
  const send=(url:string,body:unknown,cookie="",method="POST")=>fetch(base+url,{method,headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
  const location={line1:"near Shiv mandir",landmark:"Shiv mandir",city:"Delhi",state:"Delhi",pincode:"110001"};
  const phone="+91-9000099887";
  const teeStock=await prisma.inventory.findFirst({where:{sku:"WL-TEE-02",available:{gte:2}},orderBy:{available:"desc"}});
  assert.ok(teeStock,"Checkout integration test needs two available units in one tee size.");
  const size=teeStock.size;
  try{
    const reg=await send("/auth/register",{username:`Shopper${id}`,email:`shopper${id}@example.test`,password:"FictionalCustomerPassword12!",role:"CUSTOMER"});
    assert.equal(reg.status,201);
    const user=(await reg.json()) as {user:{id:string,customerId:string}};customerId=user.user.customerId;userId=user.user.id;
    const cookie=reg.headers.get("set-cookie")!.split(";")[0]!;
    const team=await send("/auth/demo",{role:"TEAM"});
    assert.equal(team.status,200);const teamCookie=team.headers.get("set-cookie")!.split(";")[0]!;
    assert.equal((await fetch(base+"/cart",{headers:{Cookie:teamCookie}})).status,403);
    assert.equal((await send("/orders",{customerId:"CUST-1006",sku:"WL-TEE-02",size:"M",quantity:1,paymentMethod:"COD"},cookie)).status,403);
    assert.equal((await send("/checkout",{paymentMethod:"COD",phone,address:location,cartVersion:1,idempotencyKey:randomUUID()},teamCookie)).status,403);
    const add=await send("/cart",{sku:"WL-TEE-02",size,quantity:1,mode:"ADD"},cookie,"PATCH");
    assert.equal(add.status,200);
    const bag=await send("/cart",{sku:"WL-BAG-05",size:"One Size",quantity:4,mode:"ADD"},cookie,"PATCH");
    assert.equal(bag.status,200);
    const cart=(await bag.json()) as {version:number;count:number;subtotal:number;items:{unitPrice:number}[]};assert.equal(cart.count,5);assert.equal(cart.items.length,2);
    assert.equal((await send("/cart",{sku:"WL-TEE-02",size:"L",quantity:1,mode:"ADD"},cookie,"PATCH")).status,409);
    assert.equal((await send("/checkout/quote",{paymentMethod:"COD",phone,address:{...location,pincode:"000000"}},cookie)).status,400);
    const quote=await send("/checkout/quote",{paymentMethod:"COD",phone,address:location},cookie);
    assert.equal(quote.status,200);
    const estimate=(await quote.json()) as {subtotal:number;shippingFee:number;codFee:number;total:number;eligible:boolean;cartVersion:number};
    assert.equal(estimate.eligible,true);
    assert.equal(estimate.total,cart.subtotal+estimate.shippingFee+49);
    const input={paymentMethod:"COD",phone,address:location,cartVersion:cart.version,idempotencyKey:randomUUID()};
    const placed=await send("/checkout",input,cookie);assert.equal(placed.status,201);
    const first=(await placed.json()) as {id:string;origin:string;risk:{band:string;score:number};paymentStatus:string;cod:{status:string};paymentAttempts:any[]};
    orders.push(first.id);assert.equal(first.origin,"CUSTOMER_CHECKOUT");assert.equal(first.risk.band,"HIGH");
    assert.equal(first.paymentStatus,"PENDING");assert.equal(first.cod.status,"PENDING");
    const duplicates=await Promise.all([send("/checkout",input,cookie),send("/checkout",input,cookie)]);
    assert.ok(duplicates.every(r=>r.status===201));
    assert.equal(((await (await send("/checkout",input,cookie)).json()) as {id:string}).id,first.id);
    assert.equal((await send("/checkout",{...input,idempotencyKey:randomUUID()},cookie)).status,409);
    assert.equal((await fetch(base+`/orders/${first.id}`,{headers:{Cookie:teamCookie}})).status,200);
    const stranger=await send("/auth/demo",{role:"CUSTOMER",customerId:"CUST-1006"});
    const otherCookie=stranger.headers.get("set-cookie")!.split(";")[0]!;
    assert.equal((await fetch(base+`/orders/${first.id}`,{headers:{Cookie:otherCookie}})).status,404);
    await runJob(`cod-send:${first.id}`);
    const conversations=(await (await fetch(base+"/conversations",{headers:{Cookie:cookie}})).json()) as {orderId:string;messages:{content:string}[]}[];
    assert.ok(conversations.some(c=>c.orderId===first.id&&c.messages.some(m=>m.content.includes("Pay online"))));
    assert.equal((await send(`/orders/${first.id}/cod`,{action:"EDIT_ADDRESS",address:{...location,line1:"24 Test Road"}},cookie)).status,200);
    assert.equal((await prisma.cODConfirmation.findUniqueOrThrow({where:{orderId:first.id}})).riskBand,"MEDIUM");
    const conversion=await send(`/orders/${first.id}/cod`,{action:"PAY_ONLINE"},cookie);
    assert.equal(conversion.status,200);const payment=(await conversion.json()) as {paymentId:string};
    assert.ok(payment.paymentId);
    assert.equal((await prisma.orderPayment.findUniqueOrThrow({where:{orderId:first.id}})).status,"PENDING");
    const paid=await send(`/orders/${first.id}/payment`,{paymentId:payment.paymentId,action:"SUCCEED"},cookie);
    assert.equal(paid.status,200);
    const converted=(await paid.json()) as {paymentStatus:string;paymentMethod:string;total:number;cod:{status:string}};
    assert.equal(converted.paymentMethod,"PREPAID");assert.equal(converted.paymentStatus,"PAID");
    assert.equal(converted.cod.status,"CONVERTED_PREPAID");
    assert.equal(converted.total,Math.round((estimate.subtotal+estimate.shippingFee-estimate.subtotal*.05)*100)/100);
    assert.equal((await send(`/orders/${first.id}/payment`,{paymentId:payment.paymentId,action:"SUCCEED"},cookie)).status,200);
    assert.equal((await prisma.order.count({where:{id:first.id}})),1);

    const addAgain=await send("/cart",{sku:"WL-TEE-02",size,quantity:1,mode:"ADD"},cookie,"PATCH");
    const cart2=(await addAgain.json()) as {version:number};
    const pre=await send("/checkout",{paymentMethod:"PREPAID",phone,address:location,cartVersion:cart2.version,idempotencyKey:randomUUID()},cookie);
    assert.equal(pre.status,201);
    const prepaid=(await pre.json()) as {id:string;paymentStatus:string;paymentAttempts:{id:string,purpose:string}[]};
    orders.push(prepaid.id);assert.equal(prepaid.paymentStatus,"PENDING");
    assert.equal(prepaid.paymentAttempts[0]?.purpose,"CHECKOUT");
    assert.equal((await send(`/orders/${prepaid.id}/courier`,{status:"PICKED_UP",eventId:`unpaid-${id}`},teamCookie)).status,409);
    const failed=await send(`/orders/${prepaid.id}/payment`,{paymentId:prepaid.paymentAttempts[0]!.id,action:"FAIL"},cookie);
    assert.equal(failed.status,200);
    assert.equal(((await failed.json()) as {status:string}).status,"CANCELLED");
    assert.equal((await prisma.orderPayment.findUniqueOrThrow({where:{orderId:prepaid.id}})).status,"FAILED");
    assert.equal((await prisma.order.findUniqueOrThrow({where:{id:prepaid.id}})).inventoryReserved,false);
    assert.equal((await send(`/orders/${prepaid.id}/payment`,{paymentId:prepaid.paymentAttempts[0]!.id,action:"FAIL"},cookie)).status,200);
    const refill=(await (await send("/cart",{sku:"WL-TEE-02",size,quantity:1,mode:"ADD"},cookie,"PATCH")).json()) as {version:number};
    const online=(await (await send("/checkout",{paymentMethod:"PREPAID",phone,address:location,cartVersion:refill.version,idempotencyKey:randomUUID(),total:1},cookie)).json()) as {id:string;total:number;paymentAttempts:{id:string}[]};
    orders.push(online.id);assert.ok(online.total>1);
    const settled=await send(`/orders/${online.id}/payment`,{paymentId:online.paymentAttempts[0]!.id,action:"SUCCEED"},cookie);
    assert.equal(settled.status,200);
    assert.equal(((await settled.json()) as {paymentStatus:string}).paymentStatus,"PAID");
    assert.equal((await send(`/orders/${online.id}/payment`,{paymentId:online.paymentAttempts[0]!.id,action:"FAIL"},cookie)).status,409);
    const cart3=(await (await send("/cart",{sku:"WL-BAG-05",size:"One Size",quantity:1,mode:"ADD"},cookie,"PATCH")).json()) as {version:number};
    const last=(await (await send("/checkout",{paymentMethod:"COD",phone,address:location,cartVersion:cart3.version,idempotencyKey:randomUUID()},cookie)).json()) as {id:string};
    orders.push(last.id);await runJob(`cod-send:${last.id}`);
    assert.equal((await send(`/orders/${last.id}/cod`,{action:"CANCEL"},cookie)).status,200);
    assert.equal((await prisma.order.findUniqueOrThrow({where:{id:last.id}})).inventoryReserved,false);
  }finally{
    server.close();
    if(customerId){
      for(const orderId of orders){
        await prisma.$transaction(async t=>{await releaseReservedStock(t,orderId);});
        await prisma.outboxJob.deleteMany({where:{id:{in:[`cod-send:${orderId}`,`cod-reminder:${orderId}`,`cod-hold:${orderId}`]}}});
        const cs=await prisma.conversation.findMany({where:{customerId,orderId},select:{id:true}});
        for(const c of cs){
          await prisma.message.deleteMany({where:{conversationId:c.id}});
          await prisma.conversation.delete({where:{id:c.id}});
        }
        await prisma.auditLog.deleteMany({where:{orderId}});
        await prisma.riskAssessment.deleteMany({where:{orderId}});
        await prisma.paymentAttempt.deleteMany({where:{orderId}});
        await prisma.cODConfirmation.deleteMany({where:{orderId}});
        await prisma.checkoutSubmission.deleteMany({where:{orderId}});
        await prisma.orderItem.deleteMany({where:{orderId}});
        await prisma.orderPayment.deleteMany({where:{orderId}});
        await prisma.order.delete({where:{id:orderId}});
      }
      await prisma.cartItem.deleteMany({where:{customerId}});
      await prisma.cart.deleteMany({where:{customerId}});
      if(userId){
        await prisma.session.deleteMany({where:{userId}});
        await prisma.user.delete({where:{id:userId}});
      }
      await prisma.customer.delete({where:{id:customerId}});
    }
  }
});
