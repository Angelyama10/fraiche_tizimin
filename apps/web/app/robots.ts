import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/cuenta', '/carrito', '/pago', '/pedidos/', '/vista-previa', '/verificar-correo'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
