import { Camera, Mail, MapPin, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import Link from 'next/link';
import type { SiteContentDocument } from '@/lib/site-content';
import { BrandIdentity } from './brand-identity';

export function SiteFooter({ content }: { content: SiteContentDocument['global'] }) {
  const { contact, footer, header } = content;

  return (
    <footer className="siteFooter">
      <div className="siteFooter__top pageWidth">
        <div className="siteFooter__brand">
          <BrandIdentity inverted logoAlt={header.logoAlt} logoUrl={header.logoUrl} />
          <span className="eyebrow eyebrow--light">{footer.eyebrow}</span>
          <h2>{footer.title}</h2>
          <p>{footer.description}</p>
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
          <a href={`https://wa.me/${contact.whatsappPhone}`} rel="noreferrer" target="_blank"><MessageCircle aria-hidden="true" size={16} /> WhatsApp</a>
          <a href={`mailto:${contact.email}`}><Mail aria-hidden="true" size={16} /> Correo</a>
          <a href={`tel:+${contact.whatsappPhone}`}><Phone aria-hidden="true" size={16} /> {contact.whatsappLabel}</a>
          <span><MapPin aria-hidden="true" size={16} /> {contact.address}</span>
        </div>
      </div>
      <div className="siteFooter__bottom pageWidth">
        <p>© {new Date().getFullYear()} KI&apos;IBOK Exclusivo</p>
        <div>
          <a aria-label="Instagram" href={contact.instagramUrl} rel="noreferrer" target="_blank" title="Instagram"><Camera aria-hidden="true" size={18} /></a>
          <a aria-label="Facebook" href={contact.facebookUrl} rel="noreferrer" target="_blank" title="Facebook"><MessagesSquare aria-hidden="true" size={18} /></a>
        </div>
        <p>Compra segura · Pagos protegidos</p>
      </div>
    </footer>
  );
}
