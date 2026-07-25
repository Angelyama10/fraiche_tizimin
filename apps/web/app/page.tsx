import { HomeStorefront } from '@/components/home/home-storefront';
import { getPublishedSiteContent } from '@/lib/site-content';
import { getStorefrontData } from '@/lib/storefront-data';
import './page.css';

export const revalidate = 60;

export default async function HomePage() {
  const [{ products, scents, promotions }, content] = await Promise.all([getStorefrontData(), getPublishedSiteContent()]);
  return <HomeStorefront content={content} products={products} promotions={promotions} scents={scents} />;
}
