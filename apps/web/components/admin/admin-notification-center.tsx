'use client';

import { Bell, BellRing, Check, Package, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate, formatMoney } from '@/lib/format';

type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type OrderNotification = {
  id: string;
  type: 'ORDER_CREATED';
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  order: {
    publicToken: string;
    number: string;
    customerName: string;
    totalCents: number;
    currency: string;
    paymentStatus: string;
    status: string;
  } | null;
};

type NotificationFeed = {
  data: OrderNotification[];
  unreadCount: number;
};

const POLL_INTERVAL_MS = 15_000;
const NOTIFIED_KEY = 'kiibok_admin_notified_orders';

export function AdminNotificationCenter({
  request,
  onOpenOrders,
  onNewOrder,
}: {
  request: AdminRequest;
  onOpenOrders: () => void;
  onNewOrder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<NotificationFeed>({ data: [], unreadCount: 0 });
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const firstLoad = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await request<NotificationFeed>('/admin/notifications?page=1&pageSize=20');
      const notified = new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'));
      const fresh = firstLoad.current
        ? []
        : next.data.filter((item) => !item.readAt && !notified.has(item.id));

      if (fresh.length) {
        onNewOrder();
        for (const item of fresh) {
          notified.add(item.id);
          if (Notification.permission === 'granted') {
            new Notification(item.title, {
              body: item.message,
              icon: '/images/brand/kiibok-emblem.png',
              tag: item.id,
            });
          }
        }
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified].slice(-100)));
      }

      firstLoad.current = false;
      setFeed(next);
    } catch {
      // The rest of the admin workspace remains usable if a polling request fails.
    }
  }, [onNewOrder, request]);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  async function enableBrowserNotifications() {
    if (!('Notification' in window)) return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  async function markRead(item: OrderNotification) {
    if (!item.readAt) {
      setFeed((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),
        data: current.data.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      }));
      await request(`/admin/notifications/${item.id}/read`, { method: 'PATCH' });
    }
    setOpen(false);
    onOpenOrders();
  }

  async function markAllRead() {
    setFeed((current) => ({
      unreadCount: 0,
      data: current.data.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    }));
    await request('/admin/notifications/read-all', { method: 'PATCH' });
  }

  return (
    <div className="adminNotificationCenter" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={`Notificaciones${feed.unreadCount ? `, ${feed.unreadCount} sin leer` : ''}`}
        className={feed.unreadCount ? 'hasUnread' : ''}
        onClick={() => setOpen((value) => !value)}
        title="Notificaciones"
        type="button"
      >
        {feed.unreadCount ? <BellRing size={18} /> : <Bell size={18} />}
        {feed.unreadCount > 0 && <b>{feed.unreadCount > 99 ? '99+' : feed.unreadCount}</b>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-label="Notificaciones administrativas"
            className="adminNotificationPanel"
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <header>
              <div><span>Actividad</span><strong>Pedidos nuevos</strong></div>
              <button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} type="button"><X size={16} /></button>
            </header>

            {permission === 'default' && (
              <button className="adminNotificationPermission" onClick={enableBrowserNotifications} type="button">
                <BellRing size={16} />
                <span><strong>Activar avisos del navegador</strong><small>Recíbelos mientras el panel esté abierto.</small></span>
              </button>
            )}

            <div className="adminNotificationList">
              {feed.data.length ? feed.data.map((item) => (
                <button className={item.readAt ? '' : 'isUnread'} key={item.id} onClick={() => void markRead(item)} type="button">
                  <span className="adminNotificationIcon"><Package size={17} /></span>
                  <span>
                    <strong>{item.order?.number ?? item.title}</strong>
                    <small>{item.order?.customerName ?? item.message}</small>
                    <time>{formatDate(item.createdAt, { dateStyle: undefined, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                  </span>
                  <span>
                    {item.order && <b>{formatMoney(item.order.totalCents, item.order.currency)}</b>}
                    {!item.readAt && <i />}
                  </span>
                </button>
              )) : (
                <div className="adminNotificationEmpty"><Check size={22} /><strong>Todo al día</strong><span>Los pedidos nuevos aparecerán aquí.</span></div>
              )}
            </div>

            {feed.unreadCount > 0 && <button className="adminNotificationReadAll" onClick={() => void markAllRead()} type="button"><Check size={15} /> Marcar todas como leídas</button>}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
