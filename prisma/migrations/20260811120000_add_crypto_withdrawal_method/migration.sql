-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WithdrawalMethod" AS ENUM ('BANK', 'CRYPTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "method" "WithdrawalMethod" NOT NULL DEFAULT 'BANK';
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "cryptoToken" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "cryptoNetwork" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "cryptoAddress" TEXT;

ALTER TABLE "withdrawals" ALTER COLUMN "beneficiaryName" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "bankName" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "accountNumber" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "swiftCode" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "beneficiaryAddress" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "zipCode" DROP NOT NULL;
ALTER TABLE "withdrawals" ALTER COLUMN "countryCode" DROP NOT NULL;
