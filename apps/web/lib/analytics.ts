export const ANALYTICS_CONSENT_KEY = 'fraiche_analytics_consent';
export const ANALYTICS_PREFERENCES_EVENT = 'fraiche:open-cookie-preferences';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, parameters?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(ANALYTICS_CONSENT_KEY) !== 'accepted') return;
  window.gtag?.('event', name, parameters);
}
