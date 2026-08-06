import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailExperience } from '@/components/account/verify-email-experience';
import './verificar-correo.css';

export const metadata: Metadata = {
  title: 'Verificar correo',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="verifyEmailPage">
          <section className="verifyEmailPanel">
            <span className="buttonSpinner verifyEmailSpinner" />
            <p>Preparando la verificación...</p>
          </section>
        </main>
      }
    >
      <VerifyEmailExperience />
    </Suspense>
  );
}
