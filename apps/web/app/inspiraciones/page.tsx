import { ArrowRight, Building2, Layers3 } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  FALLBACK_CATALOG_NAVIGATION,
  inspirationsFromNavigation,
  mergeCatalogNavigation,
} from '@/lib/catalog-navigation';
import type {
  CatalogLine,
  CatalogNavigation,
  PerfumeHouse,
} from '@/lib/types';
import './inspiraciones.css';

export const metadata: Metadata = {
  title: 'Inspiraciones por casa perfumera',
  description:
    'Explora perfumes inspirados por línea y casa perfumera en KI’IBOK Exclusivo.',
  alternates: { canonical: '/inspiraciones' },
};

export const revalidate = 300;

export default async function InspirationsPage() {
  const navigation = await apiRequest<CatalogNavigation>('/catalog/navigation', {
    next: { revalidate: 300 },
  })
    .then(mergeCatalogNavigation)
    .catch(() => FALLBACK_CATALOG_NAVIGATION);
  const inspirations = inspirationsFromNavigation(navigation);

  return (
    <main className="inspirationsPage">
      <section className="inspirationsHero">
        <Image
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          src="/images/brand/hero-perfumes.png"
        />
        <div className="pageWidth">
          <span className="eyebrow eyebrow--light">Inspiraciones</span>
          <h1>Encuentra tu perfume por la casa que te inspira.</h1>
          <p>
            Elige una línea, descubre sus casas perfumeras y compara todos los
            aromas disponibles en un mismo lugar.
          </p>
          <Link className="button button--cream button--large" href="#lineas">
            Explorar casas <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>

      <section className="inspirationsDirectory pageWidth" id="lineas">
        <header>
          <div>
            <span className="eyebrow">Directorio de inspiraciones</span>
            <h2>Cuatro caminos para encontrar tu aroma.</h2>
          </div>
          <p>
            Cada casa aparece únicamente dentro de las líneas a las que fue
            asignada en el catálogo.
          </p>
        </header>

        <div className="inspirationGroups">
          {inspirations.groups.map((group, index) => {
            const houses = housesForLines(group.lines);
            return (
              <section className="inspirationGroup" id={group.slug} key={group.slug}>
                <div className="inspirationGroup__heading">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{group.name}</h2>
                    <p>
                      {group.lines.map((line) => line.name).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="inspirationGroup__lines">
                  {group.lines.map((line) => (
                    <Link
                      href={`/productos?catalogLine=${line.slug}`}
                      key={line.slug}
                    >
                      <Layers3 aria-hidden="true" size={15} />
                      {line.name}
                    </Link>
                  ))}
                </div>

                {houses.length > 0 ? (
                  <div className="perfumeHouseDirectory">
                    {houses.map(({ house, line }) => (
                      <Link
                        href={`/productos?catalogLine=${line.slug}&house=${house.slug}`}
                        key={house.slug}
                      >
                        <span>
                          <Building2 aria-hidden="true" size={17} />
                        </span>
                        <strong>{house.name}</strong>
                        <small>
                          {house.productCount
                            ? `${house.productCount} ${
                                house.productCount === 1 ? 'perfume' : 'perfumes'
                              }`
                            : line.name}
                        </small>
                        <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="inspirationGroup__empty">
                    <Building2 aria-hidden="true" size={22} />
                    <div>
                      <strong>Lista preparada para el inventario nuevo</strong>
                      <p>
                        Las casas perfumeras aparecerán aquí al asociarlas con sus
                        productos desde el panel administrativo.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function housesForLines(lines: CatalogLine[]) {
  const houses = new Map<
    string,
    { house: PerfumeHouse; line: CatalogLine }
  >();
  for (const line of lines) {
    for (const house of line.houses ?? []) {
      const current = houses.get(house.slug);
      if (
        !current ||
        (house.productCount ?? 0) > (current.house.productCount ?? 0)
      ) {
        houses.set(house.slug, { house, line });
      }
    }
  }
  return [...houses.values()].sort((left, right) =>
    left.house.name.localeCompare(right.house.name, 'es'),
  );
}
