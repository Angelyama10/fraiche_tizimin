import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedSiteContent } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: "Condiciones de uso y compra en la tienda en línea KI'IBOK Exclusivo.",
  alternates: { canonical: '/terminos' },
};

export default async function TermsPage() {
  const content = await getPublishedSiteContent();
  const { contact } = content.global;

  return (
    <main className="legalPage pageWidth">
      <span className="eyebrow">Última actualización: 25 de julio de 2026</span>
      <h1>Términos y condiciones</h1>
      <p>
        Al utilizar esta tienda o confirmar una compra aceptas estas condiciones. La tienda es
        operada por KI&apos;IBOK Exclusivo / Fraîche Tizimín desde {contact.address}.
      </p>

      <h2>Cuenta y seguridad</h2>
      <p>
        Para comprar debes crear una cuenta, verificar tu correo y proporcionar información
        verdadera. Eres responsable de mantener tu contraseña en secreto y de avisarnos si
        detectas actividad no reconocida.
      </p>

      <h2>Catálogo, precios e inventario</h2>
      <p>
        Procuramos mostrar descripciones, fotografías y precios correctos. La apariencia del
        producto puede variar por presentación, lote o pantalla. El precio final, promociones
        e inventario se validan al confirmar el pedido. Si existe un error evidente o falta de
        existencia, te contactaremos para ofrecer una alternativa o cancelar y reembolsar.
      </p>

      <h2>Pedidos y pagos</h2>
      <p>
        Un folio confirma que recibimos la solicitud, pero la venta queda sujeta a validación
        de pago e inventario. Las tarjetas son procesadas por las pasarelas disponibles; las
        transferencias quedan pendientes hasta aprobar el comprobante; el efectivo sólo está
        disponible cuando la opción de recolección lo permita.
      </p>

      <h2>Promociones</h2>
      <p>
        Cada promoción puede tener vigencia, mínimo, productos elegibles y límite de uso. El
        descuento de bienvenida corresponde a clientes elegibles en su primera compra y no es
        canjeable por efectivo. Salvo que se indique lo contrario, las promociones no se acumulan.
      </p>

      <h2>Entrega, cambios y reembolsos</h2>
      <p>
        Las condiciones aplicables están descritas en
        <Link href="/envios-y-devoluciones"> Envíos, cambios y devoluciones</Link>, que forma
        parte de estos términos.
      </p>

      <h2>Uso del sitio</h2>
      <p>
        No debes intentar vulnerar cuentas, automatizar compras abusivas, alterar precios,
        interferir con el servicio ni utilizar contenido de la marca sin autorización. Podemos
        limitar operaciones que presenten indicios de fraude o abuso.
      </p>

      <h2>Contacto</h2>
      <p>
        Para aclaraciones escribe a <a href={`mailto:${contact.email}`}>{contact.email}</a> o
        comunícate por WhatsApp al <a href={`https://wa.me/${contact.whatsappPhone}`}>{contact.whatsappLabel}</a>.
      </p>
    </main>
  );
}
