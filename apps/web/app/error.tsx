'use client';

import { RefreshCw } from 'lucide-react';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="errorState pageWidth">
      <span className="eyebrow">Algo no salió como esperábamos</span>
      <h1>Esta esencia necesita otro intento.</h1>
      <p>La tienda sigue aquí. Vuelve a cargar esta sección para continuar.</p>
      <button className="button button--dark" onClick={reset} type="button"><RefreshCw aria-hidden="true" size={18} /> Intentar de nuevo</button>
    </main>
  );
}
