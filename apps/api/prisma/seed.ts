import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CatalogAudience,
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
const INVENTORY_3_PRODUCT_COUNT = 1027;

type InventoryCatalogEntry = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  line: ProductLine;
  brandSlug: string;
  brandName: string;
  categorySlugs: string[];
  catalogLineSlugs: string[];
  sku: string;
  variantName: string;
  concentrationLabel?: string;
  concentrationPercent?: number;
  volumeMl?: number;
  catalogPriceCents?: number;
  stock: number;
  inspirationHouseSlug?: string;
  inspirationHouseName?: string;
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

type CatalogSectionSeed = {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
};

type CatalogLineSeed = {
  sectionSlug: string;
  slug: string;
  name: string;
  description: string;
  audience?: CatalogAudience;
  sortOrder: number;
  showInInspirations?: boolean;
  inspirationGroupSlug?: string;
  inspirationGroupName?: string;
  inspirationSortOrder?: number;
};

const catalogSectionSeeds: CatalogSectionSeed[] = [
  { slug: 'perfumes', name: 'Perfumes', description: 'Fragancias organizadas por línea, público y casa perfumera.', iconKey: 'spray-can', sortOrder: 10 },
  { slug: 'brumas', name: 'Brumas', description: 'Brumas corporales ligeras para usar durante el día.', iconKey: 'sparkles', sortOrder: 20 },
  { slug: 'cuidado-belleza', name: 'Cuidado Personal y Belleza', description: 'Higiene, belleza y cuidado diario para piel, rostro y cuerpo.', iconKey: 'heart-handshake', sortOrder: 30 },
  { slug: 'aromas-hogar', name: 'Aromas para el Hogar', description: 'Productos para perfumar y ambientar cada espacio.', iconKey: 'house', sortOrder: 40 },
  { slug: 'aromas-auto', name: 'Aromatizantes para Auto', description: 'Aromas diseñados para acompañarte en cada trayecto.', iconKey: 'car-front', sortOrder: 50 },
  { slug: 'neeche-passion', name: 'Neeche Passion', description: 'Presentaciones especiales de la línea Neeche Passion.', iconKey: 'gem', sortOrder: 60 },
  { slug: 'perfumes-bolsillo', name: 'Perfumes de Bolsillo', description: 'Formatos compactos para llevar tu aroma favorito contigo.', iconKey: 'briefcase-business', sortOrder: 70 },
  { slug: 'colecciones', name: 'Colecciones', description: 'Colecciones completas por casa perfumera y presentación.', iconKey: 'gift', sortOrder: 80 },
  { slug: 'infantil', name: 'Infantil', description: 'Productos y fragancias seleccionados para público infantil.', iconKey: 'baby', sortOrder: 90 },
  { slug: 'velas', name: 'Velas', description: 'Velas aromáticas para crear ambientes especiales.', iconKey: 'flame', sortOrder: 100 },
  { slug: 'extractos', name: 'Extractos', description: 'Extractos aromáticos concentrados.', iconKey: 'leaf', sortOrder: 110 },
];

