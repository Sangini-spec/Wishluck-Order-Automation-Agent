import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError,json,policyNow } from "./db";
export const courierResponseSchema=z.object({
  orderId:z.string(),retryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  landmark:z.string().min(2).max(150).optional(),phone:z.string().optional(),pincode:z.string().regex(/^\d{6}$/).optional(),
  address:z.object({line1:z.string().min(3),city:z.string().min(2),state:z.string().min(2),pincode:z.string().regex(/^\d{6}$/)}).optional(),
  refuse:z.boolean().optional(),reason:z.string().max(200).optional(),
});
export async function validateCourierResponse(t:any,o:any,value:unknown){
  const a=courierResponseSchema.parse(value);
  if(a.orderId!==o.id)throw new HttpError(400,"Courier order mismatch.");
  if(a.retryDate){
    const today=new Date(policyNow().getTime()+330*60000).toISOString().slice(0,10);
    const diff=(Date.parse(`${a.retryDate}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000;
    if(!Number.isInteger(diff)||diff<0||diff>3)throw new HttpError(400,"Choose a retry date within the next 3 days.");
  }
  if(a.phone&&!/^(?:91)?\d{10}$/.test(a.phone.replace(/\D/g,"")))throw new HttpError(400,"Please provide a valid alternate phone.");
  for(const code of [a.address?.pincode,a.pincode].filter(Boolean)){
    const pin=await t.pincodeServiceability.findUnique({where:{pincode:code}});
    if(!pin||(o.payment?.method==="COD"&&!pin.codAvailable))throw new HttpError(400,"The corrected pincode requires manual serviceability review.");
  }
  if(a.refuse&&!a.reason)throw new HttpError(400,"Please give the refusal reason.");
  if(!a.refuse&&!a.retryDate&&!a.landmark&&!a.phone&&!a.address)throw new HttpError(400,"Provide a retry date, corrected address/landmark or alternate phone.");
  return a;
}
// The mock API contract is a validated adapter, shared by agent and queue.
// No outbound HTTP/payment provider is simulated as a real integration.
export async function acknowledgeCourierInstruction(t:any,instructionId:string){
  const command=await t.courierInstruction.findUniqueOrThrow({where:{id:instructionId}});
  if(command.status==="ACKNOWLEDGED")return command;
  const o=await t.order.findUniqueOrThrow({where:{id:command.orderId},include:{payment:true}});
  if(["DELIVERED","CANCELLED","RTO_INITIATED"].includes(o.status)){
    return t.courierInstruction.update({where:{id:command.id},data:{status:"CLOSED"}});
  }
  const a=await validateCourierResponse(t,o,command.payload);
  const acknowledgementId=`MOCK-ACK-${createHash("sha256").update(command.consentId).digest("hex").slice(0,16)}`;
  await t.shipmentEvent.upsert({where:{id:`ndr-response-${command.consentId}`},update:{},create:{
    id:`ndr-response-${command.consentId}`,shipmentId:command.shipmentId,status:a.refuse?"RTO_REQUESTED":"REATTEMPT_REQUESTED",
    reason:a.refuse?a.reason:"Mock courier acknowledged delivery instructions",
    occurredAt:policyNow(),source:"MOCK_COURIER_API",sourceIndex:await t.shipmentEvent.count({where:{shipmentId:command.shipmentId}}),
  }});
  await t.nDRCase.update({where:{id:command.ndrCaseId},data:{status:a.refuse?"RTO_REQUESTED":"REATTEMPT_REQUESTED"}});
  await t.order.update({where:{id:o.id},data:{
    ...(a.refuse?{status:"RTO_REQUESTED"}:{}),
    ...(!a.refuse&&(a.address||a.landmark)?{shippingAddress:json({...o.shippingAddress,...a.address,...(a.landmark?{landmark:a.landmark}:{})})}:{}),
    notes:{push:a.refuse?`Mock courier ${acknowledgementId}: RTO requested; ${a.reason}`:`Mock courier ${acknowledgementId}: retry instructions acknowledged${a.retryDate?` for ${a.retryDate}`:""}.`},
  }});
  return t.courierInstruction.update({where:{id:command.id},data:{status:"ACKNOWLEDGED",acknowledgementId,acknowledgedAt:new Date()}});
}
