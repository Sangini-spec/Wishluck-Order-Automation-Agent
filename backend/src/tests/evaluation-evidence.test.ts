import { test } from "node:test";
import assert from "node:assert/strict";
import { hasUnavailableStockEvidence } from "../evaluation/tool-evidence";
const sku="WL-JNS-03",size="30";
const eligibility={toolName:"evaluate_return_eligibility",status:"SUCCESS",output:{sku,requestedSize:size,availableStock:0,eligible:false}};
const check=(traces:any[])=>hasUnavailableStockEvidence(traces,sku,size);
test("stock evidence accepts successful integrated eligibility with exact SKU and size",()=>assert.equal(check([eligibility]),true));
test("stock evidence accepts successful dedicated inventory lookup with exact SKU and size",()=>assert.equal(check([{toolName:"check_inventory",status:"SUCCESS",output:{stock:[{sku,size,available:0}]}}]),true));
test("stock evidence rejects wrong product",()=>assert.equal(check([{...eligibility,output:{...eligibility.output,sku:"WL-TEE-02"}}]),false));
test("stock evidence rejects wrong variant size",()=>assert.equal(check([{...eligibility,output:{...eligibility.output,requestedSize:"32"}}]),false));
test("stock evidence rejects failed tool execution",()=>assert.equal(check([{...eligibility,status:"ERROR"}]),false));
test("stock evidence rejects positive stock and unsupported eligibility",()=>{
  assert.equal(check([{...eligibility,output:{...eligibility.output,availableStock:1}}]),false);
  assert.equal(check([{...eligibility,output:{...eligibility.output,eligible:true}}]),false);
});
test("stock evidence rejects missing results and unrelated tool names",()=>{
  assert.equal(check([]),false);
  assert.equal(check([{...eligibility,output:null}]),false);
  assert.equal(check([{...eligibility,toolName:"get_order_details"}]),false);
});
test("stock evidence cannot infer an unavailable variant from a different inventory row",()=>assert.equal(check([{toolName:"check_inventory",status:"SUCCESS",output:{stock:[{sku,size:"32",available:0}]}}]),false));
