import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidad' };

export default function PrivacyPage() {
  return <main className="legalPage pageWidth"><span className="eyebrow">Privacidad</span><h1>Aviso de privacidad</h1><p>Fraîche Tizimín utiliza los datos de contacto, envío y compra únicamente para gestionar cuentas, pedidos, pagos, entregas y atención solicitada por el cliente.</p><h2>Pagos</h2><p>Los datos de tarjeta son procesados directamente por la pasarela de pago y no se almacenan en nuestra base de datos.</p><h2>Tus derechos</h2><p>Puedes solicitar acceso, corrección o eliminación de tus datos mediante los canales de contacto publicados en este sitio. Este texto deberá revisarse con asesoría legal antes de publicar la tienda.</p></main>;
}
