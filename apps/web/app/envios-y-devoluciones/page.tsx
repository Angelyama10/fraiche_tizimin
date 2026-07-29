import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedSiteContent } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Envíos, cambios y devoluciones',
  description: "Información de entrega, recolección, cambios y devoluciones de KI'IBOK Exclusivo.",
  alternates: { canonical: '/envios-y-devoluciones' },
};

export default async function ShippingAndReturnsPage() {
  const content = await getPublishedSiteContent();
  const { contact } = content.global;

  return (
    <main className="legalPage pageWidth">
      <span className="eyebrow">Información de compra</span>
      <h1>Envíos, cambios y devoluciones</h1>

      <h2>Opciones de entrega</h2>
      <ul>
        <li><strong>Recoger en tienda:</strong> te avisaremos cuando el pedido esté listo en {contact.address}.</li>
        <li><strong>Entrega local:</strong> disponibilidad, costo y horario se confirman antes de preparar el envío.</li>
        <li><strong>Paquetería:</strong> el costo y tiempo estimado dependen del destino y servicio seleccionado.</li>
      </ul>
      <p>
        Cuando exista una guía, el código y el enlace de rastreo aparecerán en
        <Link href="/cuenta?tab=pedidos"> Mis compras</Link>. Los tiempos de la paquetería son
        estimados y pueden variar por cobertura, clima o temporadas de alta demanda.
      </p>

      <h2>Preparación y recepción</h2>
      <p>
        El inventario y el precio se validan al confirmar la compra. Revisa que la dirección y
        el teléfono sean correctos. Al recibir, verifica el empaque antes de desecharlo y
        conserva evidencia si notas daño, faltantes o un producto distinto.
      </p>

      <h2>Cambios por daño o error</h2>
      <p>
        Reporta daños, faltantes o errores dentro de las primeras 48 horas posteriores a la
        entrega mediante WhatsApp al <a href={`https://wa.me/${contact.whatsappPhone}`}>{contact.whatsappLabel}</a>.
        Incluye el número de pedido y fotografías claras del producto y empaque para revisar el caso.
      </p>

      <h2>Devoluciones y cancelaciones</h2>
      <p>
        Por higiene y seguridad, los perfumes, cosméticos y productos de cuidado abiertos,
        usados o alterados no pueden devolverse, salvo defecto o error atribuible a la tienda.
        Los productos elegibles deben conservar sellos, empaque y accesorios. Una cancelación
        puede solicitarse mientras el pedido no haya entrado en preparación o envío.
      </p>

      <h2>Reembolsos</h2>
      <p>
        Cuando proceda un reembolso, se solicitará por el mismo medio de pago utilizado. El
        tiempo para verse reflejado depende de la institución bancaria o pasarela. Los costos
        de envío originales no son reembolsables cuando el pedido fue entregado correctamente.
      </p>
    </main>
  );
}
