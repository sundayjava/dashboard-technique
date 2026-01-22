/*
  Warnings:

  - A unique constraint covering the columns `[cardNumber]` on the table `card_applications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "card_applications" ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardHolderName" TEXT,
ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "cvv" TEXT,
ADD COLUMN     "expiryMonth" INTEGER,
ADD COLUMN     "expiryYear" INTEGER,
ADD COLUMN     "issuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "card_applications_cardNumber_key" ON "card_applications"("cardNumber");

-- CreateIndex
CREATE INDEX "card_applications_cardNumber_idx" ON "card_applications"("cardNumber");
