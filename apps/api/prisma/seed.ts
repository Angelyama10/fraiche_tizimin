import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PaymentMethod,
  PricingMode,
  Prisma,
  PrismaClient,
  ProductLine,
  ProductStatus,
  PromotionPlacement,
  PromotionType,
  StockMovementType,
} from '@prisma/client';
import { hash } from 'bcrypt';
import { Pool } from 'pg';
import { DEFAULT_SITE_CONTENT } from '../src/content/site-content.defaults';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type InventoryCatalogEntry = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  line: ProductLine;
  brandSlug: string;
  categorySlugs: string[];
  scentSlugs: string[];
  sku: string;
  variantName: string;
  concentrationLabel?: string;
  concentrationPercent?: number;
  volumeMl?: number;
  catalogPriceCents?: number;
  stock: number;
  attributes: Record<string, unknown>;
  variantAttributes: Record<string, unknown>;
};

type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  parentSlug?: string;
  sortOrder: number;
};

const categorySeeds: CategorySeed[] = [
  {
    slug: 'perfumes',
    name: 'Perfumes',
    description: 'Fragancias de diseñador, Neeche Passion y líneas Premium.',
    sortOrder: 10,
  },
  {
    slug: 'disenador-clasico',
    name: 'Perfumes Diseñador - Línea Fraiche',
    description: 'Presentación de 60 ml con concentración clásica al 33%.',
    parentSlug: 'perfumes',
    sortOrder: 10,
  },
  {
    slug: 'disenador-37',
    name: 'Perfumes Diseñador 37%',
    description: 'Presentación de 60 ml con 37% de esencia para mayor intensidad.',
    parentSlug: 'perfumes',
    sortOrder: 20,
  },
  {
    slug: 'neeche-passion',
    name: 'Neeche Passion',
    description: 'Fragancias de 60 ml con concentración clásica y precio fijo de $350 MXN.',
    parentSlug: 'perfumes',
    sortOrder: 30,
  },
  {
    slug: 'premium',
    name: 'Premium Nicho y Árabes',
    description: 'Fragancias Premium de 60 ml al 37% y precio fijo de $380 MXN.',
    parentSlug: 'perfumes',
    sortOrder: 40,
  },
  {
    slug: 'cuidado-personal',
    name: 'Cuidado Personal',
    description:
      'Productos para la higiene, belleza y cuidado diario de la piel y el cuerpo. Aquí encontrarás hidratación, limpieza facial, protección solar, maquillaje y tratamientos para complementar tu rutina de forma práctica y organizada.',
    sortOrder: 20,
  },
  {
    slug: 'cremas-corporales',
    name: 'Cremas corporales',
    description: 'Productos para hidratar, nutrir y suavizar la piel.',
    parentSlug: 'cuidado-personal',
    sortOrder: 10,
  },
  {
    slug: 'body-mist',
    name: 'Body Mist',
    description: 'Brumas corporales con fragancias ligeras para brindar frescura durante el día.',
    parentSlug: 'cuidado-personal',
    sortOrder: 20,
  },
  {
    slug: 'protectores-solares',
    name: 'Protectores solares',
    description: 'Productos que ayudan a proteger la piel de los efectos de la radiación solar.',
    parentSlug: 'cuidado-personal',
    sortOrder: 30,
  },
  {
    slug: 'agua-micelar',
    name: 'Agua micelar',
    description:
      'Limpieza facial para retirar maquillaje, impurezas y exceso de grasa sin necesidad de enjuagar.',
    parentSlug: 'cuidado-personal',
    sortOrder: 40,
  },
  {
    slug: 'maquillaje',
    name: 'Maquillaje',
    description: 'Delineadores, máscaras de pestañas, labiales y otros artículos de belleza.',
    parentSlug: 'cuidado-personal',
    sortOrder: 50,
  },
  {
    slug: 'serums',
    name: 'Sérums',
    description:
      'Tratamientos faciales concentrados para hidratar, nutrir y mejorar la apariencia de la piel.',
    parentSlug: 'cuidado-personal',
    sortOrder: 60,
  },
  {
    slug: 'desmaquillantes',
    name: 'Desmaquillantes',
    description: 'Productos para retirar maquillaje y limpiar suavemente el rostro.',
    parentSlug: 'cuidado-personal',
    sortOrder: 70,
  },
  {
    slug: 'exfoliantes',
    name: 'Exfoliantes',
    description: 'Cuidado facial y corporal para retirar células muertas y renovar la piel.',
    parentSlug: 'cuidado-personal',
    sortOrder: 80,
  },
  {
    slug: 'tonicos',
    name: 'Tónicos',
    description: 'Productos para complementar la limpieza y preparar la piel.',
    parentSlug: 'cuidado-personal',
    sortOrder: 90,
  },
  {
    slug: 'balsamos-labiales',
    name: 'Bálsamos labiales',
    description: 'Hidratación y protección para los labios.',
    parentSlug: 'cuidado-personal',
    sortOrder: 100,
  },
  {
    slug: 'aceites-corporales',
    name: 'Aceites corporales',
    description: 'Aceites para nutrir la piel y complementar el cuidado corporal.',
    parentSlug: 'cuidado-personal',
    sortOrder: 110,
  },
  {
    slug: 'desodorantes',
    name: 'Desodorantes',
    description: 'Opciones para mujer, hombre y presentaciones unisex.',
    parentSlug: 'cuidado-personal',
    sortOrder: 120,
  },
  {
    slug: 'perfumes-para-cabello',
    name: 'Perfumes para cabello',
    description: 'Brumas ligeras creadas para perfumar el cabello.',
    parentSlug: 'cuidado-personal',
    sortOrder: 130,
  },
  {
    slug: 'jabones-corporales',
    name: 'Jabones corporales',
    description: 'Jabones naturales, artesanales y kits para el cuidado diario.',
    parentSlug: 'cuidado-personal',
    sortOrder: 140,
  },
  {
    slug: 'colonias-infantiles',
    name: 'Colonias infantiles',
    description: 'Aromas y aguas de colonia para niñas y niños.',
    parentSlug: 'cuidado-personal',
    sortOrder: 150,
  },
  {
    slug: 'perfumes-de-regalo',
    name: 'Perfumes de regalo',
    description: 'Presentaciones decorativas y especiales para obsequiar.',
    parentSlug: 'cuidado-personal',
    sortOrder: 160,
  },
  {
    slug: 'lociones-victorias-secret',
    name: "Lociones Victoria's Secret",
    description: "Body Mist y lociones corporales Victoria's Secret.",
    parentSlug: 'cuidado-personal',
    sortOrder: 170,
  },
  {
    slug: 'lociones-arabes',
    name: 'Lociones corporales árabes',
    description: 'Body Mist y lociones corporales de inspiración árabe.',
    parentSlug: 'cuidado-personal',
    sortOrder: 180,
  },
  {
    slug: 'linea-fraiche',
    name: 'Productos de la línea Fraiche',
    description: 'Selección de cuidado personal elaborada o distribuida por Fraiche.',
    parentSlug: 'cuidado-personal',
    sortOrder: 190,
  },
  {
    slug: 'otros-cuidados',
    name: 'Otros productos de cuidado personal',
    description: 'Artículos adicionales para el cuidado facial y corporal.',
    parentSlug: 'cuidado-personal',
    sortOrder: 200,
  },
  {
    slug: 'aromas-para-espacios',
    name: 'Aromas para espacios',
    description: 'Aromas para acompañar el hogar, el auto y tus espacios cotidianos.',
    sortOrder: 30,
  },
  {
    slug: 'aromatizantes-para-auto',
    name: 'Aromatizantes para auto',
    description: 'Aromas concentrados para mantener fresco el interior del automóvil.',
    parentSlug: 'aromas-para-espacios',
    sortOrder: 10,
  },
  {
    slug: 'velas-aromaticas',
    name: 'Velas aromáticas',
    description: 'Velas decorativas con aroma para el hogar.',
    parentSlug: 'aromas-para-espacios',
    sortOrder: 20,
  },
];

