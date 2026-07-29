import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/store/product-card';
import { ProductDetail } from '@/components/catalog/product-detail';
import { SectionHeading } from '@/components/ui/section-heading';
import { apiRequest, ApiError } from '@/lib/api';
import { jsonLd, productBreadcrumbSchema, productSchema } from '@/lib/seo';
import type { Product, ProductListResponse } from '@/lib/types';

type ProductPageProps = { params: Promise<{ slug: string }> };

async function getProduct(slug: string) {
  try {
    return await apiRequest<Product>(`/products/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? product.description ?? undefined,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.shortDescription ?? undefined,
      url: `/productos/${product.slug}`,
      type: 'website',
      images: product.images[0]?.url
        ? [{ url: product.images[0].url, alt: product.images[0].altText || product.name }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.shortDescription ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const related = await apiRequest<ProductListResponse>(`/products?line=${product.line}&take=5`, { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null }));
  const relatedProducts = related.items.filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <main className="productPage">
      <script dangerouslySetInnerHTML={{ __html: jsonLd(productSchema(product)) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: jsonLd(productBreadcrumbSchema(product)) }} type="application/ld+json" />
      <ProductDetail product={product} />
      {relatedProducts.length > 0 && (
        <section className="relatedProducts section">
          <div className="pageWidth">
            <SectionHeading eyebrow="Sigue explorando" title="Aromas con una vibra parecida" href={`/productos?line=${product.line}`} />
            <div className="productGrid">{relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div>
          </div>
        </section>
      )}
    </main>
  );
}
