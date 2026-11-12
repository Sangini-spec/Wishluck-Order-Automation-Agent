-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inventoryReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'SEED';

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'COD_CONVERSION';

-- CreateTable
CREATE TABLE "Cart" (
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("customerId")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "customerId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("customerId","sku","size")
);

-- CreateTable
CREATE TABLE "CheckoutSubmission" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSubmission_orderId_key" ON "CheckoutSubmission"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSubmission_customerId_key_key" ON "CheckoutSubmission"("customerId", "key");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Cart"("customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSubmission" ADD CONSTRAINT "CheckoutSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSubmission" ADD CONSTRAINT "CheckoutSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
