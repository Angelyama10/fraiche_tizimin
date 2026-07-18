'use client';

import { ArrowRight, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { productFallbackImage } from '@/lib/catalog';
import type { ProductSuggestion } from '@/lib/types';

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await apiRequest<ProductSuggestion[]>(
          `/products/search/suggestions?q=${encodeURIComponent(query.trim())}&take=6`,
          { signal: controller.signal, cache: 'no-store' },
        );
        setSuggestions(result);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/productos?q=${encodeURIComponent(query.trim())}`);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="searchDialog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Cerrar búsqueda" className="searchDialog__backdrop" onClick={onClose} type="button" />
          <motion.div
            aria-modal="true"
            className="searchDialog__panel"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            role="dialog"
          >
            <div className="searchDialog__header">
              <p>Encuentra tu próxima esencia</p>
              <button aria-label="Cerrar búsqueda" className="iconButton" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
            </div>
            <form className="predictiveSearch" onSubmit={submit}>
              <Search aria-hidden="true" size={22} />
              <input
                aria-label="Buscar perfumes y cuidado personal"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca por aroma, marca o familia..."
                ref={inputRef}
                value={query}
              />
              {loading && <span className="loadingDot" aria-label="Buscando" />}
            </form>
            <div className="searchDialog__content">
              {query.length < 2 ? (
                <div className="searchDialog__popular">
                  <span className="menuEyebrow">Búsquedas populares</span>
                  <div>
                    {['Floral', 'Árabe', '37% esencia', 'Cuidado corporal'].map((term) => (
                      <button key={term} onClick={() => setQuery(term)} type="button">{term}</button>
                    ))}
                  </div>
                </div>
              ) : suggestions.length ? (
                <div className="suggestionList">
                  {suggestions.map((suggestion) => {
                    const image = suggestion.images[0]?.url || productFallbackImage(suggestion.slug);
                    return (
                      <Link href={`/productos/${suggestion.slug}`} key={suggestion.slug} onClick={onClose}>
                        <div className="suggestionList__image">
                          {image ? (
                            <Image alt={suggestion.images[0]?.altText || suggestion.name} fill sizes="64px" src={image} unoptimized={image.startsWith('http')} />
                          ) : (
                            <span>{suggestion.name[0]}</span>
                          )}
                        </div>
                        <span><strong>{suggestion.name}</strong><small>{suggestion.brand?.name ?? 'Fraîche Tizimín'}</small></span>
                        <ArrowRight aria-hidden="true" size={18} />
                      </Link>
                    );
                  })}
                  <button className="searchDialog__all" onClick={submit} type="button">
                    Ver todos los resultados <ArrowRight aria-hidden="true" size={17} />
                  </button>
                </div>
              ) : (
                !loading && <p className="emptyMessage">No encontramos coincidencias. Prueba con otra nota o línea.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
