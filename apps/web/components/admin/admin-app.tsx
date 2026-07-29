'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FilePlus2,
  ImagePlus,
  KeyRound,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PanelsTopLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Store,
  Star,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage, getApiBaseUrl } from '@/lib/api';
import { LINE_LABELS } from '@/lib/catalog';
import { formatDate, formatMoney, initials } from '@/lib/format';
import { FULFILLMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, statusTone } from '@/lib/status';
import type { Category, Paginated, ProductImage, ProductLine, ScentFamily } from '@/lib/types';
import { BrandIdentity } from '@/components/site/brand-identity';
import { AdminNotificationCenter } from './admin-notification-center';
import { AdminSiteEditor } from './admin-site-editor';

type AdminUser = { id: string; email: string; name: string; role: string };
type AdminSession = { accessToken: string; expiresInSeconds: number; user: AdminUser };
type Tab = 'dashboard' | 'products' | 'inventory' | 'orders' | 'promotions' | 'content';
export type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type Dashboard = {
  generatedAt: string;
  products: { byStatus: Record<string, number>; activeVariants: number };
  inventory: { onHand: number; available: number; reserved: number; lowStock: number; outOfStock: number; openAlerts: number };
  orders: { byStatus: Record<string, number>; byPaymentStatus: Record<string, number> };
  revenue: { todayCents: number; monthCents: number; todayOrders: number; monthOrders: number; currency: string };
  recentOrders: AdminOrder[];
};

type AdminProduct = {
  id: string; name: string; slug: string; shortDescription?: string | null; description?: string | null;
  seoTitle?: string | null; seoDescription?: string | null;
  line: ProductLine; status: string; isFeatured: boolean; isNew: boolean;
  brand?: { name: string; slug: string } | null;
  images: ProductImage[];
  categories: Array<{ category: Category }>;
  scentFamilies: Array<{ scentFamily: ScentFamily }>;
  variants: Array<{ id: string; sku: string; name: string; catalogPriceCents: number | null; isActive: boolean; inventoryLevels: Array<{ onHand: number; available: number; reserved: number }> }>;
  updatedAt: string;
};

type AdminPage<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
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
  payments?: Array<{
    id: string;
    method: string;
    status: string;
    transferProofs: Array<{
      id: string;
      fileName: string;
      status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
      reviewNotes?: string | null;
      createdAt: string;
    }>;
  }>;
};

type AdminPromotion = {
  id: string; slug: string; code: string | null; name: string; description?: string | null; type: string; value: number; placement: string;
  minimumCents: number; maximumDiscountCents?: number | null; maximumUses?: number | null; perCustomerLimit?: number | null;
  startsAt: string; endsAt: string | null; isActive: boolean; isFeatured: boolean; requiresCode: boolean; isStackable: boolean;
  priority: number; uses: number; _count?: { orders: number };
};

const nav: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
  { id: 'products', label: 'Productos', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventario', icon: Boxes },
  { id: 'orders', label: 'Pedidos', icon: Package },
  { id: 'promotions', label: 'Promociones', icon: BadgePercent },
  { id: 'content', label: 'Contenido de tienda', icon: PanelsTopLeft },
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

  return <main className="adminLogin"><div className="adminLogin__brand"><BrandIdentity compact /><small>Centro de operaciones</small></div><div aria-hidden="true" className="adminLogin__visual"><BrandIdentity inverted /><p>Cada pedido, una experiencia cuidada.</p></div><form onSubmit={submit}><KeyRound size={23} /><span className="adminEyebrow">Acceso de personal</span><h1>Bienvenida de vuelta.</h1><p>Administra catálogo, inventario, pedidos y campañas.</p>{error && <div className="adminError"><AlertTriangle size={16} /> {error}</div>}<label><span>Correo administrativo</span><input autoComplete="username" name="email" required type="email" /></label><label><span>Contraseña</span><input autoComplete="current-password" minLength={10} name="password" required type="password" /></label><button className="adminPrimaryButton" disabled={loading} type="submit">{loading ? <span className="buttonSpinner" /> : <>Entrar al panel <ArrowRight size={17} /></>}</button><small>Acceso protegido para personal autorizado.</small></form><Link href="/"><ArrowLeft size={15} /> Volver a la tienda</Link></main>;
}