function loadInventoryCatalog() {
  const path = resolve(__dirname, 'data/inventory-2.0.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as InventoryCatalogEntry[];
  if (!Array.isArray(parsed) || parsed.length !== 872) {
    throw new Error('El catálogo normalizado debe contener exactamente 872 productos.');
  }
  return parsed;
}

function normalizeDisplayName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return normalized;
  return normalized[0].toLocaleUpperCase('es-MX') + normalized.slice(1);
}

function normalizeVariantName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, '$1 ml')
    .replace(/(\d+(?:[.,]\d+)?)\s*mg\b/gi, '$1 mg')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:gr|g)\b/gi, '$1 g');
}

function normalizeProductCopy(value: string) {
  return value
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, '$1 ml')
    .replace(/(\d+(?:[.,]\d+)?)\s*mg\b/gi, '$1 mg')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:gr|g)\b/gi, '$1 g');
}

async function seedCategories() {
  const categoryIds = new Map<string, string>();
  for (const seed of categorySeeds.filter((entry) => !entry.parentSlug)) {
    const category = await prisma.category.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });
    categoryIds.set(category.slug, category.id);
  }

  for (const seed of categorySeeds.filter((entry) => entry.parentSlug)) {
    const parentId = categoryIds.get(seed.parentSlug!);
    if (!parentId) throw new Error(`No existe la categoría padre ${seed.parentSlug}.`);
    const category = await prisma.category.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        parentId,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        parentId,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });
    categoryIds.set(category.slug, category.id);
  }
  return categoryIds;
}

