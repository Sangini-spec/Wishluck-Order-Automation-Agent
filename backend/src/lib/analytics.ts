import { prisma } from "./db";
import { orderInclude, orderView, riskFor, maskPhone } from "./operations";
import { redact } from "./policy";
import { estimateTokenCost,llmRateCard } from "./llm-cost";
import type { Prisma } from "@prisma/client";
export const group=(values:string[])=>Object.entries(values.reduce<Record<string,number>>((a,x)=>{a[x]=(a[x]||0)+1;return a;},{})).map(([name,count])=>({name,count}));
export async function activity(){
  const evalIds=(await prisma.conversation.findMany({where:{isEvaluation:true},select:{id:true}})).map(c=>c.id);
  const audits=await prisma.auditLog.findMany({where:{AND:[{OR:[{orderId:null},{NOT:{orderId:{startsWith:"EVAL-"}}}]},{OR:[{conversationId:null},{conversationId:{notIn:evalIds}}]}]},orderBy:{createdAt:"desc"},take:80});
  const tools=await prisma.agentToolExecution.findMany({where:{conversation:{isEvaluation:false}},orderBy:{createdAt:"desc"},take:80});
  return [...audits.map(a=>({id:a.id,type:"AUDIT",action:a.action,orderId:a.orderId,conversationId:a.conversationId,createdAt:a.createdAt,detail:{actor:a.actor,oldValue:a.oldValue,newValue:a.newValue}})),...tools.map(t=>({id:t.id,type:"TOOL",action:t.toolName,conversationId:t.conversationId,createdAt:t.createdAt,detail:{input:t.input,output:t.output,status:t.status,durationMs:t.durationMs}}))].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,100);
}
export async function analytics(db:Prisma.TransactionClient=prisma){
  const cs=await db.conversation.findMany({where:{isEvaluation:false},include:{ticket:true,messages:{orderBy:{createdAt:"asc"}}}}),cod=await db.cODConfirmation.findMany({where:{order:{isEvaluation:false}}}),tools=await db.agentToolExecution.findMany({where:{conversation:{isEvaluation:false}}}),runs=await db.agentRun.findMany({where:{isEvaluation:false}});
  const initiated=cs.filter(c=>c.messages.some(m=>m.role==="user"));
  const resolved=initiated.filter(c=>c.status==="RESOLVED"),aiResolved=resolved.filter(c=>c.resolutionSource==="CUSTOMER_AI"&&!c.hadHuman&&!c.ticket);
  const first=initiated.map(c=>{const u=c.messages.find(m=>m.role==="user");const a=u?c.messages.find(m=>["assistant","human"].includes(m.role)&&m.createdAt>=u.createdAt):undefined;return u&&a?(a.createdAt.getTime()-u.createdAt.getTime())/1000:null;}).filter((x):x is number=>x!==null);
  const orders=await db.order.findMany({where:{isEvaluation:false},select:{id:true,status:true}});
  const saved=await db.nDRCase.findMany({where:{status:"SAVED_DELIVERED",orderId:{in:orders.map(o=>o.id)}},select:{orderId:true}});
  const validCod=cod.filter(c=>c.status!=="PREPAID_REQUIRED"),inputTokens=runs.reduce((s,x)=>s+x.inputTokens,0),outputTokens=runs.reduce((s,x)=>s+x.outputTokens,0);
  return {metrics:{conversations:cs.length,customerChats:initiated.length,resolved:resolved.length,aiResolved:aiResolved.length,
    aiResolutionRate:initiated.length?Math.round(aiResolved.length/initiated.length*100):null,
    pendingCod:validCod.filter(c=>c.status==="PENDING").length,codConfirmationRate:validCod.length?Math.round(validCod.filter(c=>["CONFIRMED","CONVERTED_PREPAID"].includes(c.status)).length/validCod.length*100):null,
    rtoSaved:new Set(saved.map(n=>n.orderId)).size,firstResponseSeconds:first.length?Math.round(first.reduce((s,x)=>s+x,0)/first.length*10)/10:null,
    toolSuccessRate:tools.length?Math.round(tools.filter(t=>t.status==="SUCCESS").length/tools.length*100):null,
    averageResponseMs:runs.length?Math.round(runs.reduce((s,x)=>s+x.durationMs,0)/runs.length):null,
    llmCost:runs.length?estimateTokenCost(inputTokens,outputTokens):null,inputTokens,outputTokens},
    definitions:{aiResolutionRate:"Customer-confirmed AI resolutions without a ticket or human intervention / conversations with at least one customer message.",
      codConfirmationRate:"Confirmed or converted COD confirmations / valid COD confirmation records (excludes prepaid-required records).",
      rtoSaved:"Distinct non-evaluation orders delivered after an acknowledged retry.",
      firstResponseSeconds:"First assistant or human reply after the first customer message; excludes greetings/outreach before that message.",
      intents:"Latest recognized customer issue per conversation; deterministic multilingual classification, not a semantic accuracy claim.",
      llmCost:"Estimated USD at public uncached token rates, not an actual Replit bill."},
    rateCard:llmRateCard,handovers:group(cs.filter(c=>c.handoverReason).map(c=>c.handoverReason!)),intents:group(initiated.filter(c=>c.intent).map(c=>c.intent!)),orderStatuses:group(orders.map(o=>o.status))};
}
export async function dashboard(){
  const orders=await prisma.order.findMany({where:{isEvaluation:false},include:orderInclude,orderBy:{createdAt:"desc"}});
  const cod=orders.filter(o=>o.payment?.method==="COD"),risks=await Promise.all(cod.map(riskFor)),a=await analytics();
  return {metrics:{totalOrders:orders.length,totalCustomers:await prisma.customer.count(),activeConversations:await prisma.conversation.count({where:{status:{not:"RESOLVED"},isEvaluation:false}}),needsHuman:await prisma.conversation.count({where:{status:"NEEDS_HUMAN",isEvaluation:false}}),pendingCod:await prisma.cODConfirmation.count({where:{status:"PENDING",order:{isEvaluation:false}}}),highRiskCod:risks.filter(r=>r.band==="HIGH").length,failedDeliveries:orders.filter(o=>o.status==="DELIVERY_FAILED").length,onHold:orders.filter(o=>o.status==="ON_HOLD").length,aiResolutionRate:a.metrics.aiResolutionRate,firstResponseSeconds:a.metrics.firstResponseSeconds},orderStatuses:a.orderStatuses,riskBands:group(risks.map(r=>r.band)),recentOrders:await Promise.all(orders.slice(0,6).map(o=>orderView(o))),activity:(await activity()).slice(0,8),demoClock:(await import("./db")).policyNow().toISOString()};
}
export async function datasetReport(){
  const s=await prisma.seedDataset.findUniqueOrThrow({where:{id:"wishluck-source"}}),d=JSON.parse(s.originalText);
  const counts={customers:await prisma.customer.count({where:{id:{in:d.customers.map((c:any)=>c.customer_id)}}}),products:await prisma.product.count({where:{sku:{in:d.products.map((p:any)=>p.sku)}}}),orders:await prisma.order.count({where:{id:{in:d.orders.map((o:any)=>o.order_id)}}}),inventory:await prisma.inventory.count(),shipments:await prisma.shipment.count({where:{id:{in:d.shipments.map((s:any)=>s.shipment_id)}}}),shipmentEvents:await prisma.shipmentEvent.count({where:{id:{in:d.shipments.flatMap((s:any)=>s.events.map((e:any)=>e.event_id))}}}),returns:await prisma.returnRecord.count(),refunds:await prisma.refund.count(),codConfirmations:await prisma.cODConfirmation.count({where:{orderId:{in:d.cod_confirmations.map((c:any)=>c.order_id)}}}),orderItems:await prisma.orderItem.count({where:{orderId:{in:d.orders.map((o:any)=>o.order_id)}}}),historicalReturns:await prisma.customerReturnHistory.count(),demoScenarios:await prisma.demoScenario.count(),policyVersions:await prisma.policyVersion.count()};
  return {name:s.name,hash:s.hash,importedAt:s.importedAt,counts,warnings:await prisma.dataQualityIssue.findMany(),scenarios:s.scenarios};
}
