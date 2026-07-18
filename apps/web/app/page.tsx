import { ArrowDown, ArrowRight, MapPin, MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { HeroSpotlight } from '@/components/home/hero-spotlight';
import { ProductCarousel } from '@/components/home/product-carousel';
import { ProductCard } from '@/components/store/product-card';
import { Reveal } from '@/components/ui/reveal';
import { SectionHeading } from '@/components/ui/section-heading';
import { apiRequest } from '@/lib/api';
import { LINE_LABELS, lineFallbackImage } from '@/lib/catalog';
import type { Category, Product, ProductLine, ProductListResponse, Promotion, ScentFamily } from '@/lib/types';
import './page.css';

export const revalidate = 60;

async function homeData() {
  const [products, categories, scents, promotions] = await Promise.all([
    apiRequest<ProductListResponse>('/products?take=20', { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<Category[]>('/categories', { next: { revalidate: 300 } }).catch(() => []),
    apiRequest<ScentFamily[]>('/scent-families', { next: { revalidate: 300 } }).catch(() => []),
    apiRequest<Promotion[]>('/promotions', { next: { revalidate: 60 } }).catch(() => []),
  ]);
  return { products: products.items, categories, scents, promotions };
}

const lineTiles: Array<{ line: ProductLine; kicker: string; description: string }> = [
  { line: 'DESIGNER_CLASSIC', kicker: 'Ligera y versátil', description: 'Inspiraciones de diseñador para acompañarte todos los días.' },
  { line: 'DESIGNER_37', kicker: 'Más intensidad', description: '37% de esencia para una estela profunda y duradera.' },
  { line: 'NEECHE_PASSION', kicker: '$350 MXN', description: 'Aromas expresivos en presentación de 60 ml.' },
  { line: 'PREMIUM', kicker: '$380 MXN', description: 'Inspiraciones nicho y árabes con 37% de esencia.' },
];

export default async function HomePage() {
  const { products, scents, promotions } = await homeData();
  const newProducts = products.filter((product) => product.isNew);
  const featured = products.filter((product) => product.isFeatured);
  const spotlight = newProducts.length ? newProducts : products.slice(0, 4);
  const favorites = featured.length ? featured : products.slice(0, 4);
  const activePromotion = promotions.find((promotion) => promotion.placement === 'MONTHLY') ?? promotions[0];

  return (
    <main>
      <section className="homeHero">
        <Image
          alt="Colección de perfumes en vidrio coral, esmeralda y ámbar"
          className="homeHero__image"
          fill
          preload
          sizes="100vw"
          src="/images/brand/hero-perfumes.png"
        />
        <div className="homeHero__veil" />
        <div className="homeHero__content pageWidth">
          <div className="homeHero__copy">
            <span className="eyebrow eyebrow--hero">Perfumería contemporánea · Tizimín</span>
            <h1>Fraîche<br />Tizimín</h1>
            <p className="homeHero__tagline">Perfumes que dejan huella.</p>
            <p className="homeHero__description">Encuentra una esencia que se sienta tan tuya como tu historia.</p>
            <div className="homeHero__actions">
              <Link className="button button--coral button--large" href="/productos">
                Descubrir perfumes <ArrowRight aria-hidden="true" size={19} />
              </Link>
              <Link className="button button--glass button--large" href="/pedidos-especiales">
                Pedir un aroma
              </Link>
            </div>
            <div className="homeHero__trust">
              <span><ShieldCheck aria-hidden="true" size={17} /> Pago protegido</span>
              <span><Truck aria-hidden="true" size={17} /> Envíos a México</span>
            </div>
          </div>
          <HeroSpotlight products={spotlight} />
        </div>
        <a className="homeHero__scroll" href="#novedades" aria-label="Ir a novedades"><ArrowDown aria-hidden="true" size={18} /></a>
      </section>

      <section className="newArrivals section" id="novedades">
        <div className="pageWidth">
          <SectionHeading
            eyebrow="Recién llegados"
            title="Nuevas formas de dejar huella"
            description="Fragancias luminosas, intensas y difíciles de olvidar."
            href="/productos"
            linkLabel="Explorar catálogo"
          />
          {spotlight.length ? <ProductCarousel products={spotlight} /> : <CatalogEmpty />}
        </div>
      </section>

      <section className="lineCollection section">
        <div className="pageWidth">
          <SectionHeading eyebrow="Encuentra tu línea" title="Una esencia para cada versión de ti" />
          <div className="lineCollection__grid">
            {lineTiles.map((tile, index) => (
              <Reveal className={`lineTile lineTile--${index + 1}`} delay={index * 0.06} key={tile.line}>
                <Link href={`/productos?line=${tile.line}`}>
                  <Image alt={LINE_LABELS[tile.line]} fill sizes="(max-width: 700px) 86vw, 25vw" src={lineFallbackImage(tile.line)} />
                  <div className="lineTile__veil" />
                  <span>{tile.kicker}</span>
                  <div>
                    <h3>{LINE_LABELS[tile.line]}</h3>
                    <p>{tile.description}</p>
                  </div>
                  <b aria-hidden="true"><ArrowRight size={18} /></b>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bestSellers section">
        <div className="pageWidth">
          <SectionHeading
            eyebrow="Los más elegidos"
            title="Aromas que siempre reciben cumplidos"
            description="Una selección de favoritos para acertar contigo o con alguien especial."
            href="/productos?featured=true"
          />
          {favorites.length ? (
            <div className="productGrid productGrid--home">
              {favorites.slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} priority={index < 2} />)}
            </div>
          ) : <CatalogEmpty />}
        </div>
      </section>

      <section className="scentFinder section">
        <div className="pageWidth scentFinder__inner">
          <div>
            <span className="eyebrow eyebrow--light">Elige por sensación</span>
            <h2>¿Cómo quieres sentirte hoy?</h2>
            <p>Empieza por una familia aromática y deja que tu intuición haga el resto.</p>
          </div>
          <div className="scentFinder__links">
            {(scents.length ? scents : fallbackScents).slice(0, 8).map((scent, index) => (
              <Link href={`/productos?scent=${scent.slug}`} key={scent.slug}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {scent.name}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="offerBand section">
        <div className="pageWidth offerBand__inner">
          <Reveal className="offerBand__copy">
            <span className="eyebrow">Oferta del mes</span>
            <h2>{activePromotion?.name ?? 'Tu primera esencia merece celebrarse'}</h2>
            <p>{activePromotion?.description ?? 'Recibe 10% de descuento en productos seleccionados al usar tu código de bienvenida.'}</p>
            {(activePromotion?.code ?? 'FRAICHE10') && (
              <div className="promoCode"><span>Código</span><strong>{activePromotion?.code ?? 'FRAICHE10'}</strong></div>
            )}
            <Link className="button button--dark button--large" href="/promociones">Ver promoción <ArrowRight aria-hidden="true" size={18} /></Link>
          </Reveal>
          <Reveal className="offerBand__visual" delay={0.1}>
            <Image alt="Perfume Premium Oud Royal" fill sizes="(max-width: 800px) 100vw, 50vw" src="/images/products/premium-oud.png" />
            <span><Sparkles aria-hidden="true" size={18} /> Selección Premium</span>
          </Reveal>
        </div>
      </section>

      <section className="aboutSection section" id="nosotros">
        <div className="pageWidth aboutSection__intro">
          <Reveal>
            <span className="eyebrow">Nuestra historia</span>
            <h2>Una perfumería nacida para atenderte de cerca.</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p>En Fraîche Tizimín cada aroma se recomienda escuchando primero a la persona. Seleccionamos perfumes y productos de cuidado que combinan calidad, duración y una experiencia cálida desde el primer mensaje.</p>
            <p>Estamos construyendo una forma más fácil, transparente y bonita de encontrar tu fragancia favorita.</p>
          </Reveal>
        </div>
        <div className="pageWidth locationBand">
          <div className="locationBand__map">
            <iframe
              loading="lazy"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-88.1800%2C21.1200%2C-88.1200%2C21.1650&layer=mapnik&marker=21.1424%2C-88.1507"
              title="Ubicación de Fraîche Tizimín"
            />
          </div>
          <div className="locationBand__content">
            <MapPin aria-hidden="true" size={26} />
            <span className="eyebrow">Visítanos</span>
            <h3>Tizimín, Yucatán</h3>
            <p>La ubicación exacta de la tienda se agregará al confirmar la dirección comercial.</p>
            <a className="button button--outline" href="https://www.openstreetmap.org/?mlat=21.1424&mlon=-88.1507#map=15/21.1424/-88.1507" rel="noreferrer" target="_blank">Abrir mapa <ArrowRight aria-hidden="true" size={17} /></a>
          </div>
        </div>
      </section>

      <section className="specialOrderBand">
        <div className="pageWidth specialOrderBand__inner">
          <div><MessageCircle aria-hidden="true" size={24} /><span className="eyebrow eyebrow--light">¿No está tu aroma?</span></div>
          <h2>Cuéntanos cuál buscas.<br />Nosotros seguimos la pista.</h2>
          <Link className="button button--cream button--large" href="/pedidos-especiales">Solicitar aroma <ArrowRight aria-hidden="true" size={18} /></Link>
        </div>
      </section>
    </main>
  );
}

const fallbackScents: ScentFamily[] = [
  { id: '1', slug: 'floral', name: 'Floral' },
  { id: '2', slug: 'citrico', name: 'Cítrico' },
  { id: '3', slug: 'amaderado', name: 'Amaderado' },
  { id: '4', slug: 'fresco', name: 'Fresco' },
  { id: '5', slug: 'dulce', name: 'Dulce' },
  { id: '6', slug: 'oriental', name: 'Oriental' },
  { id: '7', slug: 'nicho', name: 'Nicho' },
  { id: '8', slug: 'arabe', name: 'Árabe' },
];

function CatalogEmpty() {
  return (
    <div className="catalogEmpty">
      <Sparkles aria-hidden="true" size={24} />
      <h3>El catálogo está por florecer</h3>
      <p>Cuando la API tenga productos activos, aparecerán aquí automáticamente.</p>
    </div>
  );
}
