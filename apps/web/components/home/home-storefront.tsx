import { ArrowDown, ArrowRight, MapPin, MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { LINE_LABELS, lineFallbackImage } from '@/lib/catalog';
import type { SiteContentDocument, StorefrontSection } from '@/lib/site-content';
import type { Product, ProductLine, Promotion, ScentFamily } from '@/lib/types';
import { ProductCard } from '@/components/store/product-card';
import { Reveal } from '@/components/ui/reveal';
import { SectionHeading } from '@/components/ui/section-heading';
import { HeroSpotlight } from './hero-spotlight';
import { ProductCarousel } from './product-carousel';

const lineTiles: Array<{ line: ProductLine; kicker: string; description: string }> = [
  { line: 'DESIGNER_CLASSIC', kicker: 'Ligera y versátil', description: 'Inspiraciones de diseñador para acompañarte todos los días.' },
  { line: 'DESIGNER_37', kicker: 'Más intensidad', description: '37% de esencia para una estela profunda y duradera.' },
  { line: 'NEECHE_PASSION', kicker: '$350 MXN', description: 'Aromas expresivos en presentación de 60 ml.' },
  { line: 'PREMIUM', kicker: '$380 MXN', description: 'Inspiraciones nicho y árabes con 37% de esencia.' },
];

export function HomeStorefront({
  content,
  products,
  promotions,
  scents,
}: {
  content: SiteContentDocument;
  products: Product[];
  promotions: Promotion[];
  scents: ScentFamily[];
}) {
  const newProducts = products.filter((product) => product.isNew);
  const featured = products.filter((product) => product.isFeatured);
  const spotlight = newProducts.length ? newProducts : products.slice(0, 4);
  const favorites = featured.length ? featured : products.slice(0, 4);
  const visibleSections = content.home.sections.filter((section) => section.enabled);
  const currentPromotions = promotions.filter((promotion) => new Date(promotion.startsAt).getTime() <= Date.now());
  const activePromotion = currentPromotions.find((promotion) => promotion.placement === 'MONTHLY') ?? currentPromotions[0];
  const firstSectionId = visibleSections[0]?.id ?? 'novedades';
  const { contact } = content.global;
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`Fraiche Tizmin, ${contact.address}`)}`;

  return (
    <main>
      <section className="homeHero">
        <Image
          alt={content.home.hero.imageAlt}
          className="homeHero__image"
          fetchPriority="high"
          fill
          loading="eager"
          sizes="100vw"
          src={content.home.hero.imageUrl}
          unoptimized={content.home.hero.imageUrl.startsWith('http')}
        />
        <div className="homeHero__veil" />
        <div className="homeHero__content pageWidth">
          <div className="homeHero__copy">
            <span className="eyebrow eyebrow--hero">{content.home.hero.eyebrow}</span>
            <h1>{content.home.hero.title}<span>{content.home.hero.titleAccent}</span></h1>
            <p className="homeHero__tagline">{content.home.hero.tagline}</p>
            <p className="homeHero__description">{content.home.hero.description}</p>
            <div className="homeHero__actions">
              <Link className="button button--coral button--large" href={content.home.hero.primaryLink.href}>{content.home.hero.primaryLink.label} <ArrowRight aria-hidden="true" size={19} /></Link>
              <Link className="button button--glass button--large" href={content.home.hero.secondaryLink.href}>{content.home.hero.secondaryLink.label}</Link>
            </div>
            <div className="homeHero__trust"><span><ShieldCheck aria-hidden="true" size={17} /> Pago protegido</span><span><Truck aria-hidden="true" size={17} /> Envíos a México</span></div>
          </div>
          <HeroSpotlight labels={content.home.commercePanel} products={spotlight} promotions={promotions} />
        </div>
        <a className="homeHero__scroll" href={`#${firstSectionId}`} aria-label="Explorar contenido"><ArrowDown aria-hidden="true" size={18} /></a>
      </section>

      {visibleSections.map((section) => {
        switch (section.type) {
          case 'NEW_ARRIVALS':
            return (
              <section className="newArrivals section cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth"><SectionHeading eyebrow={section.eyebrow} title={section.title} description={section.description} href={section.ctaHref || undefined} linkLabel={section.ctaLabel || undefined} />{spotlight.length ? <ProductCarousel products={spotlight} /> : <CatalogEmpty />}</div>
              </section>
            );
          case 'COLLECTIONS':
            return (
              <section className="lineCollection section cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth"><SectionHeading eyebrow={section.eyebrow} title={section.title} description={section.description || undefined} /><div className="lineCollection__grid">{lineTiles.map((tile, index) => <Reveal className={`lineTile lineTile--${index + 1}`} delay={index * 0.06} key={tile.line}><Link href={`/productos?line=${tile.line}`}><Image alt={LINE_LABELS[tile.line]} fill sizes="(max-width: 700px) 86vw, 25vw" src={lineFallbackImage(tile.line)} /><div className="lineTile__veil" /><span>{tile.kicker}</span><div><h3>{LINE_LABELS[tile.line]}</h3><p>{tile.description}</p></div><b aria-hidden="true"><ArrowRight size={18} /></b></Link></Reveal>)}</div></div>
              </section>
            );
          case 'BEST_SELLERS':
            return (
              <section className="bestSellers section cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth"><SectionHeading eyebrow={section.eyebrow} title={section.title} description={section.description} href={section.ctaHref || undefined} linkLabel={section.ctaLabel || undefined} />{favorites.length ? <div className="productGrid productGrid--home">{favorites.slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} priority={index < 2} />)}</div> : <CatalogEmpty />}</div>
              </section>
            );
          case 'SCENT_FINDER': {
            const scentLinks = section.scentLinks?.length
              ? section.scentLinks
              : (scents.length ? scents : fallbackScents).slice(0, 8).map((scent) => ({
                  id: scent.slug,
                  label: scent.name,
                  href: `/productos?scent=${scent.slug}`,
                }));
            return (
              <section className="scentFinder section cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth scentFinder__inner"><div><span className="eyebrow eyebrow--light">{section.eyebrow}</span><h2>{section.title}</h2><p>{section.description}</p></div><div className="scentFinder__links">{scentLinks.map((link, index) => <Link href={link.href} key={link.id}><span>{String(index + 1).padStart(2, '0')}</span>{link.label}<ArrowRight aria-hidden="true" size={17} /></Link>)}</div></div>
              </section>
            );
          }
          case 'PROMOTION_BAND':
            return (
              <section className="offerBand section cmsSection" id={section.id} key={section.id}>
                <div className="pageWidth offerBand__inner"><Reveal className="offerBand__copy"><span className="eyebrow">{section.eyebrow}</span><h2>{activePromotion?.name ?? section.title}</h2><p>{activePromotion?.description ?? section.description}</p>{activePromotion?.code && <div className="promoCode"><span>Código</span><strong>{activePromotion.code}</strong></div>}<Link className="button button--dark button--large" href={section.ctaHref || '/promociones'}>{section.ctaLabel || 'Ver promoción'} <ArrowRight aria-hidden="true" size={18} /></Link></Reveal><Reveal className="offerBand__visual" delay={0.1}><Image alt={activePromotion?.name ?? section.title} fill sizes="(max-width: 800px) 100vw, 50vw" src={activePromotion?.imageUrl || section.imageUrl || '/images/products/premium-oud.png'} unoptimized={Boolean((activePromotion?.imageUrl || section.imageUrl)?.startsWith('http'))} /><span><Sparkles aria-hidden="true" size={18} /> Selección especial</span></Reveal></div>
              </section>
            );
          case 'ABOUT':
            return (
              <section className="aboutSection section cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth aboutSection__intro"><Reveal><span className="eyebrow">{section.eyebrow}</span><h2>{section.title}</h2></Reveal><Reveal delay={0.08}><p>{section.description}</p>{section.secondaryText && <p>{section.secondaryText}</p>}</Reveal></div>
                <div className="pageWidth locationBand"><div className="locationBand__map"><iframe allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={contact.mapsEmbedUrl} title="Ubicación de Fraiche Tizmin en Google Maps" /></div><div className="locationBand__content"><MapPin aria-hidden="true" size={26} /><span className="eyebrow">Visítanos</span><h3>Centro, Tizimín</h3><p>{contact.address}</p><a className="button button--outline" href={section.ctaHref || mapUrl} rel="noreferrer" target="_blank">{section.ctaLabel || 'Cómo llegar'} <ArrowRight aria-hidden="true" size={17} /></a></div></div>
              </section>
            );
          case 'SPECIAL_ORDER':
            return (
              <section className="specialOrderBand cmsSection" id={section.id} key={section.id}>
                <SectionBackground section={section} />
                <div className="pageWidth specialOrderBand__inner"><div><MessageCircle aria-hidden="true" size={24} /><span className="eyebrow eyebrow--light">{section.eyebrow}</span></div><h2>{section.title}</h2><Link className="button button--cream button--large" href={section.ctaHref || '/pedidos-especiales'}>{section.ctaLabel || 'Solicitar aroma'} <ArrowRight aria-hidden="true" size={18} /></Link></div>
              </section>
            );
        }
      })}
    </main>
  );
}

function SectionBackground({ section }: { section: StorefrontSection }) {
  if (!section.imageUrl || section.type === 'PROMOTION_BAND') return null;
  return <div className="cmsSection__background"><Image alt="" aria-hidden="true" fill sizes="100vw" src={section.imageUrl} unoptimized={section.imageUrl.startsWith('http')} /></div>;
}

const fallbackScents: ScentFamily[] = [
  { id: '1', slug: 'floral', name: 'Floral' }, { id: '2', slug: 'citrico', name: 'Cítrico' },
  { id: '3', slug: 'amaderado', name: 'Amaderado' }, { id: '4', slug: 'fresco', name: 'Fresco' },
  { id: '5', slug: 'dulce', name: 'Dulce' }, { id: '6', slug: 'oriental', name: 'Oriental' },
  { id: '7', slug: 'nicho', name: 'Nicho' }, { id: '8', slug: 'arabe', name: 'Árabe' },
];

function CatalogEmpty() {
  return <div className="catalogEmpty"><Sparkles aria-hidden="true" size={24} /><h3>El catálogo está por florecer</h3><p>Cuando la API tenga productos activos, aparecerán aquí automáticamente.</p></div>;
}
