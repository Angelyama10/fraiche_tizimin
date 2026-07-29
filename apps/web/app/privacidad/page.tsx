import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedSiteContent } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Aviso de privacidad',
  description: "Conoce cómo KI'IBOK Exclusivo trata los datos personales de clientes y visitantes.",
  alternates: { canonical: '/privacidad' },
};

export default async function PrivacyPage() {
  const content = await getPublishedSiteContent();
  const { contact } = content.global;

  return (
    <main className="legalPage pageWidth">
      <span className="eyebrow">Última actualización: 25 de julio de 2026</span>
      <h1>Aviso de privacidad</h1>
      <p>
        KI&apos;IBOK Exclusivo, también identificada comercialmente como Fraîche Tizimín,
        con domicilio en {contact.address}, es responsable del tratamiento de los datos
        personales recabados mediante esta tienda.
      </p>

      <h2>Datos que podemos recabar</h2>
      <ul>
        <li>Nombre, correo, teléfono y credenciales protegidas de acceso.</li>
        <li>Dirección, referencias e información necesaria para entregar o recoger pedidos.</li>
        <li>Productos comprados, promociones aplicadas, pagos y seguimiento de pedidos.</li>
        <li>Mensajes, solicitudes especiales, comprobantes y comunicaciones de soporte.</li>
        <li>Información técnica básica necesaria para seguridad, sesiones y funcionamiento del sitio.</li>
      </ul>

      <h2>Finalidades</h2>
      <p>
        Usamos estos datos para crear y proteger tu cuenta, verificar tu correo, procesar
        compras, validar inventario y pagos, preparar entregas, atender solicitudes, prevenir
        fraude, cumplir obligaciones comerciales y mejorar la experiencia de la tienda.
        Las comunicaciones promocionales sólo se enviarán cuando hayas aceptado recibirlas.
      </p>

      <h2>Pagos y proveedores</h2>
      <p>
        La información completa de tarjeta es capturada y procesada directamente por la
        pasarela elegida. KI&apos;IBOK Exclusivo no almacena números completos de tarjeta ni
        códigos de seguridad. Podemos compartir los datos estrictamente necesarios con
        proveedores de pago, correo, almacenamiento, alojamiento y paquetería para prestar
        el servicio solicitado.
      </p>

      <h2>Conservación y seguridad</h2>
      <p>
        Conservamos los datos durante el tiempo necesario para atender la relación comercial,
        obligaciones aplicables, aclaraciones y prevención de fraude. Aplicamos controles de
        acceso, cifrado en tránsito, registros de operación y separación de servicios. Ningún
        sistema es infalible, por lo que también revisamos y actualizamos estas medidas.
      </p>

      <h2>Derechos ARCO y revocación</h2>
      <p>
        Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento, así
        como revocar tu consentimiento, escribiendo a <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        Indica tu nombre, el correo de tu cuenta, el derecho que deseas ejercer y un medio para
        recibir respuesta. Podremos pedir información razonable para verificar tu identidad.
      </p>

      <h2>Cookies y cambios</h2>
      <p>
        Utilizamos almacenamiento esencial para mantener la sesión, el carrito y tus
        preferencias. La medición opcional sólo se activa con consentimiento. Consulta la
        <Link href="/cookies"> política de cookies</Link>. Cualquier cambio material a este
        aviso se publicará en esta misma dirección con su fecha de actualización.
      </p>
    </main>
  );
}
