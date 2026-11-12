import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import app from "../app";
import { prisma,policyNow } from "../lib/db";
import { analytics } from "../lib/analytics";
import { evaluationOrder } from "../evaluation/fixtures";
import { startCod } from "../lib/operations";
import { estimateTokenCost } from "../lib/llm-cost";
test("evaluation conversations, COD and saved NDR cases do not affect live metrics",async()=>{
  const o=await evaluationOrder("WL10236");await startCod(o.id);
  await prisma.$transaction(async t=>{
    const before=await analytics(t);
    await t.conversation.create({data:{customerId:o.customerId,isEvaluation:true,status:"RESOLVED",resolutionSource:"CUSTOMER_AI",resolvedAt:new Date(),messages:{create:[{role:"user",content:"Policy?"},{role:"assistant",content:"Policy test answer."}]}}});
    await t.nDRCase.create({data:{orderId:o.id,shipmentId:"evaluation-only",reason:"EVAL",attemptCount:1,status:"SAVED_DELIVERED",conversationId:"evaluation-only",eventId:randomUUID()}});
    const after=await analytics(t);
    assert.equal(after.metrics.customerChats,before.metrics.customerChats);
    assert.equal(after.metrics.aiResolved,before.metrics.aiResolved);
    assert.equal(after.metrics.rtoSaved,before.metrics.rtoSaved);
    assert.equal(after.metrics.pendingCod,before.metrics.pendingCod);
    assert.ok(await t.cODConfirmation.count({where:{status:"PENDING"}})>after.metrics.pendingCod);
  },{isolationLevel:"RepeatableRead",timeout:15000});
});
test("explicit customer resolution is owned, idempotent and counted as self service",async()=>{
  const server=createServer(app);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const address=server.address();assert.ok(address&&typeof address==="object");
  const base=`http://127.0.0.1:${address.port}/api`,name=`resolution${randomUUID().slice(0,8)}`;
  let uid:string|undefined,cid:string|undefined,conversationId:string|undefined;
  try{
    const reg=await fetch(base+"/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:name,email:`${name}@example.test`,password:"EvaluationPassword12!",role:"CUSTOMER"})});
    const user=await reg.json() as any;uid=user.user.id;cid=user.user.customerId;
    const headers={Cookie:reg.headers.get("set-cookie")!.split(";")[0]!,"Content-Type":"application/json"};
    const created=await fetch(base+"/conversations",{method:"POST",headers,body:"{}"});
    const c=await created.json() as any;conversationId=c.id;
    assert.equal((await fetch(base+`/conversations/${c.id}/resolve`,{method:"POST",headers})).status,409);
    await prisma.message.createMany({data:[{conversationId:c.id,role:"user",content:"Test policy question"},{conversationId:c.id,role:"assistant",content:"Test policy answer"}]});
    const before=await analytics();
    assert.equal((await fetch(base+`/conversations/${c.id}/resolve`,{method:"POST",headers})).status,200);
    assert.equal((await fetch(base+`/conversations/${c.id}/resolve`,{method:"POST",headers})).status,200);
    const after=await analytics();assert.equal(after.metrics.aiResolved,before.metrics.aiResolved+1);
    assert.equal(after.metrics.aiResolutionRate,Math.round(after.metrics.aiResolved/after.metrics.customerChats*100));
  }finally{
    server.close();
    if(conversationId){await prisma.auditLog.deleteMany({where:{conversationId}});await prisma.message.deleteMany({where:{conversationId}});await prisma.conversation.delete({where:{id:conversationId}});}
    if(uid){await prisma.session.deleteMany({where:{userId:uid}});await prisma.user.delete({where:{id:uid}});}
    if(cid)await prisma.customer.delete({where:{id:cid}});
  }
});
test("cost estimate uses documented public token rates, separately from actual billing",()=>{
  assert.equal(estimateTokenCost(1_000_000,1_000_000),5.25);
  assert.equal(estimateTokenCost(0,0),0);
});
test("fresh processes share the persisted demo clock instead of resetting delivered-order ages",()=>{
  const before=policyNow().getTime();
  const output=execFileSync(process.execPath,["--import","tsx","--input-type=module","-e","import {prisma,policyNow} from './src/lib/db.ts'; console.log(policyNow().getTime()); await prisma.$disconnect();"],{cwd:process.cwd(),encoding:"utf8"});
  const child=Number(output.trim()),after=policyNow().getTime();
  assert.ok(child>=before-25&&child<=after+25,"a restarted process must share the same advancing clock origin");
});
