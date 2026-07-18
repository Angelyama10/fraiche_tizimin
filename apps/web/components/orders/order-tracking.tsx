'use client';

import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock3, ExternalLink, FileUp, MapPin, MessageCircle, Package, PackageCheck, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { FULFILLMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, SHIPMENT_STATUS_LABELS, statusTone } from '@/lib/status';
import type { Order } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';

const timeline = [
  { id: 'UNFULFILLED', label: 'Pedido recibido', icon: Clock3 },
  { id: 'PREPARING', label: 'Preparando', icon: Package },
  { id: 'SHIPPED', label: 'En camino', icon: Truck },
  { id: 'DELIVERED', label: 'Entregado', icon: PackageCheck },
];

export function OrderTracking({ orderToken }: { orderToken: string }) {
  const auth = useAuth();
  const notify = useNotify();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [instruction, setInstruction] = useState<{ title: string; instructions: string } | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    try {
      const next = await auth.request<Order>(`/orders/${orderToken}`);
      setOrder(next);
      if (next.paymentMethod === 'BANK_TRANSFER' || next.paymentMethod === 'CASH') {
        apiRequest<{ title: string; instructions: string }>(`/payments/instructions/${next.paymentMethod}`, { cache: 'no-store' }).then(setInstruction).catch(() => undefined);
      }
    } catch (error) {
      notify({ title: 'No pudimos abrir el pedido', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [auth, orderToken, notify]);

  useEffect(() => { if (auth.status !== 'loading') void load(); }, [auth.status, load]);

  async function openPayment() {
    if (!order) return;
    setPaying(true);
    try {
      const result = await auth.request<{ checkoutUrl: string }>(`/payments/mercado-pago/orders/${order.publicToken}/preference`, { method: 'POST' });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      notify({ title: 'No pudimos abrir Mercado Pago', description: errorMessage(error), tone: 'error' });
    } finally { setPaying(false); }
  }

  async function uploadProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !order) return;
    setUploading(true);
    try {
      const presigned = await auth.request<{ uploadUrl: string; objectKey: string; fileUrl: string; requiredHeaders: Record<string, string> }>('/uploads/transfer-proofs/presign', { method: 'POST', body: JSON.stringify({ orderToken: order.publicToken, fileName: file.name, contentType: file.type, sizeBytes: file.size }) });
      const upload = await fetch(presigned.uploadUrl, { method: 'PUT', body: file, headers: presigned.requiredHeaders });
      if (!upload.ok) throw new Error('El almacenamiento rechazó el archivo.');
      await auth.request(`/payments/orders/${order.publicToken}/transfer-proof`, { method: 'POST', body: JSON.stringify({ objectKey: presigned.objectKey, fileUrl: presigned.fileUrl, fileName: file.name, mimeType: file.type, sizeBytes: file.size }) });
      notify({ title: 'Comprobante enviado', description: 'La tienda lo revisará para confirmar tu pago.', tone: 'success' });
      await load();
    } catch (error) {
      notify({ title: 'No pudimos subir el comprobante', description: errorMessage(error), tone: 'error' });
    } finally { setUploading(false); event.target.value = ''; }
  }

  async function contact() {
    try { const result = await apiRequest<{ url: string }>(`/contact/whatsapp?orderToken=${encodeURIComponent(orderToken)}`, { cache: 'no-store' }); window.open(result.url, '_blank', 'noopener,noreferrer'); } catch (error) { notify({ title: 'WhatsApp no disponible', description: errorMessage(error), tone: 'error' }); }
  }

  async function cancel() {
    if (!order || !window.confirm('¿Deseas cancelar este pedido?')) return;
    try { const next = await auth.request<Order>(`/orders/${order.publicToken}/cancel`, { method: 'POST' }); setOrder(next); notify({ title: 'Pedido cancelado', tone: 'success' }); } catch (error) { notify({ title: 'No pudimos cancelarlo', description: errorMessage(error), tone: 'error' }); }
  }

  if (auth.status === 'loading' || loading) return <main className="orderLoading"><span className="buttonSpinner" /> Consultando tu pedido...</main>;
  if (auth.status !== 'authenticated') return <main className="orderAuth pageWidth"><Package size={28} /><h1>Entra para ver este pedido.</h1><p>El seguimiento está protegido dentro de tu cuenta.</p><Link className="button button--dark" href={`/cuenta?redirect=${encodeURIComponent(`/pedidos/${orderToken}`)}`}>Entrar a mi cuenta <ArrowRight size={17} /></Link></main>;
  if (!order) return <main className="orderAuth pageWidth"><AlertCircle size={28} /><h1>No encontramos este pedido.</h1><Link className="button button--dark" href="/cuenta?tab=pedidos">Volver a mis pedidos</Link></main>;

  const shipment = order.shipments?.[0];
  const currentIndex = Math.max(0, timeline.findIndex((step) => step.id === order.fulfillmentStatus));
  const isPickup = order.deliveryMethod === 'STORE_PICKUP';

  return <main className="orderPage"><div className="orderPage__top pageWidth"><Link href="/cuenta?tab=pedidos"><ArrowLeft size={15} /> Mis pedidos</Link><button onClick={contact} type="button"><MessageCircle size={16} /> Ayuda por WhatsApp</button></div><header className="orderHero"><div className="pageWidth"><div><span className="eyebrow">Pedido {order.number}</span><h1>{ORDER_STATUS_LABELS[order.status] ?? order.status}</h1><p>Realizado el {formatDate(order.createdAt, { dateStyle: 'long' })}</p></div><div><Status status={order.paymentStatus} label={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} /><strong>{formatMoney(order.totalCents, order.currency)}</strong></div></div></header><div className="orderLayout pageWidth"><div className="orderMain"><section className="trackingSection"><div className="orderSectionHeading"><span className="eyebrow">Seguimiento</span><h2>{isPickup ? 'Preparación en tienda' : FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus] ?? 'Estado de entrega'}</h2></div><div className="trackingTimeline">{timeline.map((step, index) => { const Icon = step.icon; const active = index <= currentIndex || order.fulfillmentStatus === 'DELIVERED'; return <div className={active ? 'isActive' : ''} key={step.id}><span><Icon size={18} /></span><strong>{isPickup && step.id === 'SHIPPED' ? 'Listo para recoger' : step.label}</strong>{index < timeline.length - 1 && <i />}</div>; })}</div>{shipment && <div className="shipmentBox"><div><Truck size={19} /><span><small>{shipment.carrier}</small><strong>{shipment.trackingNumber}</strong></span><Status status={shipment.status} label={SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status} /></div>{shipment.trackingUrl && <a href={shipment.trackingUrl} rel="noreferrer" target="_blank">Seguir en la paquetería <ExternalLink size={15} /></a>}{shipment.events?.length > 0 && <ol>{shipment.events.map((event) => <li key={event.id}><span /><div><strong>{event.title}</strong><small>{event.location ? `${event.location} · ` : ''}{formatDate(event.occurredAt, { dateStyle: undefined, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>{event.description && <p>{event.description}</p>}</div></li>)}</ol>}</div>}</section><section className="orderProducts"><div className="orderSectionHeading"><span className="eyebrow">Tu selección</span><h2>Productos</h2></div>{order.items.map((item) => <article key={item.id}><div>{item.imageUrl ? <Image alt={item.productName} fill sizes="74px" src={item.imageUrl} unoptimized /> : <Package size={20} />}</div><span><strong>{item.productName}</strong><small>{item.variantName} · Cantidad {item.quantity}</small></span><b>{formatMoney(item.lineTotalCents, order.currency)}</b></article>)}</section></div><aside className="orderAside"><div className="orderPayment"><span className="eyebrow">Pago</span><h2>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</h2>{instruction && <p>{instruction.instructions}</p>}{['CARD', 'PAYMENT_LINK'].includes(order.paymentMethod) && order.paymentStatus !== 'APPROVED' && <button className="button button--coral button--wide" disabled={paying} onClick={openPayment} type="button">{paying ? <span className="buttonSpinner" /> : <>Continuar pago <ExternalLink size={16} /></>}</button>}{order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus !== 'APPROVED' && <label className="uploadProof"><FileUp size={18} /><span><strong>{uploading ? 'Subiendo...' : 'Subir comprobante'}</strong><small>JPG, PNG, WebP o PDF · máx. 10 MB</small></span><input accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={uploadProof} type="file" /></label>}</div>{order.shippingAddress && <div className="orderAddress"><MapPin size={18} /><span className="eyebrow">Entrega</span><h3>{String(order.shippingAddress.recipientName ?? '')}</h3><p>{String(order.shippingAddress.street ?? '')} {String(order.shippingAddress.exteriorNumber ?? '')}<br />{String(order.shippingAddress.neighborhood ?? '')}, {String(order.shippingAddress.city ?? '')}</p></div>}<div className="orderTotals"><span><small>Subtotal</small><strong>{formatMoney(order.subtotalCents, order.currency)}</strong></span>{order.discountCents > 0 && <span><small>Descuento</small><strong>− {formatMoney(order.discountCents, order.currency)}</strong></span>}<span><small>Total</small><strong>{formatMoney(order.totalCents, order.currency)}</strong></span></div>{order.status === 'PENDING_PAYMENT' && <button className="cancelOrder" onClick={cancel} type="button">Cancelar pedido</button>}</aside></div></main>;
}

function Status({ status, label }: { status: string; label: string }) { return <span className={`statusBadge statusBadge--${statusTone(status)}`}>{label}</span>; }
