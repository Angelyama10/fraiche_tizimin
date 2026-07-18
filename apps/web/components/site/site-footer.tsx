import { Camera, Mail, MapPin, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooter__top pageWidth">
        <div className="siteFooter__brand">
          <span className="brandMark__monogram brandMark__monogram--light">F</span>
          <h2>Tu esencia, más cerca.</h2>
          <p>Perfumes y cuidado personal seleccionados con atención cálida desde Tizimín, Yucatán.</p>
        </div>
        <div>
          <h3>Descubre</h3>
          <Link href="/productos">Todos los productos</Link>
          <Link href="/productos?line=PREMIUM">Premium</Link>
          <Link href="/promociones">Promociones</Link>
          <Link href="/pedidos-especiales">Pedir un aroma</Link>
        </div>
        <div>
          <h3>Tu compra</h3>
          <Link href="/cuenta">Mi cuenta</Link>
          <Link href="/cuenta?tab=pedidos">Mis pedidos</Link>
          <Link href="/carrito">Carrito</Link>
          <Link href="/privacidad">Privacidad</Link>
        </div>
        <div>
          <h3>Estamos cerca</h3>
          <a href="https://wa.me/529861000000" rel="noreferrer" target="_blank"><MessageCircle aria-hidden="true" size={16} /> WhatsApp</a>
          <a href="mailto:hola@fraichetizimin.com"><Mail aria-hidden="true" size={16} /> Correo</a>
          <a href="tel:+529861000000"><Phone aria-hidden="true" size={16} /> 986 100 0000</a>
          <span><MapPin aria-hidden="true" size={16} /> Tizimín, Yucatán</span>
        </div>
      </div>
      <div className="siteFooter__bottom pageWidth">
        <p>© {new Date().getFullYear()} Fraîche Tizimín</p>
        <div>
          <a aria-label="Instagram" href="https://instagram.com" rel="noreferrer" target="_blank" title="Instagram"><Camera aria-hidden="true" size={18} /></a>
          <a aria-label="Facebook" href="https://facebook.com" rel="noreferrer" target="_blank" title="Facebook"><MessagesSquare aria-hidden="true" size={18} /></a>
        </div>
        <p>Compra segura · Pagos protegidos</p>
      </div>
    </footer>
  );
}
