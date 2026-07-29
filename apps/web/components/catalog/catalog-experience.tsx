'use client';

import {
  Check,
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ProductCard } from '@/components/store/product-card';
import { apiRequest, errorMessage } from '@/lib/api';
import { mergeCatalogNavigation } from '@/lib/catalog-navigation';
import type {
  CatalogLine,
  CatalogNavigation,
  Category,
  PerfumeHouse,
  Product,
  ProductListResponse,
} from '@/lib/types';
import { useNotify } from '@/providers/notification-provider';

type ProductFilters = {
  query: string;
  catalogSection: string;
  catalogLine: string;
  house: string;
  category: string;
  featured: boolean;
};

function buildProductParams(filters: ProductFilters) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.catalogSection) params.set('catalogSection', filters.catalogSection);
  if (filters.catalogLine) params.set('catalogLine', filters.catalogLine);
  if (filters.house) params.set('house', filters.house);
  if (filters.category) params.set('category', filters.category);
  if (filters.featured) params.set('featured', 'true');
  params.set('take', '24');
  return params;
}

export function CatalogExperience({
  initialProducts,
  initialNextCursor,
  categories,
  navigation: navigationInput,
  perfumeHouses,
}: {
  initialProducts: Product[];
  initialNextCursor: string | null;
  categories: Category[];
  navigation: CatalogNavigation;
  perfumeHouses: PerfumeHouse[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notify = useNotify();
  const navigation = useMemo(
    () => mergeCatalogNavigation(navigationInput),
    [navigationInput],
  );
  const allLines = useMemo(
    () => navigation.sections.flatMap((section) => section.lines),
    [navigation],
  );
  const requestedLine = searchParams.get('catalogLine') ?? '';
  const requestedSection = searchParams.get('catalogSection') ?? '';
  const inferredSection =
    requestedSection ||
    navigation.sections.find((section) =>
      section.lines.some((item) => item.slug === requestedLine),
    )?.slug ||
    '';

  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [catalogSection, setCatalogSection] = useState(inferredSection);
  const [catalogLine, setCatalogLine] = useState(requestedLine);
  const [house, setHouse] = useState(searchParams.get('house') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [featured, setFeatured] = useState(searchParams.get('featured') === 'true');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtersState = useMemo<ProductFilters>(
    () => ({
      query,
      catalogSection,
      catalogLine,
      house,
      category,
      featured,
    }),
    [query, catalogSection, catalogLine, house, category, featured],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const params = buildProductParams(filtersState);

      setLoading(true);
      try {
        const result = await apiRequest<ProductListResponse>(
          `/products?${params.toString()}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        setProducts(result.items);
        setNextCursor(result.nextCursor);
        params.delete('take');
        router.replace(
          `${pathname}${params.size ? `?${params.toString()}` : ''}`,
          { scroll: false },
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          notify({
            title: 'No pudimos filtrar el catálogo',
            description: errorMessage(error),
            tone: 'error',
          });
        }
      } finally {
        setLoading(false);
      }
    }, query ? 320 : 80);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filtersState, pathname, router, notify, query]);

  const activeSection = navigation.sections.find(
    (section) => section.slug === catalogSection,
  );
  const activeLine = allLines.find((item) => item.slug === catalogLine);
  const activeHouse = perfumeHouses.find((item) => item.slug === house);
  const visibleLines = activeSection?.lines ?? [];
  const houseOptions = useMemo(() => {
    const candidates = activeLine?.houses?.length
      ? activeLine.houses
      : perfumeHouses;
    return [...new Map(candidates.map((item) => [item.slug, item])).values()].sort(
      (left, right) => left.name.localeCompare(right.name, 'es'),
    );
  }, [activeLine, perfumeHouses]);

  const sortedProducts = useMemo(() => {
    const next = [...products];
    if (sort === 'price-asc') {
      next.sort(
        (a, b) =>
          (a.priceRange.minimumCents ?? Infinity) -
          (b.priceRange.minimumCents ?? Infinity),
      );
    }
    if (sort === 'price-desc') {
      next.sort(
        (a, b) =>
          (b.priceRange.minimumCents ?? -1) -
          (a.priceRange.minimumCents ?? -1),
      );
    }
    if (sort === 'name') {
      next.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    return next;
  }, [products, sort]);

  const childCategories = categories.flatMap((parent) => parent.children ?? []);
  const activeCount = [
    catalogSection,
    catalogLine,
    house,
    category,
    featured,
  ].filter(Boolean).length;
  const heroTitle = activeHouse
    ? activeLine
      ? `${activeHouse.name} en ${activeLine.name}`
      : `Inspiraciones de ${activeHouse.name}`
    : activeLine?.name ?? activeSection?.name ?? 'Perfumes, belleza y hogar';
  const heroDescription =
    activeLine?.description ??
    activeSection?.description ??
    'Explora cada línea de la tienda y encuentra productos organizados para comprar con claridad.';

  function clearFilters() {
    setQuery('');
    setCatalogSection('');
    setCatalogLine('');
    setHouse('');
    setCategory('');
    setFeatured(false);
  }

  function chooseSection(slug: string) {
    setCatalogSection(slug);
    const nextSection = navigation.sections.find((section) => section.slug === slug);
    if (!nextSection?.lines.some((item) => item.slug === catalogLine)) {
      setCatalogLine('');
      setHouse('');
    }
  }

  function chooseLine(item: CatalogLine | null) {
    setCatalogLine(item?.slug ?? '');
    setHouse('');
    if (!item) return;
    const parent = navigation.sections.find((section) =>
      section.lines.some((line) => line.slug === item.slug),
    );
    if (parent) setCatalogSection(parent.slug);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const params = buildProductParams(filtersState);
    params.set('cursor', nextCursor);
    setLoadingMore(true);
    try {
      const result = await apiRequest<ProductListResponse>(
        `/products?${params.toString()}`,
        { cache: 'no-store' },
      );
      setProducts((current) => {
        const currentIds = new Set(current.map((product) => product.id));
        return [
          ...current,
          ...result.items.filter((product) => !currentIds.has(product.id)),
        ];
      });
      setNextCursor(result.nextCursor);
    } catch (error) {
      notify({
        title: 'No pudimos cargar más productos',
        description: errorMessage(error),
        tone: 'error',
      });
    } finally {
      setLoadingMore(false);
    }
  }

  const filters = (
    <div className="catalogFilters">
      <div className="catalogFilters__heading">
        <div>
          <SlidersHorizontal aria-hidden="true" size={17} />
          <strong>Filtrar</strong>
          {activeCount > 0 && <span>{activeCount}</span>}
        </div>
        {activeCount > 0 && (
          <button onClick={clearFilters} type="button">
            <RotateCcw aria-hidden="true" size={14} /> Limpiar
          </button>
        )}
      </div>
      <FilterGroup label="Departamento">
        <FilterOption
          active={!catalogSection}
          label="Toda la tienda"
          onClick={() => chooseSection('')}
        />
        {navigation.sections.map((section) => (
          <FilterOption
            active={catalogSection === section.slug}
            key={section.slug}
            label={section.name}
            onClick={() => chooseSection(section.slug)}
          />
        ))}
      </FilterGroup>
      {activeSection && (
        <FilterGroup label="Línea">
          <FilterOption
            active={!catalogLine}
            label={`Todo en ${activeSection.name}`}
            onClick={() => chooseLine(null)}
          />
          {visibleLines.map((item) => (
            <FilterOption
              active={catalogLine === item.slug}
              key={item.slug}
              label={item.name}
              onClick={() => chooseLine(item)}
            />
          ))}
        </FilterGroup>
      )}
      {(catalogSection === 'perfumes' || catalogLine || house) &&
        houseOptions.length > 0 && (
          <FilterGroup label="Casa perfumera">
            <FilterOption
              active={!house}
              label="Todas las casas"
              onClick={() => setHouse('')}
            />
            {houseOptions.map((item) => (
              <FilterOption
                active={house === item.slug}
                key={item.slug}
                label={item.name}
                onClick={() => setHouse(item.slug)}
              />
            ))}
          </FilterGroup>
        )}
      {childCategories.length > 0 && (
        <FilterGroup label="Clasificación adicional">
          <FilterOption
            active={!category}
            label="Todas"
            onClick={() => setCategory('')}
          />
          {childCategories.map((item) => (
            <FilterOption
              active={category === item.slug}
              key={item.id}
              label={item.name}
              onClick={() => setCategory(item.slug)}
            />
          ))}
        </FilterGroup>
      )}
      <label className="featuredToggle">
        <input
          checked={featured}
          onChange={(event) => setFeatured(event.target.checked)}
          type="checkbox"
        />
        <span />
        Solo productos destacados
      </label>
    </div>
  );

  return (
    <main className="catalogPage">
      <header className="catalogHero">
        <div className="pageWidth">
          <span className="eyebrow">
            {activeHouse ? 'Casa perfumera' : activeSection?.name ?? 'Catálogo KI’IBOK'}
          </span>
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
      </header>

      <div className="catalogToolbar pageWidth">
        <label className="catalogSearch">
          <Search aria-hidden="true" size={18} />
          <input
            aria-label="Buscar en el catálogo"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar aroma, casa perfumera o producto"
            value={query}
          />
          {query && (
            <button
              aria-label="Borrar búsqueda"
              onClick={() => setQuery('')}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          )}
        </label>
        <button
          className="catalogFilterButton"
          onClick={() => setFiltersOpen(true)}
          type="button"
        >
          <Filter aria-hidden="true" size={17} /> Filtros
          {activeCount > 0 && <span>{activeCount}</span>}
        </button>
        <label className="catalogSort">
          <span>Ordenar</span>
          <select
            aria-label="Ordenar productos"
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
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
            <p>
              <strong>{sortedProducts.length}</strong> productos mostrados
            </p>
            {loading && (
              <span>
                <i /> Actualizando
              </span>
            )}
          </div>
          {sortedProducts.length ? (
            <div className="productGrid catalogResults__grid">
              {sortedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  priority={index < 4}
                  product={product}
                />
              ))}
            </div>
          ) : (
            <div className="catalogNoResults">
              <Search aria-hidden="true" size={26} />
              <h2>Aún no hay productos en esta selección.</h2>
              <p>
                La estructura ya está lista para recibir el nuevo inventario de la
                tienda.
              </p>
              <button
                className="button button--dark"
                onClick={clearFilters}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={17} /> Ver toda la tienda
              </button>
            </div>
          )}
          {nextCursor && sortedProducts.length > 0 && (
            <div className="catalogLoadMore">
              <button
                className="button button--dark button--large"
                disabled={loadingMore}
                onClick={loadMore}
                type="button"
              >
                {loadingMore ? (
                  <>
                    <span className="buttonSpinner" /> Cargando productos
                  </>
                ) : (
                  'Cargar más productos'
                )}
              </button>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.button
              aria-label="Cerrar filtros"
              animate={{ opacity: 1 }}
              className="drawerBackdrop"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setFiltersOpen(false)}
              type="button"
            />
            <motion.aside
              animate={{ x: 0 }}
              className="filterDrawer"
              exit={{ x: '-100%' }}
              initial={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              <div className="filterDrawer__header">
                <h2>Filtros</h2>
                <button
                  aria-label="Cerrar filtros"
                  className="iconButton"
                  onClick={() => setFiltersOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              {filters}
              <button
                className="button button--dark button--wide button--large"
                onClick={() => setFiltersOpen(false)}
                type="button"
              >
                Ver {sortedProducts.length} productos cargados
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="filterGroup" open>
      <summary>
        {label}
        <ChevronDown aria-hidden="true" size={15} />
      </summary>
      <div>{children}</div>
    </details>
  );
}

function FilterOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`filterOption ${active ? 'isActive' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span>{active && <Check aria-hidden="true" size={12} />}</span>
      {label}
    </button>
  );
}
