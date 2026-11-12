export type Decision = { eligible: boolean; reason: string; manualReview?: boolean };
export function codEligibility(total: number, available: boolean): Decision {
  if (total < 299 || total > 4999) return {eligible:false,reason:"COD is available only for order values from ₹299 to ₹4,999."};
  if (!available) return {eligible:false,reason:"COD is not available at this pincode. Please choose prepaid."};
  return {eligible:true,reason:"This order is eligible for COD with a ₹49 fee."};
}
export function cancellation(shipped: boolean): Decision {
  return shipped ? {eligible:false,reason:"This order has shipped and cannot be cancelled. You may refuse delivery (prepaid refund minus ₹99) or request a policy-eligible return after delivery."} : {eligible:true,reason:"Free cancellation is available before shipment."};
}
export function returnEligibility(input: {
  deliveredAt: Date|null; now: Date; innerwear:boolean; sale:boolean; exchange:boolean;
  unused:boolean; tags:boolean; stock:number; exchanges:number; returns60:number; amount:number; damaged:boolean; photo:boolean;reviewThreshold?:number;
}): Decision {
  const x=input;
  if (x.innerwear) return {eligible:false,reason:"Innerwear cannot be returned or exchanged."};
  if (!x.exchange && x.sale) return {eligible:false,reason:"Sale items cannot be refunded. A size exchange is possible within 7 days, subject to stock."};
  if (!x.deliveredAt) return {eligible:false,reason:"A return or exchange can be requested after delivery."};
  const age=x.now.getTime()-x.deliveredAt.getTime();
  if (age<0) return {eligible:false,reason:"Delivery is recorded in the future; support must verify the delivery date before a return."};
  if (age>7*86400000) return {eligible:false,reason:"The 7-day return/exchange window has expired. This recorded delivery was more than 7 days ago."};
  if (x.returns60>=3 || x.amount>Math.min(1500,x.reviewThreshold??1500) || (x.damaged&&!x.photo)) return {eligible:false,manualReview:true,reason:"A support person must review this request: high-value refund/goodwill, repeat returns, or damage without a photo."};
  if (!x.unused || !x.tags) return {eligible:false,reason:"Please confirm the item is unused and its tags are attached."};
  if (x.exchange && x.exchanges>=1) return {eligible:false,reason:"Only one size exchange per item is permitted."};
  if (x.exchange && x.stock<1) return {eligible:false,reason:"The requested size is out of stock. A support person can help with alternatives."};
  return {eligible:true,reason:x.exchange ? "Eligible for one size exchange; requested size is in stock." : "Eligible for a return. Prepaid refunds take 5–7 working days after quality check. For COD, choose bank transfer or store credit."};
}
export function scoreRisk(input:{total:number; first:boolean; refusals:number; weakAddress:boolean; codAvailable:boolean; recentOrders:number}, medium=35, high=65) {
  const reasons:string[]=[]; let score=10;
  if(input.total>4000){score+=25;reasons.push("Order value is above ₹4,000");}
  if(input.first){score+=20;reasons.push("First-time customer");}
  if(input.refusals){score+=Math.min(30,input.refusals*15);reasons.push(`${input.refusals} previous COD refusals recorded`);}
  if(input.weakAddress){score+=25;reasons.push("Address lacks a clear house number or street");}
  if(!input.codAvailable){score+=25;reasons.push("Pincode does not support COD");}
  if(input.recentOrders>1){score+=15;reasons.push("Multiple COD orders recorded within 24 hours");}
  if(!reasons.length)reasons.push("Established customer, clear address and no recorded refusals");
  score=Math.min(100,score);
  return {score,band:score>=high?"HIGH":score>=medium?"MEDIUM":"LOW",reasons};
}
export const shippingFee = (subtotal:number) => subtotal>999?0:79;
export const prepaidQuote=(subtotal:number,shipping:number,existingDiscount=0)=>{
  const discount=Math.round((existingDiscount+subtotal*.05)*100)/100;
  return {discount,amount:Math.round((subtotal+shipping-discount)*100)/100};
};
export const phoneDigits=(p:string)=>p.replace(/\D/g,"").slice(-10);
export function redact(value:unknown):any {
  if (Array.isArray(value)) return value.map(redact);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/phone|email|address|line1|line2|landmark|password|token|originalText|sourceRecord/i.test(k)?"[REDACTED]":redact(v)]));
  if(typeof value==="string") return value.replace(/(?:\+91[- ]?)?\b\d{10}\b/g,"[PHONE]").replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,"[EMAIL]");
  return value;
}
