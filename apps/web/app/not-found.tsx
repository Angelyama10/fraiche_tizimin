import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="errorState pageWidth">
      <span className="eyebrow">404 · Aroma no encontrado</span>
      <h1>Esta página ya no deja rastro.</h1>
      <p>Regresa al catálogo y sigue explorando.</p>
      <Link className="button button--dark" href="/productos"><ArrowLeft aria-hidden="true" size={18} /> Volver al catálogo</Link>
    </main>
  );
}
