'use client';

import { ArrowRight, ChevronLeft, ChevronRight, Tag, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LINE_LABELS, productImage, productImageAlt } from '@/lib/catalog';
import { ProductMediaPlaceholder } from '@/components/store/product-media-placeholder';
import { formatDate, formatMoney } from '@/lib/format';
import type { SiteContentDocument } from '@/lib/site-content';
import type { Product, Promotion } from '@/lib/types';

type PanelTab = 'products' | 'promotions';

export function HeroSpotlight({
  labels,
  products,
  promotions,
}: {
  labels: SiteContentDocument['home']['commercePanel'];
  products: Product[];
  promotions: Promotion[];
}) {
  const [tab, setTab] = useState<PanelTab>('products');
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [mobileOffersOpen, setMobileOffersOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const activePromotions = useMemo(
    () => promotions.filter((promotion) => promotion.isActive !== false).slice(0, 6),
    [promotions],
  );
  const itemCount = tab === 'products' ? products.length : activePromotions.length;

  useEffect(() => {
    if (itemCount < 2 || paused || reduceMotion) return;
    const interval = window.setInterval(() => {
      setDirection(1);
      setIndex((current) => (current + 1) % itemCount);
    }, 6200);
    return () => window.clearInterval(interval);
  }, [itemCount, paused, reduceMotion, tab]);

  useEffect(() => {
    if (!mobileOffersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileOffersOpen]);

  if (!products.length && !activePromotions.length) return null;

  function selectTab(nextTab: PanelTab) {
    setDirection(1);
    setIndex(0);
    setTab(nextTab);
  }

  function move(step: number) {
    if (!itemCount) return;
    setDirection(step);
    setIndex((current) => (current + step + itemCount) % itemCount);
  }

  function select(nextIndex: number) {
    setDirection(nextIndex >= index ? 1 : -1);
    setIndex(nextIndex);
  }

  const safeIndex = itemCount ? index % itemCount : 0;

  return (
    <div className="heroCommerce">
      <div
        className="heroSpotlight"
        onBlur={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="heroSpotlight__top">
          <div className="heroSpotlight__tabs" role="tablist" aria-label="Destacados de la tienda">
            <button aria-selected={tab === 'products'} className={tab === 'products' ? 'isActive' : ''} onClick={() => selectTab('products')} role="tab" type="button">
              {labels.productsLabel}
            </button>
            {activePromotions.length > 0 && (
              <button aria-selected={tab === 'promotions'} className={`heroSpotlight__promoTab ${tab === 'promotions' ? 'isActive' : ''}`} onClick={() => selectTab('promotions')} role="tab" type="button">
                {labels.promotionsLabel}
              </button>
            )}
          </div>
          <div className="heroSpotlight__counter">
            <b>{String(safeIndex + 1).padStart(2, '0')} / {String(itemCount).padStart(2, '0')}</b>
            {itemCount > 1 && <div className="heroSpotlight__controls"><button aria-label="Anterior" onClick={() => move(-1)} type="button"><ChevronLeft size={16} /></button><button aria-label="Siguiente" onClick={() => move(1)} type="button"><ChevronRight size={16} /></button></div>}
          </div>
        </div>

        <AnimatePresence custom={direction} initial={false} mode="wait">
          {tab === 'products' && products.length > 0 ? (
            <ProductSpotlight direction={direction} key={`product-${products[safeIndex].id}`} product={products[safeIndex]} reduceMotion={Boolean(reduceMotion)} />
          ) : activePromotions.length > 0 ? (
            <PromotionSpotlight direction={direction} key={`promotion-${activePromotions[safeIndex].slug}`} promotion={activePromotions[safeIndex]} reduceMotion={Boolean(reduceMotion)} />
          ) : null}
        </AnimatePresence>

        <div className="heroSpotlight__dots">
          {Array.from({ length: itemCount }).map((_, itemIndex) => <button aria-label={`Ver elemento ${itemIndex + 1}`} className={itemIndex === safeIndex ? 'isActive' : ''} key={itemIndex} onClick={() => select(itemIndex)} type="button" />)}
        </div>
      </div>

      {activePromotions.length > 0 && (
        <button className="heroPromoCapsule" onClick={() => setMobileOffersOpen(true)} type="button">
          <Tag aria-hidden="true" size={17} />
          <span><small>{labels.promotionsLabel}</small><strong>{labels.mobilePromotionsLabel}</strong></span>
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileOffersOpen && activePromotions.length > 0 && (
            <>
              <motion.button aria-label="Cerrar ofertas" animate={{ opacity: 1 }} className="offerSheetBackdrop" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={() => setMobileOffersOpen(false)} type="button" />
              <motion.aside animate={{ y: 0 }} aria-label="Ofertas disponibles" className="offerSheet" exit={{ y: '105%' }} initial={{ y: '105%' }} transition={{ type: 'spring', damping: 30, stiffness: 290 }}>
                <div className="offerSheet__handle" />
                <div className="offerSheet__header"><span><Tag size={17} /> {labels.promotionsLabel}</span><button aria-label="Cerrar" onClick={() => setMobileOffersOpen(false)} type="button"><X size={19} /></button></div>
                <PromotionSheet promotion={activePromotions[0]} />
                <Link className="button button--dark button--wide" href="/promociones" onClick={() => setMobileOffersOpen(false)}>Ver todas las promociones <ArrowRight size={17} /></Link>
              </motion.aside>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function ProductSpotlight({ product, direction, reduceMotion }: { product: Product; direction: number; reduceMotion: boolean }) {
  const image = productImage(product);
  const description = product.shortDescription ?? product.description ?? 'Una fragancia elegida para dejar una impresión inolvidable.';
  return (
    <motion.article animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} className="heroSpotlight__product" exit={{ opacity: 0, x: direction * -18, filter: 'blur(3px)' }} initial={{ opacity: 0, x: direction * 22, filter: 'blur(3px)' }} transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
      <div className="heroSpotlight__image">
        {image ? <Image alt={productImageAlt(product)} fetchPriority="high" fill loading="eager" sizes="(max-width: 699px) 104px, 138px" src={image} unoptimized={image.startsWith('http')} /> : <ProductMediaPlaceholder compact name={product.name} />}
      </div>
      <div className="heroSpotlight__details">
        <small>{product.brand?.name ?? 'Fraîche Tizimín'} · {product.scentFamilies[0]?.name ?? LINE_LABELS[product.line]}</small>
        <strong>{product.name}</strong>
        <p>{description}</p>
        <div><span>{LINE_LABELS[product.line]}</span><b>{formatMoney(product.priceRange.minimumCents, product.priceRange.currency)}</b></div>
      </div>
      <Link aria-label={`Ver ${product.name}`} href={`/productos/${product.slug}`}><ArrowRight aria-hidden="true" size={19} /></Link>
    </motion.article>
  );
}

function PromotionSpotlight({ promotion, direction, reduceMotion }: { promotion: Promotion; direction: number; reduceMotion: boolean }) {
  const image = promotion.imageUrl ?? '/images/products/premium-oud.png';
  const upcoming = new Date(promotion.startsAt).getTime() > Date.now();
  return (
    <motion.article animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} className="heroSpotlight__product heroSpotlight__product--promotion" exit={{ opacity: 0, x: direction * -18, filter: 'blur(3px)' }} initial={{ opacity: 0, x: direction * 22, filter: 'blur(3px)' }} transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
      <div className="heroSpotlight__image"><Image alt={promotion.name} fill sizes="(max-width: 699px) 104px, 138px" src={image} unoptimized={image.startsWith('http')} /></div>
      <div className="heroSpotlight__details">
        <small>{upcoming ? `Disponible ${formatDate(promotion.startsAt)}` : promotion.endsAt ? `Válida hasta ${formatDate(promotion.endsAt)}` : 'Beneficio permanente'}</small>
        <strong>{promotion.name}</strong>
        <p>{promotion.description ?? 'Una oportunidad especial para descubrir tu próxima esencia.'}</p>
        <div>{promotion.code ? <span>Código {promotion.code}</span> : <span>Sin código</span>}<b>{promotion.type === 'PERCENTAGE' ? `${promotion.value}%` : formatMoney(promotion.value)}</b></div>
      </div>
      <Link aria-label={`Ver promoción ${promotion.name}`} href="/promociones"><ArrowRight aria-hidden="true" size={19} /></Link>
    </motion.article>
  );
}

function PromotionSheet({ promotion }: { promotion: Promotion }) {
  const image = promotion.imageUrl ?? '/images/products/premium-oud.png';
  return (
    <article className="offerSheet__feature">
      <div><Image alt={promotion.name} fill loading="eager" sizes="112px" src={image} unoptimized={image.startsWith('http')} /></div>
      <span>
        <small>{promotion.endsAt ? `Hasta ${formatDate(promotion.endsAt)}` : 'Sin fecha de cierre'}</small>
        <strong>{promotion.name}</strong>
        <p>{promotion.description}</p>
        {promotion.code && <b>Código {promotion.code}</b>}
      </span>
    </article>
  );
}
