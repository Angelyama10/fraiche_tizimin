'use client';

import { RefreshCw } from 'lucide-react';

export default function ProductsError({ reset }: { reset: () => void }) {
  return <main className="errorState pageWidth"><span className="eyebrow">Catálogo no disponible</span><h1>No pudimos abrir el tocador.</h1><p>Comprueba que la API esté encendida y vuelve a intentar.</p><button className="button button--dark" onClick={reset} type="button"><RefreshCw size={18} /> Reintentar</button></main>;
}
