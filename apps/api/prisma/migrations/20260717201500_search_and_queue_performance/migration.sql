-- Trigram indexes keep predictive search responsive as the catalog grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx"
ON "Product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Product_slug_trgm_idx"
ON "Product" USING GIN (slug gin_trgm_ops);

CREATE INDEX "ProductVariant_sku_trgm_idx"
ON "ProductVariant" USING GIN (sku gin_trgm_ops);

CREATE INDEX "Order_number_trgm_idx"
ON "Order" USING GIN (number gin_trgm_ops);

CREATE INDEX "Order_customerEmail_trgm_idx"
ON "Order" USING GIN ("customerEmail" gin_trgm_ops);

CREATE INDEX "Order_customerName_trgm_idx"
ON "Order" USING GIN ("customerName" gin_trgm_ops);

CREATE INDEX "Promotion_placement_isActive_startsAt_endsAt_idx"
ON "Promotion"(placement, "isActive", "startsAt", "endsAt");

-- These partial indexes target the two hot worker/admin queues.
CREATE INDEX "InventoryLevel_low_stock_partial_idx"
ON "InventoryLevel"(available, "lowStockThreshold")
WHERE available <= "lowStockThreshold";

CREATE INDEX "OutboxEvent_pending_available_partial_idx"
ON "OutboxEvent"("availableAt", "createdAt")
WHERE status = 'PENDING'::"OutboxStatus" AND attempts < 10;
