import { ArrowRight, PackageOpen, Ruler } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import type { PerfumeHouse } from '@/lib/types';
import './colecciones.css';

export const metadata: Metadata = {
  title: 'Colecciones por casa perfumera',
  description:
    'Solicita colecciones completas de 10, 30 o 60 ml por casa perfumera.',
  alternates: { canonical: '/colecciones' },
};

export const revalidate = 300;

const sizes = [
  { label: '10 ml', slug: 'coleccion-10ml' },
  { label: '30 ml', slug: 'coleccion-30ml' },
  { label: '60 ml', slug: 'coleccion-60ml' },
];

export default async function CollectionsPage() {
  const houses = await apiRequest<PerfumeHouse[]>('/perfume-houses', {
    next: { revalidate: 300 },
  }).catch(() => []);

  return (
    <main className="collectionsPage">
      <section className="collectionsHero">
        <div className="pageWidth">
          <span className="eyebrow eyebrow--light">Colecciones completas</span>
          <h1>Una casa perfumera. Todos sus aromas.</h1>
          <p>
            Consulta colecciones en 10, 30 o 60 ml. La tienda revisará
            disponibilidad y te enviará una cotización personalizada.
          </p>
        </div>
      </section>

      <section className="collectionsDirectory pageWidth">
        <header>
          <div>
            <span className="eyebrow">Elige una casa</span>
            <h2>Cotiza la colección que quieres descubrir.</h2>
          </div>
          <div className="collectionSizes" aria-label="Presentaciones disponibles">
            {sizes.map((size) => (
              <span key={size.slug}>
                <Ruler aria-hidden="true" size={15} />
                {size.label}
              </span>
            ))}
          </div>
        </header>

        {houses.length > 0 ? (
          <div className="collectionHouses">
            {houses.map((house, index) => {
              const quoteParams = new URLSearchParams({
                tipo: 'coleccion',
                casa: house.name,
                aroma: `Colección completa de ${house.name}`,
              });
              return (
                <article key={house.slug}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{house.name}</h2>
                    <nav aria-label={`Presentaciones de ${house.name}`}>
                      {sizes.map((size) => (
                        <Link
                          href={`/productos?catalogLine=${size.slug}&house=${house.slug}`}
                          key={size.slug}
                        >
                          {size.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                  <Link
                    className="collectionHouses__quote"
                    href={`/pedidos-especiales?${quoteParams.toString()}`}
                  >
                    Cotizar completa <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="collectionsEmpty">
            <PackageOpen aria-hidden="true" size={25} />
            <div>
              <h2>Directorio preparado</h2>
              <p>
                Las casas perfumeras se mostrarán al cargar la nueva base de
                productos.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
