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
} from '@prisma/client';
import { Pool } from 'pg';
import { hash } from 'bcrypt';
import { DEFAULT_SITE_CONTENT } from '../src/content/site-content.defaults';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type SeedProduct = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  line: ProductLine;
  brandSlug: string;
  categorySlug: string;
  scentSlugs: string[];
  sku: string;
  variantName: string;
  concentrationLabel?: string;
  concentrationPercent?: number;
  volumeMl?: number;
  catalogPriceCents?: number;
  stock: number;
  isFeatured?: boolean;
  isNew?: boolean;
};

async function upsertCategory(slug: string, name: string, parentId?: string) {
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { slug, name, parentId, isActive: true },
  });
}

async function seedProduct(productData: SeedProduct, locationId: string) {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { slug: productData.brandSlug },
  });
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: productData.categorySlug },
  });

  const product = await prisma.product.upsert({
    where: { slug: productData.slug },
    update: {},
    create: {
      slug: productData.slug,
      name: productData.name,
      shortDescription: productData.shortDescription,
      description: productData.description,
      line: productData.line,
      brandId: brand.id,
      status: ProductStatus.ACTIVE,
      isFeatured: productData.isFeatured ?? false,
      isNew: productData.isNew ?? false,
    },
  });

  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: { productId: product.id, categoryId: category.id },
    },
    update: {},
    create: { productId: product.id, categoryId: category.id },
  });

  for (const scentSlug of productData.scentSlugs) {
    const scentFamily = await prisma.scentFamily.findUniqueOrThrow({
      where: { slug: scentSlug },
    });
    await prisma.productScentFamily.upsert({
      where: {
        productId_scentFamilyId: {
          productId: product.id,
          scentFamilyId: scentFamily.id,
        },
      },
      update: {},
      create: { productId: product.id, scentFamilyId: scentFamily.id },
    });
  }

  const variant = await prisma.productVariant.upsert({
    where: { sku: productData.sku },
    update: {},
    create: {
      productId: product.id,
      sku: productData.sku,
      name: productData.variantName,
      concentrationLabel: productData.concentrationLabel,
      concentrationPercent: productData.concentrationPercent,
      volumeMl: productData.volumeMl,
      catalogPriceCents: productData.catalogPriceCents,
      isActive: true,
    },
  });

  await prisma.inventoryLevel.upsert({
    where: {
      variantId_locationId: { variantId: variant.id, locationId },
    },
    update: {},
    create: {
      variantId: variant.id,
      locationId,
      onHand: productData.stock,
      available: productData.stock,
      reserved: 0,
    },
  });

  return product;
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
      update: {},
      create: { line, pricingMode, fixedPriceCents, isActive: true },
    });
  }

  for (const [slug, name] of [
    ['fraiche', 'Fraiche'],
    ['neeche', 'Neeche Passion'],
    ['premium', 'Premium'],
    ['victorias-secret', "Victoria's Secret"],
    ['arabic-care', 'Cuidado Arabe'],
  ]) {
    await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
  }

  const perfumes = await upsertCategory('perfumes', 'Perfumes');
  await upsertCategory('disenador-clasico', 'Perfumes Disenador - Linea Fraiche', perfumes.id);
  await upsertCategory('disenador-37', 'Perfumes Disenador 37%', perfumes.id);
  await upsertCategory('neeche-passion', 'Neeche Passion', perfumes.id);
  await upsertCategory('premium', 'Premium Nicho y Arabes', perfumes.id);

  const personalCare = await upsertCategory('cuidado-personal', 'Cuidado Personal');
  await upsertCategory('cremas-corporales', 'Cremas Corporales', personalCare.id);
  await upsertCategory('desodorantes', 'Desodorantes', personalCare.id);
  await upsertCategory('lociones-victorias-secret', "Lociones Victoria's Secret", personalCare.id);
  await upsertCategory('lociones-arabes', 'Lociones Corporales Arabes', personalCare.id);
  await upsertCategory('linea-fraiche', 'Productos de la Linea Fraiche', personalCare.id);

  for (const [slug, name] of [
    ['floral', 'Floral'],
    ['citrico', 'Citrico'],
    ['amaderado', 'Amaderado'],
    ['fresco', 'Fresco'],
    ['dulce', 'Dulce'],
    ['oriental', 'Oriental'],
    ['nicho', 'Nicho'],
    ['arabe', 'Arabe'],
  ]) {
    await prisma.scentFamily.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
  }

  const location = await prisma.storeLocation.upsert({
    where: { slug: 'tizimin-centro' },
    update: {},
    create: {
      slug: 'tizimin-centro',
      name: 'Fraiche Tizimin',
      isDefault: true,
      isActive: true,
      address: { city: 'Tizimin', state: 'Yucatan', country: 'MX' },
    },
  });

  const seededProducts: SeedProduct[] = [
    {
      slug: 'elegance-floral-clasico',
      name: 'Elegance Floral',
      shortDescription: 'Inspiracion floral ligera para todos los dias.',
      description: 'Fragancia de la linea Fraiche inspirada en perfumeria de disenador.',
      line: ProductLine.DESIGNER_CLASSIC,
      brandSlug: 'fraiche',
      categorySlug: 'disenador-clasico',
      scentSlugs: ['floral', 'fresco'],
      sku: 'FRA-DIS-CLA-001-60',
      variantName: '60 ml Clasica',
      concentrationLabel: 'Clasica',
      volumeMl: 60,
      catalogPriceCents: 32000,
      stock: 30,
      isFeatured: true,
    },
    {
      slug: 'noir-intense-37',
      name: 'Noir Intense',
      shortDescription: 'Aroma profundo con mayor intensidad y duracion.',
      description: 'Perfume de disenador con 37% de esencia en presentacion de 60 ml.',
      line: ProductLine.DESIGNER_37,
      brandSlug: 'fraiche',
      categorySlug: 'disenador-37',
      scentSlugs: ['amaderado', 'oriental'],
      sku: 'FRA-DIS-37-001-60',
      variantName: '60 ml 37%',
      concentrationLabel: '37%',
      concentrationPercent: 37,
      volumeMl: 60,
      catalogPriceCents: 42000,
      stock: 24,
      isNew: true,
    },
    {
      slug: 'neeche-passion-floral',
      name: 'Neeche Passion Floral',
      shortDescription: 'Fragancia expresiva, suave y memorable.',
      description: 'Neeche Passion en concentracion normal y presentacion de 60 ml.',
      line: ProductLine.NEECHE_PASSION,
      brandSlug: 'neeche',
      categorySlug: 'neeche-passion',
      scentSlugs: ['floral', 'dulce'],
      sku: 'NEE-PAS-001-60',
      variantName: '60 ml Clasica',
      concentrationLabel: 'Normal',
      volumeMl: 60,
      stock: 40,
      isFeatured: true,
    },
    {
      slug: 'premium-oud-royal',
      name: 'Premium Oud Royal',
      shortDescription: 'Inspiracion arabe con oud y matices orientales.',
      description: 'Perfume Premium de inspiracion nicho y arabe con 37% de esencia.',
      line: ProductLine.PREMIUM,
      brandSlug: 'premium',
      categorySlug: 'premium',
      scentSlugs: ['arabe', 'nicho', 'oriental'],
      sku: 'PRE-OUD-001-60',
      variantName: '60 ml 37%',
      concentrationLabel: '37%',
      concentrationPercent: 37,
      volumeMl: 60,
      stock: 35,
      isFeatured: true,
      isNew: true,
    },
    {
      slug: 'crema-corporal-fraiche-floral',
      name: 'Crema Corporal Floral',
      shortDescription: 'Hidratacion diaria con aroma floral fresco.',
      description: 'Crema corporal de la linea Fraiche para complementar tu fragancia.',
      line: ProductLine.PERSONAL_CARE,
      brandSlug: 'fraiche',
      categorySlug: 'cremas-corporales',
      scentSlugs: ['floral', 'fresco'],
      sku: 'CARE-CREAM-001-250',
      variantName: '250 ml',
      volumeMl: 250,
      catalogPriceCents: 18000,
      stock: 20,
    },
  ];

  const products = [];
  for (const seed of seededProducts) {
    products.push(await seedProduct(seed, location.id));
  }

  await prisma.paymentInstruction.upsert({
    where: { method: PaymentMethod.BANK_TRANSFER },
    update: {},
    create: {
      method: PaymentMethod.BANK_TRANSFER,
      title: 'Transferencia bancaria',
      instructions: 'Realiza la transferencia y adjunta tu comprobante. La orden se confirma despues de la revision.',
      accountData: { configured: false },
    },
  });

  await prisma.paymentInstruction.upsert({
    where: { method: PaymentMethod.CASH },
    update: {},
    create: {
      method: PaymentMethod.CASH,
      title: 'Pago en efectivo',
      instructions: 'Paga al recoger tu pedido en Fraiche Tizimin.',
    },
  });

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setMonth(endsAt.getMonth() + 1);

  const promotion = await prisma.promotion.upsert({
    where: { slug: 'bienvenida-fraiche' },
    update: {
      requiresCode: true,
      placement: PromotionPlacement.WELCOME,
    },
    create: {
      slug: 'bienvenida-fraiche',
      code: 'FRAICHE10',
      name: 'Bienvenida Fraiche',
      description: '10% de descuento en productos seleccionados.',
      type: PromotionType.PERCENTAGE,
      value: 10,
      startsAt: now,
      endsAt,
      isActive: true,
      isFeatured: true,
      requiresCode: true,
      placement: PromotionPlacement.WELCOME,
    },
  });

  for (const product of products.slice(0, 2)) {
    await prisma.promotionProduct.upsert({
      where: {
        promotionId_productId: { promotionId: promotion.id, productId: product.id },
      },
      update: {},
      create: { promotionId: promotion.id, productId: product.id },
    });
  }
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
