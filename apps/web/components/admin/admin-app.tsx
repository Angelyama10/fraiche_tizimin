'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FilePlus2,
  KeyRound,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage, getApiBaseUrl } from '@/lib/api';
import { LINE_LABELS } from '@/lib/catalog';
import { formatDate, formatMoney, initials } from '@/lib/format';
import { FULFILLMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, statusTone } from '@/lib/status';
import type { Category, Paginated, ProductLine, ScentFamily } from '@/lib/types';

type AdminUser = { id: string; email: string; name: string; role: string };
type AdminSession = { accessToken: string; expiresInSeconds: number; user: AdminUser };
type Tab = 'dashboard' | 'products' | 'inventory' | 'orders' | 'promotions';
type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type Dashboard = {
  generatedAt: string;
  products: { byStatus: Record<string, number>; activeVariants: number };
  inventory: { onHand: number; available: number; reserved: number; lowStock: number; outOfStock: number; openAlerts: number };
  orders: { byStatus: Record<string, number>; byPaymentStatus: Record<string, number> };
  revenue: { todayCents: number; monthCents: number; todayOrders: number; monthOrders: number; currency: string };
  recentOrders: AdminOrder[];
};

type AdminProduct = {
  id: string; name: string; slug: string; line: ProductLine; status: string; isFeatured: boolean; isNew: boolean;
  brand?: { name: string } | null;
  categories: Array<{ category: Category }>;
  variants: Array<{ id: string; sku: string; name: string; catalogPriceCents: number | null; isActive: boolean; inventoryLevels: Array<{ onHand: number; available: number; reserved: number }> }>;
  updatedAt: string;
};

type InventoryItem = {
  id: string; onHand: number; available: number; reserved: number; lowStockThreshold: number;
  location: { name: string };
  variant: { id: string; sku: string; name: string; product: { name: string; line: ProductLine } };
  alerts: Array<{ id: string }>;
};

type AdminOrder = {
  publicToken: string; number: string; customerName: string; customerEmail?: string; customerPhone?: string;
  status: string; paymentStatus: string; fulfillmentStatus: string; totalCents: number; currency: string; deliveryMethod: string; createdAt: string;
  _count?: { items: number; shipments: number };
  shipments?: Array<{ id: string; carrier: string; trackingNumber: string; status: string }>;
};

type AdminPromotion = {
  id: string; slug: string; code: string | null; name: string; description?: string | null; type: string; value: number; placement: string;
  startsAt: string; endsAt: string; isActive: boolean; isFeatured: boolean; uses: number; _count?: { orders: number };
};

const nav: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
  { id: 'products', label: 'Productos', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventario', icon: Boxes },
  { id: 'orders', label: 'Pedidos', icon: Package },
  { id: 'promotions', label: 'Promociones', icon: BadgePercent },
];

const SESSION_KEY = 'fraiche_admin_session';

export function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setSession(JSON.parse(saved) as AdminSession); } catch { sessionStorage.removeItem(SESSION_KEY); }
    }
    setReady(true);
  }, []);

  if (!ready) return <div className="adminBoot"><span className="buttonSpinner" /></div>;
  if (!session) return <AdminLogin onLogin={(next) => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); }} />;
  return <AdminWorkspace session={session} onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setSession(null); }} />;
}

