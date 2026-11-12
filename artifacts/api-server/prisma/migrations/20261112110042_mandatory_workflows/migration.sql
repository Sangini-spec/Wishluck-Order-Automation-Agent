-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "clarificationTurns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hadHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issueKey" TEXT,
ADD COLUMN     "resolutionSource" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "toolErrorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unresolvedTurns" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "refundAmount" DECIMAL(12,2),
ADD COLUMN     "refundMethod" TEXT;

-- CreateTable
CREATE TABLE "CourierInstruction" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "ndrCaseId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "acknowledgementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "CourierInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierInstruction_consentId_key" ON "CourierInstruction"("consentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierInstruction_acknowledgementId_key" ON "CourierInstruction"("acknowledgementId");
