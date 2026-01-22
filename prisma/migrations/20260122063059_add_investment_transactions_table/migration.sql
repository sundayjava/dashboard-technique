-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INVESTMENT_PURCHASE', 'INVESTMENT_PROFIT', 'INVESTMENT_RETURN', 'FEE', 'BONUS', 'REFUND', 'ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_DEPOSIT';
ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT_WITHDRAWAL';

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionType" "InvestmentTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "investmentId" TEXT,
    "relatedAccountId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investment_transactions_reference_key" ON "investment_transactions"("reference");

-- CreateIndex
CREATE INDEX "investment_transactions_userId_idx" ON "investment_transactions"("userId");

-- CreateIndex
CREATE INDEX "investment_transactions_transactionType_idx" ON "investment_transactions"("transactionType");

-- CreateIndex
CREATE INDEX "investment_transactions_status_idx" ON "investment_transactions"("status");

-- CreateIndex
CREATE INDEX "investment_transactions_createdAt_idx" ON "investment_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "investment_transactions_reference_idx" ON "investment_transactions"("reference");

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
