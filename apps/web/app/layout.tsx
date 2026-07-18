import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { AppProviders } from '@/providers/app-providers';
import { SiteShell } from '@/components/site-shell';
import './globals.css';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Fraîche Tizimín | Perfumes que dejan huella',
    template: '%s | Fraîche Tizimín',
  },
  description:
    'Perfumes de diseñador, Neeche Passion, Premium y cuidado personal en Tizimín. Compra fácil, segura y con atención por WhatsApp.',
  keywords: [
    'perfumes Tizimín',
    'Fraiche Tizimín',
    'perfumes 37 por ciento',
    'perfumes árabes',
    'perfumes nicho',
    'cuidado personal',
  ],
  applicationName: 'Fraîche Tizimín',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Fraîche Tizimín',
    description: 'Encuentra la fragancia que habla de ti.',
    locale: 'es_MX',
    type: 'website',
    images: [{ url: '/images/brand/hero-perfumes.png', width: 1536, height: 1024, alt: 'Selección de perfumes Fraîche Tizimín' }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d4f43',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} data-scroll-behavior="smooth" lang="es-MX">
      <body>
        <AppProviders>
          <SiteShell>{children}</SiteShell>
        </AppProviders>
      </body>
    </html>
  );
}
