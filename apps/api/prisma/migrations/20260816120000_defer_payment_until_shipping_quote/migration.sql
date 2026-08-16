-- Shipping and local-delivery orders are reserved before the customer chooses
-- a payment method. Existing orders keep their current value.
ALTER TABLE "Order"
ALTER COLUMN "paymentMethod" DROP NOT NULL;