function AdminWorkspace({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scents, setScents] = useState<ScentFamily[]>([]);
  const [modal, setModal] = useState<'product' | 'product-edit' | 'product-images' | 'inventory' | 'promotion' | 'promotion-edit' | 'shipment' | 'price' | null>(null);
  const [selected, setSelected] = useState<InventoryItem | AdminOrder | AdminProduct | AdminPromotion | null>(null);
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
      const [nextDashboard, nextInventory, nextOrders, nextPromotions, nextCategories, nextScents] = await Promise.all([
        request<Dashboard>('/admin/dashboard'),
        request<Paginated<InventoryItem>>('/admin/inventory?page=1&pageSize=100'),
        request<Paginated<AdminOrder>>('/admin/orders?page=1&pageSize=100'),
        request<Paginated<AdminPromotion>>('/admin/promotions?page=1&pageSize=100'),
        apiRequest<Category[]>('/categories', { cache: 'no-store' }),
        apiRequest<ScentFamily[]>('/scent-families', { cache: 'no-store' }),
      ]);
      setDashboard(nextDashboard); setInventory(nextInventory.data); setOrders(nextOrders.data); setPromotions(nextPromotions.data); setCategories(nextCategories); setScents(nextScents);
    } catch (error) { setNotice({ tone: 'error', message: errorMessage(error) }); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void loadAll(); }, [loadAll, refreshKey]);

  function actionSuccess(message: string) { setNotice({ tone: 'success', message }); setModal(null); setSelected(null); setRefreshKey((value) => value + 1); }
  function open(nextModal: typeof modal, item?: typeof selected) { setSelected(item ?? null); setModal(nextModal); }

  const tabLabel = nav.find((item) => item.id === tab)?.label;

  return (
    <main className="adminShell">
      <aside className={`adminSidebar ${menuOpen ? 'isOpen' : ''}`}>
        <div className="adminSidebar__brand"><BrandIdentity compact inverted /><button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} type="button"><X size={18} /></button></div>
        <nav>{nav.map((item) => <button className={tab === item.id ? 'isActive' : ''} key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }} type="button"><item.icon size={18} /><span>{item.label}</span><ChevronRight size={14} /></button>)}</nav>
        <div className="adminSidebar__user"><span>{initials(session.user.name.split(' ')[0], session.user.name.split(' ')[1])}</span><div><strong>{session.user.name}</strong><small>{session.user.role}</small></div><button aria-label="Cerrar sesión" onClick={onLogout} title="Cerrar sesión" type="button"><LogOut size={16} /></button></div>
      </aside>
      {menuOpen && <button aria-label="Cerrar menú" className="adminBackdrop" onClick={() => setMenuOpen(false)} type="button" />}
      <section className="adminWorkspace">
        <header className="adminTopbar">
          <button aria-label="Abrir menú" onClick={() => setMenuOpen(true)} type="button"><Menu size={20} /></button>
          <div><span>Administración</span><strong>{tabLabel}</strong></div>
          <div>
            <button aria-label="Actualizar datos" onClick={() => setRefreshKey((value) => value + 1)} title="Actualizar" type="button"><RefreshCw size={18} /></button>
            <AdminNotificationCenter
              onNewOrder={() => setRefreshKey((value) => value + 1)}
              onOpenOrders={() => setTab('orders')}
              request={request}
            />
            <Link aria-label="Ver tienda" href="/" title="Ver tienda"><Eye size={18} /></Link>
          </div>
        </header>
        {notice && <div className={`adminNotice adminNotice--${notice.tone}`}><span>{notice.message}</span><button aria-label="Cerrar" onClick={() => setNotice(null)} type="button"><X size={15} /></button></div>}
        <div className="adminContent">
          {loading ? <AdminLoading /> : <>
            {tab === 'dashboard' && <DashboardTab dashboard={dashboard} onTab={setTab} />}
            {tab === 'products' && <ProductsTab refreshKey={refreshKey} onCreate={() => open('product')} onEdit={(product) => open('product-edit', product)} onEditImages={(product) => open('product-images', product)} onEditPrice={(product) => open('price', product)} request={request} onSuccess={actionSuccess} />}
            {tab === 'inventory' && <InventoryTab inventory={inventory} onAdjust={(item) => open('inventory', item)} />}
            {tab === 'orders' && <OrdersTab orders={orders} onShipment={(order) => open('shipment', order)} request={request} onSuccess={actionSuccess} />}
            {tab === 'promotions' && <PromotionsTab promotions={promotions} onCreate={() => open('promotion')} onEdit={(promotion) => open('promotion-edit', promotion)} request={request} onSuccess={actionSuccess} />}
            {tab === 'content' && <AdminSiteEditor onNotice={(tone, message) => setNotice({ tone, message })} request={request} />}
          </>}
        </div>
      </section>
      {modal && <AdminModal title={modalTitle(modal)} onClose={() => setModal(null)}>
        {modal === 'product' && <ProductForm categories={categories} scents={scents} request={request} onSuccess={actionSuccess} />}
        {modal === 'product-edit' && selected && <ProductEditForm product={selected as AdminProduct} categories={categories} scents={scents} request={request} onSuccess={actionSuccess} />}
        {modal === 'product-images' && selected && <ProductImagesForm product={selected as AdminProduct} request={request} onSuccess={actionSuccess} />}
        {modal === 'inventory' && selected && <InventoryForm item={selected as InventoryItem} request={request} onSuccess={actionSuccess} />}
        {modal === 'price' && selected && <PriceForm product={selected as AdminProduct} request={request} onSuccess={actionSuccess} />}
        {modal === 'promotion' && <PromotionForm request={request} onSuccess={actionSuccess} />}
        {modal === 'promotion-edit' && selected && <PromotionForm promotion={selected as AdminPromotion} request={request} onSuccess={actionSuccess} />}
        {modal === 'shipment' && selected && <ShipmentForm order={selected as AdminOrder} request={request} onSuccess={actionSuccess} />}
      </AdminModal>}
    </main>
  );
}

