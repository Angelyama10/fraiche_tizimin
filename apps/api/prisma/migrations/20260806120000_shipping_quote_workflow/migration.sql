-- CreateEnum
CREATE TYPE "ShippingQuoteStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'QUOTED');

-- AlterEnum
ALTER TYPE "AdminNotificationType" ADD VALUE 'SHIPPING_QUOTE_REQUESTED';

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "shippingQuoteStatus" "ShippingQuoteStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "shippingQuotedAt" TIMESTAMP(3),
ADD COLUMN "shippingQuoteNotes" TEXT;
