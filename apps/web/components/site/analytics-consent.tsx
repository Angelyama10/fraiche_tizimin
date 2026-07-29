'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ANALYTICS_CONSENT_KEY, ANALYTICS_PREFERENCES_EVENT } from '@/lib/analytics';

type Consent = 'accepted' | 'rejected' | null;

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    setConsent(saved === 'accepted' || saved === 'rejected' ? saved : null);
    setReady(true);

    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
  }, []);

  if (!measurementId || !ready) return null;

  function choose(next: Exclude<Consent, null>) {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
    setConsent(next);
    setPreferencesOpen(false);
  }

  return (
    <>
      {consent === 'accepted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
          <Script id="fraiche-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config','${measurementId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {(consent === null || preferencesOpen) && (
        <aside aria-label="Preferencias de cookies" className="cookieConsent" role="dialog">
          <div>
            <strong>Medición con tu permiso</strong>
            <p>Podemos medir visitas y compras para mejorar la tienda. El carrito y tu cuenta funcionan aunque rechaces.</p>
            <Link href="/cookies">Conocer la política</Link>
          </div>
          <div className="cookieConsent__actions">
            <button className="button button--outline" onClick={() => choose('rejected')} type="button">Sólo esenciales</button>
            <button className="button button--dark" onClick={() => choose('accepted')} type="button">Aceptar medición</button>
          </div>
        </aside>
      )}
    </>
  );
}