const catalogLineSeeds: CatalogLineSeed[] = [
  { sectionSlug: 'perfumes', slug: 'fraiche-dama', name: 'Fraiche Dama', description: 'Inspiraciones Fraiche para dama.', audience: CatalogAudience.WOMEN, sortOrder: 10, showInInspirations: true, inspirationGroupSlug: 'fraiche-dama', inspirationGroupName: 'Fraiche Dama', inspirationSortOrder: 10 },
  { sectionSlug: 'perfumes', slug: 'fraiche-caballero', name: 'Fraiche Caballero', description: 'Inspiraciones Fraiche para caballero.', audience: CatalogAudience.MEN, sortOrder: 20, showInInspirations: true, inspirationGroupSlug: 'fraiche-caballero', inspirationGroupName: 'Fraiche Caballero', inspirationSortOrder: 20 },
  { sectionSlug: 'perfumes', slug: 'neeche-passion-dama', name: 'Neeche Passion Dama', description: 'Aromas Neeche Passion para dama.', audience: CatalogAudience.WOMEN, sortOrder: 30 },
  { sectionSlug: 'perfumes', slug: 'arabe-dama', name: 'Árabe Dama', description: 'Perfumes de inspiración árabe para dama.', audience: CatalogAudience.WOMEN, sortOrder: 40 },
  { sectionSlug: 'perfumes', slug: 'neeche-passion-caballero', name: 'Neeche Passion Caballero', description: 'Aromas Neeche Passion para caballero.', audience: CatalogAudience.MEN, sortOrder: 50 },
  { sectionSlug: 'perfumes', slug: 'arabe-caballero', name: 'Árabe Caballero', description: 'Perfumes de inspiración árabe para caballero.', audience: CatalogAudience.MEN, sortOrder: 60 },
  { sectionSlug: 'perfumes', slug: 'neeche-passion-unisex', name: 'Neeche Passion Unisex', description: 'Aromas Neeche Passion sin género.', audience: CatalogAudience.UNISEX, sortOrder: 70 },
  { sectionSlug: 'perfumes', slug: 'arabe-unisex', name: 'Árabe Unisex', description: 'Perfumes de inspiración árabe unisex.', audience: CatalogAudience.UNISEX, sortOrder: 80 },
  { sectionSlug: 'perfumes', slug: 'kiibok-clasico-dama', name: "Kii'bok Exclusivo Clásico Dama", description: "Línea Kii'bok Exclusivo Clásico para dama.", audience: CatalogAudience.WOMEN, sortOrder: 90, showInInspirations: true, inspirationGroupSlug: 'kiibok-exclusivo-clasico', inspirationGroupName: "Kii'bok Exclusivo Clásico", inspirationSortOrder: 30 },
  { sectionSlug: 'perfumes', slug: 'kiibok-clasico-caballero', name: "Kii'bok Exclusivo Clásico Caballero", description: "Línea Kii'bok Exclusivo Clásico para caballero.", audience: CatalogAudience.MEN, sortOrder: 100, showInInspirations: true, inspirationGroupSlug: 'kiibok-exclusivo-clasico', inspirationGroupName: "Kii'bok Exclusivo Clásico", inspirationSortOrder: 30 },
  { sectionSlug: 'perfumes', slug: 'kiibok-premium-dama', name: "Kii'bok Exclusivo Premium Dama", description: "Línea Kii'bok Exclusivo Premium para dama.", audience: CatalogAudience.WOMEN, sortOrder: 110, showInInspirations: true, inspirationGroupSlug: 'kiibok-exclusivo-premium', inspirationGroupName: "Kii'bok Exclusivo Premium", inspirationSortOrder: 40 },
  { sectionSlug: 'perfumes', slug: 'kiibok-premium-caballero', name: "Kii'bok Exclusivo Premium Caballero", description: "Línea Kii'bok Exclusivo Premium para caballero.", audience: CatalogAudience.MEN, sortOrder: 120, showInInspirations: true, inspirationGroupSlug: 'kiibok-exclusivo-premium', inspirationGroupName: "Kii'bok Exclusivo Premium", inspirationSortOrder: 40 },
  { sectionSlug: 'perfumes', slug: 'kiibok-premium-unisex', name: "Kii'bok Exclusivo Premium Unisex", description: "Línea Kii'bok Exclusivo Premium unisex.", audience: CatalogAudience.UNISEX, sortOrder: 130, showInInspirations: true, inspirationGroupSlug: 'kiibok-exclusivo-premium', inspirationGroupName: "Kii'bok Exclusivo Premium", inspirationSortOrder: 40 },
  { sectionSlug: 'brumas', slug: 'brumas-fraiche', name: 'Brumas Corporales Fraiche', description: 'Brumas corporales de la línea Fraiche.', sortOrder: 10 },
  { sectionSlug: 'brumas', slug: 'brumas-arabes', name: 'Brumas Corporales Árabes', description: 'Brumas corporales de inspiración árabe.', sortOrder: 20 },
  { sectionSlug: 'brumas', slug: 'brumas-victorias-secret', name: "Brumas Victoria's Secret", description: "Brumas corporales Victoria's Secret.", sortOrder: 30 },
  { sectionSlug: 'cuidado-belleza', slug: 'cremas-humectantes', name: 'Cremas Humectantes', description: 'Hidratación y suavidad para la piel.', sortOrder: 10 },
  { sectionSlug: 'cuidado-belleza', slug: 'cremas-perfumables', name: 'Cremas Humectantes Perfumables', description: 'Cremas que pueden personalizarse con aroma.', sortOrder: 20 },
  { sectionSlug: 'cuidado-belleza', slug: 'hair-mist', name: 'Hair Mist', description: 'Brumas ligeras para perfumar el cabello.', sortOrder: 30 },
  { sectionSlug: 'cuidado-belleza', slug: 'serums', name: 'Sérums', description: 'Tratamientos faciales concentrados.', sortOrder: 40 },
  { sectionSlug: 'cuidado-belleza', slug: 'cosmeticos', name: 'Cosméticos', description: 'Productos de maquillaje y belleza.', sortOrder: 50 },
  { sectionSlug: 'cuidado-belleza', slug: 'jabones', name: 'Jabones', description: 'Jabones para el cuidado diario.', sortOrder: 60 },
  { sectionSlug: 'cuidado-belleza', slug: 'desodorantes-aerosol-fraiche', name: 'Desodorantes en Aerosol Fraiche', description: 'Desodorantes Fraiche en aerosol.', sortOrder: 70 },
  { sectionSlug: 'cuidado-belleza', slug: 'antitranspirantes', name: 'Antitranspirantes', description: 'Protección antitranspirante para el día a día.', sortOrder: 80 },
  { sectionSlug: 'cuidado-belleza', slug: 'desodorantes-roll-on', name: 'Desodorantes Roll-On', description: 'Desodorantes en presentación roll-on.', sortOrder: 90 },
  { sectionSlug: 'aromas-hogar', slug: 'aromatizantes-ambientales', name: 'Aromatizantes Ambientales', description: 'Aromas para distintos espacios del hogar.', sortOrder: 10 },
  { sectionSlug: 'aromas-hogar', slug: 'atomizadores-ambientales', name: 'Atomizadores Ambientales', description: 'Atomizadores para perfumar ambientes.', sortOrder: 20 },
  { sectionSlug: 'aromas-hogar', slug: 'difusores-ambientales', name: 'Difusores Ambientales', description: 'Difusores de aroma para el hogar.', sortOrder: 30 },
  { sectionSlug: 'aromas-auto', slug: 'aromatizantes-auto', name: 'Aromatizantes para Auto', description: 'Aromas para el interior del automóvil.', sortOrder: 10 },
  { sectionSlug: 'neeche-passion', slug: 'spray-neeche-passion', name: 'Spray Neeche Passion', description: 'Sprays aromáticos de la línea Neeche Passion.', sortOrder: 10 },
  { sectionSlug: 'perfumes-bolsillo', slug: 'perfumes-bolsillo', name: 'Perfumes de Bolsillo', description: 'Presentaciones compactas fáciles de llevar.', sortOrder: 10 },
  { sectionSlug: 'colecciones', slug: 'coleccion-10ml', name: 'Colección 10 ml', description: 'Colecciones por casa perfumera en 10 ml.', sortOrder: 10 },
  { sectionSlug: 'colecciones', slug: 'coleccion-30ml', name: 'Colección 30 ml', description: 'Colecciones por casa perfumera en 30 ml.', sortOrder: 20 },
  { sectionSlug: 'colecciones', slug: 'coleccion-60ml', name: 'Colección 60 ml', description: 'Colecciones por casa perfumera en 60 ml.', sortOrder: 30 },
  { sectionSlug: 'colecciones', slug: 'coleccion-100ml', name: 'Colección 100 ml', description: 'Colecciones por casa perfumera en 100 ml.', sortOrder: 40 },
  { sectionSlug: 'cuidado-belleza', slug: 'cuidado-facial', name: 'Cuidado Facial', description: 'Productos para la limpieza, hidratación y cuidado del rostro.', sortOrder: 100 },
  { sectionSlug: 'infantil', slug: 'infantil', name: 'Infantil', description: 'Selección infantil.', audience: CatalogAudience.KIDS, sortOrder: 10 },
  { sectionSlug: 'velas', slug: 'velas', name: 'Velas', description: 'Velas aromáticas.', sortOrder: 10 },
  { sectionSlug: 'extractos', slug: 'extractos', name: 'Extractos', description: 'Extractos aromáticos.', sortOrder: 10 },
];

