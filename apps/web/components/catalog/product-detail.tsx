'use client';

import { ArrowLeft, Check, ChevronDown, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Sparkles, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LINE_LABELS, productImage, productImageAlt, stockMessage } from '@/lib/catalog';
import { errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';

export function ProductDetail({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.inStock)?.id ?? product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [liked, setLiked] = useState(false);
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) ?? product.variants[0], [product.variants, variantId]);
  const { addItem } = useCart();
  const auth = useAuth();
  const notify = useNotify();
  const router = useRouter();
  const image = productImage(product);

  async function add() {
    if (!variant?.inStock) return;
    setAdding(true);
    try {
      await addItem(variant.id, quantity);
    } finally {
      setAdding(false);
    }
  }

  async function toggleFavorite() {
    if (auth.status !== 'authenticated') {
      router.push(`/cuenta?redirect=${encodeURIComponent(`/productos/${product.slug}`)}`);
      return;
    }
    try {
      await auth.request(`/customers/me/wishlist/${product.id}`, { method: liked ? 'DELETE' : 'POST' });
      setLiked(!liked);
      notify({ title: liked ? 'Retirado de favoritos' : 'Guardado en favoritos', tone: 'success' });
    } catch (error) {
      notify({ title: 'No pudimos actualizar favoritos', description: errorMessage(error), tone: 'error' });
    }
  }

  return (
    <section className="productDetail pageWidth">
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <Link href="/productos"><ArrowLeft aria-hidden="true" size={15} /> Catálogo</Link><span>/</span><span>{LINE_LABELS[product.line]}</span>
      </nav>
      <div className="productDetail__layout">
        <div className="productGallery">
          <div className="productGallery__main">
            <Image alt={productImageAlt(product)} fill preload sizes="(max-width: 850px) 100vw, 52vw" src={image} unoptimized={image.startsWith('http')} />
            <span className="productGallery__mark">Fraîche Tizimín</span>
          </div>
        </div>
        <div className="productBuyBox">
          <span className="eyebrow">{LINE_LABELS[product.line]}</span>
          <h1>{product.name}</h1>
          <p className="productBuyBox__description">{product.shortDescription}</p>
          <div className="productBuyBox__rating"><span>★★★★★</span><small>Selección de la casa</small></div>
          <div className="productBuyBox__price">
            {variant?.compareAtPriceCents && <del>{formatMoney(variant.compareAtPriceCents, variant.currency)}</del>}
            <strong>{formatMoney(variant?.priceCents, variant?.currency)}</strong>
            <small>Impuestos incluidos</small>
          </div>

          {product.variants.length > 0 && (
            <fieldset className="variantPicker">
              <legend>Presentación</legend>
              <div>
                {product.variants.map((item) => (
                  <button className={item.id === variantId ? 'isActive' : ''} disabled={!item.inStock} key={item.id} onClick={() => { setVariantId(item.id); setQuantity(1); }} type="button">
                    <span>{item.name}</span><small>{formatMoney(item.priceCents, item.currency)}</small>{item.id === variantId && <Check aria-hidden="true" size={14} />}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="productBuyBox__stock"><i className={variant?.inStock ? '' : 'isOut'} /> {stockMessage(variant?.available ?? 0)}</div>
          <div className="productBuyBox__actions">
            <div className="quantityControl">
              <button aria-label="Restar uno" disabled={quantity <= 1} onClick={() => setQuantity((current) => current - 1)} type="button"><Minus aria-hidden="true" size={16} /></button>
              <span>{quantity}</span>
              <button aria-label="Sumar uno" disabled={!variant || quantity >= variant.available} onClick={() => setQuantity((current) => current + 1)} type="button"><Plus aria-hidden="true" size={16} /></button>
            </div>
            <button className="button button--coral button--large" disabled={!variant?.inStock || adding} onClick={add} type="button">
              {adding ? <span className="buttonSpinner" /> : <ShoppingBag aria-hidden="true" size={18} />} Agregar al carrito
            </button>
            <button aria-label="Guardar en favoritos" className={`iconButton iconButton--border ${liked ? 'isLiked' : ''}`} onClick={toggleFavorite} title="Favorito" type="button"><Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} size={19} /></button>
          </div>

          <div className="productBenefits">
            <span><Truck aria-hidden="true" size={19} /><b>Envíos a México</b><small>Rastreo desde tu cuenta</small></span>
            <span><ShieldCheck aria-hidden="true" size={19} /><b>Pago protegido</b><small>Mercado Pago o transferencia</small></span>
            <span><Sparkles aria-hidden="true" size={19} /><b>Atención personal</b><small>Te ayudamos a elegir</small></span>
          </div>

          <div className="productAccordions">
            <details open><summary>El aroma <ChevronDown aria-hidden="true" size={16} /></summary><div><p>{product.description ?? product.shortDescription}</p><div className="scentChips">{product.scentFamilies.map((scent) => <Link href={`/productos?scent=${scent.slug}`} key={scent.id}>{scent.name}</Link>)}</div></div></details>
            <details><summary>Concentración y presentación <ChevronDown aria-hidden="true" size={16} /></summary><div><p>{variant?.concentrationLabel ?? 'Concentración clásica'}{variant?.volumeMl ? ` · ${variant.volumeMl} ml` : ''}.</p></div></details>
            <details><summary>Envíos y pagos <ChevronDown aria-hidden="true" size={16} /></summary><div><p>Paga con tarjeta, link, transferencia o efectivo al recoger. El seguimiento aparece en tu cuenta cuando la guía está lista.</p></div></details>
          </div>
        </div>
      </div>
    </section>
  );
}
