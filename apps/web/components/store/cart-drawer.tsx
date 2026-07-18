'use client';

import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { lineFallbackImage } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { useCart } from '@/providers/cart-provider';

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, mutating, updateItem, removeItem } = useCart();

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.button
            aria-label="Cerrar carrito"
            className="drawerBackdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <motion.aside
            aria-label="Tu carrito"
            className="cartDrawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="cartDrawer__header">
              <div>
                <span className="menuEyebrow">Tu selección</span>
                <h2>Carrito <small>{cart?.itemCount ?? 0}</small></h2>
              </div>
              <button aria-label="Cerrar carrito" className="iconButton" onClick={() => setDrawerOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
            </div>

            {!cart?.items.length ? (
              <div className="cartDrawer__empty">
                <span><ShoppingBag aria-hidden="true" size={28} /></span>
                <h3>Tu próxima esencia te espera</h3>
                <p>Añade un perfume o producto de cuidado para empezar.</p>
                <Link className="button button--dark" href="/productos" onClick={() => setDrawerOpen(false)}>
                  Explorar catálogo <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            ) : (
              <>
                <div className="cartDrawer__items">
                  {cart.items.map((item) => (
                    <article className="cartLine" key={item.id}>
                      <Link className="cartLine__image" href={`/productos/${item.product.slug}`} onClick={() => setDrawerOpen(false)}>
                        <Image
                          alt={item.product.image?.altText ?? item.product.name}
                          fill
                          sizes="96px"
                          src={item.product.image?.url ?? lineFallbackImage(item.product.line)}
                        />
                      </Link>
                      <div className="cartLine__content">
                        <div>
                          <Link href={`/productos/${item.product.slug}`} onClick={() => setDrawerOpen(false)}>{item.product.name}</Link>
                          <small>{item.variant.name}</small>
                        </div>
                        <strong>{formatMoney(item.lineTotalCents, item.currency)}</strong>
                        <div className="quantityControl quantityControl--small">
                          <button aria-label="Restar uno" disabled={mutating || item.quantity <= 1} onClick={() => updateItem(item.id, item.quantity - 1)} type="button"><Minus aria-hidden="true" size={14} /></button>
                          <span>{item.quantity}</span>
                          <button aria-label="Sumar uno" disabled={mutating || item.quantity >= item.available} onClick={() => updateItem(item.id, item.quantity + 1)} type="button"><Plus aria-hidden="true" size={14} /></button>
                        </div>
                      </div>
                      <button aria-label={`Eliminar ${item.product.name}`} className="cartLine__remove" disabled={mutating} onClick={() => removeItem(item.id)} title="Eliminar" type="button"><Trash2 aria-hidden="true" size={16} /></button>
                    </article>
                  ))}
                </div>
                <div className="cartDrawer__footer">
                  <div><span>Subtotal</span><strong>{formatMoney(cart.subtotalCents, cart.currency)}</strong></div>
                  <p>Envío y descuentos se calculan al finalizar.</p>
                  <Link className="button button--coral button--wide button--large" href="/carrito" onClick={() => setDrawerOpen(false)}>
                    Finalizar compra <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                  <Link className="textLink" href="/productos" onClick={() => setDrawerOpen(false)}>Seguir explorando</Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
