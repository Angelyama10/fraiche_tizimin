import { notFound } from 'next/navigation';
import { StorefrontPreviewFrame } from '@/components/content/storefront-preview-frame';
import { HomeStorefront } from '@/components/home/home-storefront';
import { apiRequest } from '@/lib/api';
import type { SiteContentResponse } from '@/lib/site-content';
import { getStorefrontData } from '@/lib/storefront-data';
import '../page.css';

export const dynamic = 'force-dynamic';

export default async function StorefrontPreviewPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) notFound();

  try {
    const [preview, data] = await Promise.all([
      apiRequest<SiteContentResponse>(`/content/preview/${encodeURIComponent(token)}`, { cache: 'no-store' }),
      getStorefrontData(),
    ]);
    return (
      <StorefrontPreviewFrame content={preview.content}>
        <HomeStorefront content={preview.content} products={data.products} promotions={data.promotions} scents={data.scents} />
      </StorefrontPreviewFrame>
    );
  } catch {
    notFound();
  }
}
