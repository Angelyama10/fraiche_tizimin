'use client';

import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Home,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { formatDate, formatMoney, initials } from '@/lib/format';
import { FULFILLMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, statusTone } from '@/lib/status';
import type { CustomerAddress, CustomerProfile, Order, Paginated, WishlistEntry } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';
import { ProductMediaPlaceholder } from '@/components/store/product-media-placeholder';

type Tab = 'resumen' | 'pedidos' | 'favoritos' | 'direcciones' | 'perfil';

const navItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'resumen', label: 'Resumen', icon: Home },
  { id: 'pedidos', label: 'Mis compras', icon: Package },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'direcciones', label: 'Direcciones', icon: MapPin },
  { id: 'perfil', label: 'Mi perfil', icon: UserRound },
];

export function CustomerDashboard() {
  const auth = useAuth();
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(navItems.some((item) => item.id === requestedTab) ? requestedTab! : 'resumen');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProfile, nextOrders, nextAddresses, nextWishlist] = await Promise.all([
        auth.request<CustomerProfile>('/customers/me'),
        auth.request<Paginated<Order>>('/orders?page=1&pageSize=20'),
        auth.request<CustomerAddress[]>('/customers/me/addresses'),
        auth.request<WishlistEntry[]>('/customers/me/wishlist'),
      ]);
      setProfile(nextProfile);
      setOrders(nextOrders.data);
      setAddresses(nextAddresses);
      setWishlist(nextWishlist);
    } catch (error) {
      notify({ title: 'No pudimos cargar tu cuenta', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [auth, notify]);

  useEffect(() => { void load(); }, [load]);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(`/cuenta?tab=${next}`, { scroll: false });
  }

  async function removeFavorite(productId: string) {
    try {
      await auth.request(`/customers/me/wishlist/${productId}`, { method: 'DELETE' });
      setWishlist((current) => current.filter((item) => item.product.id !== productId));
      notify({ title: 'Favorito retirado', tone: 'success' });
    } catch (error) {
      notify({ title: 'No pudimos retirarlo', description: errorMessage(error), tone: 'error' });
    }
  }

  async function deleteAddress(addressId: string) {
    try {
      await auth.request(`/customers/me/addresses/${addressId}`, { method: 'DELETE' });
      setAddresses((current) => current.filter((item) => item.id !== addressId));
      notify({ title: 'Dirección eliminada', tone: 'success' });
    } catch (error) {
      notify({ title: 'No pudimos eliminarla', description: errorMessage(error), tone: 'error' });
    }
  }

  const firstName = profile?.firstName ?? auth.customer?.firstName ?? 'hola';

  return (
    <main className="accountPage">
      <header className="accountHeader">
        <div className="pageWidth"><div className="accountAvatar">{initials(profile?.firstName, profile?.lastName)}</div><div><span className="eyebrow">Tu espacio Fraîche</span><h1>Hola, {firstName}.</h1><p>Aquí vive todo lo que elegiste para ti.</p></div></div>
      </header>

      <div className="accountNavMobile pageWidth">
        {navItems.map((item) => <button className={tab === item.id ? 'isActive' : ''} key={item.id} onClick={() => selectTab(item.id)} type="button"><item.icon aria-hidden="true" size={16} />{item.label}</button>)}
      </div>

      <div className="accountLayout pageWidth">
        <aside className="accountSidebar">
          <nav>{navItems.map((item) => <button className={tab === item.id ? 'isActive' : ''} key={item.id} onClick={() => selectTab(item.id)} type="button"><item.icon aria-hidden="true" size={17} /><span>{item.label}</span><ChevronRight aria-hidden="true" size={15} /></button>)}</nav>
          <button className="accountLogout" onClick={() => auth.logout()} type="button"><LogOut aria-hidden="true" size={17} /> Cerrar sesión</button>
        </aside>

        <section className="accountContent" aria-busy={loading}>
          {loading ? <AccountSkeleton /> : (
            <>
              {tab === 'resumen' && <Overview profile={profile} orders={orders} wishlistCount={wishlist.length} addressesCount={addresses.length} onSelectTab={selectTab} />}
              {tab === 'pedidos' && <OrdersTab orders={orders} />}
              {tab === 'favoritos' && <WishlistTab entries={wishlist} onRemove={removeFavorite} />}
              {tab === 'direcciones' && <AddressesTab addresses={addresses} onAdd={() => setAddressOpen(true)} onDelete={deleteAddress} />}
              {tab === 'perfil' && <ProfileTab profile={profile} onUpdated={load} />}
            </>
          )}
        </section>
      </div>

      {addressOpen && <AddressModal onClose={() => setAddressOpen(false)} onCreated={(address) => { setAddresses((current) => [address, ...current]); setAddressOpen(false); }} />}
    </main>
  );
}

