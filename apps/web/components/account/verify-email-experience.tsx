'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mail,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import type { CustomerProfile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';

type VerificationState = 'pending' | 'verifying' | 'success' | 'error';

export function VerifyEmailExperience() {
  const auth = useAuth();
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const destination = safeDestination(searchParams.get('redirect'));
  const startedToken = useRef<string | null>(null);
  const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState(
    token
      ? 'Estamos confirmando tu enlace seguro.'
      : 'Te enviamos un enlace. Ábrelo desde tu correo para activar las compras.',
  );
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token || startedToken.current === token) return;
    startedToken.current = token;

    void apiRequest('/customer-auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
      .then(async () => {
        await auth.refreshSession();
        setState('success');
        setMessage('Tu correo quedó verificado. Ya puedes comprar y seguir tus pedidos.');
      })
      .catch((error) => {
        setState('error');
        setMessage(errorMessage(error));
      });
  }, [auth, token]);

  async function resend() {
    if (auth.status !== 'authenticated') {
      router.push(`/cuenta?redirect=${encodeURIComponent('/verificar-correo')}`);
      return;
    }

    setResending(true);
    try {
      const result = await auth.request<{ emailVerified?: boolean }>(
        '/customer-auth/resend-verification',
        { method: 'POST' },
      );
      if (result.emailVerified) {
        await auth.refreshSession();
        setState('success');
        setMessage('Tu correo ya estaba verificado. Puedes continuar.');
        return;
      }
      notify({
        title: 'Correo enviado',
        description: 'Revisa también Promociones o Spam. El enlace vence en 24 horas.',
        tone: 'success',
      });
      setMessage('Enviamos un enlace nuevo. Puede tardar unos segundos en llegar.');
    } catch (error) {
      notify({
        title: 'No pudimos reenviar el correo',
        description: errorMessage(error),
        tone: 'error',
      });
    } finally {
      setResending(false);
    }
  }

  async function checkVerification() {
    if (auth.status !== 'authenticated') {
      router.push(`/cuenta?redirect=${encodeURIComponent('/verificar-correo')}`);
      return;
    }

    setChecking(true);
    try {
      const profile = await auth.request<CustomerProfile>('/customers/me');
      if (!profile.emailVerifiedAt) {
        notify({
          title: 'Aún falta confirmar',
          description: 'Abre el enlace que enviamos a tu correo.',
          tone: 'info',
        });
        return;
      }
      await auth.refreshSession();
      setState('success');
      setMessage('Tu correo quedó verificado. Ya puedes continuar con tu compra.');
    } catch (error) {
      notify({
        title: 'No pudimos comprobar la cuenta',
        description: errorMessage(error),
        tone: 'error',
      });
    } finally {
      setChecking(false);
    }
  }

  const content = verificationContent(state);
  const Icon = content.icon;

  return (
    <main className="verifyEmailPage">
      <section className="verifyEmailPanel">
        <span className={`verifyEmailIcon ${content.className}`}>
          {state === 'verifying' ? (
            <span className="buttonSpinner verifyEmailSpinner" />
          ) : (
            <Icon aria-hidden="true" size={34} />
          )}
        </span>
        <span className="eyebrow">Cuenta KI&apos;IBOK</span>
        <h1>{content.title}</h1>
        <p>{message}</p>
        {auth.customer?.email && state === 'pending' && (
          <p className="verifyEmailAddress">
            <Mail aria-hidden="true" size={16} />
            {auth.customer.email}
          </p>
        )}

        <div className="verifyEmailActions">
          {state === 'success' ? (
            <Link className="button button--dark button--large" href={destination}>
              Continuar <ArrowRight aria-hidden="true" size={17} />
            </Link>
          ) : state !== 'verifying' ? (
            <>
              <button
                className="button button--dark button--large"
                disabled={resending}
                onClick={resend}
                type="button"
              >
                {resending ? (
                  <span className="buttonSpinner" />
                ) : (
                  <RefreshCw aria-hidden="true" size={17} />
                )}
                Reenviar correo
              </button>
              <button
                className="button button--ghost button--large"
                disabled={checking}
                onClick={checkVerification}
                type="button"
              >
                {checking ? <span className="buttonSpinner" /> : 'Ya lo verifiqué'}
              </button>
            </>
          ) : null}
        </div>

        {state !== 'success' && (
          <div className="verifyEmailHint">
            <MailCheck aria-hidden="true" size={18} />
            <span>El enlace dura 24 horas. Revisa también las carpetas Promociones y Spam.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function safeDestination(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/cuenta';
}

function verificationContent(state: VerificationState) {
  if (state === 'success') {
    return {
      title: 'Correo verificado.',
      icon: CheckCircle2,
      className: 'isSuccess',
    };
  }
  if (state === 'error') {
    return {
      title: 'El enlace no pudo verificarse.',
      icon: AlertCircle,
      className: 'isError',
    };
  }
  if (state === 'verifying') {
    return {
      title: 'Verificando tu correo.',
      icon: MailCheck,
      className: 'isPending',
    };
  }
  return {
    title: 'Revisa tu correo.',
    icon: Mail,
    className: 'isPending',
  };
}
