-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'REPLIED', 'CLOSED');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "links" TEXT;

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");

-- CreateIndex
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");

-- CreateIndex
CREATE INDEX "support_requests_email_idx" ON "support_requests"("email");

-- CreateIndex
CREATE INDEX "support_requests_createdAt_idx" ON "support_requests"("createdAt");

-- CreateIndex
CREATE INDEX "posts_published_idx" ON "posts"("published");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");
