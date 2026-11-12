import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qualityIssues, validateSeed } from "../lib/seed";

const data=JSON.parse(readFileSync(resolve(process.cwd(),"../data/wishluck_seed_data.json"),"utf8"));
test("active dataset contains all required entity collections",()=>{
  for(const [collection,key] of [["customers","customer_id"],["products","sku"],["orders","order_id"],["shipments","shipment_id"],["returns","return_id"],["refunds","refund_id"],["cod_confirmations","order_id"]]){
    assert.ok(data[collection!].length>0);
    assert.equal(new Set(data[collection!].map((r:any)=>r[key!])).size,data[collection!].length);
  }
});
test("active dataset has valid counts and no relationship or policy inconsistencies",()=>{
  assert.equal(validateSeed(data).orders,30);
  assert.deepEqual(qualityIssues(data),[]);
});
test("assignment's exact 4600 incomplete-address COD case is high risk",()=>{
  const order=data.orders.find((x:any)=>x.order_id==="WL10236"),cod=data.cod_confirmations.find((x:any)=>x.order_id===order.order_id);
  assert.equal(order.payment.total,4600);
  assert.equal(order.shipping_address.line1,"near Shiv mandir");
  assert.equal(cod.risk_band,"HIGH");
});
test("COD exclusions require prepaid and COD refund specifies payout method",()=>{
  assert.equal(data.orders.find((o:any)=>o.order_id==="WL10255").payment.method,"PREPAID");
  assert.equal(data.cod_confirmations.find((c:any)=>c.order_id==="WL10255").status,"PREPAID_REQUIRED");
  assert.equal(data.refunds.find((r:any)=>r.refund_id==="REF-4012").method,"BANK_TRANSFER");
});
