import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
export const demoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
// The demo clock advances normally, but retains the supplied November 12 policy scenarios.
const boot = Date.now();
export const policyNow = () => demoMode ? new Date(Date.UTC(2026,10,12,8,18) + Date.now() - boot) : new Date();
export const json = (v: unknown): any => JSON.parse(JSON.stringify(v, (_, x) => typeof x === "bigint" ? Number(x) : x));
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
