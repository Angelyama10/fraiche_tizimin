CREATE TYPE "AdminNotificationType" AS ENUM ('ORDER_CREATED');

CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "orderId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNotification_userId_type_orderId_key"
ON "AdminNotification"("userId", "type", "orderId");

CREATE INDEX "AdminNotification_userId_readAt_createdAt_idx"
ON "AdminNotification"("userId", "readAt", "createdAt");

CREATE INDEX "AdminNotification_orderId_idx"
ON "AdminNotification"("orderId");

ALTER TABLE "AdminNotification"
ADD CONSTRAINT "AdminNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNotification"
ADD CONSTRAINT "AdminNotification_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
