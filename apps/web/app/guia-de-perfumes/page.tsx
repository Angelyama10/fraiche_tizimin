import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Guía para elegir perfume',
  description: 'Una guía breve sobre concentración, intensidad y uso de perfumes.',
  alternates: { canonical: '/guia-de-perfumes' },
};

const collections = [
  ['Para todos los días', 'Concentración clásica y presencia ligera para acompañarte durante el día.', 'DESIGNER_CLASSIC'],
  ['Mayor intensidad', 'Presentaciones al 37% para quienes buscan más presencia y duración.', 'DESIGNER_37'],
  ['Neeche Passion', 'Fragancias de 60 ml con una selección propia de la línea.', 'NEECHE_PASSION'],
  ['Nicho y árabe', 'Composiciones intensas y menos convencionales dentro de la línea Premium.', 'PREMIUM'],
  ['Cuidado personal', 'Productos para complementar tu rutina de higiene, belleza y cuidado diario.', 'PERSONAL_CARE'],
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

      <h2>Explora según lo que buscas</h2>
      <div className="guideLinks">
        {collections.map(([name, description, line]) => (
          <Link href={`/productos?line=${line}`} key={name}>
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
