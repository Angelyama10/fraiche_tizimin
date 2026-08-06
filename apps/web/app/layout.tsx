import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { AppProviders } from '@/providers/app-providers';
import { SiteShell } from '@/components/site-shell';
import { AnalyticsConsent } from '@/components/site/analytics-consent';
import { AssetRecovery } from '@/components/site/asset-recovery';
import { getPublishedSiteContent } from '@/lib/site-content';
import { jsonLd, organizationSchema, SITE_URL } from '@/lib/seo';
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KI'IBOK Exclusivo | Perfumes Fraîche en Tizimín",
    template: "%s | KI'IBOK Exclusivo",
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
  applicationName: "KI'IBOK Exclusivo",
  alternates: { canonical: '/' },
  openGraph: {
    title: "KI'IBOK Exclusivo",
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const siteContent = await getPublishedSiteContent();
  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} data-scroll-behavior="smooth" lang="es-MX">
      <body>
        <script
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema(siteContent.global)) }}
          type="application/ld+json"
        />
        <AssetRecovery />
        <AppProviders>
          <SiteShell content={siteContent}>{children}</SiteShell>
        </AppProviders>
        <AnalyticsConsent />
      </body>
    </html>
  );
}
