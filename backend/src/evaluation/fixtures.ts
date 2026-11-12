import { randomUUID } from "node:crypto";
import { prisma,policyNow,json } from "../lib/db";
import { orderInclude,startCod,courierEvent } from "../lib/operations";
import { runJob } from "../lib/queue";
export async function evaluationOrder(sourceId:string){
  const s=await prisma.order.findUniqueOrThrow({where:{id:sourceId},include:orderInclude}),id=`EVAL-${randomUUID().slice(0,12).toUpperCase()}`,p=s.payment!;
  return prisma.order.create({data:{id,isEvaluation:true,isDemo:true,customerId:s.customerId,verificationPhone:s.verificationPhone,
    createdAt:policyNow(),deliveredAt:s.deliveredAt,status:s.status,fulfillmentStatus:s.fulfillmentStatus,scenarioTag:"agent_evaluation",
    shippingAddress:s.shippingAddress!,notes:[],sourceRecord:{evaluation:true,sourceId},
    payment:{create:{method:p.method,status:p.status,subtotal:p.subtotal,shippingFee:p.shippingFee,codFee:p.codFee,discount:p.discount,total:p.total,amountDueAtDelivery:p.amountDueAtDelivery}},
    items:{create:s.items.map((i,index)=>({id:`${id}:${index}`,sourceIndex:index,sku:i.sku,productName:i.productName,quantity:i.quantity,size:i.size,unitPrice:i.unitPrice,isSaleItem:i.isSaleItem,isInnerwear:i.isInnerwear}))}},include:orderInclude});
}
export async function prepareEventCase(kind:"COD"|"NDR"){
  const o=await evaluationOrder(kind==="COD"?"WL10236":"WL10234");
  await prisma.order.update({where:{id:o.id},data:{status:"UNFULFILLED",fulfillmentStatus:"UNFULFILLED"}});
  if(kind==="COD"){
    await startCod(o.id);await runJob(`cod-send:${o.id}`);
  }else{
    await courierEvent(o.id,{eventId:`pick-${o.id}`,status:"PICKED_UP"});
    await courierEvent(o.id,{eventId:`fail-${o.id}`,status:"DELIVERY_FAILED",reason:"CUSTOMER_NOT_AVAILABLE"});
    await runJob(`ndr-send:fail-${o.id}`);
  }
  const conv=await prisma.conversation.findFirstOrThrow({where:{orderId:o.id,isEvaluation:true}});
  return {o,conv};
}
export async function finishCourierJobs(orderId:string){
  const commands=await prisma.courierInstruction.findMany({where:{orderId}});
  for(const c of commands)await runJob(`ndr-submit:${c.consentId}`);
}
export async function releaseEvaluationExchangeStock(orderId:string){
  await prisma.$transaction(async t=>{
    const requests=await t.returnRequest.findMany({where:{orderId,kind:"EXCHANGE"},include:{orderItem:true}});
    for(const r of requests){
      await t.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id=${r.id} FOR UPDATE`;
      const latest=await t.returnRequest.findUniqueOrThrow({where:{id:r.id}});
      if((latest.evidence as any).evaluationStockReleased)continue;
      await t.inventory.update({where:{sku_size:{sku:r.orderItem.sku,size:r.size!}},data:{available:{increment:r.quantity}}});
      await t.returnRequest.update({where:{id:r.id},data:{evidence:json({...latest.evidence as object,evaluationStockReleased:true})}});
    }
  });
}
