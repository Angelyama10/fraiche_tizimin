'use client';

import { AuthGateway } from './auth-gateway';
import { CustomerDashboard } from './customer-dashboard';
import { useAuth } from '@/providers/auth-provider';

export function AccountExperience() {
  const { status } = useAuth();
  if (status === 'loading') return <main className="accountLoading pageWidth"><span className="buttonSpinner" /> Preparando tu cuenta...</main>;
  return status === 'authenticated' ? <CustomerDashboard /> : <AuthGateway />;
}
