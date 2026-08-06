'use client';

import { useEffect } from 'react';

const RELOAD_PARAM = '__asset_reload';
const RECOVERY_KEY = 'kiibok:asset-recovery';
const RECOVERY_WINDOW_MS = 60_000;
const STABLE_WINDOW_MS = 12_000;

function rejectionMessage(reason: unknown) {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  return typeof reason === 'string' ? reason : '';
}

function isChunkFailure(message: string) {
  return [
    'chunkloaderror',
    'loading chunk',
    'failed to fetch dynamically imported module',
    'importing a module script failed',
  ].some((fragment) => message.toLowerCase().includes(fragment));
}

function failedAssetUrl(target: EventTarget | null) {
  if (target instanceof HTMLScriptElement) return target.src;
  if (target instanceof HTMLLinkElement) return target.href;
  return '';
}

export function AssetRecovery() {
  useEffect(() => {
    let stableTimer: ReturnType<typeof setTimeout> | undefined;

    const recover = () => {
      const now = Date.now();
      const currentUrl = new URL(window.location.href);
      const previous = Number(sessionStorage.getItem(RECOVERY_KEY) ?? 0);

      if (currentUrl.searchParams.has(RELOAD_PARAM) || now - previous < RECOVERY_WINDOW_MS) {
        return;
      }

      sessionStorage.setItem(RECOVERY_KEY, String(now));
      currentUrl.searchParams.set(RELOAD_PARAM, String(now));
      window.location.replace(currentUrl.toString());
    };

    const handleAssetError = (event: Event) => {
      const url = failedAssetUrl(event.target);
      if (url.includes('/_next/static/')) recover();
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkFailure(rejectionMessage(event.reason))) recover();
    };

    window.addEventListener('error', handleAssetError, true);
    window.addEventListener('unhandledrejection', handleRejection);

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(RELOAD_PARAM)) {
      stableTimer = setTimeout(() => {
        currentUrl.searchParams.delete(RELOAD_PARAM);
        window.history.replaceState(window.history.state, '', currentUrl.toString());
        sessionStorage.removeItem(RECOVERY_KEY);
      }, STABLE_WINDOW_MS);
    }

    return () => {
      window.removeEventListener('error', handleAssetError, true);
      window.removeEventListener('unhandledrejection', handleRejection);
      if (stableTimer) clearTimeout(stableTimer);
    };
  }, []);

  return null;
}
