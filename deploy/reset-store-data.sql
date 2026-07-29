BEGIN;

TRUNCATE TABLE
  "AdminNotification",
  "ShipmentEvent",
  "Shipment",
  "TransferProof",
  "Payment",
  "InventoryReservation",
  "OrderPromotion",
  "OrderItem",
  "Order",
  "CartItem",
  "Cart",
  "WishlistItem",
  "CustomerSession",
  "PasswordResetRequest",
  "CustomerAddress",
  "Customer",
  "WebhookEvent",
  "PromotionProduct",
  "PromotionCategory",
  "Promotion",
  "StockMovement",
  "InventoryAlert",
  "InventoryLevel",
  "ProductImage",
  "ProductCategory",
  "ProductScentFamily",
  "ProductVariant",
  "Product",
  "SpecialRequest",
  "OutboxEvent",
  "IdempotencyRecord",
  "AuditLog"
RESTART IDENTITY CASCADE;

COMMIT;
