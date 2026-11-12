import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { curateDataset } from "./lib/curated-data";
import { seed, qualityIssues, validateSeed } from "./lib/seed";
import { prisma } from "./lib/db";
import { logger } from "./lib/logger";
const root=resolve(process.cwd(),"../../data"),active=resolve(root,"wishluck_seed_data.json"),archive=resolve(root,"original/wishluck_seed_data.json");
try{
  const original=readFileSync(existsSync(archive)?archive:active,"utf8");
  const hash=createHash("sha256").update(original).digest("hex");
  if(hash!=="b494fd9ec725a12ae6a937de54b12fa9ba11c0965ac2520b8eb5020f4adac196")throw new Error("Original upload hash mismatch; refusing to overwrite files.");
  const d=curateDataset(JSON.parse(original));d.dataset_metadata.original_sha256=hash;
  const counts=validateSeed(d),issues=qualityIssues(d);
  if(issues.length)throw new Error(`Corrected data still has issues: ${JSON.stringify(issues)}`);
  mkdirSync(resolve(root,"original"),{recursive:true});if(!existsSync(archive))writeFileSync(archive,original);
  writeFileSync(active,JSON.stringify(d,null,2)+"\n");
  await seed();
  logger.info({counts,issues:issues.length},"Corrected demo dataset generated and safely applied");
}catch(e){logger.error({message:e instanceof Error?e.message:"Correction failed"},"Data correction failed");process.exitCode=1;}finally{await prisma.$disconnect();}