async function seedCatalogProduct(
  entry: InventoryCatalogEntry,
  locationId: string,
  brandIds: Map<string, string>,
  categoryIds: Map<string, string>,
  scentIds: Map<string, string>,
) {
  const brandId = brandIds.get(entry.brandSlug);
  if (!brandId) throw new Error(`No existe la marca ${entry.brandSlug}.`);
  const productName = normalizeDisplayName(entry.name);
  const variantName = normalizeVariantName(entry.variantName);
  const shortDescription = normalizeProductCopy(entry.shortDescription);
  const description = normalizeProductCopy(entry.description);

  const product = await prisma.product.upsert({
    where: { slug: entry.slug },
    update: {
      name: productName,
      shortDescription,
      description,
      line: entry.line,
      brandId,
      status: ProductStatus.ACTIVE,
      attributes: entry.attributes as Prisma.InputJsonValue,
    },
    create: {
      slug: entry.slug,
      name: productName,
      shortDescription,
      description,
      line: entry.line,
      brandId,
      status: ProductStatus.ACTIVE,
      attributes: entry.attributes as Prisma.InputJsonValue,
    },
  });

  const productCategories = entry.categorySlugs.map((slug) => {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) throw new Error(`No existe la categoría ${slug}.`);
    return { productId: product.id, categoryId };
  });
  await prisma.productCategory.createMany({
    data: productCategories,
    skipDuplicates: true,
  });

  const productScents = entry.scentSlugs.map((slug) => {
    const scentFamilyId = scentIds.get(slug);
    if (!scentFamilyId) throw new Error(`No existe la familia aromática ${slug}.`);
    return { productId: product.id, scentFamilyId };
  });
  if (productScents.length) {
    await prisma.productScentFamily.createMany({
      data: productScents,
      skipDuplicates: true,
    });
  }

  const variant = await prisma.productVariant.upsert({
    where: { sku: entry.sku },
    update: {
      productId: product.id,
      name: variantName,
      concentrationLabel: entry.concentrationLabel,
      concentrationPercent: entry.concentrationPercent,
      volumeMl: entry.volumeMl,
      catalogPriceCents: entry.catalogPriceCents,
      attributes: entry.variantAttributes as Prisma.InputJsonValue,
      isActive: true,
    },
    create: {
      productId: product.id,
      sku: entry.sku,
      name: variantName,
      concentrationLabel: entry.concentrationLabel,
      concentrationPercent: entry.concentrationPercent,
      volumeMl: entry.volumeMl,
      catalogPriceCents: entry.catalogPriceCents,
      attributes: entry.variantAttributes as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  const existingInventory = await prisma.inventoryLevel.findUnique({
    where: {
      variantId_locationId: { variantId: variant.id, locationId },
    },
  });
  if (!existingInventory) {
    await prisma.$transaction([
      prisma.inventoryLevel.create({
        data: {
          variantId: variant.id,
          locationId,
          onHand: entry.stock,
          available: entry.stock,
          reserved: 0,
          lowStockThreshold: 3,
        },
      }),
      ...(entry.stock > 0
        ? [
            prisma.stockMovement.create({
              data: {
                variantId: variant.id,
                locationId,
                type: StockMovementType.PURCHASE,
                quantity: entry.stock,
                referenceId: product.id,
                reason: 'Importación inicial de INVENTARIO 2.0.xlsx',
              },
            }),
          ]
        : []),
    ]);
  }
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: 'Administrador Fraiche',
        passwordHash: await hash(adminPassword, 12),
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email: adminEmail,
        name: 'Administrador Fraiche',
        passwordHash: await hash(adminPassword, 12),
        role: 'ADMIN',
        isActive: true,
      },
    });
  }

  await prisma.siteContent.upsert({
    where: { key: 'main' },
    update: {},
    create: {
      key: 'main',
      draftContent: DEFAULT_SITE_CONTENT as unknown as Prisma.InputJsonValue,
      publishedContent: DEFAULT_SITE_CONTENT as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
  });

  const policies = [
    [ProductLine.DESIGNER_CLASSIC, PricingMode.CATALOG, null],
    [ProductLine.DESIGNER_37, PricingMode.CATALOG, null],
    [ProductLine.NEECHE_PASSION, PricingMode.FIXED_BY_LINE, 35000],
    [ProductLine.PREMIUM, PricingMode.FIXED_BY_LINE, 38000],
    [ProductLine.PERSONAL_CARE, PricingMode.CATALOG, null],
  ] as const;
  for (const [line, pricingMode, fixedPriceCents] of policies) {
    await prisma.linePricingPolicy.upsert({
      where: { line },
      update: { pricingMode, fixedPriceCents, isActive: true },
      create: { line, pricingMode, fixedPriceCents, isActive: true },
    });
  }

  const brandIds = new Map<string, string>();
  for (const [slug, name] of [
    ['fraiche', 'Fraiche'],
    ['neeche', 'Neeche Passion'],
    ['premium', 'Premium'],
    ['victorias-secret', "Victoria's Secret"],
    ['arabic-care', 'Cuidado árabe'],
  ]) {
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });
    brandIds.set(brand.slug, brand.id);
  }

  const categoryIds = await seedCategories();
  const scentIds = new Map<string, string>();
  for (const [slug, name, description] of [
    ['floral', 'Floral', 'Rosas, jazmín, violetas y flores blancas.'],
    ['citrico', 'Cítrico', 'Bergamota, limón, naranja, mandarina y toronja.'],
    ['amaderado', 'Amaderado', 'Cedro, sándalo, vetiver, pachulí y oud.'],
    ['fresco', 'Fresco', 'Acordes acuáticos, verdes, limpios y ligeros.'],
    ['dulce', 'Dulce', 'Vainilla, caramelo, miel, chocolate y notas gourmand.'],
    ['oriental', 'Oriental', 'Ámbar, almizcle, especias e incienso.'],
    ['nicho', 'Nicho', 'Composiciones distintivas inspiradas en perfumería nicho.'],
    ['arabe', 'Árabe', 'Acordes intensos de oud, ámbar, especias y resinas.'],
  ]) {
    const scent = await prisma.scentFamily.upsert({
      where: { slug },
      update: { name, description },
      create: { slug, name, description },
    });
    scentIds.set(scent.slug, scent.id);
  }

  const location = await prisma.storeLocation.upsert({
    where: { slug: 'tizimin-centro' },
    update: {
      name: 'Fraiche Tizimín',
      isDefault: true,
      isActive: true,
      address: {
        street: 'C. 56 396, entre 45 y 47',
        neighborhood: 'Centro',
        postalCode: '97700',
        city: 'Tizimín',
        state: 'Yucatán',
        country: 'MX',
      },
    },
    create: {
      slug: 'tizimin-centro',
      name: 'Fraiche Tizimín',
      isDefault: true,
      isActive: true,
      address: {
        street: 'C. 56 396, entre 45 y 47',
        neighborhood: 'Centro',
        postalCode: '97700',
        city: 'Tizimín',
        state: 'Yucatán',
        country: 'MX',
      },
    },
  });

  await prisma.product.updateMany({
    where: {
      slug: {
        in: [
          'elegance-floral-clasico',
          'noir-intense-37',
          'neeche-passion-floral',
          'premium-oud-royal',
          'crema-corporal-fraiche-floral',
        ],
      },
    },
    data: { status: ProductStatus.ARCHIVED },
  });

  const catalog = loadInventoryCatalog();
  const batchSize = 16;
  for (let index = 0; index < catalog.length; index += batchSize) {
    await Promise.all(
      catalog
        .slice(index, index + batchSize)
        .map((entry) =>
          seedCatalogProduct(entry, location.id, brandIds, categoryIds, scentIds),
        ),
    );
  }

  await prisma.paymentInstruction.upsert({
    where: { method: PaymentMethod.BANK_TRANSFER },
    update: {
      title: 'Transferencia a Mercado Pago',
      instructions:
        'Transfiere el total exacto de tu pedido y adjunta el comprobante. Confirmaremos el pago después de revisarlo.',
      accountData: {
        clabe: '722969020182233026',
        beneficiary: 'Ivonne Michel Gastelum Fernandez',
        institution: 'Mercado Pago W',
        dimoPhone: '-',
      },
      isActive: true,
    },
    create: {
      method: PaymentMethod.BANK_TRANSFER,
      title: 'Transferencia a Mercado Pago',
      instructions:
        'Transfiere el total exacto de tu pedido y adjunta el comprobante. Confirmaremos el pago después de revisarlo.',
      accountData: {
        clabe: '722969020182233026',
        beneficiary: 'Ivonne Michel Gastelum Fernandez',
        institution: 'Mercado Pago W',
        dimoPhone: '-',
      },
      isActive: true,
    },
  });

  await prisma.paymentInstruction.upsert({
    where: { method: PaymentMethod.CASH },
    update: {
      title: 'Pago en efectivo',
      instructions: 'Paga al recoger tu pedido en Fraiche Tizimín.',
      isActive: true,
    },
    create: {
      method: PaymentMethod.CASH,
      title: 'Pago en efectivo',
      instructions: 'Paga al recoger tu pedido en Fraiche Tizimín.',
      isActive: true,
    },
  });

  const welcomePromotion = await prisma.promotion.upsert({
    where: { slug: 'bienvenida-fraiche' },
    update: {
      code: null,
      name: '10% en tu primera compra',
      description:
        'Crea tu cuenta y recibe automáticamente 10% de descuento en tu primera compra.',
      type: PromotionType.PERCENTAGE,
      value: 10,
      minimumCents: 0,
      maximumUses: null,
      maximumDiscountCents: null,
      perCustomerLimit: 1,
      endsAt: null,
      isActive: true,
      isFeatured: true,
      requiresCode: false,
      isStackable: false,
      priority: 100,
      placement: PromotionPlacement.WELCOME,
    },
    create: {
      slug: 'bienvenida-fraiche',
      code: null,
      name: '10% en tu primera compra',
      description:
        'Crea tu cuenta y recibe automáticamente 10% de descuento en tu primera compra.',
      type: PromotionType.PERCENTAGE,
      value: 10,
      minimumCents: 0,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: null,
      isActive: true,
      isFeatured: true,
      requiresCode: false,
      isStackable: false,
      priority: 100,
      placement: PromotionPlacement.WELCOME,
      perCustomerLimit: 1,
    },
  });
  await prisma.$transaction([
    prisma.promotionProduct.deleteMany({
      where: { promotionId: welcomePromotion.id },
    }),
    prisma.promotionCategory.deleteMany({
      where: { promotionId: welcomePromotion.id },
    }),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
