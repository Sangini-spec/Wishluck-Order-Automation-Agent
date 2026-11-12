import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { prisma, json } from "./db";
import { logger } from "./logger";
import { applySeedRevision } from "./seed-revision";
export const expectedCounts = {customers:30,products:6,orders:30,inventory:23,shipments:21,shipmentEvents:70,returns:9,refunds:3,codConfirmations:7,orderItems:31,historicalReturns:3};
export function validateSeed(d:any) {
  for(const [entity,key] of [["customers","customer_id"],["products","sku"],["orders","order_id"],["shipments","shipment_id"],["returns","return_id"],["refunds","refund_id"],["cod_confirmations","order_id"],["pincode_serviceability","pincode"]]){
    if(!Array.isArray(d[entity!])) throw new Error(`Missing entity ${entity}`);
    const ids=d[entity!].map((x:any)=>x[key!]);if(ids.some((id:any)=>!id)||new Set(ids).size!==ids.length)throw new Error(`Invalid or duplicate IDs in ${entity}`);
  }
  const customers=new Map(d.customers.map((x:any)=>[x.customer_id,x])),products=new Map(d.products.map((x:any)=>[x.sku,x])),orders=new Map(d.orders.map((x:any)=>[x.order_id,x]));
  for(const o of d.orders){
    if(!customers.has(o.customer_id))throw new Error(`Missing customer on ${o.order_id}`);
    let subtotal=0;
    for(const i of o.items){const p:any=products.get(i.sku);if(!p||!p.sizes.includes(i.size)||i.quantity<1)throw new Error(`Invalid item on ${o.order_id}`);subtotal+=i.unit_price*i.quantity;}
    const p=o.payment;if(subtotal!==p.subtotal||p.subtotal+p.shipping_fee+p.cod_fee-p.discount!==p.total)throw new Error(`Payment mismatch on ${o.order_id}`);
  }
  for(const name of ["shipments","returns","refunds","cod_confirmations"])for(const r of d[name]){const o:any=orders.get(r.order_id);if(!o || (r.customer_id&&r.customer_id!==o.customer_id))throw new Error(`Broken ownership/reference in ${name}`);}
  const variants=new Set<string>();for(const i of d.inventory){const p:any=products.get(i.sku),key=`${i.sku}/${i.size}`;if(!p||!p.sizes.includes(i.size)||variants.has(key)||i.available<0)throw new Error("Invalid inventory");variants.add(key);}
  const events=d.shipments.flatMap((s:any)=>s.events.map((e:any)=>e.event_id));if(new Set(events).size!==events.length)throw new Error("Duplicate shipment event ID");
  const counts={customers:d.customers.length,products:d.products.length,orders:d.orders.length,inventory:d.inventory.length,shipments:d.shipments.length,shipmentEvents:events.length,returns:d.returns.length,refunds:d.refunds.length,codConfirmations:d.cod_confirmations.length,orderItems:d.orders.reduce((s:number,o:any)=>s+o.items.length,0),historicalReturns:d.customers.reduce((s:number,c:any)=>s+(c.return_history_last_60_days?.length||0),0)};
  const expected=d.dataset_metadata.version==="2.0.0"?{...expectedCounts,shipmentEvents:74,returns:12,refunds:4,historicalReturns:6}:expectedCounts;
  for(const [key,n] of Object.entries(expected))if(counts[key as keyof typeof counts]!==n)throw new Error(`Expected ${n} ${key}, found ${counts[key as keyof typeof counts]}. Source file changed; review required.`);
  return counts;
}
export function qualityIssues(d:any) {
  const out:any[]=[];const add=(id:string,code:string,detail:string)=>out.push({id:`${id}:${code}:${out.length}`,entityId:id,code,detail});
  const orders=new Map<string,any>(d.orders.map((o:any)=>[o.order_id,o])), customers=new Map<string,any>(d.customers.map((c:any)=>[c.customer_id,c]));
  for(const c of d.customers){
    if(/\s/.test(c.email))add(c.customer_id,"INVALID_CONTACT_EMAIL","Fictional seed email contains whitespace; retained unchanged, not used as an authentication identity.");
    if(c.is_first_time_customer&&c.cod_refusals_last_12_months)add(c.customer_id,"AMBIGUOUS_FIRST_TIME","First-time flag coexists with previous COD refusals. Both source signals retained.");
    for(const h of c.return_history_last_60_days||[])if(!orders.has(h.order_id)&&h.reference_scope!=="EXTERNAL_HISTORY")add(c.customer_id,"HISTORICAL_ORDER_MISSING",`${h.return_id} refers to absent ${h.order_id}; preserved as external historical evidence.`);
  }
  for(const s of d.shipments){
    const o=orders.get(s.order_id)!;
    for(const e of s.events){
      if(e.status==="DELIVERED"&&new Date(e.occurred_at).getTime()!==new Date(o.delivered_at).getTime())add(o.order_id,"DELIVERY_DATE_CONFLICT","Order delivery date differs from courier delivery event. Imported eligibility uses the order date; both retained.");
      if(new Date(e.occurred_at)>new Date(d.dataset_metadata.generated_at))add(o.order_id,"FUTURE_COURIER_EVENT",`${e.event_id} is after dataset generation; imported, not replayed.`);
    }
    if(s.attempt_count>s.events.filter((e:any)=>e.status==="DELIVERY_FAILED").length)add(o.order_id,"INCOMPLETE_ATTEMPT_HISTORY","Attempt count exceeds failure events in timeline. No omitted events were fabricated.");
    if(/REFUND/.test(s.status))add(o.order_id,"FINANCIAL_SHIPMENT_STATUS","Seed shipment uses a financial status; transport stage must be read separately from actual courier events.");
  }
  for(const o of d.orders){
    const c=customers.get(o.customer_id)!;
    if(o.scenario_tag==="three_returns_customer"&&c.returns_last_60_days<3)add(o.order_id,"RETURN_HISTORY_TAG_CONFLICT","Scenario says three returns; linked customer has one. Actual three-return customer is CUST-1017.");
    if(o.scenario_tag==="repeat_customer_low_risk"&&c.is_first_time_customer)add(o.order_id,"RISK_TAG_CONFLICT","Scenario says repeat customer; source customer is marked first-time.");
    if(o.scenario_tag==="cod_multiple_recent")add(o.order_id,"UNSUPPORTED_REPEAT_ORDER_CLAIM","Source risk reason mentions multiple orders, but only one is supplied for this customer.");
    if(o.payment.method==="COD"){const pin=d.pincode_serviceability.find((p:any)=>p.pincode===o.shipping_address.pincode);if(!pin?.cod_available||o.payment.total>4999||o.payment.total<299)add(o.order_id,"COD_INELIGIBLE_SOURCE","Preserved COD order violates amount or pincode eligibility. No new COD acceptance/dispatch is permitted.");}
    if(o.payment.status==="REFUNDED"&&!d.refunds.some((r:any)=>r.order_id===o.order_id))add(o.order_id,"REFUND_RECORD_MISSING","Payment is refunded but no detailed refund record was supplied.");
  }
  for(const r of d.refunds){
    if(!d.returns.some((x:any)=>x.order_id===r.order_id)&&r.type!=="GOODWILL_REQUEST")add(r.order_id,"RETURN_LINK_MISSING","Refund has no matching source return. Return/QC timing must not be invented.");
    if(new Date(r.requested_at)<new Date(orders.get(r.order_id)!.delivered_at))add(r.order_id,"REFUND_BEFORE_DELIVERY","Refund request timestamp precedes delivery; preserved as source evidence.");
    if(r.method==="BANK_TRANSFER_OR_STORE_CREDIT")add(r.order_id,"PAYOUT_METHOD_UNSPECIFIED","Completed refund does not specify which COD payout option was selected.");
    if(r.amount>orders.get(r.order_id)!.payment.total&&!(r.type==="GOODWILL_REQUEST"&&r.status==="MANUAL_REVIEW"))add(r.order_id,"GOODWILL_EXCEEDS_ORDER","Requested amount exceeds order total; manual review is required.");
  }
  for(const r of d.returns)if(r.eligible_by_window!==(r.delivered_days_ago<=7))add(r.order_id,"WINDOW_FLAG_CONFLICT","Source window flag disagrees with supplied relative delivery age; deterministic policy recomputes eligibility.");
  if(d.cod_confirmations.find((x:any)=>x.order_id==="WL10236")?.risk_band!=="HIGH")add("WL10236","SOURCE_RISK_BAND_CONFLICT","Exact ₹4,600 high-risk scenario must have a high risk assessment.");
  return out;
}
export async function seed() {
  const candidates=[process.env.SEED_FILE,resolve(process.cwd(),"../data/wishluck_seed_data.json"),resolve(process.cwd(),"data/wishluck_seed_data.json")].filter(Boolean) as string[];
  const file=candidates.find(existsSync);if(!file)throw new Error("Seed file missing. Expected data/wishluck_seed_data.json.");
  const originalText=readFileSync(file,"utf8"),d=JSON.parse(originalText),counts=validateSeed(d),hash=createHash("sha256").update(originalText).digest("hex");
  const existing=await prisma.seedDataset.findUnique({where:{id:"wishluck-source"}});
  if(existing){
    if(existing.hash!==hash&&d.dataset_metadata.version==="2.0.0"&&d.dataset_metadata.original_sha256===existing.hash){
      const issues=qualityIssues(d);if(issues.length)throw new Error("Corrected seed failed relationship/policy validation.");
      await prisma.$transaction(t=>applySeedRevision(t,existing,d,hash,originalText,issues),{timeout:60000});
      logger.info({counts,hash},"Applied authorized demo corrections without resetting runtime data");return counts;
    }
    if(existing.hash!==hash)throw new Error("Seed content differs from imported source. Refusing to overwrite live/source records.");
    await prisma.$transaction(async t=>{
      await t.policyVersion.createMany({data:[{id:"wishluck-policy-v1",seedDatasetId:existing.id,version:d.dataset_metadata.version,document:d.policy}],skipDuplicates:true});
      await t.demoScenario.createMany({data:d.demo_scenarios.map((s:any,i:number)=>({id:`SCENARIO-${i+1}`,sourceIndex:i,scenario:s.scenario,expected:s.expected,orderId:s.order_id||null,sourceRecord:s})),skipDuplicates:true});
    });
    logger.info({counts,hash},"Seed already imported; no source records changed");return counts;
  }
  await prisma.$transaction(async t=>{
    await t.seedDataset.create({data:{id:"wishluck-source",hash,name:d.dataset_metadata.name,originalText,metadata:d.dataset_metadata,notes:d.notes,policy:d.policy,scenarios:d.demo_scenarios}});
    await t.policyVersion.create({data:{id:"wishluck-policy-v1",seedDatasetId:"wishluck-source",version:d.dataset_metadata.version,document:d.policy}});
    for(const p of d.products)await t.product.create({data:{sku:p.sku,name:p.name,category:p.category,price:p.price,sizes:p.sizes,returnable:p.returnable,exchangeable:p.exchangeable,notes:p.notes,sourceRecord:p}});
    for(const c of d.customers){
      await t.customer.create({data:{id:c.customer_id,name:c.name,email:c.email,phone:c.phone,address:c.address,isFirstTimeCustomer:c.is_first_time_customer,codRefusalsLast12Months:c.cod_refusals_last_12_months,returnsLast60Days:c.returns_last_60_days,customerSince:c.customer_since,sourceRecord:c}});
      for(const h of c.return_history_last_60_days||[])await t.customerReturnHistory.create({data:{id:h.return_id,customerId:c.customer_id,sourceOrderId:h.order_id,linkedOrderId:null,status:h.status,daysAgo:h.days_ago,sourceRecord:h}});
    }
    for(const i of d.inventory)await t.inventory.create({data:{sku:i.sku,size:i.size,available:i.available}});
    for(const o of d.orders){
      const p=o.payment,c=d.customers.find((c:any)=>c.customer_id===o.customer_id);
      await t.order.create({data:{id:o.order_id,customerId:o.customer_id,scenarioTag:o.scenario_tag,createdAt:new Date(o.created_at),currency:o.currency,status:o.status,fulfillmentStatus:o.fulfillment_status,shippingAddress:o.shipping_address,verificationPhone:c.phone,deliveredAt:o.delivered_at?new Date(o.delivered_at):null,customerVerificationRequired:o.customer_verification_required,notes:o.notes,sourceRecord:o,payment:{create:{method:p.method,status:p.status,subtotal:p.subtotal,shippingFee:p.shipping_fee,codFee:p.cod_fee,discount:p.discount,total:p.total,amountDueAtDelivery:p.amount_due_at_delivery}},items:{create:o.items.map((i:any,index:number)=>({id:`${o.order_id}:${index}`,sourceIndex:index,sku:i.sku,productName:i.product_name,quantity:i.quantity,unitPrice:i.unit_price,size:i.size,isSaleItem:i.is_sale_item,isInnerwear:i.is_innerwear}))}}});
    }
    for(const s of d.shipments)await t.shipment.create({data:{id:s.shipment_id,orderId:s.order_id,carrier:s.carrier,trackingNumber:s.tracking_number,trackingUrl:s.tracking_url,status:s.status,attemptCount:s.attempt_count,estimatedDeliveryDate:s.estimated_delivery_date,lastFailureReason:s.last_failure_reason,sourceRecord:s,events:{create:s.events.map((e:any,i:number)=>({id:e.event_id,status:e.status,reason:e.reason,occurredAt:new Date(e.occurred_at),source:e.source,sourceIndex:i}))}}});
    for(const r of d.returns)await t.returnRecord.create({data:{id:r.return_id,orderId:r.order_id,customerId:r.customer_id,status:r.status,deliveredDaysAgo:r.delivered_days_ago,eligibleByWindow:r.eligible_by_window,reason:r.reason,qualityCheckStatus:r.quality_check_status,exchangeCountForItem:r.exchange_count_for_item,sourceRecord:r}});
    for(const r of d.refunds)await t.refund.create({data:{id:r.refund_id,orderId:r.order_id,customerId:r.customer_id,amount:r.amount,status:r.status,method:r.method,requestedAt:new Date(r.requested_at),qualityCheckStatus:r.quality_check_status,policyNote:r.policy_note,sourceRecord:r}});
    for(const c of d.cod_confirmations)await t.cODConfirmation.create({data:{orderId:c.order_id,customerId:c.customer_id,riskScore:c.risk_score,riskBand:c.risk_band,riskReasons:c.risk_reasons,status:c.status,messageSentAt:c.message_sent_at,reminderDueAfterMinutes:c.reminder_due_after_minutes,holdAfterMinutes:c.hold_after_minutes,options:c.options,prepaidDiscountPercent:c.prepaid_discount_percent,sourceRecord:c}});
    for(const p of d.pincode_serviceability)await t.pincodeServiceability.create({data:{pincode:p.pincode,city:p.city,codAvailable:p.cod_available}});
    await t.demoScenario.createMany({data:d.demo_scenarios.map((s:any,i:number)=>({id:`SCENARIO-${i+1}`,sourceIndex:i,scenario:s.scenario,expected:s.expected,orderId:s.order_id||null,sourceRecord:s}))});
    await t.dataQualityIssue.createMany({data:qualityIssues(d)});
    await t.appSetting.create({data:{key:"workflow",value:{codReminderSeconds:7200,codHoldSeconds:86400,ndrFollowupSeconds:120,riskHighThreshold:65,riskMediumThreshold:35}}});
  },{timeout:60000});
  logger.info({counts,hash},"Imported all source data transactionally; historical workflows not replayed");
  return json(counts);
}
