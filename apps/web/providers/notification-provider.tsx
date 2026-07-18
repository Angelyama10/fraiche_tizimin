'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
};

type NotifyInput = Omit<Toast, 'id'>;

const NotificationContext = createContext<(toast: NotifyInput) => void>(() => undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((input: NotifyInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...input, id }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? XCircle : Info;
            return (
              <motion.div
                className={`toast toast--${toast.tone}`}
                key={toast.id}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
              >
                <Icon aria-hidden="true" size={20} />
                <div>
                  <strong>{toast.title}</strong>
                  {toast.description && <p>{toast.description}</p>}
                </div>
                <button
                  aria-label="Cerrar aviso"
                  className="iconButton iconButton--small"
                  onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotificationContext);
}
