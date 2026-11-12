-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "seedDatasetId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "document" JSONB NOT NULL,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoScenario" (
    "id" TEXT NOT NULL,
    "sourceIndex" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "orderId" TEXT,
    "sourceRecord" JSONB NOT NULL,

    CONSTRAINT "DemoScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoScenario_sourceIndex_key" ON "DemoScenario"("sourceIndex");

-- AddForeignKey
ALTER TABLE "DemoScenario" ADD CONSTRAINT "DemoScenario_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