function DashboardTab({ dashboard, onTab }: { dashboard: Dashboard | null; onTab: (tab: Tab) => void }) {
  if (!dashboard) return null;
  const pendingOrders = dashboard.orders.byStatus.PENDING_PAYMENT ?? 0;
  return <><div className="adminPageHeading"><div><span className="adminEyebrow">Hoy en la tienda</span><h1>Un vistazo a KI&apos;IBOK</h1><p>Actualizado {formatDate(dashboard.generatedAt, { dateStyle: undefined, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div></div><div className="adminMetrics"><Metric icon={CircleDollarSign} label="Ventas del mes" value={formatMoney(dashboard.revenue.monthCents)} note={`${dashboard.revenue.monthOrders} pedidos pagados`} tone="green" /><Metric icon={ShoppingBag} label="Ventas de hoy" value={formatMoney(dashboard.revenue.todayCents)} note={`${dashboard.revenue.todayOrders} pedidos`} tone="coral" /><Metric icon={Package} label="Pendientes" value={String(pendingOrders)} note="Esperando pago" tone="yellow" /><Metric icon={AlertTriangle} label="Alertas de stock" value={String(dashboard.inventory.openAlerts)} note={`${dashboard.inventory.outOfStock} agotados`} tone="red" /></div><div className="adminDashboardGrid"><section className="adminPanel adminPanel--orders"><div className="adminPanel__heading"><div><span className="adminEyebrow">Actividad</span><h2>Pedidos recientes</h2></div><button onClick={() => onTab('orders')} type="button">Ver todos <ArrowRight size={14} /></button></div><AdminOrdersTable orders={dashboard.recentOrders} compact /></section><section className="adminPanel"><div className="adminPanel__heading"><div><span className="adminEyebrow">Inventario</span><h2>Existencias</h2></div><button onClick={() => onTab('inventory')} type="button">Gestionar <ArrowRight size={14} /></button></div><div className="inventorySummary"><div><strong>{dashboard.inventory.available}</strong><span>Disponibles</span></div><div><strong>{dashboard.inventory.reserved}</strong><span>Reservados</span></div><div><strong>{dashboard.inventory.lowStock}</strong><span>Por agotarse</span></div><div><strong>{dashboard.inventory.outOfStock}</strong><span>Agotados</span></div></div><div className="stockBar"><span style={{ width: `${Math.min(100, (dashboard.inventory.available / Math.max(1, dashboard.inventory.onHand)) * 100)}%` }} /></div><small>{dashboard.inventory.onHand} unidades registradas</small></section></div></>;
}

function ProductsTab({
  refreshKey,
  onCreate,
  onEdit,
  onEditImages,
  onEditPrice,
  request,
  onSuccess,
}: {
  refreshKey: number;
  onCreate: () => void;
  onEdit: (product: AdminProduct) => void;
  onEditImages: (product: AdminProduct) => void;
  onEditPrice: (product: AdminProduct) => void;
  request: AdminRequest;
  onSuccess: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminPage<AdminProduct> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const search = new URLSearchParams({
          page: String(page),
          pageSize: '30',
        });
        if (query.trim()) search.set('search', query.trim());
        setResult(await request<AdminPage<AdminProduct>>(`/admin/products?${search}`));
      } catch (error) {
        window.alert(errorMessage(error));
      } finally {
        setLoading(false);
      }
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [page, query, refreshKey, request]);

  async function toggle(product: AdminProduct, key: 'isFeatured' | 'isNew') {
    try {
      await request(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: !product[key] }),
      });
      onSuccess('Producto actualizado.');
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  const products = result?.data ?? [];
  const pagination = result?.pagination;
  return <>
    <AdminHeading
      eyebrow="Catálogo"
      title="Productos"
      description={`${pagination?.total ?? 0} productos registrados`}
      action={<button className="adminPrimaryButton" onClick={onCreate} type="button"><Plus size={16} /> Nuevo producto</button>}
    />
    <AdminSearch
      value={query}
      onChange={(value) => { setQuery(value); setPage(1); }}
      placeholder="Buscar producto o SKU"
    />
    <div className={`adminTableWrap ${loading ? 'isLoading' : ''}`}>
      <table className="adminTable">
        <thead><tr><th>Producto</th><th>Línea</th><th>Precio</th><th>Stock</th><th>Visibilidad</th><th /></tr></thead>
        <tbody>
          {products.map((product) => {
            const variant = product.variants[0];
            const stock = product.variants.reduce((sum, item) => sum + item.inventoryLevels.reduce((total, level) => total + level.available, 0), 0);
            const image = product.images[0];
            return <tr key={product.id}>
              <td>
                <div className="tablePrimary tablePrimary--product">
                  <span className={image ? 'hasImage' : ''} style={image ? { backgroundImage: `url("${image.url.replace(/"/g, '%22')}")` } : undefined}>
                    {!image && <ShoppingBag size={16} />}
                  </span>
                  <div><strong>{product.name}</strong><small>{variant?.sku ?? product.slug}</small></div>
                </div>
              </td>
              <td><span className="adminTag">{LINE_LABELS[product.line]}</span></td>
              <td><strong>{variant?.catalogPriceCents ? formatMoney(variant.catalogPriceCents) : product.line === 'NEECHE_PASSION' ? '$350' : product.line === 'PREMIUM' ? '$380' : 'Política'}</strong></td>
              <td><span className={stock <= 5 ? 'stockLow' : ''}>{stock} disp.</span></td>
              <td><div className="tableToggles"><button className={product.isFeatured ? 'isActive' : ''} onClick={() => toggle(product, 'isFeatured')} type="button">Destacado</button><button className={product.isNew ? 'isActive' : ''} onClick={() => toggle(product, 'isNew')} type="button">Nuevo</button></div></td>
              <td>
                <div className="adminRowActions">
                  <button aria-label="Gestionar fotografías" className="adminIconButton" onClick={() => onEditImages(product)} title="Gestionar fotografías" type="button"><ImagePlus size={15} /></button>
                  <button aria-label="Editar producto e imágenes" className="adminIconButton" onClick={() => onEdit(product)} title="Editar producto e imágenes" type="button"><Pencil size={15} /></button>
                  <button aria-label="Editar precio" className="adminIconButton" onClick={() => onEditPrice(product)} title="Editar precio" type="button"><Tag size={15} /></button>
                </div>
              </td>
            </tr>;
          })}
          {!loading && !products.length && <tr><td colSpan={6}><div className="adminEmptyState">No encontramos productos con esa búsqueda.</div></td></tr>}
        </tbody>
      </table>
    </div>
    {pagination && pagination.pageCount > 1 && <div className="adminPagination">
      <button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ArrowLeft size={15} /> Anterior</button>
      <span>Página {pagination.page} de {pagination.pageCount}</span>
      <button disabled={page >= pagination.pageCount || loading} onClick={() => setPage((value) => value + 1)} type="button">Siguiente <ArrowRight size={15} /></button>
    </div>}
  </>;
}

function InventoryTab({ inventory, onAdjust }: { inventory: InventoryItem[]; onAdjust: (item: InventoryItem) => void }) {
  const [query, setQuery] = useState(''); const [onlyLow, setOnlyLow] = useState(false); const visible = inventory.filter((item) => (!onlyLow || item.available <= item.lowStockThreshold) && `${item.variant.product.name} ${item.variant.sku}`.toLowerCase().includes(query.toLowerCase()));
  return <><AdminHeading eyebrow="Control de stock" title="Inventario" description={`${inventory.reduce((sum, item) => sum + item.available, 0)} unidades disponibles`} action={<button className={`adminFilterToggle ${onlyLow ? 'isActive' : ''}`} onClick={() => setOnlyLow(!onlyLow)} type="button"><AlertTriangle size={15} /> Poco stock</button>} /><AdminSearch value={query} onChange={setQuery} placeholder="Buscar producto o SKU" /><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Producto</th><th>Ubicación</th><th>Disponible</th><th>Reservado</th><th>Total</th><th>Alerta</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="tablePrimary"><span><Boxes size={16} /></span><div><strong>{item.variant.product.name}</strong><small>{item.variant.sku}</small></div></div></td><td>{item.location.name}</td><td><strong className={item.available <= item.lowStockThreshold ? 'stockLow' : ''}>{item.available}</strong></td><td>{item.reserved}</td><td>{item.onHand}</td><td>{item.available <= item.lowStockThreshold ? <span className="adminStatus adminStatus--danger">Reponer</span> : <span className="adminStatus adminStatus--success">Bien</span>}</td><td><button className="adminSecondaryButton" onClick={() => onAdjust(item)} type="button">Ajustar</button></td></tr>)}</tbody></table></div></>;
}

