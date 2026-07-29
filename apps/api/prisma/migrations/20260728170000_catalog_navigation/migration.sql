CREATE TYPE "CatalogAudience" AS ENUM ('GENERAL', 'WOMEN', 'MEN', 'UNISEX', 'KIDS');

CREATE TABLE "CatalogSection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogLine" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" "CatalogAudience" NOT NULL DEFAULT 'GENERAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showInInspirations" BOOLEAN NOT NULL DEFAULT false,
    "inspirationGroupSlug" TEXT,
    "inspirationGroupName" TEXT,
    "inspirationSortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerfumeHouse" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfumeHouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogLineHouse" (
    "catalogLineId" TEXT NOT NULL,
    "perfumeHouseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogLineHouse_pkey" PRIMARY KEY ("catalogLineId","perfumeHouseId")
);

CREATE TABLE "ProductCatalogLine" (
    "productId" TEXT NOT NULL,
    "catalogLineId" TEXT NOT NULL,

    CONSTRAINT "ProductCatalogLine_pkey" PRIMARY KEY ("productId","catalogLineId")
);

ALTER TABLE "Product" ADD COLUMN "inspirationHouseId" TEXT;

CREATE UNIQUE INDEX "CatalogSection_slug_key" ON "CatalogSection"("slug");
CREATE INDEX "CatalogSection_isActive_sortOrder_idx" ON "CatalogSection"("isActive", "sortOrder");
CREATE UNIQUE INDEX "CatalogLine_slug_key" ON "CatalogLine"("slug");
CREATE INDEX "CatalogLine_sectionId_isActive_sortOrder_idx" ON "CatalogLine"("sectionId", "isActive", "sortOrder");
CREATE INDEX "CatalogLine_showInInspirations_isActive_idx" ON "CatalogLine"("showInInspirations", "isActive");
CREATE INDEX "CatalogLine_inspirationGroupSlug_inspirationSortOrder_idx" ON "CatalogLine"("inspirationGroupSlug", "inspirationSortOrder");
CREATE UNIQUE INDEX "PerfumeHouse_slug_key" ON "PerfumeHouse"("slug");
CREATE INDEX "PerfumeHouse_isActive_sortOrder_name_idx" ON "PerfumeHouse"("isActive", "sortOrder", "name");
CREATE INDEX "CatalogLineHouse_perfumeHouseId_catalogLineId_idx" ON "CatalogLineHouse"("perfumeHouseId", "catalogLineId");
CREATE INDEX "ProductCatalogLine_catalogLineId_productId_idx" ON "ProductCatalogLine"("catalogLineId", "productId");
CREATE INDEX "Product_inspirationHouseId_idx" ON "Product"("inspirationHouseId");

ALTER TABLE "CatalogLine" ADD CONSTRAINT "CatalogLine_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "CatalogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogLineHouse" ADD CONSTRAINT "CatalogLineHouse_catalogLineId_fkey"
  FOREIGN KEY ("catalogLineId") REFERENCES "CatalogLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogLineHouse" ADD CONSTRAINT "CatalogLineHouse_perfumeHouseId_fkey"
  FOREIGN KEY ("perfumeHouseId") REFERENCES "PerfumeHouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCatalogLine" ADD CONSTRAINT "ProductCatalogLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCatalogLine" ADD CONSTRAINT "ProductCatalogLine_catalogLineId_fkey"
  FOREIGN KEY ("catalogLineId") REFERENCES "CatalogLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_inspirationHouseId_fkey"
  FOREIGN KEY ("inspirationHouseId") REFERENCES "PerfumeHouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
