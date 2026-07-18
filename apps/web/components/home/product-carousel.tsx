'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/store/product-card';

export function ProductCarousel({ products }: { products: Product[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const move = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.min(360, window.innerWidth * 0.8), behavior: 'smooth' });

  return (
    <div className="productCarousel">
      <div className="productCarousel__controls">
        <button aria-label="Productos anteriores" className="iconButton iconButton--border" onClick={() => move(-1)} title="Anterior" type="button"><ArrowLeft aria-hidden="true" size={19} /></button>
        <button aria-label="Productos siguientes" className="iconButton iconButton--dark" onClick={() => move(1)} title="Siguiente" type="button"><ArrowRight aria-hidden="true" size={19} /></button>
      </div>
      <div className="productCarousel__rail" ref={railRef}>
        {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index === 0} />)}
      </div>
    </div>
  );
}
