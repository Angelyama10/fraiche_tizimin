import type {
  CatalogAudience,
  CatalogLine,
  CatalogNavigation,
  CatalogSection,
  InspirationsResponse,
} from '@/lib/types';

type LineSeed = {
  slug: string;
  name: string;
  description: string;
  audience?: CatalogAudience;
  showInInspirations?: boolean;
  inspirationGroupSlug?: string;
  inspirationGroupName?: string;
  inspirationSortOrder?: number;
};

type SectionSeed = {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  lines: LineSeed[];
};

const sectionSeeds: SectionSeed[] = [
  {
    slug: 'perfumes',
    name: 'Perfumes',
    description: 'Fragancias organizadas por línea, público y casa perfumera.',
    iconKey: 'spray-can',
    lines: [
      inspirationLine('fraiche-dama', 'Fraiche Dama', 'Inspiraciones Fraiche para dama.', 'WOMEN', 'fraiche-dama', 'Fraiche Dama', 10),
      inspirationLine('fraiche-caballero', 'Fraiche Caballero', 'Inspiraciones Fraiche para caballero.', 'MEN', 'fraiche-caballero', 'Fraiche Caballero', 20),
      line('neeche-passion-dama', 'Neeche Passion Dama', 'Aromas Neeche Passion para dama.', 'WOMEN'),
      line('arabe-dama', 'Árabe Dama', 'Perfumes de inspiración árabe para dama.', 'WOMEN'),
      line('neeche-passion-caballero', 'Neeche Passion Caballero', 'Aromas Neeche Passion para caballero.', 'MEN'),
      line('arabe-caballero', 'Árabe Caballero', 'Perfumes de inspiración árabe para caballero.', 'MEN'),
      line('neeche-passion-unisex', 'Neeche Passion Unisex', 'Aromas Neeche Passion sin género.', 'UNISEX'),
      line('arabe-unisex', 'Árabe Unisex', 'Perfumes de inspiración árabe unisex.', 'UNISEX'),
      inspirationLine('kiibok-clasico-dama', "Kii'bok Exclusivo Clásico Dama", "Línea Kii'bok Exclusivo Clásico para dama.", 'WOMEN', 'kiibok-exclusivo-clasico', "Kii'bok Exclusivo Clásico", 30),
      inspirationLine('kiibok-clasico-caballero', "Kii'bok Exclusivo Clásico Caballero", "Línea Kii'bok Exclusivo Clásico para caballero.", 'MEN', 'kiibok-exclusivo-clasico', "Kii'bok Exclusivo Clásico", 30),
      inspirationLine('kiibok-premium-dama', "Kii'bok Exclusivo Premium Dama", "Línea Kii'bok Exclusivo Premium para dama.", 'WOMEN', 'kiibok-exclusivo-premium', "Kii'bok Exclusivo Premium", 40),
      inspirationLine('kiibok-premium-caballero', "Kii'bok Exclusivo Premium Caballero", "Línea Kii'bok Exclusivo Premium para caballero.", 'MEN', 'kiibok-exclusivo-premium', "Kii'bok Exclusivo Premium", 40),
      inspirationLine('kiibok-premium-unisex', "Kii'bok Exclusivo Premium Unisex", "Línea Kii'bok Exclusivo Premium unisex.", 'UNISEX', 'kiibok-exclusivo-premium', "Kii'bok Exclusivo Premium", 40),
    ],
  },
  {
    slug: 'brumas',
    name: 'Brumas',
    description: 'Brumas corporales ligeras para usar durante el día.',
    iconKey: 'sparkles',
    lines: [
      line('brumas-fraiche', 'Brumas Corporales Fraiche', 'Brumas corporales de la línea Fraiche.'),
      line('brumas-arabes', 'Brumas Corporales Árabes', 'Brumas corporales de inspiración árabe.'),
      line('brumas-victorias-secret', "Brumas Victoria's Secret", "Brumas corporales Victoria's Secret."),
    ],
  },
  {
    slug: 'cuidado-belleza',
    name: 'Cuidado Personal y Belleza',
    description: 'Higiene, belleza y cuidado diario para piel, rostro y cuerpo.',
    iconKey: 'heart-handshake',
    lines: [
      line('cremas-humectantes', 'Cremas Humectantes', 'Hidratación y suavidad para la piel.'),
      line('cremas-perfumables', 'Cremas Humectantes Perfumables', 'Cremas que pueden personalizarse con aroma.'),
      line('hair-mist', 'Hair Mist', 'Brumas ligeras para perfumar el cabello.'),
      line('serums', 'Sérums', 'Tratamientos faciales concentrados.'),
      line('cosmeticos', 'Cosméticos', 'Productos de maquillaje y belleza.'),
      line('jabones', 'Jabones', 'Jabones para el cuidado diario.'),
      line('desodorantes-aerosol-fraiche', 'Desodorantes en Aerosol Fraiche', 'Desodorantes Fraiche en aerosol.'),
      line('antitranspirantes', 'Antitranspirantes', 'Protección antitranspirante para el día a día.'),
      line('desodorantes-roll-on', 'Desodorantes Roll-On', 'Desodorantes en presentación roll-on.'),
    ],
  },
  {
    slug: 'aromas-hogar',
    name: 'Aromas para el Hogar',
    description: 'Productos para perfumar y ambientar cada espacio.',
    iconKey: 'house',
    lines: [
      line('aromatizantes-ambientales', 'Aromatizantes Ambientales', 'Aromas para distintos espacios del hogar.'),
      line('atomizadores-ambientales', 'Atomizadores Ambientales', 'Atomizadores para perfumar ambientes.'),
      line('difusores-ambientales', 'Difusores Ambientales', 'Difusores de aroma para el hogar.'),
    ],
  },
  singleLineSection('aromas-auto', 'Aromatizantes para Auto', 'Aromas diseñados para acompañarte en cada trayecto.', 'car-front', 'aromatizantes-auto'),
  singleLineSection('neeche-passion', 'Neeche Passion', 'Presentaciones especiales de la línea Neeche Passion.', 'gem', 'spray-neeche-passion', 'Spray Neeche Passion'),
  singleLineSection('perfumes-bolsillo', 'Perfumes de Bolsillo', 'Formatos compactos para llevar tu aroma favorito contigo.', 'briefcase-business', 'perfumes-bolsillo'),
  {
    slug: 'colecciones',
    name: 'Colecciones',
    description: 'Colecciones completas por casa perfumera y presentación.',
    iconKey: 'gift',
    lines: [
      line('coleccion-10ml', 'Colección 10 ml', 'Colecciones por casa perfumera en 10 ml.'),
      line('coleccion-30ml', 'Colección 30 ml', 'Colecciones por casa perfumera en 30 ml.'),
      line('coleccion-60ml', 'Colección 60 ml', 'Colecciones por casa perfumera en 60 ml.'),
    ],
  },
  singleLineSection('infantil', 'Infantil', 'Productos y fragancias seleccionados para público infantil.', 'baby', 'infantil', 'Infantil', 'KIDS'),
  singleLineSection('velas', 'Velas', 'Velas aromáticas para crear ambientes especiales.', 'flame', 'velas'),
  singleLineSection('extractos', 'Extractos', 'Extractos aromáticos concentrados.', 'leaf', 'extractos'),
];

