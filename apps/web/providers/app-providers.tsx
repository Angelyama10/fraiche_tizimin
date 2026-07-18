'use client';

import { AuthProvider } from './auth-provider';
import { CartProvider } from './cart-provider';
import { NotificationProvider } from './notification-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
