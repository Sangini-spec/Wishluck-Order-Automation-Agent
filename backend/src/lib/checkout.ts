import { createHash, randomUUID } from "node:crypto";
import { prisma, HttpError, json, policyNow, demoMode } from "./db";
import { inr, type ShippingAddress } from "./cart";
import { codEligibility, scoreRisk } from "./policy";
import { audit, enqueue, orderInclude, orderView, refresh, settings } from "./operations";

export type CheckoutInput={phone:string;address:ShippingAddress;paymentMethod:"COD"|"PREPAID";cartVersion:number;idempotencyKey:string;saveProfile?:boolean};
export async function submitCheckout(customerId:string,input:CheckoutInput){
  if(!demoMode)throw new HttpError(403,"Demo checkout is disabled. No live payment provider is configured.");
  const a={...input,phone:input.phone.trim(),address:input.address};
  const payloadHash=createHash("sha256").update(JSON.stringify({phone:a.phone,address:a.address,paymentMethod:a.paymentMethod,cartVersion:a.cartVersion,saveProfile:!!a.saveProfile})).digest("hex");
  const cfg:any=await settings();
  const orderId=await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Customer" WHERE id=${customerId} FOR UPDATE`;
    const prior=await t.checkoutSubmission.findUnique({where:{customerId_key:{customerId,key:a.idempotencyKey}}});
    if(prior){if(prior.payloadHash!==payloadHash)throw new HttpError(409,"This checkout token belongs to a different request.");return prior.orderId;}
    const cart=await t.cart.findUnique({where:{customerId},include:{items:{include:{product:true}}}});
    if(!cart||!cart.items.length||cart.version!==a.cartVersion)throw new HttpError(409,"Your cart changed. Refresh the checkout totals before ordering.");
    const pin=await t.pincodeServiceability.findUnique({where:{pincode:a.address.pincode}});
    if(!pin)throw new HttpError(400,"Delivery to this pincode is not confirmed.");
    const items=cart.items.sort((x,y)=>x.sku.localeCompare(y.sku)||x.size.localeCompare(y.size));
    const subtotal=inr(items.reduce((n,i)=>n+Number(i.product.price)*i.quantity,0));
    const shipping=subtotal>999?0:79,cod=a.paymentMethod==="COD"?49:0,total=inr(subtotal+shipping+cod);
    if(a.paymentMethod==="COD"&&!codEligibility(total,pin.codAvailable).eligible)throw new HttpError(400,codEligibility(total,pin.codAvailable).reason);
    const c=await t.customer.findUniqueOrThrow({where:{id:customerId},include:{orders:{where:{isEvaluation:false},select:{id:true},take:1}}});
    const first=c.isFirstTimeCustomer&&c.orders.length===0;
    const id=`WL-DEMO-${randomUUID().slice(0,12).toUpperCase()}`;
    for(const item of items){
      const stock=await t.inventory.updateMany({where:{sku:item.sku,size:item.size,available:{gte:item.quantity}},data:{available:{decrement:item.quantity}}});
      if(!stock.count)throw new HttpError(409,`${item.product.name} size ${item.size} went out of stock. No order was placed.`);
    }
    const address=json(a.address);
    await t.order.create({data:{id,customerId,origin:"CUSTOMER_CHECKOUT",scenarioTag:"customer_checkout",isDemo:true,inventoryReserved:true,
      createdAt:policyNow(),status:a.paymentMethod==="COD"?"AWAITING_CONFIRMATION":"PAYMENT_PENDING",fulfillmentStatus:"UNFULFILLED",
      shippingAddress:address,verificationPhone:a.phone,notes:["Customer placed a simulated checkout order."],
      sourceRecord:{runtime:true,firstTimeAtPlacement:first},
      items:{create:items.map((i,index)=>({id:`${id}:${index}`,sourceIndex:index,sku:i.sku,productName:i.product.name,quantity:i.quantity,unitPrice:i.product.price,size:i.size,isSaleItem:i.sku==="WL-SAL-06",isInnerwear:i.product.category==="Innerwear"}))},
      payment:{create:{method:a.paymentMethod,status:"PENDING",subtotal,shippingFee:shipping,codFee:cod,discount:0,total,amountDueAtDelivery:cod?total:0}}}});
    await t.checkoutSubmission.create({data:{customerId,key:a.idempotencyKey,payloadHash,orderId:id}});
    if(a.paymentMethod==="PREPAID"){
      await t.paymentAttempt.create({data:{orderId:id,amount:total,discount:0,purpose:"CHECKOUT"}});
    }else{
      const recent=await t.order.count({where:{customerId,payment:{method:"COD"},isEvaluation:false,createdAt:{gte:new Date(policyNow().getTime()-86400000)}}});
      const risk=scoreRisk({total,first,refusals:c.codRefusalsLast12Months,
        weakAddress:!/\d/.test(a.address.line1)||/near.*(?:temple|mandir)/i.test(a.address.line1),codAvailable:pin.codAvailable,recentOrders:recent},
        cfg.riskMediumThreshold,cfg.riskHighThreshold);
      await t.cODConfirmation.create({data:{orderId:id,customerId,riskScore:risk.score,riskBand:risk.band,riskReasons:risk.reasons,status:"PENDING",
        reminderDueAfterMinutes:Math.ceil(cfg.codReminderSeconds/60),holdAfterMinutes:Math.ceil(cfg.codHoldSeconds/60),
        options:["CONFIRM","CANCEL","EDIT_ADDRESS","PAY_ONLINE_5_PERCENT_OFF"],prepaidDiscountPercent:5,sourceRecord:{runtime:true}}});
      await t.riskAssessment.create({data:{orderId:id,score:risk.score,band:risk.band,reasons:risk.reasons,version:"rules-1"}});
      await enqueue(t,`cod-send:${id}`,"COD_SEND",{orderId:id});
      await enqueue(t,`cod-reminder:${id}`,"COD_REMINDER",{orderId:id},cfg.codReminderSeconds);
      await enqueue(t,`cod-hold:${id}`,"COD_HOLD",{orderId:id},cfg.codHoldSeconds);
    }
    if(a.saveProfile&&(c.sourceRecord as any)?.runtime===true)await t.customer.update({where:{id:customerId},data:{phone:a.phone,address}});
    await t.cartItem.deleteMany({where:{customerId}});
    await t.cart.update({where:{customerId},data:{version:{increment:1}}});
    await audit(t,"CUSTOMER","Placed simulated order",id,{}, {paymentMethod:a.paymentMethod,total,itemCount:items.length});
    return id;
  },{timeout:30000});
  refresh();
  return orderView(await prisma.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude}));
}

