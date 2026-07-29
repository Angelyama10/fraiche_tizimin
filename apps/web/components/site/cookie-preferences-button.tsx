'use client';

import { ANALYTICS_PREFERENCES_EVENT } from '@/lib/analytics';

export function CookiePreferencesButton() {
  return (
    <button
      className="siteFooter__textButton"
      onClick={() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT))}
      type="button"
    >
      Preferencias de cookies
    </button>
  );
}
