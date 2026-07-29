import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de cookies',
  description: "Conoce qué almacenamiento usa la tienda KI'IBOK Exclusivo y cómo administrar tus preferencias.",
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <main className="legalPage pageWidth">
      <span className="eyebrow">Control y transparencia</span>
      <h1>Política de cookies</h1>
      <p>
        Esta tienda usa cookies y almacenamiento local para recordar información entre
        visitas. Algunas funciones son esenciales; otras, como la medición de audiencia, sólo
        se activan cuando existe una configuración válida y otorgas tu consentimiento.
      </p>

      <h2>Almacenamiento esencial</h2>
      <ul>
        <li>Sesión segura y renovación de acceso.</li>
        <li>Carrito, preferencias de interfaz y controles contra abuso.</li>
        <li>Registro de la elección sobre cookies opcionales.</li>
      </ul>
      <p>Estas funciones son necesarias para operar la cuenta y la compra, por lo que no se desactivan desde el aviso.</p>

      <h2>Medición opcional</h2>
      <p>
        Si la tienda habilita una herramienta de analítica, puede medir páginas visitadas,
        productos agregados y compras completadas de forma agregada. No usamos esta medición
        hasta que eliges “Aceptar medición”.
      </p>

      <h2>Cómo cambiar tu elección</h2>
      <p>
        Puedes borrar las cookies y datos del sitio desde la configuración de tu navegador.
        También puedes reabrir el panel de preferencias mediante el enlace “Preferencias de
        cookies” del pie cuando la medición esté habilitada.
      </p>
    </main>
  );
}
