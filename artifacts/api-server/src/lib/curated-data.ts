import { scoreRisk } from "./policy";

/** Explicitly authored demo corrections, not a reconstruction of real customer facts. */
export function curateDataset(original:any) {
  const d=structuredClone(original),at=new Date(d.dataset_metadata.generated_at).getTime();
  const orders=new Map<string,any>(d.orders.map((o:any)=>[o.order_id,o]));
  const customers=new Map<string,any>(d.customers.map((c:any)=>[c.customer_id,c]));
  for(const c of d.customers){
    c.email=`${c.name.toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/\.$/,"")}.${c.customer_id.toLowerCase()}@example.test`;
    if(c.cod_refusals_last_12_months||c.returns_last_60_days)c.is_first_time_customer=false;
    for(const h of c.return_history_last_60_days||[])h.reference_scope="EXTERNAL_HISTORY";
  }
  const high=orders.get("WL10236")!,highCustomer=customers.get(high.customer_id)!;
  high.shipping_address={...high.shipping_address,line1:"near Shiv mandir",line2:"",landmark:"Shiv mandir"};
  highCustomer.address=structuredClone(high.shipping_address);
  const repeat=orders.get("WL10248")!,repeatCustomer=customers.get(repeat.customer_id)!;
  repeatCustomer.returns_last_60_days=3;repeatCustomer.is_first_time_customer=false;
  repeatCustomer.return_history_last_60_days=[12,28,46].map((days:number,i:number)=>({
    return_id:`HIST-RET-C1015-${i+1}`,order_id:`EXTERNAL-C1015-${i+1}`,status:"COMPLETED",days_ago:days,reference_scope:"EXTERNAL_HISTORY",
  }));
  for(const o of d.orders){
    const c=customers.get(o.customer_id)!;
    if(o.scenario_tag==="repeat_customer_low_risk")c.is_first_time_customer=false;
    const p=o.payment,pin=d.pincode_serviceability.find((x:any)=>x.pincode===o.shipping_address.pincode);
    if(p.method==="COD"&&(!pin?.cod_available||p.total<299||p.total>4999)){
      p.method="PREPAID";p.cod_fee=0;p.total=p.subtotal+p.shipping_fee-p.discount;p.amount_due_at_delivery=0;
      p.status=o.fulfillment_status==="FULFILLED"?"PAID":"PENDING";
      if(o.fulfillment_status==="UNFULFILLED"){
        o.status="ON_HOLD";
        o.notes.push("Prepaid payment required before dispatch: COD is unavailable for this order's value or pincode.");
        const cod=d.cod_confirmations.find((x:any)=>x.order_id===o.order_id);if(cod)cod.status="PREPAID_REQUIRED";
      }
      if(o.scenario_tag==="cod_multiple_recent")o.scenario_tag="prepaid_required_non_cod_pincode";
    }
  }
  for(const s of d.shipments){
    const o=orders.get(s.order_id)!;
    const firstFailure=s.events.findIndex((e:any)=>e.status==="DELIVERY_FAILED");
    if(firstFailure>=0&&s.attempt_count>s.events.filter((e:any)=>e.status==="DELIVERY_FAILED").length){
      s.events.splice(firstFailure,0,
        {event_id:`${s.shipment_id}-CURATED-FAIL-1`,status:"DELIVERY_FAILED",reason:s.last_failure_reason||"CUSTOMER_NOT_AVAILABLE",source:"MOCK_COURIER"},
        {event_id:`${s.shipment_id}-CURATED-OFD-2`,status:"OUT_FOR_DELIVERY",reason:null,source:"MOCK_COURIER"});
    }
    const end=o.delivered_at?new Date(o.delivered_at).getTime():Math.min(at-3600000,...s.events.map((e:any)=>e.occurred_at?new Date(e.occurred_at).getTime():at));
    s.events.forEach((e:any,i:number)=>e.occurred_at=new Date(end-(s.events.length-1-i)*6*3600000).toISOString());
    if(new Date(o.created_at).getTime()>=new Date(s.events[0].occurred_at).getTime())o.created_at=new Date(new Date(s.events[0].occurred_at).getTime()-3600000).toISOString();
    s.status=s.events.at(-1).status;
    s.attempt_count=s.events.filter((e:any)=>e.status==="DELIVERY_FAILED").length;
  }
  for(const r of d.returns)r.eligible_by_window=r.delivered_days_ago<=7;
  for(const o of d.orders.filter((x:any)=>x.payment.status==="REFUNDED")){
    if(!d.refunds.some((r:any)=>r.order_id===o.order_id))d.refunds.push({
      refund_id:`REF-CURATED-${o.order_id}`,order_id:o.order_id,customer_id:o.customer_id,amount:o.payment.total,status:"COMPLETED",
      method:o.payment.method==="COD"?"BANK_TRANSFER":"ORIGINAL_PAYMENT_METHOD",
      requested_at:new Date(new Date(o.delivered_at).getTime()+86400000).toISOString(),
      quality_check_status:"PASSED",policy_note:"Returned item passed quality check; refund completed through the recorded payment method.",
    });
  }
  for(const r of d.refunds){
    const o=orders.get(r.order_id)!;
    if(r.amount>o.payment.total){
      r.type="GOODWILL_REQUEST";r.status="MANUAL_REVIEW";r.quality_check_status="NOT_STARTED";
      r.policy_note="Unapproved ₹1,800 goodwill request. Requires human review; no payout has been approved.";
    }else if(!d.returns.some((x:any)=>x.order_id===o.order_id)){
      d.returns.push({return_id:`RET-CURATED-${o.order_id}`,order_id:o.order_id,customer_id:o.customer_id,status:r.status==="COMPLETED"?"COMPLETED":"RECEIVED",
        delivered_days_ago:Math.floor((at-new Date(o.delivered_at).getTime())/86400000),eligible_by_window:false,
        reason:"Return requested within the policy window; item received for quality check.",quality_check_status:r.quality_check_status,exchange_count_for_item:0});
      const added=d.returns.at(-1);added.eligible_by_window=added.delivered_days_ago<=7;
    }
    if(new Date(r.requested_at).getTime()<new Date(o.delivered_at).getTime())r.requested_at=new Date(new Date(o.delivered_at).getTime()+86400000).toISOString();
    if(r.method==="BANK_TRANSFER_OR_STORE_CREDIT")r.method="BANK_TRANSFER";
  }
  for(const cod of d.cod_confirmations){
    const o=orders.get(cod.order_id)!,c=customers.get(o.customer_id)!;
    const pin=d.pincode_serviceability.find((p:any)=>p.pincode===o.shipping_address.pincode);
    const risk=scoreRisk({total:o.payment.total,first:c.is_first_time_customer,refusals:c.cod_refusals_last_12_months,
      weakAddress:!/\d/.test(o.shipping_address.line1),codAvailable:!!pin?.cod_available,recentOrders:1});
    cod.risk_score=risk.score;cod.risk_band=risk.band;cod.risk_reasons=risk.reasons;
  }
  d.dataset_metadata.version="2.0.0";
  d.dataset_metadata.record_count={customers:d.customers.length,products:d.products.length,orders:d.orders.length,shipments:d.shipments.length};
  d.notes.data_import="Assignment-aligned corrected demo dataset. Original upload retained in data/original; corrections are documented separately.";
  d.notes.historical_references="EXTERNAL_HISTORY records are explicitly external historical summaries, not broken foreign keys into this 30-order demo extract.";
  return d;
}
