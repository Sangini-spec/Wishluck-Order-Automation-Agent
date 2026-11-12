import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { curateDataset } from "../lib/curated-data";
import { qualityIssues, validateSeed } from "../lib/seed";
const archive=resolve(process.cwd(),"../../data/original/wishluck_seed_data.json");
const original=JSON.parse(readFileSync(existsSync(archive)?archive:resolve(process.cwd(),"../../data/wishluck_seed_data.json"),"utf8"));
test("corrected dataset retains every original entity ID and leaves the input untouched",()=>{
  const text=JSON.stringify(original),d=curateDataset(original);
  assert.equal(JSON.stringify(original),text);
  for(const [table,key] of [["customers","customer_id"],["products","sku"],["orders","order_id"],["shipments","shipment_id"],["returns","return_id"],["refunds","refund_id"],["cod_confirmations","order_id"]]){
    for(const row of original[table!])assert.ok(d[table!].some((r:any)=>r[key!]===row[key!]));
  }
});
test("corrected dataset has valid counts and no relationship or policy inconsistencies",()=>{
  const d=curateDataset(original);assert.equal(validateSeed(d).orders,30);assert.deepEqual(qualityIssues(d),[]);
});
test("assignment's exact 4600 incomplete-address COD case is high risk",()=>{
  const d=curateDataset(original),o=d.orders.find((x:any)=>x.order_id==="WL10236"),c=d.cod_confirmations.find((x:any)=>x.order_id===o.order_id);
  assert.equal(o.payment.total,4600);assert.equal(o.shipping_address.line1,"near Shiv mandir");assert.equal(c.risk_band,"HIGH");
});
test("COD exclusions require prepaid and completed COD refund has an explicit payout method",()=>{
  const d=curateDataset(original);
  assert.equal(d.orders.find((o:any)=>o.order_id==="WL10255").payment.method,"PREPAID");
  assert.equal(d.cod_confirmations.find((c:any)=>c.order_id==="WL10255").status,"PREPAID_REQUIRED");
  assert.equal(d.refunds.find((r:any)=>r.refund_id==="REF-4012").method,"BANK_TRANSFER");
});
