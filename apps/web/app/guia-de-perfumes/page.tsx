import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Guía para elegir perfume',
  description: 'Una guía breve sobre concentración, familias aromáticas y uso de perfumes.',
  alternates: { canonical: '/guia-de-perfumes' },
};

const families = [
  ['Floral', 'Pétalos, flores blancas y acordes suaves o románticos.', 'floral'],
  ['Fresco', 'Notas limpias, verdes o acuáticas para una sensación ligera.', 'fresco'],
  ['Cítrico', 'Bergamota, limón, mandarina y salidas luminosas.', 'citrico'],
  ['Dulce', 'Vainilla, caramelo, frutas maduras y acordes envolventes.', 'dulce'],
  ['Amaderado', 'Cedro, sándalo y vetiver con presencia elegante.', 'amaderado'],
  ['Oriental', 'Especias, resinas y notas cálidas de gran personalidad.', 'oriental'],
  ['Árabe y nicho', 'Composiciones intensas, oud y mezclas menos convencionales.', 'arabe'],
];

export default function PerfumeGuidePage() {
  return (
    <main className="legalPage editorialPage pageWidth">
      <span className="eyebrow">Guía KI&apos;IBOK</span>
      <h1>Cómo encontrar una esencia que se sienta tuya</h1>
      <p>
        No existe un perfume correcto para todo el mundo. Empieza por la sensación que buscas,
        considera la intensidad y pruébalo sobre tu piel antes de decidir.
      </p>

      <h2>Clásica o 37%</h2>
      <p>
        La concentración clásica suele sentirse más ligera para uso cotidiano. Las
        presentaciones al 37% buscan mayor intensidad y permanencia; aplica poca cantidad y
        espera unos minutos para conocer su evolución.
      </p>

      <h2>Explora por familia</h2>
      <div className="guideLinks">
        {families.map(([name, description, slug]) => (
          <Link href={`/productos?scent=${slug}`} key={name}>
            <strong>{name}</strong>
            <span>{description}</span>
          </Link>
        ))}
      </div>

      <h2>Haz que dure mejor</h2>
      <ul>
        <li>Aplica sobre piel limpia e hidratada, sin frotar las muñecas.</li>
        <li>Evita guardar el frasco bajo sol directo, calor o humedad constante.</li>
        <li>Prueba una fragancia a la vez y observa su salida, corazón y fondo.</li>
      </ul>

      <p>
        ¿Sigues dudando? <Link href="/pedidos-especiales">Cuéntanos qué aroma buscas</Link> o
        pide una recomendación por WhatsApp.
      </p>
    </main>
  );
}
