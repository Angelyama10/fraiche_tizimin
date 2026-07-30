SELECT set_config('inventory.expected_products', :'expected_products', false);
SELECT set_config('inventory.expected_zero_stock', :'expected_zero_stock', false);

DO $$
DECLARE
  expected_products integer := current_setting('inventory.expected_products')::integer;
  expected_zero_stock integer := current_setting('inventory.expected_zero_stock')::integer;
  product_count integer;
  variant_count integer;
  inventory_count integer;
  zero_stock_count integer;
  cream_count integer;
  invalid_products integer;
  invalid_skus integer;
  missing_categories integer;
  missing_catalog_lines integer;
  invalid_creams integer;
BEGIN
  SELECT COUNT(*) INTO product_count FROM "Product" WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO variant_count FROM "ProductVariant" WHERE "isActive" = true;
  SELECT COUNT(*) INTO inventory_count FROM "InventoryLevel";
  SELECT COUNT(*) INTO zero_stock_count FROM "InventoryLevel" WHERE "onHand" = 0;
  SELECT COUNT(*) INTO invalid_products
  FROM "Product"
  WHERE status = 'ACTIVE'
    AND (
      "brandId" IS NULL
      OR COALESCE(BTRIM(name), '') = ''
      OR COALESCE(BTRIM("shortDescription"), '') = ''
      OR COALESCE(BTRIM(description), '') = ''
    );
  SELECT COUNT(*) INTO invalid_skus
  FROM "ProductVariant"
  WHERE sku <> BTRIM(sku) OR sku ~ '\s';
  SELECT COUNT(*) INTO missing_categories
  FROM "Product" product
  WHERE product.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM "ProductCategory" relation
      WHERE relation."productId" = product.id
    );
  SELECT COUNT(*) INTO missing_catalog_lines
  FROM "Product" product
  WHERE product.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM "ProductCatalogLine" relation
      WHERE relation."productId" = product.id
    );
  SELECT COUNT(*) INTO cream_count
  FROM "Product"
  WHERE attributes->>'sourceSheet' = 'Crema Humectante Perfumable';
  SELECT COUNT(*) INTO invalid_creams
  FROM "Product" product
  JOIN "ProductVariant" variant ON variant."productId" = product.id
  WHERE product.attributes->>'sourceSheet' = 'Crema Humectante Perfumable'
    AND (
      variant."concentrationPercent" IS NOT NULL
      OR variant.attributes->'essenceAmount'->>'amount' <> '2'
      OR variant.attributes->'essenceAmount'->>'unit' <> 'g'
    );

  IF product_count <> expected_products THEN
    RAISE EXCEPTION 'Productos activos: %, esperados: %', product_count, expected_products;
  END IF;
  IF variant_count <> expected_products THEN
    RAISE EXCEPTION 'Variantes activas: %, esperadas: %', variant_count, expected_products;
  END IF;
  IF inventory_count <> expected_products THEN
    RAISE EXCEPTION 'Niveles de inventario: %, esperados: %', inventory_count, expected_products;
  END IF;
  IF zero_stock_count <> expected_zero_stock THEN
    RAISE EXCEPTION 'Productos con stock cero: %, esperados: %', zero_stock_count, expected_zero_stock;
  END IF;
  IF cream_count <> 10 OR invalid_products <> 0 OR invalid_skus <> 0
    OR missing_categories <> 0 OR missing_catalog_lines <> 0
    OR invalid_creams <> 0 THEN
    RAISE EXCEPTION
      'Datos inválidos: cremas %, productos %, SKU %, categorías %, líneas %, cremas inválidas %',
      cream_count, invalid_products, invalid_skus, missing_categories,
      missing_catalog_lines, invalid_creams;
  END IF;
END
$$;

SELECT
  (SELECT COUNT(*) FROM "Product" WHERE status = 'ACTIVE') AS products,
  (SELECT COUNT(*) FROM "ProductVariant" WHERE "isActive" = true) AS variants,
  (SELECT COUNT(*) FROM "Brand") AS brands,
  (SELECT COUNT(*) FROM "Category") AS categories,
  (SELECT COUNT(*) FROM "PerfumeHouse") AS perfume_houses,
  (SELECT COUNT(*) FROM "InventoryLevel" WHERE "onHand" = 0) AS zero_stock;
