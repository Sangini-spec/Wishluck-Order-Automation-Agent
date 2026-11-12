import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
export const demoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
// One shared, durable clock origin: a server/worker/CLI restart must never make
// a freshly delivered runtime order appear to have been delivered in the future.
const baseline=Date.UTC(2026,10,12,8,18);
const lastRuntimeDelivery=demoMode?await prisma.order.aggregate({where:{isDemo:true},_max:{deliveredAt:true}}):null;
const clock=demoMode?await prisma.appSetting.upsert({where:{key:"demoClockAnchor"},update:{},
  create:{key:"demoClockAnchor",value:{demoMs:Math.max(baseline,lastRuntimeDelivery?._max.deliveredAt?.getTime()||baseline),wallMs:Date.now()}}}):null;
const anchor=clock?.value as {demoMs:number;wallMs:number}|undefined;
export const policyNow = () => demoMode&&anchor ? new Date(anchor.demoMs+Date.now()-anchor.wallMs) : new Date();
export const json = (v: unknown): any => JSON.parse(JSON.stringify(v, (_, x) => typeof x === "bigint" ? Number(x) : x));
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
