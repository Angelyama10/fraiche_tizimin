'use client';

import { ArrowRight, CalendarDays, Check, Copy, Gift, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate, formatMoney } from '@/lib/format';
import type { Promotion } from '@/lib/types';
import { useNotify } from '@/providers/notification-provider';

const placementLabels: Record<Promotion['placement'], string> = {
  GENERAL: 'Especial',
  DAILY: 'Oferta del día',
  MONTHLY: 'Oferta del mes',
  FLASH: 'Por tiempo limitado',
  WELCOME: 'Bienvenida',
};

export function PromotionsExperience({ promotions }: { promotions: Promotion[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const notify = useNotify();

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    notify({ title: 'Código copiado', description: 'Úsalo al finalizar tu compra.', tone: 'success' });
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <main className="promotionsPage">
      <header className="promotionsHero">
        <div className="pageWidth">
          <span className="eyebrow eyebrow--light">Un detalle para ti</span>
          <h1>Promociones que huelen a buena idea.</h1>
          <p>Beneficios vigentes calculados por la tienda al momento de confirmar tu pedido.</p>
        </div>
      </header>
      <section className="promotionsList pageWidth section">
        {promotions.length ? promotions.map((promotion, index) => (
          <article className={`promotionRow promotionRow--${(index % 3) + 1}`} key={promotion.slug}>
            <div className="promotionRow__number">{String(index + 1).padStart(2, '0')}</div>
            <div className="promotionRow__content">
              <span className="eyebrow">{placementLabels[promotion.placement]}</span>
              <h2>{promotion.name}</h2>
              <p>{promotion.description}</p>
              <div className="promotionRow__terms">
                <span><Sparkles aria-hidden="true" size={15} /> {promotion.type === 'PERCENTAGE' ? `${promotion.value}% de descuento` : `${formatMoney(promotion.value)} de descuento`}</span>
                <span><CalendarDays aria-hidden="true" size={15} /> Hasta {formatDate(promotion.endsAt)}</span>
                {promotion.minimumCents > 0 && <span>Compra mínima {formatMoney(promotion.minimumCents)}</span>}
              </div>
            </div>
            <div className="promotionRow__action">
              {promotion.code ? (
                <button className="promotionCodeButton" onClick={() => copyCode(promotion.code!)} type="button">
                  <span>Código</span><strong>{promotion.code}</strong>{copied === promotion.code ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
                </button>
              ) : <span className="automaticPromo"><Gift aria-hidden="true" size={18} /> Se aplica automáticamente</span>}
              <Link className="button button--dark" href="/productos">Elegir productos <ArrowRight aria-hidden="true" size={17} /></Link>
            </div>
          </article>
        )) : (
          <div className="promotionsEmpty"><Gift aria-hidden="true" size={30} /><h2>Estamos preparando la próxima sorpresa.</h2><p>Mientras tanto, explora el catálogo o pregúntanos por WhatsApp.</p><Link className="button button--dark" href="/productos">Ver catálogo <ArrowRight size={17} /></Link></div>
        )}
      </section>
    </main>
  );
}
