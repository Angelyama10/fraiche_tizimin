'use client';

import { ArrowUpRight, Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LINE_SHORT_LABELS, productImage, productImageAlt, stockMessage } from '@/lib/catalog';
import { errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';
import { ProductMediaPlaceholder } from './product-media-placeholder';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addItem } = useCart();
  const auth = useAuth();
  const notify = useNotify();
  const router = useRouter();
  const pathname = usePathname();
  const variant = product.variants.find((item) => item.inStock) ?? product.variants[0];
  const image = productImage(product);
  const external = image?.startsWith('http') ?? false;

  async function addToCart() {
    if (!variant?.inStock) return;
    setAdding(true);
    try {
      await addItem(variant.id);
    } finally {
      setAdding(false);
    }
  }

  async function toggleWishlist() {
    if (auth.status !== 'authenticated') {
      router.push(`/cuenta?redirect=${encodeURIComponent(pathname)}`);
      notify({ title: 'Guarda tus favoritos', description: 'Entra a tu cuenta para conservar tu selección.', tone: 'info' });
      return;
    }
    setSaving(true);
    try {
      await auth.request(`/customers/me/wishlist/${product.id}`, { method: liked ? 'DELETE' : 'POST' });
      setLiked(!liked);
      notify({ title: liked ? 'Retirado de favoritos' : 'Guardado en favoritos', tone: 'success' });
    } catch (error) {
      notify({ title: 'No pudimos actualizar favoritos', description: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.article className="productCard" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}>
      <div className="productCard__media">
        <Link href={`/productos/${product.slug}`} aria-label={`Ver ${product.name}`}>
          {image ? (
            <Image
              alt={productImageAlt(product)}
              fetchPriority={priority ? 'high' : 'auto'}
              fill
              loading={priority ? 'eager' : 'lazy'}
              sizes="(max-width: 600px) 78vw, (max-width: 1100px) 42vw, 310px"
              src={image}
              unoptimized={external}
            />
          ) : <ProductMediaPlaceholder name={product.name} />}
        </Link>
        <div className="productCard__badges">
          {product.isNew && <span>Nuevo</span>}
          {product.isFeatured && <span className="badge--mint">Favorito</span>}
        </div>
        <button
          aria-label={liked ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
          className={`productCard__heart ${liked ? 'isActive' : ''}`}
          disabled={saving}
          onClick={toggleWishlist}
          title="Favorito"
          type="button"
        >
          <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} size={18} />
        </button>
        <span className={`productCard__stock ${!variant?.inStock ? 'isOut' : ''}`}>{stockMessage(variant?.available ?? 0)}</span>
      </div>
      <div className="productCard__content">
        <div className="productCard__meta">
          <span>{LINE_SHORT_LABELS[product.line]}</span>
          <span>{variant?.volumeMl ? `${variant.volumeMl} ml` : product.brand?.name}</span>
        </div>
        <Link href={`/productos/${product.slug}`}>
          <h3>{product.name}</h3>
          <p>{product.shortDescription}</p>
        </Link>
        <div className="productCard__bottom">
          <div>
            {variant?.compareAtPriceCents && <del>{formatMoney(variant.compareAtPriceCents)}</del>}
            <strong>{formatMoney(variant?.priceCents, variant?.currency)}</strong>
          </div>
          <button
            aria-label={`Agregar ${product.name} al carrito`}
            className="productCard__add"
            disabled={!variant?.inStock || adding}
            onClick={addToCart}
            title="Agregar al carrito"
            type="button"
          >
            {adding ? <span className="buttonSpinner" /> : <ShoppingBag aria-hidden="true" size={18} />}
          </button>
        </div>
        <Link className="productCard__view" href={`/productos/${product.slug}`}>
          Detalles de {product.name} <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </motion.article>
  );
}
