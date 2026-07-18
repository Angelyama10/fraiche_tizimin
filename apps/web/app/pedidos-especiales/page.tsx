import type { Metadata } from 'next';
import { SpecialRequestForm } from '@/components/special-requests/special-request-form';
import './pedidos-especiales.css';

export const metadata: Metadata = {
  title: 'Pedido especial de aroma',
  description: 'Solicita un perfume o aroma que no esté disponible en el catálogo de Fraîche Tizimín.',
  alternates: { canonical: '/pedidos-especiales' },
};

export default function SpecialRequestsPage() {
  return (
    <main className="specialRequestPage">
      <section className="specialRequestHero pageWidth">
        <div>
          <span className="eyebrow">Pedido especial</span>
          <h1>Hay aromas que vale la pena buscar.</h1>
          <p>Cuéntanos cuál tienes en mente y te contactaremos cuando tengamos disponibilidad o una alternativa cercana.</p>
          <ol>
            <li><span>01</span><div><strong>Describe tu aroma</strong><small>Nombre, referencia o notas que recuerdes.</small></div></li>
            <li><span>02</span><div><strong>Lo investigamos</strong><small>Revisamos catálogo y disponibilidad.</small></div></li>
            <li><span>03</span><div><strong>Te contactamos</strong><small>Recibes respuesta y precio por correo o WhatsApp.</small></div></li>
          </ol>
        </div>
        <SpecialRequestForm />
      </section>
    </main>
  );
}
