'use client';

import { Check, ChevronDown, Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { LINE_LABELS } from '@/lib/catalog';
import type { Category, Product, ProductLine, ProductListResponse, ScentFamily } from '@/lib/types';
import { useNotify } from '@/providers/notification-provider';
import { ProductCard } from '@/components/store/product-card';

const lines = Object.entries(LINE_LABELS) as Array<[ProductLine, string]>;

function buildProductParams({
  query,
  line,
  category,
  scent,
  featured,
}: {
  query: string;
  line: ProductLine | '';
  category: string;
  scent: string;
  featured: boolean;
}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (line) params.set('line', line);
  if (category) params.set('category', category);
  if (scent) params.set('scent', scent);
  if (featured) params.set('featured', 'true');
  params.set('take', '24');
  return params;
}

export function CatalogExperience({
  initialProducts,
  initialNextCursor,
  categories,
  scents,
}: {
  initialProducts: Product[];
  initialNextCursor: string | null;
  categories: Category[];
  scents: ScentFamily[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notify = useNotify();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [line, setLine] = useState<ProductLine | ''>((searchParams.get('line') as ProductLine | null) ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [scent, setScent] = useState(searchParams.get('scent') ?? '');
  const [featured, setFeatured] = useState(searchParams.get('featured') === 'true');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const params = buildProductParams({ query, line, category, scent, featured });

      setLoading(true);
      try {
        const result = await apiRequest<ProductListResponse>(`/products?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
        setProducts(result.items);
        setNextCursor(result.nextCursor);
        params.delete('take');
        router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          notify({ title: 'No pudimos filtrar el catálogo', description: errorMessage(error), tone: 'error' });
        }
      } finally {
        setLoading(false);
      }
    }, query ? 320 : 80);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, line, category, scent, featured, pathname, router, notify]);

  const sortedProducts = useMemo(() => {
    const next = [...products];
    if (sort === 'price-asc') next.sort((a, b) => (a.priceRange.minimumCents ?? Infinity) - (b.priceRange.minimumCents ?? Infinity));
    if (sort === 'price-desc') next.sort((a, b) => (b.priceRange.minimumCents ?? -1) - (a.priceRange.minimumCents ?? -1));
    if (sort === 'name') next.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return next;
  }, [products, sort]);

  const childCategories = categories.flatMap((parent) => parent.children ?? []);
  const activeCount = [line, category, scent, featured].filter(Boolean).length;

  function clearFilters() {
    setQuery('');
    setLine('');
    setCategory('');
    setScent('');
    setFeatured(false);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const params = buildProductParams({ query, line, category, scent, featured });
    params.set('cursor', nextCursor);
    setLoadingMore(true);
    try {
      const result = await apiRequest<ProductListResponse>(`/products?${params.toString()}`, { cache: 'no-store' });
      setProducts((current) => {
        const currentIds = new Set(current.map((product) => product.id));
        return [...current, ...result.items.filter((product) => !currentIds.has(product.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (error) {
      notify({ title: 'No pudimos cargar más productos', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }

  const filters = (
    <div className="catalogFilters">
      <div className="catalogFilters__heading">
        <div><SlidersHorizontal aria-hidden="true" size={17} /><strong>Filtrar</strong>{activeCount > 0 && <span>{activeCount}</span>}</div>
        {activeCount > 0 && <button onClick={clearFilters} type="button"><RotateCcw aria-hidden="true" size={14} /> Limpiar</button>}
      </div>
      <FilterGroup label="Línea">
        <FilterOption active={!line} label="Todas las líneas" onClick={() => setLine('')} />
        {lines.map(([value, label]) => <FilterOption active={line === value} key={value} label={label} onClick={() => setLine(value)} />)}
      </FilterGroup>
      <FilterGroup label="Categoría">
        <FilterOption active={!category} label="Todas" onClick={() => setCategory('')} />
        {childCategories.map((item) => <FilterOption active={category === item.slug} key={item.id} label={item.name} onClick={() => setCategory(item.slug)} />)}
      </FilterGroup>
      <FilterGroup label="Familia aromática">
        <div className="scentOptions">
          {scents.map((item) => (
            <button className={scent === item.slug ? 'isActive' : ''} key={item.id} onClick={() => setScent(scent === item.slug ? '' : item.slug)} type="button">
              {scent === item.slug && <Check aria-hidden="true" size={12} />}{item.name}
            </button>
          ))}
        </div>
      </FilterGroup>
      <label className="featuredToggle">
        <input checked={featured} onChange={(event) => setFeatured(event.target.checked)} type="checkbox" />
        <span />
        Solo productos destacados
      </label>
    </div>
  );

  return (
    <main className="catalogPage">
      <header className="catalogHero">
        <div className="pageWidth">
          <span className="eyebrow">Catálogo Fraîche</span>
          <h1>Perfumes y cuidado personal</h1>
          <p>Explora por intensidad, línea o familia aromática. Cada precio y existencia se actualiza desde nuestra tienda.</p>
        </div>
      </header>

      <div className="catalogToolbar pageWidth">
        <label className="catalogSearch">
          <Search aria-hidden="true" size={18} />
          <input aria-label="Buscar en el catálogo" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aroma, marca o nombre" value={query} />
          {query && <button aria-label="Borrar búsqueda" onClick={() => setQuery('')} type="button"><X aria-hidden="true" size={16} /></button>}
        </label>
        <button className="catalogFilterButton" onClick={() => setFiltersOpen(true)} type="button"><Filter aria-hidden="true" size={17} /> Filtros {activeCount > 0 && <span>{activeCount}</span>}</button>
        <label className="catalogSort">
          <span>Ordenar</span>
          <select aria-label="Ordenar productos" onChange={(event) => setSort(event.target.value)} value={sort}>
            <option value="newest">Más recientes</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="name">Nombre</option>
          </select>
          <ChevronDown aria-hidden="true" size={15} />
        </label>
      </div>

      <div className="catalogLayout pageWidth">
        <aside className="catalogSidebar">{filters}</aside>
        <section className="catalogResults" aria-busy={loading} aria-live="polite">
          <div className="catalogResults__meta">
            <p><strong>{sortedProducts.length}</strong> productos mostrados</p>
            {loading && <span><i /> Actualizando</span>}
          </div>
          {sortedProducts.length ? (
            <div className="productGrid catalogResults__grid">
              {sortedProducts.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
            </div>
          ) : (
            <div className="catalogNoResults">
              <Search aria-hidden="true" size={26} />
              <h2>No encontramos esa combinación.</h2>
              <p>Prueba con otra familia aromática o limpia los filtros.</p>
              <button className="button button--dark" onClick={clearFilters} type="button"><RotateCcw aria-hidden="true" size={17} /> Ver todos</button>
            </div>
          )}
          {nextCursor && sortedProducts.length > 0 && (
            <div className="catalogLoadMore">
              <button className="button button--dark button--large" disabled={loadingMore} onClick={loadMore} type="button">
                {loadingMore ? <><span className="buttonSpinner" /> Cargando productos</> : 'Cargar más productos'}
              </button>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.button aria-label="Cerrar filtros" className="drawerBackdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFiltersOpen(false)} type="button" />
            <motion.aside className="filterDrawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
              <div className="filterDrawer__header"><h2>Filtros</h2><button aria-label="Cerrar filtros" className="iconButton" onClick={() => setFiltersOpen(false)} type="button"><X aria-hidden="true" size={20} /></button></div>
              {filters}
              <button className="button button--dark button--wide button--large" onClick={() => setFiltersOpen(false)} type="button">Ver {sortedProducts.length} productos cargados</button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="filterGroup" open><summary>{label}<ChevronDown aria-hidden="true" size={15} /></summary><div>{children}</div></details>;
}

function FilterOption({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`filterOption ${active ? 'isActive' : ''}`} onClick={onClick} type="button"><span>{active && <Check aria-hidden="true" size={12} />}</span>{label}</button>;
}
