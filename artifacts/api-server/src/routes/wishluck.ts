import { Router } from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createHmac,timingSafeEqual,randomUUID } from "node:crypto";
import * as V from "@workspace/api-zod";
import { prisma, demoMode, HttpError, json } from "../lib/db";
import { sessionMiddleware,requireUser,requireTeam,startSession,endSession,sessionInfo,demoUser,passwordHash,checkPassword,type AuthRequest } from "../lib/auth";
import { orderInclude,orderView,settings,audit,createTestOrder,createConversation,conversationView,codRespond,courierEvent,maskPhone,refresh,events } from "../lib/operations";
import { dashboard,analytics,activity,datasetReport } from "../lib/analytics";
import { respondAgent } from "../lib/agent";
import { logger } from "../lib/logger";
import { getCart,changeCart,checkoutQuote } from "../lib/cart";
import { submitCheckout,simulateCustomerPayment } from "../lib/checkout";
import { handoverDefaults } from "../lib/workflow-rules";
const router=Router();router.use(cookieParser());router.use(sessionMiddleware);
const authLimit=rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false,validate:{xForwardedForHeader:false},message:{error:"Too many attempts. Try again shortly."}});
router.get("/auth/me",(req:AuthRequest,res)=>res.json(sessionInfo(req.user)));
router.post("/auth/demo",authLimit,async(req,res)=>{const a=V.DemoLoginBody.parse(req.body);res.json(await startSession(res,await demoUser(a.role,a.customerId)));});
router.post("/auth/login",authLimit,async(req,res)=>{
  const a=V.LoginBody.parse(req.body);
  const user=await prisma.user.findUnique({where:{email:a.email.toLowerCase()}});
  if(!user||user.role!==a.role||!checkPassword(a.password,user.passwordHash))throw new HttpError(401,"Email, password or selected role does not match.");
  res.json(await startSession(res,user));
});
router.post("/auth/register",authLimit,async(req,res)=>{
  const a=V.RegisterBody.parse(req.body);
  z.object({username:z.string().trim().min(3).max(50),email:z.string().email().max(200),password:z.string().min(10).max(128)}).parse(a);
  if(a.role==="TEAM"&&!demoMode)throw new HttpError(403,"Public Team registration is disabled outside this fictional demo.");
  const email=a.email.toLowerCase();
  const user=await prisma.$transaction(async t=>{
    let customerId:string|null=null;
    if(a.role==="CUSTOMER"){const c=await t.customer.create({data:{id:`CUST-DEMO-${randomUUID().slice(0,8)}`,name:a.username,email,phone:"",address:{},isFirstTimeCustomer:true,codRefusalsLast12Months:0,returnsLast60Days:0,customerSince:new Date().toISOString().slice(0,10),sourceRecord:{runtime:true,registration:true}}});customerId=c.id;}
    return t.user.create({data:{username:a.username,email,passwordHash:passwordHash(a.password),role:a.role,customerId}});
  });res.status(201).json(await startSession(res,user));
});
router.post("/auth/logout",async(req:AuthRequest,res)=>{await endSession(req,res);res.json({success:true,message:"Signed out."});});
// Webhook HMAC is checked against the exact raw JSON bytes before accepting an event.
function signature(req:any){
  const key=process.env.WEBHOOK_SECRET||process.env.SESSION_SECRET;
  if(!key)throw new HttpError(503,"Webhook signing secret is not configured.");
  const supplied=String(req.headers["x-wishluck-signature"]||"").replace(/^sha256=/,""),raw=req.rawBody as Buffer|undefined;
  if(!raw||!/^[a-f0-9]{64}$/i.test(supplied))throw new HttpError(401,"Invalid webhook signature.");
  const expected=createHmac("sha256",key).update(raw).digest();if(!timingSafeEqual(expected,Buffer.from(supplied,"hex")))throw new HttpError(401,"Invalid webhook signature.");
}
router.post("/webhooks/courier",async(req,res)=>{signature(req);const body=z.object({orderId:z.string(),eventId:z.string().min(1)}).passthrough().parse(req.body);res.json(await courierEvent(body.orderId,{...V.TriggerCourierBody.parse(body),eventId:body.eventId}));});
router.post("/webhooks/orders",async(req,res)=>{signature(req);const a=z.object({eventId:z.string().min(1),order:z.unknown()}).parse(req.body);const input=V.CreateTestOrderBody.parse(a.order);res.status(201).json(await createTestOrder(input,a.eventId));});
router.use(requireUser);
function customerId(req:AuthRequest){
  if(req.user!.role!=="CUSTOMER"||!req.user!.customerId)throw new HttpError(403,"Customer account required.");
  return req.user!.customerId;
}
const delivery=z.object({
  phone:z.string().trim().regex(/^(?:\+91[- ]?)?\d{10}$/),
  paymentMethod:z.enum(["COD","PREPAID"]),
  address:z.object({
    line1:z.string().trim().min(3).max(200),line2:z.string().trim().max(200).optional(),
    landmark:z.string().trim().max(150).optional(),city:z.string().trim().min(2).max(80),
    state:z.string().trim().min(2).max(80),pincode:z.string().regex(/^\d{6}$/),
  }).strict(),
}).strict();
router.get("/cart",async(req:AuthRequest,res)=>res.json(await getCart(customerId(req))));
router.patch("/cart",async(req:AuthRequest,res)=>{
  const a=V.ChangeCartBody.parse(req.body);
  res.json(await changeCart(customerId(req),z.object({sku:z.string().min(1).max(80),size:z.string().min(1).max(40),quantity:z.number().int().min(0).max(10),mode:z.enum(["ADD","SET"])}).strict().parse(a)));
  refresh();
});
router.post("/checkout/quote",async(req:AuthRequest,res)=>{
  const a=delivery.parse(V.GetCheckoutQuoteBody.parse(req.body));
  res.json(await checkoutQuote(customerId(req),a));
});
router.post("/checkout",async(req:AuthRequest,res)=>{
  const body=V.SubmitCheckoutBody.parse(req.body);
  const a=z.object({phone:delivery.shape.phone,paymentMethod:delivery.shape.paymentMethod,address:delivery.shape.address,
    cartVersion:z.number().int().min(1),idempotencyKey:z.string().min(12).max(100),saveProfile:z.boolean().optional()}).strict().parse(body);
  res.status(201).json(await submitCheckout(customerId(req),a));
});
async function ownProfile(req:AuthRequest){
  if(req.user!.role!=="CUSTOMER"||!req.user!.customerId)throw new HttpError(403,"Customer account required.");
  const c=await prisma.customer.findUniqueOrThrow({where:{id:req.user!.customerId}});
  return {id:c.id,name:c.name,email:c.email,phone:c.phone,address:c.address,editable:(c.sourceRecord as any)?.runtime===true};
}
router.get("/profile",async(req:AuthRequest,res)=>res.json(await ownProfile(req)));
router.patch("/profile",async(req:AuthRequest,res)=>{
  const profile=await ownProfile(req);if(!profile.editable)throw new HttpError(403,"Original fictional customer identity is read-only. Change a specific order's contact through verified chat.");
  const a=V.UpdateProfileBody.parse(req.body);
  z.object({phone:z.string().regex(/^(?:\+91[- ]?)?\d{10}$/),address:z.object({line1:z.string().min(3),city:z.string().min(2),state:z.string().min(2),pincode:z.string().regex(/^\d{6}$/)}).passthrough()}).parse(a);
  const pin=await prisma.pincodeServiceability.findUnique({where:{pincode:String(a.address.pincode)}});
  if(!pin)throw new HttpError(400,"This pincode is not in the demo serviceability table. Contact support for a manual check.");
  await prisma.customer.update({where:{id:profile.id},data:{phone:a.phone,address:json(a.address)}});
  refresh();res.json(await ownProfile(req));
});
async function ownOrder(req:AuthRequest,id:string){
  const o=await prisma.order.findUnique({where:{id},include:orderInclude});
  if(!o||o.isEvaluation||(req.user!.role!=="TEAM"&&req.user!.customerId!==o.customerId))throw new HttpError(404,"Order not found.");
  return o;
}
async function ownConversation(req:AuthRequest,id:string){
  const c=await prisma.conversation.findUnique({where:{id}});
  if(!c||c.isEvaluation||(req.user!.role!=="TEAM"&&req.user!.customerId!==c.customerId))throw new HttpError(404,"Conversation not found.");
  return c;
}
router.get("/events",(req:AuthRequest,res)=>{
  res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");res.flushHeaders();
  res.write(`data: ${JSON.stringify({type:"connected"})}\n\n`);
  const update=()=>res.write(`data: ${JSON.stringify({type:"refresh"})}\n\n`);
  events.on("refresh",update);const keep=setInterval(()=>res.write(": heartbeat\n\n"),20000);
  req.on("close",()=>{clearInterval(keep);events.off("refresh",update);});
});
router.get("/products",async(_req,res)=>res.json((await prisma.product.findMany({include:{inventory:true},orderBy:{sku:"asc"}})).map(({sourceRecord,price,...p})=>({...p,price:Number(price)}))));
router.get("/orders",async(req:AuthRequest,res)=>{
  const q=V.GetOrdersQueryParams.parse(req.query),scope=req.user!.role==="TEAM"?{}:{customerId:req.user!.customerId!};
  const orders=await prisma.order.findMany({where:{isEvaluation:false,...scope,...(q.status&&q.status!=="ALL"?{status:q.status}:{}),...(q.search?{OR:[{id:{contains:q.search,mode:"insensitive"}},{customer:{name:{contains:q.search,mode:"insensitive"}}}]}:{})},include:orderInclude,orderBy:{createdAt:"desc"}});
  res.json(await Promise.all(orders.map(o=>orderView(o))));
});
router.get("/orders/:id",async(req:AuthRequest,res)=>res.json(await orderView(await ownOrder(req,V.GetOrderParams.parse(req.params).id),req.user!.role==="TEAM")));
router.post("/orders",requireTeam,async(req,res)=>res.status(201).json(await createTestOrder(V.CreateTestOrderBody.parse(req.body))));
router.post("/orders/:id/cod",async(req:AuthRequest,res)=>{
  const id=V.RespondCodParams.parse(req.params).id;await ownOrder(req,id);
  const action=V.RespondCodBody.parse(req.body);
  if(action.action==="START"&&req.user!.role!=="TEAM")throw new HttpError(403,"New customer COD orders start automatically; only the team can restart imported demo workflows.");
  if(action.action==="PAYMENT_SUCCESS"&&req.user!.role!=="TEAM")throw new HttpError(403,"Only the demo team can trigger the simulated payment callback.");
  res.json(await codRespond(id,action));
});
router.post("/orders/:id/payment",async(req:AuthRequest,res)=>{
  const id=V.SimulateCustomerPaymentParams.parse(req.params).id,a=V.SimulateCustomerPaymentBody.parse(req.body);
  res.json(await simulateCustomerPayment(customerId(req),id,a.paymentId,a.action));
});
router.post("/orders/:id/courier",requireTeam,async(req:AuthRequest,res)=>{
  const id=V.TriggerCourierParams.parse(req.params).id;await ownOrder(req,id);res.json(await courierEvent(id,V.TriggerCourierBody.parse(req.body)));
});
router.get("/conversations",async(req:AuthRequest,res)=>{
  const cs=await prisma.conversation.findMany({where:{isEvaluation:false,...(req.user!.role==="TEAM"?{}:{customerId:req.user!.customerId!})},orderBy:{updatedAt:"desc"}});
  res.json(await Promise.all(cs.map(c=>conversationView(c.id,req.user!.role==="TEAM"))));
});
router.post("/conversations",async(req:AuthRequest,res)=>{
  const a=V.CreateConversationBody.parse(req.body),customerId=req.user!.role==="TEAM"?a.customerId:req.user!.customerId;
  if(!customerId)throw new HttpError(400,"Select a customer for this demo conversation.");
  const c=await createConversation(customerId);res.status(201).json(await conversationView(c.id,req.user!.role==="TEAM"));
});
router.get("/conversations/:id",async(req:AuthRequest,res)=>{const id=V.GetConversationParams.parse(req.params).id;await ownConversation(req,id);res.json(await conversationView(id,req.user!.role==="TEAM"));});
router.post("/conversations/:id/resolve",async(req:AuthRequest,res)=>{
  customerId(req);
  const id=V.ResolveCustomerConversationParams.parse(req.params).id;
  await ownConversation(req,id);
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Conversation" WHERE id=${id} FOR UPDATE`;
    const c=await t.conversation.findUniqueOrThrow({where:{id},include:{messages:{orderBy:{createdAt:"desc"},take:20},pendingActions:{where:{status:"PENDING",expiresAt:{gt:new Date()}}}}});
    if(c.status==="RESOLVED"&&c.resolutionSource==="CUSTOMER_AI")return;
    const user=c.messages.find(m=>m.role==="user"),assistant=c.messages.find(m=>m.role==="assistant");
    if(c.status!=="AI_HANDLING"||c.pendingActions.length||(c.busyUntil&&c.busyUntil>new Date())||!user||!assistant||assistant.createdAt<user.createdAt)throw new HttpError(409,"Wait for the reply and complete any pending action before marking this solved.");
    await t.conversation.update({where:{id},data:{status:"RESOLVED",resolvedAt:new Date(),resolutionSource:"CUSTOMER_AI",version:{increment:1}}});
    await audit(t,"CUSTOMER","Marked conversation solved",c.orderId,{status:c.status},{status:"RESOLVED",resolutionSource:"CUSTOMER_AI"},id);
  });
  refresh();res.json(await conversationView(id,false));
});
router.patch("/conversations/:id",requireTeam,async(req:AuthRequest,res)=>{
  const id=V.UpdateConversationParams.parse(req.params).id,a=V.UpdateConversationBody.parse(req.body);await ownConversation(req,id);
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Conversation" WHERE id=${id} FOR UPDATE`;
    const status=a.action==="TAKE_OVER"?"NEEDS_HUMAN":a.action==="HAND_BACK"?"AI_HANDLING":"RESOLVED";
    await t.conversation.update({where:{id},data:{status,version:{increment:1},busyUntil:null,
      ...(a.action==="TAKE_OVER"?{handoverReason:"Team took over manually",hadHuman:true}:{}),
      ...(a.action==="RESOLVE"?{resolvedAt:new Date(),resolutionSource:"TEAM"}:{resolvedAt:null,resolutionSource:null}),
      ...(a.action==="HAND_BACK"?{unresolvedTurns:0,clarificationTurns:0,toolErrorCount:0}:{})}});
    await t.pendingAction.updateMany({where:{conversationId:id,status:"PENDING"},data:{status:"INVALIDATED"}});
    if(a.action==="RESOLVE")await t.supportTicket.updateMany({where:{conversationId:id},data:{status:"RESOLVED"}});
    if(a.action==="TAKE_OVER"){
      await t.supportTicket.upsert({where:{conversationId:id},update:{status:"OPEN"},create:{conversationId:id,reason:"Team took over manually",sentiment:"NEUTRAL",priority:"NORMAL",summary:"Team initiated manual takeover. Review the full conversation before replying.",suggestedReply:"Hi, I’m from the WishLuck support team. How can I help?"}});
      await t.message.create({data:{conversationId:id,role:"assistant",content:"A support person has taken over this conversation. Automated replies are paused."}});
    }
    await audit(t,"TEAM",a.action.replaceAll("_"," "),null,{}, {status},id);
  });refresh();res.json(await conversationView(id,true));
});
router.post("/conversations/:id/messages",rateLimit({windowMs:60000,limit:30,validate:{xForwardedForHeader:false},message:{error:"Please wait before sending more messages."}}),async(req:AuthRequest,res)=>{
  const id=V.SendMessageParams.parse(req.params).id,a=V.SendMessageBody.parse(req.body),c=await ownConversation(req,id);
  if(c.status==="RESOLVED")throw new HttpError(409,"This conversation is resolved. Start a new conversation or hand it back to AI.");
  if(a.asHuman&&req.user!.role!=="TEAM")throw new HttpError(403,"Only team members can send human replies.");
  if(a.asHuman&&c.status!=="NEEDS_HUMAN")throw new HttpError(409,"Take over this conversation before sending a manual reply.");
  if(!a.asHuman&&c.busyUntil&&c.busyUntil>new Date())throw new HttpError(409,"Please wait for the current reply.");
  await prisma.message.create({data:{conversationId:id,role:a.asHuman?"human":"user",content:a.content}});
  await prisma.conversation.update({where:{id},data:{updatedAt:new Date(),...(a.asHuman?{hadHuman:true}:{})}});
  refresh();
  if(!a.asHuman)await respondAgent(id,a.content);
  res.json(await conversationView(id,req.user!.role==="TEAM"));
});
router.get("/tickets",requireTeam,async(_req,res)=>{
  const ts=await prisma.supportTicket.findMany({where:{conversation:{isEvaluation:false}},include:{conversation:{include:{customer:true}}},orderBy:{createdAt:"desc"}});
  res.json(ts.map(({conversation,...t})=>({...t,customerName:conversation.customer.name})));
});
router.patch("/tickets/:id",requireTeam,async(req,res)=>{
  const id=V.UpdateTicketParams.parse(req.params).id,a=V.UpdateTicketBody.parse(req.body);
  const t=await prisma.supportTicket.update({where:{id},data:a,include:{conversation:{include:{customer:true}}}});
  if(a.status==="RESOLVED")await prisma.conversation.update({where:{id:t.conversationId},data:{status:"RESOLVED",version:{increment:1}}});
  refresh();const {conversation,...ticket}=t;res.json({...ticket,customerName:conversation.customer.name});
});
router.get("/customers",requireTeam,async(_req,res)=>res.json((await prisma.customer.findMany({orderBy:{id:"asc"}})).map(c=>({id:c.id,name:c.name,phone:maskPhone(c.phone),email:"[masked]",address:{city:(c.address as any).city}}))));
router.get("/dashboard",requireTeam,async(_req,res)=>res.json(json(await dashboard())));
router.get("/analytics",requireTeam,async(_req,res)=>res.json(json(await analytics())));
router.get("/activity",requireTeam,async(_req,res)=>res.json(json(await activity())));
router.get("/dataset",requireTeam,async(_req,res)=>res.json(json(await datasetReport())));
router.get("/settings",requireTeam,async(_req,res)=>res.json(await settings()));
router.patch("/settings",requireTeam,async(req,res)=>{
  const parsed=V.UpdateSettingsBody.parse(req.body);
  const oldSetting=await prisma.appSetting.findUniqueOrThrow({where:{key:"workflow"}});
  const a={...handoverDefaults,...oldSetting.value as any,...parsed};
  if(a.codHoldSeconds<=a.codReminderSeconds)throw new HttpError(400,"Hold delay must exceed reminder delay.");
  if(a.riskHighThreshold<=a.riskMediumThreshold)throw new HttpError(400,"High risk threshold must exceed medium threshold.");
  await prisma.$transaction(async t=>{
    const old=await t.appSetting.findUniqueOrThrow({where:{key:"workflow"}});
    await t.appSetting.update({where:{key:"workflow"},data:{value:a}});
    const jobs=await t.outboxJob.findMany({where:{state:"PENDING"}});
    for(const j of jobs){const delay=j.kind==="COD_REMINDER"?a.codReminderSeconds:j.kind==="COD_HOLD"?a.codHoldSeconds:j.kind==="NDR_CHECK"?a.ndrFollowupSeconds:null;if(delay!==null)await t.outboxJob.update({where:{id:j.id},data:{dueAt:new Date(j.createdAt.getTime()+delay*1000)}});}
    await audit(t,"TEAM","Updated workflow settings",null,old.value,a);
  });refresh();res.json(await settings());
});
export default router;
