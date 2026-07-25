import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KI'IBOK Exclusivo",
    short_name: "KI'IBOK",
    description: 'Perfumes y cuidado personal en Tizimín.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfaf6',
    theme_color: '#0d4f43',
    lang: 'es-MX',
    icons: [{ src: '/images/brand/kiibok-emblem.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' }],
  };
}
