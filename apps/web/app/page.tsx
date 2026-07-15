'use client';

import { useEffect, useState } from 'react';
import './page.css';

type Product = {
  id: string;
  name: string;
  brand?: string | null;
  kind: string;
  fixedPriceCents?: number | null;
  imageUrl?: string | null;
  variants: Array<{ priceCents?: number | null; presentationMl: number }>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/products`)
      .then((response) => response.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="storefront">
      <header className="header">
        <div>
          <p className="eyebrow">FRÁICHETIZIMIN</p>
          <h1>Perfumes que dejan huella</h1>
        </div>
        <button className="cartButton" type="button">Carrito (0)</button>
      </header>

      <section className="intro">
        <p>Explora fragancias Neeche, Premium y de diseñador.</p>
        <input aria-label="Buscar perfumes" placeholder="Buscar perfume..." />
      </section>

      <section className="catalog" aria-live="polite">
        {loading && <p>Cargando catálogo...</p>}
        {!loading && products.length === 0 && <p>Aún no hay productos cargados.</p>}
        {products.map((product) => (
          <article className="product" key={product.id}>
            <div className="productImage">{product.imageUrl ? 'Imagen' : 'Sin imagen'}</div>
            <div className="productInfo">
              <span className="kind">{product.kind}</span>
              <h2>{product.name}</h2>
              <p>{product.brand ?? 'Fragancia'}</p>
              <strong>
                {(product.fixedPriceCents ?? product.variants[0]?.priceCents)
                  ? `$${((product.fixedPriceCents ?? product.variants[0]?.priceCents ?? 0) / 100).toFixed(2)} MXN`
                  : 'Consultar precio'}
              </strong>
              <button className="addButton" type="button">Agregar al carrito</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