function AdminLogin({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); setError('');
    try { onLogin(await apiRequest<AdminSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  return <main className="adminLogin"><div className="adminLogin__brand"><span className="brandMark__monogram">F</span><span><strong>Fraîche Tizimín</strong><small>Centro de operaciones</small></span></div><form onSubmit={submit}><KeyRound size={23} /><span className="adminEyebrow">Acceso de personal</span><h1>Bienvenida de vuelta.</h1><p>Administra catálogo, inventario, pedidos y campañas.</p>{error && <div className="adminError"><AlertTriangle size={16} /> {error}</div>}<label><span>Correo administrativo</span><input autoComplete="username" name="email" required type="email" /></label><label><span>Contraseña</span><input autoComplete="current-password" minLength={10} name="password" required type="password" /></label><button className="adminPrimaryButton" disabled={loading} type="submit">{loading ? <span className="buttonSpinner" /> : <>Entrar al panel <ArrowRight size={17} /></>}</button><small>El usuario se crea desde `ADMIN_EMAIL` y `ADMIN_PASSWORD` al iniciar la API.</small></form><Link href="/"><ArrowLeft size={15} /> Volver a la tienda</Link></main>;
}

function AdminWorkspace({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scents, setScents] = useState<ScentFamily[]>([]);
  const [modal, setModal] = useState<'product' | 'inventory' | 'promotion' | 'shipment' | 'price' | null>(null);
  const [selected, setSelected] = useState<InventoryItem | AdminOrder | AdminProduct | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const request = useCallback<AdminRequest>(async (path, init = {}) => {
    const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${session.accessToken}`);
    const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers: (() => { if (init.body) headers.set('Content-Type', 'application/json'); return headers; })(), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message ?? `Error ${response.status}`);
    return payload;
  }, [session.accessToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDashboard, nextProducts, nextInventory, nextOrders, nextPromotions, nextCategories, nextScents] = await Promise.all([
        request<Dashboard>('/admin/dashboard'),
        request<Paginated<AdminProduct>>('/admin/products?page=1&pageSize=100'),
        request<Paginated<InventoryItem>>('/admin/inventory?page=1&pageSize=100'),
        request<Paginated<AdminOrder>>('/admin/orders?page=1&pageSize=100'),
        request<Paginated<AdminPromotion>>('/admin/promotions?page=1&pageSize=100'),
        apiRequest<Category[]>('/categories', { cache: 'no-store' }),
        apiRequest<ScentFamily[]>('/scent-families', { cache: 'no-store' }),
      ]);
      setDashboard(nextDashboard); setProducts(nextProducts.data); setInventory(nextInventory.data); setOrders(nextOrders.data); setPromotions(nextPromotions.data); setCategories(nextCategories); setScents(nextScents);
    } catch (error) { setNotice({ tone: 'error', message: errorMessage(error) }); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void loadAll(); }, [loadAll, refreshKey]);

  function actionSuccess(message: string) { setNotice({ tone: 'success', message }); setModal(null); setSelected(null); setRefreshKey((value) => value + 1); }
  function open(nextModal: typeof modal, item?: typeof selected) { setSelected(item ?? null); setModal(nextModal); }

  const tabLabel = nav.find((item) => item.id === tab)?.label;

  return <main className="adminShell"><aside className={`adminSidebar ${menuOpen ? 'isOpen' : ''}`}><div className="adminSidebar__brand"><span className="brandMark__monogram">F</span><div><strong>Fraîche</strong><small>Operaciones</small></div><button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} type="button"><X size={18} /></button></div><nav>{nav.map((item) => <button className={tab === item.id ? 'isActive' : ''} key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }} type="button"><item.icon size={18} /><span>{item.label}</span><ChevronRight size={14} /></button>)}</nav><div className="adminSidebar__user"><span>{initials(session.user.name.split(' ')[0], session.user.name.split(' ')[1])}</span><div><strong>{session.user.name}</strong><small>{session.user.role}</small></div><button aria-label="Cerrar sesión" onClick={onLogout} title="Cerrar sesión" type="button"><LogOut size={16} /></button></div></aside>{menuOpen && <button aria-label="Cerrar menú" className="adminBackdrop" onClick={() => setMenuOpen(false)} type="button" />}<section className="adminWorkspace"><header className="adminTopbar"><button aria-label="Abrir menú" onClick={() => setMenuOpen(true)} type="button"><Menu size={20} /></button><div><span>Administración</span><strong>{tabLabel}</strong></div><div><button aria-label="Actualizar datos" onClick={() => setRefreshKey((value) => value + 1)} title="Actualizar" type="button"><RefreshCw size={18} /></button><button aria-label="Notificaciones" title="Notificaciones" type="button"><Bell size={18} />{(dashboard?.inventory.openAlerts ?? 0) > 0 && <i />}</button><Link aria-label="Ver tienda" href="/" title="Ver tienda"><Eye size={18} /></Link></div></header>{notice && <div className={`adminNotice adminNotice--${notice.tone}`}><span>{notice.message}</span><button aria-label="Cerrar" onClick={() => setNotice(null)} type="button"><X size={15} /></button></div>}<div className="adminContent">{loading ? <AdminLoading /> : <>{tab === 'dashboard' && <DashboardTab dashboard={dashboard} onTab={setTab} />}{tab === 'products' && <ProductsTab products={products} onCreate={() => open('product')} onEditPrice={(product) => open('price', product)} request={request} onSuccess={actionSuccess} />}{tab === 'inventory' && <InventoryTab inventory={inventory} onAdjust={(item) => open('inventory', item)} />}{tab === 'orders' && <OrdersTab orders={orders} onShipment={(order) => open('shipment', order)} request={request} onSuccess={actionSuccess} />}{tab === 'promotions' && <PromotionsTab promotions={promotions} onCreate={() => open('promotion')} request={request} onSuccess={actionSuccess} />}</>}</div></section>{modal && <AdminModal title={modalTitle(modal)} onClose={() => setModal(null)}>{modal === 'product' && <ProductForm categories={categories} scents={scents} request={request} onSuccess={actionSuccess} />}{modal === 'inventory' && selected && <InventoryForm item={selected as InventoryItem} request={request} onSuccess={actionSuccess} />}{modal === 'price' && selected && <PriceForm product={selected as AdminProduct} request={request} onSuccess={actionSuccess} />}{modal === 'promotion' && <PromotionForm request={request} onSuccess={actionSuccess} />}{modal === 'shipment' && selected && <ShipmentForm order={selected as AdminOrder} request={request} onSuccess={actionSuccess} />}</AdminModal>}</main>;
}

function DashboardTab({ dashboard, onTab }: { dashboard: Dashboard | null; onTab: (tab: Tab) => void }) {
  if (!dashboard) return null;
  const pendingOrders = dashboard.orders.byStatus.PENDING_PAYMENT ?? 0;
  return <><div className="adminPageHeading"><div><span className="adminEyebrow">Hoy en la tienda</span><h1>Un vistazo a Fraîche</h1><p>Actualizado {formatDate(dashboard.generatedAt, { dateStyle: undefined, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div></div><div className="adminMetrics"><Metric icon={CircleDollarSign} label="Ventas del mes" value={formatMoney(dashboard.revenue.monthCents)} note={`${dashboard.revenue.monthOrders} pedidos pagados`} tone="green" /><Metric icon={ShoppingBag} label="Ventas de hoy" value={formatMoney(dashboard.revenue.todayCents)} note={`${dashboard.revenue.todayOrders} pedidos`} tone="coral" /><Metric icon={Package} label="Pendientes" value={String(pendingOrders)} note="Esperando pago" tone="yellow" /><Metric icon={AlertTriangle} label="Alertas de stock" value={String(dashboard.inventory.openAlerts)} note={`${dashboard.inventory.outOfStock} agotados`} tone="red" /></div><div className="adminDashboardGrid"><section className="adminPanel adminPanel--orders"><div className="adminPanel__heading"><div><span className="adminEyebrow">Actividad</span><h2>Pedidos recientes</h2></div><button onClick={() => onTab('orders')} type="button">Ver todos <ArrowRight size={14} /></button></div><AdminOrdersTable orders={dashboard.recentOrders} compact /></section><section className="adminPanel"><div className="adminPanel__heading"><div><span className="adminEyebrow">Inventario</span><h2>Existencias</h2></div><button onClick={() => onTab('inventory')} type="button">Gestionar <ArrowRight size={14} /></button></div><div className="inventorySummary"><div><strong>{dashboard.inventory.available}</strong><span>Disponibles</span></div><div><strong>{dashboard.inventory.reserved}</strong><span>Reservados</span></div><div><strong>{dashboard.inventory.lowStock}</strong><span>Por agotarse</span></div><div><strong>{dashboard.inventory.outOfStock}</strong><span>Agotados</span></div></div><div className="stockBar"><span style={{ width: `${Math.min(100, (dashboard.inventory.available / Math.max(1, dashboard.inventory.onHand)) * 100)}%` }} /></div><small>{dashboard.inventory.onHand} unidades registradas</small></section></div></>;
}

function ProductsTab({ products, onCreate, onEditPrice, request, onSuccess }: { products: AdminProduct[]; onCreate: () => void; onEditPrice: (product: AdminProduct) => void; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [query, setQuery] = useState(''); const visible = products.filter((item) => `${item.name} ${item.slug} ${item.variants.map((v) => v.sku).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  async function toggle(product: AdminProduct, key: 'isFeatured' | 'isNew') { try { await request(`/admin/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ [key]: !product[key] }) }); onSuccess('Producto actualizado.'); } catch (error) { throw error; } }
  return <><AdminHeading eyebrow="Catálogo" title="Productos" description={`${products.length} productos registrados`} action={<button className="adminPrimaryButton" onClick={onCreate} type="button"><Plus size={16} /> Nuevo producto</button>} /><AdminSearch value={query} onChange={setQuery} placeholder="Buscar producto o SKU" /><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Producto</th><th>Línea</th><th>Precio</th><th>Stock</th><th>Visibilidad</th><th /></tr></thead><tbody>{visible.map((product) => { const variant = product.variants[0]; const stock = product.variants.reduce((sum, item) => sum + item.inventoryLevels.reduce((total, level) => total + level.available, 0), 0); return <tr key={product.id}><td><div className="tablePrimary"><span><ShoppingBag size={16} /></span><div><strong>{product.name}</strong><small>{variant?.sku ?? product.slug}</small></div></div></td><td><span className="adminTag">{LINE_LABELS[product.line]}</span></td><td><strong>{variant?.catalogPriceCents ? formatMoney(variant.catalogPriceCents) : product.line === 'NEECHE_PASSION' ? '$350' : product.line === 'PREMIUM' ? '$380' : 'Política'}</strong></td><td><span className={stock <= 5 ? 'stockLow' : ''}>{stock} disp.</span></td><td><div className="tableToggles"><button className={product.isFeatured ? 'isActive' : ''} onClick={() => toggle(product, 'isFeatured')} type="button">Destacado</button><button className={product.isNew ? 'isActive' : ''} onClick={() => toggle(product, 'isNew')} type="button">Nuevo</button></div></td><td><button aria-label="Editar precio" className="adminIconButton" onClick={() => onEditPrice(product)} title="Editar precio" type="button"><Pencil size={15} /></button></td></tr>; })}</tbody></table></div></>;
}

function InventoryTab({ inventory, onAdjust }: { inventory: InventoryItem[]; onAdjust: (item: InventoryItem) => void }) {
  const [query, setQuery] = useState(''); const [onlyLow, setOnlyLow] = useState(false); const visible = inventory.filter((item) => (!onlyLow || item.available <= item.lowStockThreshold) && `${item.variant.product.name} ${item.variant.sku}`.toLowerCase().includes(query.toLowerCase()));
  return <><AdminHeading eyebrow="Control de stock" title="Inventario" description={`${inventory.reduce((sum, item) => sum + item.available, 0)} unidades disponibles`} action={<button className={`adminFilterToggle ${onlyLow ? 'isActive' : ''}`} onClick={() => setOnlyLow(!onlyLow)} type="button"><AlertTriangle size={15} /> Poco stock</button>} /><AdminSearch value={query} onChange={setQuery} placeholder="Buscar producto o SKU" /><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Producto</th><th>Ubicación</th><th>Disponible</th><th>Reservado</th><th>Total</th><th>Alerta</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="tablePrimary"><span><Boxes size={16} /></span><div><strong>{item.variant.product.name}</strong><small>{item.variant.sku}</small></div></div></td><td>{item.location.name}</td><td><strong className={item.available <= item.lowStockThreshold ? 'stockLow' : ''}>{item.available}</strong></td><td>{item.reserved}</td><td>{item.onHand}</td><td>{item.available <= item.lowStockThreshold ? <span className="adminStatus adminStatus--danger">Reponer</span> : <span className="adminStatus adminStatus--success">Bien</span>}</td><td><button className="adminSecondaryButton" onClick={() => onAdjust(item)} type="button">Ajustar</button></td></tr>)}</tbody></table></div></>;
}

function OrdersTab({ orders, onShipment, request, onSuccess }: { orders: AdminOrder[]; onShipment: (order: AdminOrder) => void; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [query, setQuery] = useState(''); const visible = orders.filter((order) => `${order.number} ${order.customerName} ${order.customerEmail}`.toLowerCase().includes(query.toLowerCase()));
  async function updateStatus(order: AdminOrder, status: string) { try { await request(`/admin/orders/${order.publicToken}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); onSuccess('Estado del pedido actualizado.'); } catch (error) { window.alert(errorMessage(error)); } }
  return <><AdminHeading eyebrow="Ventas y entregas" title="Pedidos" description={`${orders.length} pedidos en el historial`} /><AdminSearch value={query} onChange={setQuery} placeholder="Buscar folio, cliente o correo" /><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Pedido</th><th>Cliente</th><th>Pago</th><th>Preparación</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{visible.map((order) => <tr key={order.publicToken}><td><div className="tablePrimary"><span><Package size={16} /></span><div><strong>{order.number}</strong><small>{formatDate(order.createdAt)}</small></div></div></td><td><strong>{order.customerName}</strong></td><td><span className={`adminStatus adminStatus--${statusTone(order.paymentStatus)}`}>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</span></td><td><select className="adminInlineSelect" onChange={(event) => updateStatus(order, event.target.value)} value={order.status}>{['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'].map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select></td><td><strong>{formatMoney(order.totalCents, order.currency)}</strong></td><td><div className="tableActions"><button className="adminSecondaryButton" onClick={() => onShipment(order)} type="button"><Truck size={14} /> Guía</button></div></td></tr>)}</tbody></table></div></>;
}

function PromotionsTab({ promotions, onCreate, request, onSuccess }: { promotions: AdminPromotion[]; onCreate: () => void; request: AdminRequest; onSuccess: (message: string) => void }) {
  async function toggle(item: AdminPromotion) { try { await request(`/admin/promotions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }); onSuccess('Promoción actualizada.'); } catch (error) { window.alert(errorMessage(error)); } }
  return <><AdminHeading eyebrow="Campañas" title="Promociones" description={`${promotions.filter((item) => item.isActive).length} promociones activas`} action={<button className="adminPrimaryButton" onClick={onCreate} type="button"><Plus size={16} /> Nueva promoción</button>} /><div className="promotionAdminGrid">{promotions.map((item) => <article key={item.id}><div><span className="adminTag">{item.placement}</span><button className={`adminSwitch ${item.isActive ? 'isActive' : ''}`} aria-label={item.isActive ? 'Desactivar promoción' : 'Activar promoción'} onClick={() => toggle(item)} type="button"><i /></button></div><Tag size={21} /><h3>{item.name}</h3><p>{item.description}</p><div><strong>{item.type === 'PERCENTAGE' ? `${item.value}%` : formatMoney(item.value)}</strong>{item.code && <code>{item.code}</code>}</div><small>{formatDate(item.startsAt)} – {formatDate(item.endsAt)}</small></article>)}</div></>;
}

function AdminOrdersTable({ orders, compact }: { orders: AdminOrder[]; compact?: boolean }) { return <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>{orders.slice(0, compact ? 8 : orders.length).map((order) => <tr key={order.publicToken}><td><div className="tablePrimary"><span><Package size={15} /></span><div><strong>{order.number}</strong><small>{formatDate(order.createdAt)}</small></div></div></td><td>{order.customerName}</td><td><span className={`adminStatus adminStatus--${statusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span></td><td><strong>{formatMoney(order.totalCents, order.currency)}</strong></td></tr>)}</tbody></table></div>; }

function ProductForm({ categories, scents, request, onSuccess }: { categories: Category[]; scents: ScentFamily[]; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [saving, setSaving] = useState(false); const leafCategories = categories.flatMap((item) => item.children ?? []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const price = Number(form.get('price') || 0); setSaving(true); try { await request('/admin/products', { method: 'POST', body: JSON.stringify({ slug: form.get('slug'), name: form.get('name'), shortDescription: form.get('shortDescription') || undefined, description: form.get('description') || undefined, line: form.get('line'), brandSlug: form.get('brandSlug') || undefined, categorySlugs: [form.get('categorySlug')], scentSlugs: form.getAll('scentSlugs'), isFeatured: form.get('isFeatured') === 'on', isNew: form.get('isNew') === 'on', images: form.get('imageUrl') ? [{ url: form.get('imageUrl'), altText: form.get('name'), isPrimary: true }] : [], variants: [{ sku: form.get('sku'), name: form.get('variantName'), concentrationLabel: form.get('concentrationLabel') || undefined, concentrationPercent: form.get('concentrationPercent') ? Number(form.get('concentrationPercent')) : undefined, volumeMl: form.get('volumeMl') ? Number(form.get('volumeMl')) : undefined, catalogPriceCents: price ? Math.round(price * 100) : undefined, initialStock: Number(form.get('initialStock') || 0), lowStockThreshold: Number(form.get('lowStockThreshold') || 5) }] }) }); onSuccess('Producto creado y disponible para administrar.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } }
  return <form className="adminForm" onSubmit={submit}><div className="adminFormGrid"><AdminField label="Nombre"><input name="name" required /></AdminField><AdminField label="Slug"><input name="slug" pattern="[a-z0-9-]+" placeholder="nombre-del-producto" required /></AdminField></div><AdminField label="Descripción corta"><input maxLength={240} name="shortDescription" /></AdminField><AdminField label="Descripción"><textarea name="description" rows={3} /></AdminField><div className="adminFormGrid"><AdminField label="Línea"><select name="line" required>{Object.entries(LINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminField><AdminField label="Marca"><select name="brandSlug"><option value="fraiche">Fraiche</option><option value="neeche">Neeche Passion</option><option value="premium">Premium</option><option value="victorias-secret">Victoria&apos;s Secret</option><option value="arabic-care">Cuidado árabe</option></select></AdminField></div><AdminField label="Categoría"><select name="categorySlug" required>{leafCategories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></AdminField><fieldset className="adminCheckGrid"><legend>Familias aromáticas</legend>{scents.map((scent) => <label key={scent.id}><input name="scentSlugs" type="checkbox" value={scent.slug} /><span><Check size={11} /></span>{scent.name}</label>)}</fieldset><AdminField label="URL de imagen HTTPS (opcional)"><input name="imageUrl" type="url" /></AdminField><div className="adminFormDivider"><span>Variante inicial</span></div><div className="adminFormGrid"><AdminField label="SKU"><input name="sku" required /></AdminField><AdminField label="Nombre de variante"><input name="variantName" placeholder="60 ml 37%" required /></AdminField><AdminField label="Concentración"><input name="concentrationLabel" placeholder="Clásica o 37%" /></AdminField><AdminField label="Porcentaje"><input min="0" name="concentrationPercent" step="0.01" type="number" /></AdminField><AdminField label="Volumen ml"><input min="1" name="volumeMl" type="number" /></AdminField><AdminField label="Precio MXN"><input min="0" name="price" step="0.01" type="number" /></AdminField><AdminField label="Existencia inicial"><input defaultValue="0" min="0" name="initialStock" required type="number" /></AdminField><AdminField label="Avisar cuando queden"><input defaultValue="5" min="0" name="lowStockThreshold" type="number" /></AdminField></div><div className="adminFormChecks"><label><input name="isFeatured" type="checkbox" /> Destacado</label><label><input name="isNew" type="checkbox" /> Novedad</label></div><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><FilePlus2 size={16} /> Crear producto</>}</button></form>;
}

function InventoryForm({ item, request, onSuccess }: { item: InventoryItem; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await request(`/admin/inventory/${item.variant.id}`, { method: 'PATCH', body: JSON.stringify({ onHand: Number(form.get('onHand')), lowStockThreshold: Number(form.get('lowStockThreshold')), reason: form.get('reason') }) }); onSuccess('Inventario actualizado y movimiento registrado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Boxes size={19} /><div><strong>{item.variant.product.name}</strong><small>{item.variant.sku} · {item.available} disponibles · {item.reserved} reservados</small></div></div><AdminField label="Existencia total"><input defaultValue={item.onHand} min={item.reserved} name="onHand" required type="number" /></AdminField><AdminField label="Umbral de poco stock"><input defaultValue={item.lowStockThreshold} min="0" name="lowStockThreshold" required type="number" /></AdminField><AdminField label="Motivo"><textarea maxLength={300} name="reason" placeholder="Compra a proveedor, ajuste de conteo..." required rows={3} /></AdminField><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Guardar inventario'}</button></form>; }

function PriceForm({ product, request, onSuccess }: { product: AdminProduct; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const variantId = String(form.get('variantId')); const price = Number(form.get('price')); setSaving(true); try { await request(`/admin/variants/${variantId}`, { method: 'PATCH', body: JSON.stringify({ catalogPriceCents: Math.round(price * 100) }) }); onSuccess('Precio actualizado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Tag size={19} /><div><strong>{product.name}</strong><small>{LINE_LABELS[product.line]}</small></div></div><AdminField label="Variante"><select name="variantId">{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.sku}</option>)}</select></AdminField><AdminField label="Nuevo precio MXN"><input defaultValue={(product.variants[0]?.catalogPriceCents ?? 0) / 100} min="0" name="price" required step="0.01" type="number" /></AdminField><p className="adminFormHint">Neeche Passion y Premium toman el precio fijo de su política de línea.</p><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Actualizar precio'}</button></form>; }

function PromotionForm({ request, onSuccess }: { request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await request('/admin/promotions', { method: 'POST', body: JSON.stringify({ slug: form.get('slug'), code: form.get('code') || undefined, name: form.get('name'), description: form.get('description') || undefined, type: form.get('type'), value: Number(form.get('value')), minimumCents: Math.round(Number(form.get('minimum') || 0) * 100), startsAt: new Date(String(form.get('startsAt'))).toISOString(), endsAt: new Date(String(form.get('endsAt'))).toISOString(), placement: form.get('placement'), isActive: true, isFeatured: form.get('isFeatured') === 'on', requiresCode: Boolean(form.get('code')), isStackable: form.get('isStackable') === 'on', priority: Number(form.get('priority') || 0) }) }); onSuccess('Promoción publicada.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16); const month = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16); return <form className="adminForm" onSubmit={submit}><div className="adminFormGrid"><AdminField label="Nombre"><input name="name" required /></AdminField><AdminField label="Slug"><input name="slug" pattern="[a-z0-9-]+" required /></AdminField></div><AdminField label="Descripción"><textarea maxLength={500} name="description" rows={3} /></AdminField><div className="adminFormGrid"><AdminField label="Tipo"><select name="type"><option value="PERCENTAGE">Porcentaje</option><option value="FIXED_AMOUNT">Monto fijo en centavos</option></select></AdminField><AdminField label="Valor"><input min="1" name="value" required type="number" /></AdminField><AdminField label="Código opcional"><input maxLength={60} name="code" /></AdminField><AdminField label="Compra mínima MXN"><input min="0" name="minimum" type="number" /></AdminField><AdminField label="Ubicación"><select name="placement"><option value="GENERAL">General</option><option value="DAILY">Oferta del día</option><option value="MONTHLY">Oferta del mes</option><option value="FLASH">Flash</option><option value="WELCOME">Bienvenida</option></select></AdminField><AdminField label="Prioridad"><input defaultValue="0" name="priority" type="number" /></AdminField><AdminField label="Inicia"><input defaultValue={tomorrow} name="startsAt" required type="datetime-local" /></AdminField><AdminField label="Termina"><input defaultValue={month} name="endsAt" required type="datetime-local" /></AdminField></div><div className="adminFormChecks"><label><input name="isFeatured" type="checkbox" /> Destacada</label><label><input name="isStackable" type="checkbox" /> Acumulable</label></div><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><Send size={15} /> Publicar promoción</>}</button></form>; }

function ShipmentForm({ order, request, onSuccess }: { order: AdminOrder; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await request(`/admin/orders/${order.publicToken}/shipments`, { method: 'POST', body: JSON.stringify({ carrier: form.get('carrier'), service: form.get('service') || undefined, trackingNumber: form.get('trackingNumber'), trackingUrl: form.get('trackingUrl') || undefined, status: 'LABEL_CREATED', estimatedDeliveryAt: form.get('estimatedDeliveryAt') ? new Date(String(form.get('estimatedDeliveryAt'))).toISOString() : undefined, notes: form.get('notes') || undefined }) }); onSuccess('Guía registrada y cliente notificado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Truck size={19} /><div><strong>{order.number}</strong><small>{order.customerName} · {formatMoney(order.totalCents, order.currency)}</small></div></div><div className="adminFormGrid"><AdminField label="Paquetería"><input name="carrier" placeholder="DHL, Estafeta..." required /></AdminField><AdminField label="Servicio"><input name="service" placeholder="Express" /></AdminField></div><AdminField label="Código de rastreo"><input name="trackingNumber" required /></AdminField><AdminField label="URL HTTPS de seguimiento"><input name="trackingUrl" placeholder="https://..." type="url" /></AdminField><AdminField label="Entrega estimada"><input name="estimatedDeliveryAt" type="datetime-local" /></AdminField><AdminField label="Notas internas"><textarea maxLength={500} name="notes" rows={3} /></AdminField><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><Truck size={15} /> Registrar guía</>}</button></form>; }

function AdminModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="adminModal"><button aria-label="Cerrar" className="adminModal__backdrop" onClick={onClose} type="button" /><section><header><div><span className="adminEyebrow">Operación segura</span><h2>{title}</h2></div><button aria-label="Cerrar" onClick={onClose} type="button"><X size={19} /></button></header>{children}</section></div>; }
function AdminHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="adminPageHeading"><div><span className="adminEyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="adminSearch"><Search size={16} /><input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />{value && <button aria-label="Limpiar" onClick={() => onChange('')} type="button"><X size={14} /></button>}</label>; }
function AdminField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="adminField"><span>{label}</span>{children}</label>; }
function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof BarChart3; label: string; value: string; note: string; tone: string }) { return <article className={`adminMetric adminMetric--${tone}`}><span><Icon size={19} /></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>; }
function AdminLoading() { return <div className="adminLoading"><span /><div>{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><b /></div>; }
function modalTitle(modal: string) { return ({ product: 'Nuevo producto', inventory: 'Ajustar inventario', promotion: 'Nueva promoción', shipment: 'Registrar guía', price: 'Actualizar precio' } as Record<string, string>)[modal] ?? 'Administrar'; }