const perfumeHouseSeeds = [
  'Chanel',
  'Dior',
  'Carolina Herrera',
  'Yves Saint Laurent',
  'Prada',
  'Gucci',
  'Dolce & Gabbana',
  'Versace',
  'Giorgio Armani',
  'Valentino',
  'Burberry',
  'Kayali',
  'Maison Francis Kurkdjian',
];

const initialHouseLines: Record<string, string[]> = Object.fromEntries(
  perfumeHouseSeeds.map((name) => [name, ['fraiche-dama']]),
);

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
  const path = resolve(__dirname, 'data/inventory-3.0.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== INVENTORY_3_PRODUCT_COUNT) {
    throw new Error(
      `El catálogo normalizado INVENTARIO 3.0 debe contener exactamente ${INVENTORY_3_PRODUCT_COUNT} productos.`,
    );
  }
  const catalog = parsed as InventoryCatalogEntry[];
  const productLines = new Set<string>(Object.values(ProductLine));
  const skus = new Set<string>();
  const slugs = new Set<string>();

  for (const [index, entry] of catalog.entries()) {
    const row = index + 1;
    for (const [field, value] of [
      ['slug', entry.slug],
      ['name', entry.name],
      ['shortDescription', entry.shortDescription],
      ['description', entry.description],
      ['brandSlug', entry.brandSlug],
      ['brandName', entry.brandName],
      ['sku', entry.sku],
      ['variantName', entry.variantName],
    ] as const) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`INVENTARIO 3.0: ${field} es obligatorio en el registro ${row}.`);
      }
    }
    if (!productLines.has(entry.line)) {
      throw new Error(`INVENTARIO 3.0: ProductLine inválido para SKU ${entry.sku}.`);
    }
    if (!Array.isArray(entry.categorySlugs) || entry.categorySlugs.length === 0) {
      throw new Error(`INVENTARIO 3.0: falta categoría para SKU ${entry.sku}.`);
    }
    if (!Array.isArray(entry.catalogLineSlugs) || entry.catalogLineSlugs.length === 0) {
      throw new Error(`INVENTARIO 3.0: falta línea de catálogo para SKU ${entry.sku}.`);
    }
    if (
      Boolean(entry.inspirationHouseSlug)
      !== Boolean(entry.inspirationHouseName)
    ) {
      throw new Error(
        `INVENTARIO 3.0: la casa perfumera está incompleta para SKU ${entry.sku}.`,
      );
    }
    if (!Number.isInteger(entry.stock) || entry.stock < 0) {
      throw new Error(`INVENTARIO 3.0: existencia inválida para SKU ${entry.sku}.`);
    }
    if (
      entry.concentrationPercent !== undefined
      && (entry.concentrationPercent < 0 || entry.concentrationPercent > 1)
    ) {
      throw new Error(`INVENTARIO 3.0: concentración inválida para SKU ${entry.sku}.`);
    }
    if (entry.sku !== entry.sku.trim() || /\s/.test(entry.sku)) {
      throw new Error(`INVENTARIO 3.0: el SKU ${entry.sku} contiene espacios.`);
    }
    if (skus.has(entry.sku)) {
      throw new Error(`INVENTARIO 3.0: SKU duplicado ${entry.sku}.`);
    }
    if (slugs.has(entry.slug)) {
      throw new Error(`INVENTARIO 3.0: slug duplicado ${entry.slug}.`);
    }
    skus.add(entry.sku);
    slugs.add(entry.slug);
  }

  return catalog;
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

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedCatalogNavigation(catalog: InventoryCatalogEntry[]) {
  const sectionIds = new Map<string, string>();
  const lineIds = new Map<string, string>();

  for (const seed of catalogSectionSeeds) {
    const section = await prisma.catalogSection.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        iconKey: seed.iconKey,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: { ...seed, isActive: true },
    });
    sectionIds.set(section.slug, section.id);
  }

  for (const seed of catalogLineSeeds) {
    const sectionId = sectionIds.get(seed.sectionSlug);
    if (!sectionId) throw new Error(`No existe la sección ${seed.sectionSlug}.`);
    const {
      sectionSlug: _sectionSlug,
      audience = CatalogAudience.GENERAL,
      showInInspirations = false,
      inspirationGroupSlug = null,
      inspirationGroupName = null,
      inspirationSortOrder = null,
      ...line
    } = seed;
    const catalogLine = await prisma.catalogLine.upsert({
      where: { slug: seed.slug },
      update: {
        ...line,
        sectionId,
        audience,
        showInInspirations,
        inspirationGroupSlug,
        inspirationGroupName,
        inspirationSortOrder,
        isActive: true,
      },
      create: {
        ...line,
        sectionId,
        audience,
        showInInspirations,
        inspirationGroupSlug,
        inspirationGroupName,
        inspirationSortOrder,
        isActive: true,
      },
    });
    lineIds.set(catalogLine.slug, catalogLine.id);
  }

  const houseNames = new Map(
    perfumeHouseSeeds.map((name) => [toSlug(name), name]),
  );
  for (const entry of catalog) {
    if (entry.inspirationHouseSlug && entry.inspirationHouseName) {
      houseNames.set(entry.inspirationHouseSlug, entry.inspirationHouseName);
    }
  }

  const perfumeHouseIds = new Map<string, string>();
  const orderedHouses = [...houseNames.entries()].sort((left, right) =>
    left[1].localeCompare(right[1], 'es-MX'),
  );
  for (const [sortOrder, [slug, name]] of orderedHouses.entries()) {
    const perfumeHouse = await prisma.perfumeHouse.upsert({
      where: { slug },
      update: { name, sortOrder, isActive: true },
      create: { slug, name, sortOrder, isActive: true },
    });
    perfumeHouseIds.set(perfumeHouse.slug, perfumeHouse.id);

    for (const [houseLineOrder, lineSlug] of (initialHouseLines[name] ?? []).entries()) {
      const catalogLineId = lineIds.get(lineSlug);
      if (!catalogLineId) throw new Error(`No existe la línea ${lineSlug}.`);
      await prisma.catalogLineHouse.upsert({
        where: {
          catalogLineId_perfumeHouseId: {
            catalogLineId,
            perfumeHouseId: perfumeHouse.id,
          },
        },
        update: { sortOrder: houseLineOrder + sortOrder },
        create: {
          catalogLineId,
          perfumeHouseId: perfumeHouse.id,
          sortOrder: houseLineOrder + sortOrder,
        },
      });
    }
  }

  const catalogLineHouses = new Map<
    string,
    { catalogLineId: string; perfumeHouseId: string; sortOrder: number }
  >();
  for (const entry of catalog) {
    if (!entry.inspirationHouseSlug) continue;
    const perfumeHouseId = perfumeHouseIds.get(entry.inspirationHouseSlug);
    if (!perfumeHouseId) {
      throw new Error(`No existe la casa perfumera ${entry.inspirationHouseSlug}.`);
    }
    for (const lineSlug of entry.catalogLineSlugs) {
      const catalogLineId = lineIds.get(lineSlug);
      if (!catalogLineId) throw new Error(`No existe la línea ${lineSlug}.`);
      const key = `${catalogLineId}:${perfumeHouseId}`;
      if (!catalogLineHouses.has(key)) {
        catalogLineHouses.set(key, {
          catalogLineId,
          perfumeHouseId,
          sortOrder: catalogLineHouses.size,
        });
      }
    }
  }
  if (catalogLineHouses.size > 0) {
    await prisma.catalogLineHouse.createMany({
      data: [...catalogLineHouses.values()],
      skipDuplicates: true,
    });
  }

  return { catalogLineIds: lineIds, perfumeHouseIds };
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
  catalogLineIds: Map<string, string>,
  perfumeHouseIds: Map<string, string>,
) {
  const brandId = brandIds.get(entry.brandSlug);
  if (!brandId) throw new Error(`No existe la marca ${entry.brandSlug}.`);
  const inspirationHouseId = entry.inspirationHouseSlug
    ? perfumeHouseIds.get(entry.inspirationHouseSlug)
    : undefined;
  if (entry.inspirationHouseSlug && !inspirationHouseId) {
    throw new Error(`No existe la casa perfumera ${entry.inspirationHouseSlug}.`);
  }
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
      inspirationHouseId: inspirationHouseId ?? null,
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
      inspirationHouseId,
      status: ProductStatus.ACTIVE,
      attributes: entry.attributes as Prisma.InputJsonValue,
    },
  });

  const productCategories = entry.categorySlugs.map((slug) => {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) throw new Error(`No existe la categoría ${slug}.`);
    return { productId: product.id, categoryId };
  });
  const productCatalogLines = entry.catalogLineSlugs.map((slug) => {
    const catalogLineId = catalogLineIds.get(slug);
    if (!catalogLineId) throw new Error(`No existe la línea de catálogo ${slug}.`);
    return { productId: product.id, catalogLineId };
  });
  await prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId: product.id } }),
    prisma.productCategory.createMany({ data: productCategories }),
    prisma.productCatalogLine.deleteMany({ where: { productId: product.id } }),
    prisma.productCatalogLine.createMany({ data: productCatalogLines }),
  ]);

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
                reason: 'Importación inicial de INVENTARIO 3 CORREGIDO.xlsx',
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

  const seedInventory = ['1', 'true', 'yes'].includes(
    (
      process.env.SEED_INVENTORY
      ?? process.env.SEED_LEGACY_INVENTORY
      ?? ''
    ).trim().toLowerCase(),
  );
  const catalog = seedInventory ? loadInventoryCatalog() : [];
  const { catalogLineIds, perfumeHouseIds } =
    await seedCatalogNavigation(catalog);

  const brandIds = new Map<string, string>();
  const brandNames = new Map<string, string>([
    ['fraiche', 'Fraiche'],
    ['neeche', 'Neeche Passion'],
    ['premium', 'Premium'],
    ['victorias-secret', "Victoria's Secret"],
    ['arabic-care', 'Cuidado árabe'],
  ]);
  for (const entry of catalog) {
    if (!brandNames.has(entry.brandSlug)) {
      brandNames.set(entry.brandSlug, entry.brandName);
    }
  }
  for (const [slug, name] of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });
    brandIds.set(brand.slug, brand.id);
  }

  const categoryIds = await seedCategories();

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

  if (seedInventory) {
    const batchSize = 16;
    for (let index = 0; index < catalog.length; index += batchSize) {
      await Promise.all(
        catalog
          .slice(index, index + batchSize)
          .map((entry) =>
            seedCatalogProduct(
              entry,
              location.id,
              brandIds,
              categoryIds,
              catalogLineIds,
              perfumeHouseIds,
            ),
          ),
      );
    }
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
