import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, MailCheck } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/api';
import './verificar-correo.css';

export const metadata: Metadata = {
  title: 'Verificar correo',
  robots: { index: false, follow: false },
};

type VerificationState =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyToken(token);
  const success = result.status === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <main className="verifyEmailPage">
      <section className="verifyEmailPanel">
        <span className={success ? 'verifyEmailIcon isSuccess' : 'verifyEmailIcon isError'}>
          <Icon aria-hidden="true" size={34} />
        </span>
        <span className="eyebrow">Cuenta KI&apos;IBOK</span>
        <h1>{success ? 'Correo verificado.' : 'No pudimos verificar este enlace.'}</h1>
        <p>{result.message}</p>
        <div className="verifyEmailActions">
          <Link className="button button--dark button--large" href="/cuenta">
            Ir a mi cuenta <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <Link className="button button--ghost button--large" href="/productos">
            Ver productos
          </Link>
        </div>
        {!success && (
          <div className="verifyEmailHint">
            <MailCheck aria-hidden="true" size={18} />
            <span>También puedes entrar a tu cuenta y solicitar un nuevo correo de verificación.</span>
          </div>
        )}
      </section>
    </main>
  );
}

async function verifyToken(token?: string): Promise<VerificationState> {
  if (!token) {
    return {
      status: 'error',
      message: 'El enlace no incluye token de verificación.',
    };
  }

  try {
    await apiRequest('/customer-auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    return {
      status: 'success',
      message: 'Ya puedes completar compras, recibir avisos de pedidos y seguir tus entregas.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: errorMessage(error),
    };
  }
}
