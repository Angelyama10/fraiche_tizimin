import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountExperience } from '@/components/account/account-experience';
import './cuenta.css';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <Suspense fallback={<div className="accountLoading pageWidth"><span className="buttonSpinner" /> Preparando tu cuenta...</div>}><AccountExperience /></Suspense>;
}