function Overview({ profile, orders, wishlistCount, addressesCount, onSelectTab }: { profile: CustomerProfile | null; orders: Order[]; wishlistCount: number; addressesCount: number; onSelectTab: (tab: Tab) => void }) {
  const latest = orders[0];
  return <><div className="accountSectionHeading"><div><span className="eyebrow">Resumen</span><h2>Todo en orden.</h2></div><Link className="button button--dark" href="/productos">Seguir explorando <ArrowRight size={16} /></Link></div><div className="accountMetrics"><button onClick={() => onSelectTab('pedidos')} type="button"><Package size={20} /><strong>{profile?._count.orders ?? orders.length}</strong><span>Pedidos</span></button><button onClick={() => onSelectTab('favoritos')} type="button"><Heart size={20} /><strong>{wishlistCount}</strong><span>Favoritos</span></button><button onClick={() => onSelectTab('direcciones')} type="button"><MapPin size={20} /><strong>{addressesCount}</strong><span>Direcciones</span></button></div>{latest ? <div className="latestOrder"><div><span className="eyebrow">Pedido más reciente</span><h3>{latest.number}</h3><p>{formatDate(latest.createdAt)}</p></div><div><StatusBadge status={latest.fulfillmentStatus} label={FULFILLMENT_STATUS_LABELS[latest.fulfillmentStatus] ?? latest.fulfillmentStatus} /><strong>{formatMoney(latest.totalCents, latest.currency)}</strong><Link href={`/pedidos/${latest.publicToken}`}>Ver seguimiento <ArrowRight size={16} /></Link></div></div> : <div className="accountEmpty"><ShoppingBag size={25} /><h3>Tu primera elección empieza aquí.</h3><p>Cuando hagas una compra, podrás seguir cada paso desde este espacio.</p><Link className="button button--coral" href="/productos">Explorar perfumes</Link></div>}</>;
}

function OrdersTab({ orders }: { orders: Order[] }) {
  return <><div className="accountSectionHeading"><div><span className="eyebrow">Historial</span><h2>Mis compras</h2></div></div>{orders.length ? <div className="ordersList">{orders.map((order) => <article key={order.publicToken}><div className="ordersList__top"><div><span>{formatDate(order.createdAt)}</span><h3>{order.number}</h3></div><StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status] ?? order.status} /></div><div className="ordersList__items"><Package size={17} /><span>{order.items?.length ?? 0} productos</span><strong>{formatMoney(order.totalCents, order.currency)}</strong></div><div className="ordersList__bottom"><span>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</span><Link href={`/pedidos/${order.publicToken}`}>Detalles y seguimiento <ArrowRight size={15} /></Link></div></article>)}</div> : <AccountEmpty icon={Package} title="Aún no hay compras" description="Tus compras aparecerán aquí con su pago y seguimiento." />}</>;
}

function WishlistTab({ entries, onRemove }: { entries: WishlistEntry[]; onRemove: (id: string) => void }) {
  return <><div className="accountSectionHeading"><div><span className="eyebrow">Guardados</span><h2>Mis favoritos</h2></div></div>{entries.length ? <div className="wishlistGrid">{entries.map(({ product }) => { const variant = product.variants[0]; return <article key={product.id}><Link className="wishlistGrid__image" href={`/productos/${product.slug}`}>{product.image?.url ? <Image alt={product.image.altText || product.name} fill sizes="(max-width: 700px) 45vw, 220px" src={product.image.url} /> : <ProductMediaPlaceholder name={product.name} />}</Link><button aria-label={`Quitar ${product.name}`} onClick={() => onRemove(product.id)} title="Quitar favorito" type="button"><X size={16} /></button><Link href={`/productos/${product.slug}`}><h3>{product.name}</h3><p>{product.shortDescription}</p><strong>{formatMoney(variant?.price.amountCents, variant?.price.currency)}</strong></Link></article>; })}</div> : <AccountEmpty icon={Heart} title="Tu tocador está listo" description="Guarda aquí los aromas que quieres volver a encontrar." />}</>;
}

function AddressesTab({ addresses, onAdd, onDelete }: { addresses: CustomerAddress[]; onAdd: () => void; onDelete: (id: string) => void }) {
  return <><div className="accountSectionHeading"><div><span className="eyebrow">Entregas</span><h2>Mis direcciones</h2></div><button className="button button--dark" onClick={onAdd} type="button"><Plus size={17} /> Agregar</button></div>{addresses.length ? <div className="addressList">{addresses.map((address) => <article key={address.id}><div><MapPin size={19} /><span>{address.label}</span>{address.isDefault && <b>Principal</b>}</div><h3>{address.recipientName}</h3><p>{address.street} {address.exteriorNumber}{address.interiorNumber ? ` Int. ${address.interiorNumber}` : ''}<br />{address.neighborhood}, {address.city}, {address.state} {address.postalCode}</p><small>{address.phone}</small><div><button aria-label="Editar dirección" disabled title="Editar próximamente" type="button"><Pencil size={15} /></button><button aria-label="Eliminar dirección" onClick={() => onDelete(address.id)} title="Eliminar" type="button"><Trash2 size={15} /></button></div></article>)}</div> : <AccountEmpty icon={MapPin} title="Agrega tu primera dirección" description="La tendrás lista para comprar más rápido." action={<button className="button button--coral" onClick={onAdd} type="button"><Plus size={16} /> Agregar dirección</button>} />}</>;
}

