'use client';

import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productImage, productImageAlt } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';

export function HeroSpotlight({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (products.length < 2) return;
    const interval = window.setInterval(() => setIndex((current) => (current + 1) % products.length), 5200);
    return () => window.clearInterval(interval);
  }, [products.length]);

  if (!products.length) return null;
  const product = products[index % products.length];
  const image = productImage(product);

  return (
    <div className="heroSpotlight">
      <div className="heroSpotlight__top"><span>Nuevo en la tienda</span><b>{String(index + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</b></div>
      <AnimatePresence mode="wait">
        <motion.div className="heroSpotlight__product" key={product.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <div className="heroSpotlight__image">
            <Image
              alt={productImageAlt(product)}
              fetchPriority="high"
              fill
              loading="eager"
              sizes="110px"
              src={image}
              unoptimized={image.startsWith('http')}
            />
          </div>
          <div>
            <small>{product.brand?.name ?? 'Fraîche Tizimín'}</small>
            <strong>{product.name}</strong>
            <span>{formatMoney(product.priceRange.minimumCents, product.priceRange.currency)}</span>
          </div>
          <Link aria-label={`Ver ${product.name}`} href={`/productos/${product.slug}`}><ArrowRight aria-hidden="true" size={17} /></Link>
        </motion.div>
      </AnimatePresence>
      <div className="heroSpotlight__dots">
        {products.map((item, itemIndex) => <button aria-label={`Ver ${item.name}`} className={itemIndex === index ? 'isActive' : ''} key={item.id} onClick={() => setIndex(itemIndex)} type="button" />)}
      </div>
    </div>
  );
}
