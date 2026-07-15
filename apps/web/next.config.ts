import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  turbopack: {
    root: path.resolve('/app'),
  },
};

export default nextConfig;
