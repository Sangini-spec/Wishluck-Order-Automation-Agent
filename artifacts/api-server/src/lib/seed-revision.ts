import { isDeepStrictEqual } from "node:util";
import { HttpError, json } from "./db";
const same=(a:any,b:any)=>isDeepStrictEqual(a instanceof Date?a.toISOString():typeof b==="number"?Number(a):a,b instanceof Date?b.toISOString():b);
const customer=(c:any)=>({name:c.name,email:c.email,phone:c.phone,address:c.address,isFirstTimeCustomer:c.is_first_time_customer,codRefusalsLast12Months:c.cod_refusals_last_12_months,returnsLast60Days:c.returns_last_60_days,customerSince:c.customer_since});
const order=(o:any,c:any)=>({customerId:o.customer_id,scenarioTag:o.scenario_tag,createdAt:new Date(o.created_at),currency:o.currency,status:o.status,fulfillmentStatus:o.fulfillment_status,shippingAddress:o.shipping_address,verificationPhone:c.phone,deliveredAt:o.delivered_at?new Date(o.delivered_at):null,customerVerificationRequired:o.customer_verification_required,notes:o.notes});
const payment=(p:any)=>({method:p.method,status:p.status,subtotal:p.subtotal,shippingFee:p.shipping_fee,codFee:p.cod_fee,discount:p.discount,total:p.total,amountDueAtDelivery:p.amount_due_at_delivery});
const shipment=(s:any)=>({orderId:s.order_id,carrier:s.carrier,trackingNumber:s.tracking_number,trackingUrl:s.tracking_url,status:s.status,attemptCount:s.attempt_count,estimatedDeliveryDate:s.estimated_delivery_date,lastFailureReason:s.last_failure_reason});
const returned=(r:any)=>({orderId:r.order_id,customerId:r.customer_id,status:r.status,deliveredDaysAgo:r.delivered_days_ago,eligibleByWindow:r.eligible_by_window,reason:r.reason,qualityCheckStatus:r.quality_check_status,exchangeCountForItem:r.exchange_count_for_item});
const refund=(r:any)=>({orderId:r.order_id,customerId:r.customer_id,amount:r.amount,status:r.status,method:r.method,requestedAt:new Date(r.requested_at),qualityCheckStatus:r.quality_check_status,policyNote:r.policy_note});
const cod=(c:any)=>({customerId:c.customer_id,riskScore:c.risk_score,riskBand:c.risk_band,riskReasons:c.risk_reasons,status:c.status,messageSentAt:c.message_sent_at,reminderDueAfterMinutes:c.reminder_due_after_minutes,holdAfterMinutes:c.hold_after_minutes,options:c.options,prepaidDiscountPercent:c.prepaid_discount_percent});

/** Only change fields that still match the prior import. Never reset runtime orders/chats/jobs. */
export async function applySeedRevision(t:any,previous:any,d:any,hash:string,text:string,issues:any[]){
  const original=JSON.parse(previous.originalText);
  const merge=async(model:string,where:any,before:any,after:any,source?:any)=>{
    const current=await t[model].findUnique({where});
    if(!current){await t[model].create({data:{...where,...after,...(source?{sourceRecord:source}:{})}});return;}
    const patch:any={};
    for(const [key,value] of Object.entries(after)){
      if(before&&same(value,before[key]))continue;
      if(!same(current[key],value)&&before&&!same(current[key],before[key])){
        if(key==="notes"){patch[key]=[...new Set([...current[key],...(value as string[])])];continue;}
        throw new HttpError(409,`Demo correction conflicts with a runtime change in ${model}.${key}. No corrections were applied; review before retrying.`);
      }
      patch[key]=value;
    }
    if(source)patch.sourceRecord=source;
    await t[model].update({where,data:patch});
  };
  for(const c of d.customers){
    const old=original.customers.find((x:any)=>x.customer_id===c.customer_id);
    await merge("customer",{id:c.customer_id},old&&customer(old),customer(c),c);
    for(const h of c.return_history_last_60_days||[]){
      const before=old?.return_history_last_60_days?.find((x:any)=>x.return_id===h.return_id);
      const mapped={customerId:c.customer_id,sourceOrderId:h.order_id,linkedOrderId:null,status:h.status,daysAgo:h.days_ago};
      await merge("customerReturnHistory",{id:h.return_id},before?mapped:null,mapped,h);
    }
  }
  for(const o of d.orders){
    const old=original.orders.find((x:any)=>x.order_id===o.order_id);
    await merge("order",{id:o.order_id},order(old,original.customers.find((x:any)=>x.customer_id===old.customer_id)),order(o,d.customers.find((x:any)=>x.customer_id===o.customer_id)),o);
    await merge("orderPayment",{orderId:o.order_id},payment(old.payment),payment(o.payment));
  }
  for(const s of d.shipments){
    const old=original.shipments.find((x:any)=>x.shipment_id===s.shipment_id);
    await merge("shipment",{id:s.shipment_id},shipment(old),shipment(s),s);
    for(const [i,e] of s.events.entries()){
      const before=old.events.find((x:any)=>x.event_id===e.event_id);
      const map=(x:any,index:number)=>({shipmentId:s.shipment_id,status:x.status,reason:x.reason,occurredAt:new Date(x.occurred_at),source:x.source,sourceIndex:index});
      await merge("shipmentEvent",{id:e.event_id},before?map(before,old.events.indexOf(before)):null,map(e,i));
    }
  }
  for(const r of d.returns){const old=original.returns.find((x:any)=>x.return_id===r.return_id);await merge("returnRecord",{id:r.return_id},old?returned(old):null,returned(r),r);}
  for(const r of d.refunds){const old=original.refunds.find((x:any)=>x.refund_id===r.refund_id);await merge("refund",{id:r.refund_id},old?refund(old):null,refund(r),r);}
  for(const c of d.cod_confirmations){const old=original.cod_confirmations.find((x:any)=>x.order_id===c.order_id);await merge("cODConfirmation",{orderId:c.order_id},cod(old),cod(c),c);}
  await t.seedDataset.update({where:{id:previous.id},data:{hash,originalText:text,metadata:d.dataset_metadata,notes:d.notes,policy:d.policy,scenarios:d.demo_scenarios}});
  await t.seedDataset.create({data:{...previous,id:"wishluck-original"}});
  await t.policyVersion.update({where:{id:"wishluck-policy-v1"},data:{version:d.dataset_metadata.version,document:d.policy}});
  await t.dataQualityIssue.deleteMany({});
  if(issues.length)await t.dataQualityIssue.createMany({data:issues});
  await t.auditLog.create({data:{actor:"SYSTEM",action:"Applied assignment-aligned demo corrections; original archived",oldValue:json({hash:previous.hash}),newValue:json({hash,version:d.dataset_metadata.version})}});
}
