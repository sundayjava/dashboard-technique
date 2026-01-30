-- AlterTable
ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "cryptoIcon" TEXT;
ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "cryptoSymbol" TEXT;