function OrdersTab({ orders, onShipment, request, onSuccess }: { orders: AdminOrder[]; onShipment: (order: AdminOrder) => void; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const visible = orders.filter((order) =>
    `${order.number} ${order.customerName} ${order.customerEmail}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  async function updateStatus(order: AdminOrder, status: string) {
    try {
      await request(`/admin/orders/${order.publicToken}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onSuccess('Estado del pedido actualizado.');
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  async function confirmCash(order: AdminOrder) {
    if (!window.confirm(`¿Confirmas que recibiste el efectivo de ${order.number}?`)) return;
    try {
      await request(`/admin/orders/${order.publicToken}/confirm-cash`, {
        method: 'POST',
      });
      onSuccess('Pago en efectivo confirmado.');
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  async function openProof(proofId: string) {
    try {
      const result = await request<{ url: string }>(
        `/admin/transfer-proofs/${proofId}/download`,
      );
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  async function reviewProof(
    proofId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const notes =
      status === 'REJECTED'
        ? window.prompt('Indica por qué debe enviar otro comprobante:')?.trim()
        : undefined;
    if (status === 'REJECTED' && !notes) return;
    if (
      status === 'APPROVED' &&
      !window.confirm('¿La transferencia ya aparece abonada por el importe correcto?')
    ) {
      return;
    }
    try {
      await request(`/admin/transfer-proofs/${proofId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
      onSuccess(
        status === 'APPROVED'
          ? 'Transferencia aprobada y pedido confirmado.'
          : 'Comprobante rechazado; el cliente podrá enviar otro.',
      );
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  return (
    <>
      <AdminHeading
        eyebrow="Ventas y entregas"
        title="Pedidos"
        description={`${orders.length} pedidos en el historial`}
      />
      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Buscar folio, cliente o correo"
      />
      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Pago</th>
              <th>Preparación</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => {
              const isTerminal = ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(
                order.status,
              );
              const proof = isTerminal
                ? undefined
                : order.payments
                    ?.flatMap((payment) => payment.transferProofs ?? [])
                    .find((item) => item.status === 'PENDING_REVIEW');
              const canConfirmCash =
                !isTerminal &&
                order.payments?.[0]?.method === 'CASH' &&
                ['PENDING', 'IN_PROCESS'].includes(order.paymentStatus);
              const canCreateShipment =
                order.deliveryMethod !== 'STORE_PICKUP' &&
                order.paymentStatus === 'APPROVED' &&
                ['CONFIRMED', 'PROCESSING', 'READY'].includes(order.status);

              return (
                <tr key={order.publicToken}>
                  <td>
                    <div className="tablePrimary">
                      <span>
                        <Package size={16} />
                      </span>
                      <div>
                        <strong>{order.number}</strong>
                        <small>{formatDate(order.createdAt)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{order.customerName}</strong>
                  </td>
                  <td>
                    <span
                      className={`adminStatus adminStatus--${statusTone(order.paymentStatus)}`}
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <select
                      className="adminInlineSelect"
                      onChange={(event) => updateStatus(order, event.target.value)}
                      value={order.status}
                    >
                      {adminOrderStatusOptions(order).map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABELS[status] ?? status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <strong>{formatMoney(order.totalCents, order.currency)}</strong>
                  </td>
                  <td>
                    <div className="tableActions">
                      {proof && (
                        <>
                          <button
                            className="adminSecondaryButton"
                            onClick={() => openProof(proof.id)}
                            type="button"
                          >
                            <Eye size={14} /> Comprobante
                          </button>
                          <button
                            className="adminSecondaryButton adminSecondaryButton--approve"
                            onClick={() => reviewProof(proof.id, 'APPROVED')}
                            type="button"
                          >
                            <Check size={14} /> Aprobar
                          </button>
                          <button
                            aria-label="Rechazar comprobante"
                            className="adminIconButton adminIconButton--danger"
                            onClick={() => reviewProof(proof.id, 'REJECTED')}
                            title="Rechazar comprobante"
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {canConfirmCash && (
                        <button
                          className="adminSecondaryButton"
                          onClick={() => confirmCash(order)}
                          type="button"
                        >
                          <CircleDollarSign size={14} /> Confirmar efectivo
                        </button>
                      )}
                      {canCreateShipment ? (
                        <button
                          className="adminSecondaryButton"
                          onClick={() => onShipment(order)}
                          type="button"
                        >
                          <Truck size={14} /> Guía
                        </button>
                      ) : order.deliveryMethod === 'STORE_PICKUP' ? (
                        <span className="adminActionNote">
                          <Store size={14} /> Recoger en tienda
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function adminOrderStatusOptions(order: AdminOrder) {
  if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status)) {
    return [order.status];
  }

  const nextByStatus: Record<string, string[]> = {
    PENDING_PAYMENT:
      order.payments?.[0]?.method === 'CASH' ? ['PROCESSING', 'READY'] : [],
    CONFIRMED: ['PROCESSING', 'READY'],
    PROCESSING: ['READY'],
    READY: order.paymentStatus === 'APPROVED' ? ['COMPLETED'] : [],
  };

  return Array.from(
    new Set([order.status, ...(nextByStatus[order.status] ?? []), 'CANCELLED']),
  );
}

function PromotionsTab({ promotions, onCreate, onEdit, request, onSuccess }: { promotions: AdminPromotion[]; onCreate: () => void; onEdit: (promotion: AdminPromotion) => void; request: AdminRequest; onSuccess: (message: string) => void }) {
  async function toggle(item: AdminPromotion) { try { await request(`/admin/promotions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }); onSuccess('Promoción actualizada.'); } catch (error) { window.alert(errorMessage(error)); } }
  return <><AdminHeading eyebrow="Campañas" title="Promociones" description={`${promotions.filter((item) => item.isActive).length} promociones activas`} action={<button className="adminPrimaryButton" onClick={onCreate} type="button"><Plus size={16} /> Nueva promoción</button>} /><div className="promotionAdminGrid">{promotions.map((item) => <article key={item.id}><div><span className="adminTag">{item.placement}</span><div className="promotionAdminGrid__actions"><button aria-label={`Editar ${item.name}`} className="promotionEditButton" onClick={() => onEdit(item)} title="Editar promoción" type="button"><Pencil size={14} /> Editar</button><button className={`adminSwitch ${item.isActive ? 'isActive' : ''}`} aria-label={item.isActive ? 'Desactivar promoción' : 'Activar promoción'} onClick={() => toggle(item)} type="button"><i /></button></div></div><Tag size={21} /><h3>{item.name}</h3><p>{item.description}</p><div><strong>{item.type === 'PERCENTAGE' ? `${item.value}%` : formatMoney(item.value)}</strong>{item.code && <code>{item.code}</code>}</div><small>{formatDate(item.startsAt)} – {item.endsAt ? formatDate(item.endsAt) : 'Sin vencimiento'}</small></article>)}</div></>;
}

function AdminOrdersTable({ orders, compact }: { orders: AdminOrder[]; compact?: boolean }) { return <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>{orders.slice(0, compact ? 8 : orders.length).map((order) => <tr key={order.publicToken}><td><div className="tablePrimary"><span><Package size={15} /></span><div><strong>{order.number}</strong><small>{formatDate(order.createdAt)}</small></div></div></td><td>{order.customerName}</td><td><span className={`adminStatus adminStatus--${statusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span></td><td><strong>{formatMoney(order.totalCents, order.currency)}</strong></td></tr>)}</tbody></table></div>; }

type MediaUploadResponse = {
  asset: { id: string };
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

type CompletedMediaAsset = {
  id: string;
  url: string;
  altText: string | null;
};

function categoryChoices(categories: Category[]) {
  return categories.flatMap((parent) => {
    if (!parent.children?.length) {
      return [{ category: parent, parent: null as Category | null }];
    }
    return parent.children.map((category) => ({ category, parent }));
  });
}

function categorySlugsForSelection(categories: Category[], selectedSlugs: string[]) {
  const selected = new Set(selectedSlugs);
  for (const parent of categories) {
    if (parent.children?.some((child) => selected.has(child.slug))) {
      selected.add(parent.slug);
    }
  }
  return [...selected];
}

function productImagesPayload(images: ProductImage[]) {
  return images.map((image, index) => ({
    url: image.url,
    altText: image.altText.trim() || `Imagen de producto ${index + 1}`,
    isPrimary: image.isPrimary ?? index === 0,
  }));
}

function normalizeProductImages(images: ProductImage[]) {
  if (!images.length) return [];
  const primaryIndex = images.findIndex((image) => image.isPrimary);
  return images.map((image, index) => ({
    ...image,
    isPrimary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
    sortOrder: index,
  }));
}

function ProductImageManager({
  images,
  onChange,
  productName,
  request,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  productName: string;
  request: AdminRequest;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const availableSlots = Math.max(0, 8 - images.length);
    if (!availableSlots) {
      setError('Cada producto admite hasta 8 imágenes.');
      return;
    }

    const selected = Array.from(files).slice(0, availableSlots);
    const invalid = selected.find(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
        file.size > 10 * 1024 * 1024,
    );
    if (invalid) {
      setError('Usa archivos JPG, PNG, WebP o AVIF de máximo 10 MB.');
      return;
    }

    setUploading(true);
    setError('');
    const uploadedImages: ProductImage[] = [];
    try {
      for (const file of selected) {
        const fallbackAlt = productName.trim() || file.name.replace(/\.[^.]+$/, '');
        const presigned = await request<MediaUploadResponse>('/admin/media/presign', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            altText: fallbackAlt,
          }),
        });
        const uploadResponse = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: presigned.requiredHeaders,
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error(`No fue posible subir ${file.name}.`);
        }
        const asset = await request<CompletedMediaAsset>(
          `/admin/media/${presigned.asset.id}/complete`,
          {
            method: 'POST',
            body: JSON.stringify({ altText: fallbackAlt }),
          },
        );
        uploadedImages.push({
          id: asset.id,
          url: asset.url,
          altText: asset.altText || fallbackAlt,
          isPrimary: images.length === 0 && uploadedImages.length === 0,
        });
      }
      onChange(normalizeProductImages([...images, ...uploadedImages]));
    } catch (caught) {
      if (uploadedImages.length) {
        onChange(normalizeProductImages([...images, ...uploadedImages]));
      }
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  }

  function makePrimary(index: number) {
    const next = [images[index], ...images.filter((_, itemIndex) => itemIndex !== index)];
    onChange(next.map((image, itemIndex) => ({ ...image, isPrimary: itemIndex === 0, sortOrder: itemIndex })));
  }

  function remove(index: number) {
    onChange(normalizeProductImages(images.filter((_, itemIndex) => itemIndex !== index)));
  }

  function updateAltText(index: number, altText: string) {
    onChange(images.map((image, itemIndex) => itemIndex === index ? { ...image, altText } : image));
  }

  return <fieldset className="productImageManager">
    <legend>Fotografías del producto</legend>
    <p>Puedes publicar sin imagen y subirla después. La portada aparece primero en el catálogo.</p>
    {images.length > 0 && <div className="productImageGrid">
      {images.map((image, index) => <article className={image.isPrimary ? 'isPrimary' : ''} key={`${image.url}-${index}`}>
        <div
          aria-label={image.altText}
          className="productImageGrid__preview"
          role="img"
          style={{ backgroundImage: `url("${image.url.replace(/"/g, '%22')}")` }}
        />
        <AdminField label="Texto alternativo">
          <input
            maxLength={180}
            onChange={(event) => updateAltText(index, event.target.value)}
            value={image.altText}
          />
        </AdminField>
        <div className="productImageGrid__actions">
          <button
            className={image.isPrimary ? 'isActive' : ''}
            disabled={image.isPrimary}
            onClick={() => makePrimary(index)}
            title="Usar como portada"
            type="button"
          >
            <Star size={14} /> {image.isPrimary ? 'Portada' : 'Hacer portada'}
          </button>
          <button
            aria-label="Eliminar imagen del producto"
            className="isDanger"
            onClick={() => remove(index)}
            title="Eliminar imagen"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>)}
    </div>}
    <label className={`productImageUpload ${uploading ? 'isLoading' : ''}`}>
      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={uploading || images.length >= 8}
        multiple
        onChange={(event) => {
          void upload(event.target.files);
          event.target.value = '';
        }}
        type="file"
      />
      {uploading ? <span className="buttonSpinner" /> : <ImagePlus size={17} />}
      {uploading ? 'Subiendo imágenes…' : images.length >= 8 ? 'Límite de 8 imágenes' : 'Subir imágenes'}
    </label>
    {error && <span className="productImageManager__error">{error}</span>}
  </fieldset>;
}

function ProductForm({ categories, scents, request, onSuccess }: { categories: Category[]; scents: ScentFamily[]; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const choices = categoryChoices(categories);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = Number(form.get('price') || 0);
    const categorySlug = String(form.get('categorySlug') ?? '');
    setSaving(true);
    try {
      await request('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          slug: form.get('slug'),
          name: form.get('name'),
          shortDescription: form.get('shortDescription') || undefined,
          description: form.get('description') || undefined,
          seoTitle: form.get('seoTitle') || undefined,
          seoDescription: form.get('seoDescription') || undefined,
          line: form.get('line'),
          status: form.get('status'),
          brandSlug: form.get('brandSlug') || undefined,
          categorySlugs: categorySlugsForSelection(categories, [categorySlug]),
          scentSlugs: form.getAll('scentSlugs'),
          isFeatured: form.get('isFeatured') === 'on',
          isNew: form.get('isNew') === 'on',
          images: productImagesPayload(images),
          variants: [{
            sku: form.get('sku'),
            name: form.get('variantName'),
            concentrationLabel: form.get('concentrationLabel') || undefined,
            concentrationPercent: form.get('concentrationPercent') ? Number(form.get('concentrationPercent')) : undefined,
            volumeMl: form.get('volumeMl') ? Number(form.get('volumeMl')) : undefined,
            catalogPriceCents: price ? Math.round(price * 100) : undefined,
            initialStock: Number(form.get('initialStock') || 0),
            lowStockThreshold: Number(form.get('lowStockThreshold') || 5),
          }],
        }),
      });
      onSuccess(form.get('status') === 'ACTIVE' ? 'Producto creado y publicado.' : 'Producto guardado como borrador.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <form className="adminForm" onSubmit={submit}>
    <div className="adminFormGrid">
      <AdminField label="Nombre"><input name="name" onChange={(event) => setProductName(event.target.value)} required /></AdminField>
      <AdminField label="Slug"><input name="slug" pattern="[a-z0-9-]+" placeholder="nombre-del-producto" required /></AdminField>
    </div>
    <AdminField label="Descripción corta"><input maxLength={240} name="shortDescription" /></AdminField>
    <AdminField label="Descripción"><textarea name="description" rows={3} /></AdminField>
    <div className="adminFormDivider"><span>Vista previa en buscadores</span></div>
    <AdminField label="Título SEO (opcional)"><input maxLength={70} name="seoTitle" placeholder="Si se deja vacío, se usa el nombre del producto" /></AdminField>
    <AdminField label="Descripción SEO (opcional)"><textarea maxLength={170} name="seoDescription" placeholder="Resumen breve para Google y al compartir el enlace" rows={2} /></AdminField>
    <p className="adminFormHint">Estos textos no cambian la ficha visible del producto; ayudan a presentar mejor su enlace en buscadores y redes.</p>
    <div className="adminFormGrid">
      <AdminField label="Línea"><select name="line" required>{Object.entries(LINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminField>
      <AdminField label="Estado"><select defaultValue="ACTIVE" name="status"><option value="ACTIVE">Publicado</option><option value="DRAFT">Borrador</option></select></AdminField>
      <AdminField label="Marca"><select name="brandSlug"><option value="fraiche">Fraiche</option><option value="neeche">Neeche Passion</option><option value="premium">Premium</option><option value="victorias-secret">Victoria&apos;s Secret</option><option value="arabic-care">Cuidado árabe</option></select></AdminField>
      <AdminField label="Categoría">
        <select name="categorySlug" required>
          {choices.map(({ category, parent }) => <option key={category.id} value={category.slug}>{parent ? `${parent.name} · ${category.name}` : category.name}</option>)}
        </select>
      </AdminField>
    </div>
    <fieldset className="adminCheckGrid"><legend>Familias aromáticas</legend>{scents.map((scent) => <label key={scent.id}><input name="scentSlugs" type="checkbox" value={scent.slug} /><span><Check size={11} /></span>{scent.name}</label>)}</fieldset>
    <ProductImageManager images={images} onChange={setImages} productName={productName} request={request} />
    <div className="adminFormDivider"><span>Variante inicial</span></div>
    <div className="adminFormGrid">
      <AdminField label="SKU"><input name="sku" required /></AdminField>
      <AdminField label="Nombre de variante"><input name="variantName" placeholder="60 ml 37%" required /></AdminField>
      <AdminField label="Concentración"><input name="concentrationLabel" placeholder="Clásica o 37%" /></AdminField>
      <AdminField label="Porcentaje"><input min="0" name="concentrationPercent" step="0.01" type="number" /></AdminField>
      <AdminField label="Volumen ml"><input min="1" name="volumeMl" type="number" /></AdminField>
      <AdminField label="Precio MXN"><input min="0" name="price" step="0.01" type="number" /></AdminField>
      <AdminField label="Existencia inicial"><input defaultValue="0" min="0" name="initialStock" required type="number" /></AdminField>
      <AdminField label="Avisar cuando queden"><input defaultValue="5" min="0" name="lowStockThreshold" type="number" /></AdminField>
    </div>
    <div className="adminFormChecks"><label><input name="isFeatured" type="checkbox" /> Destacado</label><label><input name="isNew" type="checkbox" /> Novedad</label></div>
    <button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><FilePlus2 size={16} /> Crear producto</>}</button>
  </form>;
}

function ProductEditForm({
  product,
  categories,
  scents,
  request,
  onSuccess,
}: {
  product: AdminProduct;
  categories: Category[];
  scents: ScentFamily[];
  request: AdminRequest;
  onSuccess: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState(product.name);
  const [images, setImages] = useState<ProductImage[]>(normalizeProductImages(product.images));
  const choices = categoryChoices(categories);
  const selectedCategories = new Set(product.categories.map((item) => item.category.slug));
  const selectedScents = new Set(product.scentFamilies.map((item) => item.scentFamily.slug));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedCategorySlugs = form.getAll('categorySlugs').map(String);
    if (!selectedCategorySlugs.length) {
      window.alert('Selecciona al menos una categoría.');
      return;
    }

    setSaving(true);
    try {
      await request(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.get('name'),
          shortDescription: form.get('shortDescription') || '',
          description: form.get('description') || '',
          seoTitle: String(form.get('seoTitle') ?? '').trim() || null,
          seoDescription: String(form.get('seoDescription') ?? '').trim() || null,
          status: form.get('status'),
          categorySlugs: categorySlugsForSelection(categories, selectedCategorySlugs),
          scentSlugs: form.getAll('scentSlugs'),
          isFeatured: form.get('isFeatured') === 'on',
          isNew: form.get('isNew') === 'on',
          images: productImagesPayload(images),
        }),
      });
      onSuccess('Producto, categorías e imágenes actualizados.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <form className="adminForm" onSubmit={submit}>
    <div className="adminFormContext"><Pencil size={19} /><div><strong>{product.name}</strong><small>{product.variants[0]?.sku ?? product.slug} · {LINE_LABELS[product.line]}</small></div></div>
    <div className="adminFormGrid">
      <AdminField label="Nombre"><input defaultValue={product.name} name="name" onChange={(event) => setProductName(event.target.value)} required /></AdminField>
      <AdminField label="Estado"><select defaultValue={product.status} name="status"><option value="ACTIVE">Publicado</option><option value="DRAFT">Borrador</option><option value="ARCHIVED">Archivado</option></select></AdminField>
    </div>
    <AdminField label="Descripción corta"><input defaultValue={product.shortDescription ?? ''} maxLength={240} name="shortDescription" /></AdminField>
    <AdminField label="Descripción"><textarea defaultValue={product.description ?? ''} name="description" rows={4} /></AdminField>
    <div className="adminFormDivider"><span>Vista previa en buscadores</span></div>
    <AdminField label="Título SEO (opcional)"><input defaultValue={product.seoTitle ?? ''} maxLength={70} name="seoTitle" placeholder="Si se deja vacío, se usa el nombre del producto" /></AdminField>
    <AdminField label="Descripción SEO (opcional)"><textarea defaultValue={product.seoDescription ?? ''} maxLength={170} name="seoDescription" placeholder="Resumen breve para Google y al compartir el enlace" rows={2} /></AdminField>
    <p className="adminFormHint">Puedes personalizar cómo se presenta este producto en Google y redes sin modificar el texto que ve el cliente dentro de la ficha.</p>
    <fieldset className="adminCheckGrid adminCheckGrid--categories">
      <legend>Categorías</legend>
      {choices.map(({ category, parent }) => <label key={category.id}><input defaultChecked={selectedCategories.has(category.slug)} name="categorySlugs" type="checkbox" value={category.slug} /><span><Check size={11} /></span>{parent ? `${parent.name} · ${category.name}` : category.name}</label>)}
    </fieldset>
    <fieldset className="adminCheckGrid"><legend>Familias aromáticas</legend>{scents.map((scent) => <label key={scent.id}><input defaultChecked={selectedScents.has(scent.slug)} name="scentSlugs" type="checkbox" value={scent.slug} /><span><Check size={11} /></span>{scent.name}</label>)}</fieldset>
    <ProductImageManager images={images} onChange={setImages} productName={productName} request={request} />
    <div className="adminFormChecks"><label><input defaultChecked={product.isFeatured} name="isFeatured" type="checkbox" /> Destacado</label><label><input defaultChecked={product.isNew} name="isNew" type="checkbox" /> Novedad</label></div>
    <button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><Check size={16} /> Guardar producto</>}</button>
  </form>;
}

function ProductImagesForm({
  product,
  request,
  onSuccess,
}: {
  product: AdminProduct;
  request: AdminRequest;
  onSuccess: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<ProductImage[]>(normalizeProductImages(product.images));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await request(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: productImagesPayload(images) }),
      });
      onSuccess('Fotografías del producto actualizadas.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <form className="adminForm" onSubmit={submit}>
    <div className="adminFormContext">
      <ImagePlus size={19} />
      <div>
        <strong>{product.name}</strong>
        <small>{product.variants[0]?.sku ?? product.slug} · {images.length} de 8 fotografías</small>
      </div>
    </div>
    <ProductImageManager images={images} onChange={setImages} productName={product.name} request={request} />
    <button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">
      {saving ? <span className="buttonSpinner" /> : <><Check size={16} /> Guardar fotografías</>}
    </button>
  </form>;
}

function InventoryForm({ item, request, onSuccess }: { item: InventoryItem; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await request(`/admin/inventory/${item.variant.id}`, { method: 'PATCH', body: JSON.stringify({ onHand: Number(form.get('onHand')), lowStockThreshold: Number(form.get('lowStockThreshold')), reason: form.get('reason') }) }); onSuccess('Inventario actualizado y movimiento registrado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Boxes size={19} /><div><strong>{item.variant.product.name}</strong><small>{item.variant.sku} · {item.available} disponibles · {item.reserved} reservados</small></div></div><AdminField label="Existencia total"><input defaultValue={item.onHand} min={item.reserved} name="onHand" required type="number" /></AdminField><AdminField label="Umbral de poco stock"><input defaultValue={item.lowStockThreshold} min="0" name="lowStockThreshold" required type="number" /></AdminField><AdminField label="Motivo"><textarea maxLength={300} name="reason" placeholder="Compra a proveedor, ajuste de conteo..." required rows={3} /></AdminField><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Guardar inventario'}</button></form>; }

function PriceForm({ product, request, onSuccess }: { product: AdminProduct; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const variantId = String(form.get('variantId')); const price = Number(form.get('price')); setSaving(true); try { await request(`/admin/variants/${variantId}`, { method: 'PATCH', body: JSON.stringify({ catalogPriceCents: Math.round(price * 100) }) }); onSuccess('Precio actualizado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Tag size={19} /><div><strong>{product.name}</strong><small>{LINE_LABELS[product.line]}</small></div></div><AdminField label="Variante"><select name="variantId">{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.sku}</option>)}</select></AdminField><AdminField label="Nuevo precio MXN"><input defaultValue={(product.variants[0]?.catalogPriceCents ?? 0) / 100} min="0" name="price" required step="0.01" type="number" /></AdminField><p className="adminFormHint">Neeche Passion y Premium toman el precio fijo de su política de línea.</p><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : 'Actualizar precio'}</button></form>; }

function toDateTimeLocal(value: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function normalizeSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function PromotionForm({ promotion, request, onSuccess }: { promotion?: AdminPromotion; request: AdminRequest; onSuccess: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const defaultStart = toDateTimeLocal(promotion?.startsAt ?? new Date(Date.now() + 15 * 60_000));
  const defaultEnd = promotion
    ? toDateTimeLocal(promotion.endsAt)
    : toDateTimeLocal(new Date(Date.now() + 30 * 86400000));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type'));
    const startsAt = new Date(String(form.get('startsAt')));
    const rawEndsAt = String(form.get('endsAt') ?? '').trim();
    const endsAt = rawEndsAt ? new Date(rawEndsAt) : null;
    if (endsAt && endsAt <= startsAt) {
      window.alert('La fecha de término debe ser posterior al inicio.');
      return;
    }

    const enteredValue = Number(form.get('value'));
    const code = String(form.get('code') ?? '').trim();
    const payload = {
      slug: form.get('slug'),
      code: code || (promotion ? '' : undefined),
      name: form.get('name'),
      description: String(form.get('description') ?? '').trim(),
      type,
      value: type === 'FIXED_AMOUNT' ? Math.round(enteredValue * 100) : Math.round(enteredValue),
      minimumCents: Math.round(Number(form.get('minimum') || 0) * 100),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      placement: form.get('placement'),
      isActive: form.get('isActive') === 'on',
      isFeatured: form.get('isFeatured') === 'on',
      requiresCode: Boolean(code),
      isStackable: form.get('isStackable') === 'on',
      priority: Number(form.get('priority') || 0),
    };

    setSaving(true);
    try {
      await request(promotion ? `/admin/promotions/${promotion.id}` : '/admin/promotions', {
        method: promotion ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess(promotion ? 'Promoción actualizada.' : 'Promoción publicada.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const displayValue = promotion
    ? promotion.type === 'FIXED_AMOUNT' ? promotion.value / 100 : promotion.value
    : '';

  return <form className="adminForm" onSubmit={submit}>
    {promotion && <div className="adminFormContext"><Pencil size={19} /><div><strong>{promotion.name}</strong><small>{promotion.uses} usos registrados</small></div></div>}
    <div className="adminFormGrid"><AdminField label="Nombre"><input defaultValue={promotion?.name} name="name" required /></AdminField><AdminField label="Slug"><input defaultValue={promotion ? normalizeSlug(promotion.slug) : ''} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></AdminField></div>
    <AdminField label="Descripción"><textarea defaultValue={promotion?.description ?? ''} maxLength={500} name="description" rows={3} /></AdminField>
    <div className="adminFormGrid">
      <AdminField label="Tipo"><select defaultValue={promotion?.type ?? 'PERCENTAGE'} name="type"><option value="PERCENTAGE">Porcentaje</option><option value="FIXED_AMOUNT">Monto fijo MXN</option></select></AdminField>
      <AdminField label="Valor"><input defaultValue={displayValue} min="1" name="value" required step="0.01" type="number" /></AdminField>
      <AdminField label="Código opcional"><input defaultValue={promotion?.code ?? ''} maxLength={60} name="code" /></AdminField>
      <AdminField label="Compra mínima MXN"><input defaultValue={(promotion?.minimumCents ?? 0) / 100} min="0" name="minimum" step="0.01" type="number" /></AdminField>
      <AdminField label="Ubicación"><select defaultValue={promotion?.placement ?? 'GENERAL'} name="placement"><option value="GENERAL">General</option><option value="DAILY">Oferta del día</option><option value="MONTHLY">Oferta del mes</option><option value="FLASH">Flash</option><option value="WELCOME">Bienvenida</option></select></AdminField>
      <AdminField label="Prioridad"><input defaultValue={promotion?.priority ?? 0} name="priority" type="number" /></AdminField>
      <AdminField label="Inicia"><input defaultValue={defaultStart} name="startsAt" required type="datetime-local" /></AdminField>
      <AdminField label="Termina (opcional)"><input defaultValue={defaultEnd} name="endsAt" type="datetime-local" /></AdminField>
    </div>
    <p className="adminFormHint">Deja la fecha de término vacía para una promoción permanente.</p>
    <div className="adminFormChecks"><label><input defaultChecked={promotion?.isActive ?? true} name="isActive" type="checkbox" /> Activa</label><label><input defaultChecked={promotion?.isFeatured} name="isFeatured" type="checkbox" /> Destacada</label><label><input defaultChecked={promotion?.isStackable} name="isStackable" type="checkbox" /> Acumulable</label></div>
    <button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><Send size={15} /> {promotion ? 'Guardar cambios' : 'Publicar promoción'}</>}</button>
  </form>;
}

function ShipmentForm({ order, request, onSuccess }: { order: AdminOrder; request: AdminRequest; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); try { await request(`/admin/orders/${order.publicToken}/shipments`, { method: 'POST', body: JSON.stringify({ carrier: form.get('carrier'), service: form.get('service') || undefined, trackingNumber: form.get('trackingNumber'), trackingUrl: form.get('trackingUrl') || undefined, status: 'LABEL_CREATED', estimatedDeliveryAt: form.get('estimatedDeliveryAt') ? new Date(String(form.get('estimatedDeliveryAt'))).toISOString() : undefined, notes: form.get('notes') || undefined }) }); onSuccess('Guía registrada y cliente notificado.'); } catch (error) { window.alert(errorMessage(error)); } finally { setSaving(false); } } return <form className="adminForm" onSubmit={submit}><div className="adminFormContext"><Truck size={19} /><div><strong>{order.number}</strong><small>{order.customerName} · {formatMoney(order.totalCents, order.currency)}</small></div></div><div className="adminFormGrid"><AdminField label="Paquetería"><input name="carrier" placeholder="DHL, Estafeta..." required /></AdminField><AdminField label="Servicio"><input name="service" placeholder="Express" /></AdminField></div><AdminField label="Código de rastreo"><input name="trackingNumber" required /></AdminField><AdminField label="URL HTTPS de seguimiento"><input name="trackingUrl" placeholder="https://..." type="url" /></AdminField><AdminField label="Entrega estimada"><input name="estimatedDeliveryAt" type="datetime-local" /></AdminField><AdminField label="Notas internas"><textarea maxLength={500} name="notes" rows={3} /></AdminField><button className="adminPrimaryButton adminPrimaryButton--wide" disabled={saving} type="submit">{saving ? <span className="buttonSpinner" /> : <><Truck size={15} /> Registrar guía</>}</button></form>; }

function AdminModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="adminModal"><button aria-label="Cerrar" className="adminModal__backdrop" onClick={onClose} type="button" /><section><header><div><span className="adminEyebrow">Operación segura</span><h2>{title}</h2></div><button aria-label="Cerrar" onClick={onClose} type="button"><X size={19} /></button></header>{children}</section></div>; }
function AdminHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="adminPageHeading"><div><span className="adminEyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="adminSearch"><Search size={16} /><input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />{value && <button aria-label="Limpiar" onClick={() => onChange('')} type="button"><X size={14} /></button>}</label>; }
function AdminField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="adminField"><span>{label}</span>{children}</label>; }
function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof BarChart3; label: string; value: string; note: string; tone: string }) { return <article className={`adminMetric adminMetric--${tone}`}><span><Icon size={19} /></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>; }
function AdminLoading() { return <div className="adminLoading"><span /><div>{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><b /></div>; }
function modalTitle(modal: string) { return ({ product: 'Nuevo producto', 'product-edit': 'Editar producto', 'product-images': 'Fotografías del producto', inventory: 'Ajustar inventario', promotion: 'Nueva promoción', 'promotion-edit': 'Editar promoción', shipment: 'Registrar guía', price: 'Actualizar precio' } as Record<string, string>)[modal] ?? 'Administrar'; }