export async function releaseReservedStock(t:any,orderId:string){
  const o=await t.order.findUniqueOrThrow({where:{id:orderId},include:{items:true}});
  if(!o.inventoryReserved)return;
  for(const item of o.items)await t.inventory.update({where:{sku_size:{sku:item.sku,size:item.size}},data:{available:{increment:item.quantity}}});
  await t.order.update({where:{id:orderId},data:{inventoryReserved:false}});
}
export async function simulateCustomerPayment(customerId:string,orderId:string,paymentId:string,action:"SUCCEED"|"FAIL"){
  if(!demoMode)throw new HttpError(403,"Payment simulations are disabled outside demo mode.");
  const order=await prisma.order.findUnique({where:{id:orderId}});
  if(!order||order.customerId!==customerId||order.isEvaluation)throw new HttpError(404,"Order not found.");
  const attempt=await prisma.paymentAttempt.findUnique({where:{id:paymentId}});
  if(!attempt||attempt.orderId!==orderId)throw new HttpError(404,"Payment simulation not found.");
  if(attempt.purpose==="COD_CONVERSION"){
    if(action==="SUCCEED"){
      const {codRespond}=await import("./operations");
      if(attempt.status==="PENDING")await codRespond(orderId,{action:"PAYMENT_SUCCESS",paymentId});
      else if(attempt.status!=="SUCCEEDED")throw new HttpError(409,"This simulation has already failed.");
    }else await prisma.$transaction(async t=>{
      await t.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const latest=await t.paymentAttempt.findUniqueOrThrow({where:{id:paymentId}});
      if(latest.status==="FAILED")return;
      if(latest.status!=="PENDING")throw new HttpError(409,"Payment outcome is already final.");
      await t.paymentAttempt.update({where:{id:paymentId},data:{status:"FAILED"}});
      await audit(t,"CUSTOMER","Simulated prepaid conversion failed",orderId,{status:"PENDING"},{status:"FAILED"});
    });
  }else if(attempt.purpose==="CHECKOUT"){
    await prisma.$transaction(async t=>{
      await t.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const p=await t.paymentAttempt.findUniqueOrThrow({where:{id:paymentId}});
      if(p.status===(action==="SUCCEED"?"SUCCEEDED":"FAILED"))return;
      if(p.status!=="PENDING")throw new HttpError(409,"Payment outcome is already final.");
      const o=await t.order.findUniqueOrThrow({where:{id:orderId},include:{payment:true}});
      if(o.status!=="PAYMENT_PENDING"||o.payment?.status!=="PENDING")throw new HttpError(409,"This order no longer awaits payment.");
      await t.paymentAttempt.update({where:{id:paymentId},data:{status:action==="SUCCEED"?"SUCCEEDED":"FAILED"}});
      if(action==="SUCCEED"){
        await t.orderPayment.update({where:{orderId},data:{status:"PAID"}});
        await t.order.update({where:{id:orderId},data:{status:"READY_TO_SHIP"}});
      }else{
        await releaseReservedStock(t,orderId);
        await t.orderPayment.update({where:{orderId},data:{status:"FAILED"}});
        await t.order.update({where:{id:orderId},data:{status:"CANCELLED"}});
      }
      await audit(t,"CUSTOMER","Simulated checkout payment",orderId,{status:"PENDING"},{status:action==="SUCCEED"?"PAID":"CANCELLED"});
    });
  }else throw new HttpError(409,"Unknown payment simulation.");
  refresh();
  return orderView(await prisma.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude}));
}
