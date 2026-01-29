-- CreateEnum
CREATE TYPE "HoldingStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'CLOSED');

-- CreateTable
CREATE TABLE "holding_tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "logo" TEXT,
    "tokenAddress" TEXT,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceChange24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holding_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_holdings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "depositedAmount" DOUBLE PRECISION NOT NULL,
    "tokenAmount" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "interestEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holding_tokens_symbol_key" ON "holding_tokens"("symbol");

-- CreateIndex
CREATE INDEX "user_holdings_userId_idx" ON "user_holdings"("userId");

-- CreateIndex
CREATE INDEX "user_holdings_tokenId_idx" ON "user_holdings"("tokenId");

-- CreateIndex
CREATE INDEX "user_holdings_status_idx" ON "user_holdings"("status");

-- AddForeignKey
ALTER TABLE "user_holdings" ADD CONSTRAINT "user_holdings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_holdings" ADD CONSTRAINT "user_holdings_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "holding_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