function ProfileTab({ profile, onUpdated }: { profile: CustomerProfile | null; onUpdated: () => Promise<void> }) {
  const auth = useAuth(); const notify = useNotify(); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await auth.request('/customers/me', { method: 'PATCH', body: JSON.stringify({ firstName: form.get('firstName'), lastName: form.get('lastName'), phone: form.get('phone'), marketingOptIn: form.get('marketingOptIn') === 'on' }) }); await onUpdated(); notify({ title: 'Perfil actualizado', tone: 'success' }); } catch (error) { notify({ title: 'No pudimos guardar', description: errorMessage(error), tone: 'error' }); } finally { setSaving(false); } }
  return <><div className="accountSectionHeading"><div><span className="eyebrow">Datos personales</span><h2>Mi perfil</h2></div></div><form className="profileForm" onSubmit={submit}><div className="formGrid"><label className="formField"><span>Nombre</span><input defaultValue={profile?.firstName ?? ''} maxLength={80} name="firstName" required /></label><label className="formField"><span>Apellidos</span><input defaultValue={profile?.lastName ?? ''} maxLength={80} name="lastName" required /></label></div><label className="formField"><span>Correo</span><input disabled value={profile?.email ?? ''} /></label><label className="formField"><span>WhatsApp</span><input defaultValue={profile?.phone ?? ''} maxLength={30} name="phone" required /></label><label className="checkField"><input defaultChecked={profile?.marketingOptIn} name="marketingOptIn" type="checkbox" /><span><Check size={12} /></span>Quiero recibir promociones y novedades.</label><button className="button button--dark button--large" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Guardar cambios'}</button></form></>;
}

function AddressModal({ onClose, onCreated }: { onClose: () => void; onCreated: (address: CustomerAddress) => void }) {
  const auth = useAuth(); const notify = useNotify(); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const fields = ['label', 'recipientName', 'phone', 'street', 'exteriorNumber', 'interiorNumber', 'neighborhood', 'city', 'municipality', 'state', 'postalCode', 'reference']; const payload = Object.fromEntries(fields.map((field) => [field, String(form.get(field) ?? '') || undefined])); setSaving(true); try { const address = await auth.request<CustomerAddress>('/customers/me/addresses', { method: 'POST', body: JSON.stringify({ ...payload, country: 'MX', isDefault: form.get('isDefault') === 'on' }) }); onCreated(address); notify({ title: 'Dirección guardada', tone: 'success' }); } catch (error) { notify({ title: 'No pudimos guardar la dirección', description: errorMessage(error), tone: 'error' }); } finally { setSaving(false); } }
  return <div className="accountModal"><button aria-label="Cerrar" className="accountModal__backdrop" onClick={onClose} type="button" /><form className="addressForm" onSubmit={submit}><div className="addressForm__header"><div><span className="eyebrow">Nueva entrega</span><h2>Agregar dirección</h2></div><button aria-label="Cerrar" className="iconButton" onClick={onClose} type="button"><X size={20} /></button></div><div className="formGrid"><label className="formField"><span>Etiqueta</span><input name="label" placeholder="Casa" maxLength={40} required /></label><label className="formField"><span>Recibe</span><input name="recipientName" maxLength={120} required /></label></div><label className="formField"><span>WhatsApp</span><input name="phone" maxLength={30} required /></label><div className="formGrid formGrid--street"><label className="formField"><span>Calle</span><input name="street" maxLength={160} required /></label><label className="formField"><span>Núm. exterior</span><input name="exteriorNumber" maxLength={20} required /></label><label className="formField"><span>Interior</span><input name="interiorNumber" maxLength={20} /></label></div><label className="formField"><span>Colonia</span><input name="neighborhood" maxLength={100} required /></label><div className="formGrid"><label className="formField"><span>Ciudad</span><input defaultValue="Tizimín" name="city" maxLength={100} required /></label><label className="formField"><span>Municipio</span><input defaultValue="Tizimín" name="municipality" maxLength={100} /></label></div><div className="formGrid"><label className="formField"><span>Estado</span><input defaultValue="Yucatán" name="state" maxLength={100} required /></label><label className="formField"><span>Código postal</span><input inputMode="numeric" name="postalCode" maxLength={10} required /></label></div><label className="formField"><span>Referencias</span><textarea name="reference" maxLength={300} rows={3} /></label><label className="checkField"><input name="isDefault" type="checkbox" /><span><Check size={12} /></span>Usar como dirección principal.</label><button className="button button--coral button--large button--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Guardar dirección'}</button></form></div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) { return <span className={`statusBadge statusBadge--${statusTone(status)}`}>{label}</span>; }
function AccountEmpty({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description: string; action?: React.ReactNode }) { return <div className="accountEmpty"><Icon size={26} /><h3>{title}</h3><p>{description}</p>{action}</div>; }
function AccountSkeleton() { return <div className="accountSkeleton"><span /><span /><div><i /><i /><i /></div></div>; }
