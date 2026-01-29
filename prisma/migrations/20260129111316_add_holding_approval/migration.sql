-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HoldingStatus" ADD VALUE 'PENDING';
ALTER TYPE "HoldingStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "user_holdings" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processedBy" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
