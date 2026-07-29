INSERT INTO "PaymentInstruction" (
  "id",
  "method",
  "title",
  "instructions",
  "accountData",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'payment-instruction-bank-transfer',
  'BANK_TRANSFER',
  'Transferencia a Mercado Pago',
  'Transfiere el total exacto de tu pedido y adjunta el comprobante. Confirmaremos el pago despues de revisarlo.',
  '{"clabe":"722969020182233026","beneficiary":"Ivonne Michel Gastelum Fernandez","institution":"Mercado Pago W","dimoPhone":"-"}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("method") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "instructions" = EXCLUDED."instructions",
  "accountData" = EXCLUDED."accountData",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