export const FALLBACK_CATALOG_NAVIGATION: CatalogNavigation = {
  sections: sectionSeeds.map((section, sectionIndex) => ({
    id: `fallback-section-${section.slug}`,
    slug: section.slug,
    name: section.name,
    description: section.description,
    iconKey: section.iconKey,
    sortOrder: (sectionIndex + 1) * 10,
    lines: section.lines.map((item, lineIndex) => ({
      id: `fallback-line-${item.slug}`,
      slug: item.slug,
      name: item.name,
      description: item.description,
      audience: item.audience ?? 'GENERAL',
      sortOrder: (lineIndex + 1) * 10,
      showInInspirations: item.showInInspirations ?? false,
      inspirationGroupSlug: item.inspirationGroupSlug ?? null,
      inspirationGroupName: item.inspirationGroupName ?? null,
      inspirationSortOrder: item.inspirationSortOrder ?? null,
      productCount: 0,
      houses: [],
    })),
  })),
};

export function mergeCatalogNavigation(
  navigation: CatalogNavigation | null | undefined,
): CatalogNavigation {
  if (!navigation?.sections?.length) return FALLBACK_CATALOG_NAVIGATION;
  const received = new Map(navigation.sections.map((section) => [section.slug, section]));
  const sections = FALLBACK_CATALOG_NAVIGATION.sections.map((fallbackSection) => {
    const section = received.get(fallbackSection.slug);
    if (!section) return fallbackSection;
    const receivedLines = new Map(section.lines.map((item) => [item.slug, item]));
    return {
      ...fallbackSection,
      ...section,
      lines: fallbackSection.lines.map(
        (fallbackLine) => receivedLines.get(fallbackLine.slug) ?? fallbackLine,
      ),
    };
  });
  for (const section of navigation.sections) {
    if (!sections.some((item) => item.slug === section.slug)) sections.push(section);
  }
  return { sections };
}

export function inspirationsFromNavigation(
  navigation: CatalogNavigation,
): InspirationsResponse {
  const groups = new Map<string, InspirationsResponse['groups'][number]>();
  for (const section of navigation.sections) {
    for (const item of section.lines) {
      if (
        !item.showInInspirations ||
        !item.inspirationGroupSlug ||
        !item.inspirationGroupName
      ) {
        continue;
      }
      const group = groups.get(item.inspirationGroupSlug) ?? {
        slug: item.inspirationGroupSlug,
        name: item.inspirationGroupName,
        sortOrder: item.inspirationSortOrder ?? item.sortOrder,
        lines: [],
      };
      group.lines.push(item);
      groups.set(group.slug, group);
    }
  }
  return {
    groups: [...groups.values()].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'),
    ),
  };
}

export function catalogLineHref(item: CatalogLine, houseSlug?: string) {
  const params = new URLSearchParams({ catalogLine: item.slug });
  if (houseSlug) params.set('house', houseSlug);
  return `/productos?${params.toString()}`;
}

export function findCatalogSection(
  navigation: CatalogNavigation,
  slug: string,
): CatalogSection | undefined {
  return navigation.sections.find((section) => section.slug === slug);
}

function line(
  slug: string,
  name: string,
  description: string,
  audience: CatalogAudience = 'GENERAL',
): LineSeed {
  return { slug, name, description, audience };
}

function inspirationLine(
  slug: string,
  name: string,
  description: string,
  audience: CatalogAudience,
  groupSlug: string,
  groupName: string,
  groupSortOrder: number,
): LineSeed {
  return {
    ...line(slug, name, description, audience),
    showInInspirations: true,
    inspirationGroupSlug: groupSlug,
    inspirationGroupName: groupName,
    inspirationSortOrder: groupSortOrder,
  };
}

function singleLineSection(
  slug: string,
  name: string,
  description: string,
  iconKey: string,
  lineSlug: string,
  lineName = name,
  audience: CatalogAudience = 'GENERAL',
): SectionSeed {
  return {
    slug,
    name,
    description,
    iconKey,
    lines: [line(lineSlug, lineName, description, audience)],
  };
}
