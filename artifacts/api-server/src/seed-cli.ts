import { seed } from "./lib/seed";
import { demoUser } from "./lib/auth";
import { prisma } from "./lib/db";
import { logger } from "./lib/logger";
try {
  await seed();
  await demoUser("TEAM");
  await demoUser("CUSTOMER");
} catch (e) {
  logger.error({message:e instanceof Error?e.message:"Seed failed"},"Import failed");
  process.exitCode=1;
} finally { await prisma.$disconnect(); }
