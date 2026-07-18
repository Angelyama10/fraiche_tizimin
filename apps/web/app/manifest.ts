import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fraîche Tizimín',
    short_name: 'Fraîche',
    description: 'Perfumes y cuidado personal en Tizimín.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfaf6',
    theme_color: '#0d4f43',
    lang: 'es-MX',
    icons: [],
  };
}
