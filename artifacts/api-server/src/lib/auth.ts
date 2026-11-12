import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma, demoMode, HttpError } from "./db";
import type { User } from "@prisma/client";
export type AuthRequest=Request & { user?:User };
export function passwordHash(password:string){const salt=randomBytes(16).toString("hex");return `${salt}:${scryptSync(password,salt,64).toString("hex")}`;}
export function checkPassword(password:string,hash:string){const [salt,key]=hash.split(":");if(!salt||!key)return false;const stored=Buffer.from(key,"hex"),actual=scryptSync(password,salt,64);return stored.length===actual.length&&timingSafeEqual(stored,actual);}
const hashToken=(s:string)=>createHash("sha256").update(s).digest("hex");
export async function sessionMiddleware(req:AuthRequest,_res:Response,next:NextFunction){
  try{const raw=req.cookies?.wishluck_session;if(raw){const s=await prisma.session.findUnique({where:{tokenHash:hashToken(raw)},include:{user:true}});if(s&&s.expiresAt>new Date())req.user=s.user;}next();}catch(e){next(e);}
}
export function requireUser(req:AuthRequest,_res:Response,next:NextFunction){if(!req.user){next(new HttpError(401,"Please sign in."));return;}next();}
export function requireTeam(req:AuthRequest,_res:Response,next:NextFunction){if(req.user?.role!=="TEAM"){next(new HttpError(403,"Team access required."));return;}next();}
export function sessionInfo(user?:User){return {authenticated:!!user,demoMode,...(user?{user:{id:user.id,username:user.username,email:user.email,role:user.role,customerId:user.customerId}}:{})};}
export async function startSession(res:Response,user:User){
  const token=randomBytes(32).toString("hex");
  await prisma.session.create({data:{tokenHash:hashToken(token),userId:user.id,expiresAt:new Date(Date.now()+12*3600000)}});
  res.cookie("wishluck_session",token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:12*3600000,path:"/"});
  return sessionInfo(user);
}
export async function endSession(req:AuthRequest,res:Response){if(req.cookies?.wishluck_session)await prisma.session.deleteMany({where:{tokenHash:hashToken(req.cookies.wishluck_session)}});res.clearCookie("wishluck_session",{path:"/"});}
export async function demoUser(role:string,customerId="CUST-1006"){
  if(!demoMode)throw new HttpError(403,"Demo access is disabled.");
  if(role==="CUSTOMER"&&!await prisma.customer.findUnique({where:{id:customerId}}))throw new HttpError(400,"Unknown fictional demo identity.");
  const id=role==="TEAM"?"demo-team":`demo-${customerId}`;
  return prisma.user.upsert({where:{id},update:{},create:{id,username:role==="TEAM"?"WishLuck Team":`Demo ${customerId}`,email:`${id}@wishluck.example.test`,passwordHash:passwordHash("WishLuckDemo!2026"),role,customerId:role==="CUSTOMER"?customerId:null}});
}
