'use client';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  History,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { LINE_LABELS } from '@/lib/catalog';
import { formatDate, formatMoney } from '@/lib/format';
import type { Brand, Category, ProductLine } from '@/lib/types';
import type { AdminRequest } from './admin-app';

type AdjustmentDirection = 'INCREASE' | 'DECREASE';
type AdjustmentScope = 'ALL' | 'LINE' | 'BRAND' | 'CATEGORY';
type RoundingMode = 'CENT' | 'PESO' | 'FIVE_PESOS' | 'TEN_PESOS';

type AdjustmentSummary = {
  affectedProducts: number;
  affectedVariants: number;
  affectedFixedVariants: number;
  affectedFixedPolicies: number;
  skippedFixedVariants: number;
  skippedMissingPrices: number;
  unchanged: number;
  currentMinimumCents: number | null;
  currentMaximumCents: number | null;
  nextMinimumCents: number | null;
  nextMaximumCents: number | null;
  totalDeltaCents: number;
};

type AdjustmentSample = {
  kind: 'VARIANT' | 'POLICY';
  id: string;
  label: string;
  sku: string | null;
  line: ProductLine;
  currentPriceCents: number;
  nextPriceCents: number;
  differenceCents: number;
};

type AdjustmentPreview = {
  generatedAt: string;
  summary: AdjustmentSummary;
  sample: AdjustmentSample[];
  warnings: string[];
};

type AdjustmentRequestSnapshot = {
  direction: AdjustmentDirection;
  percentage: number;
  scope: AdjustmentScope;
  line?: ProductLine | null;
  brandId?: string | null;
  categoryId?: string | null;
  includeDrafts: boolean;
  includeFixedPolicies: boolean;
  rounding: RoundingMode;
  reason: string;
};

type AdjustmentHistoryEntry = {
  id: string;
  batchId: string;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  reason: string;
  request: AdjustmentRequestSnapshot;
  summary: AdjustmentSummary;
  warnings: unknown[];
};

type AdjustmentHistoryResponse = {
  data: AdjustmentHistoryEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

type FormState = {
  direction: AdjustmentDirection;
  percentage: string;
  scope: AdjustmentScope;
  line: ProductLine;
  brandId: string;
  categoryId: string;
  includeDrafts: boolean;
  includeFixedPolicies: boolean;
  rounding: RoundingMode;
  reason: string;
};

type CategoryOption = {
  id: string;
  label: string;
};

const PRESETS = [5, 10, 16];

function flattenCategories(categories: Category[], prefix = ''): CategoryOption[] {
  return categories.flatMap((category) => {
    const label = prefix ? `${prefix} · ${category.name}` : category.name;
    return [
      { id: category.id, label },
      ...flattenCategories(category.children ?? [], label),
    ];
  });
}

function scopeLabel(
  request: AdjustmentRequestSnapshot,
  brands: Brand[],
  categories: CategoryOption[],
) {
  if (request.scope === 'LINE' && request.line) {
    return LINE_LABELS[request.line];
  }
  if (request.scope === 'BRAND') {
    return brands.find((brand) => brand.id === request.brandId)?.name ?? 'Marca';
  }
  if (request.scope === 'CATEGORY') {
    return categories.find((category) => category.id === request.categoryId)?.label ?? 'Categoría';
  }
  return 'Todo el catálogo';
}

export function AdminPriceManager({
  brands,
  categories,
  request,
  onSuccess,
}: {
  brands: Brand[];
  categories: Category[];
  request: AdminRequest;
  onSuccess: (message: string) => void;
}) {
  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);
  const [form, setForm] = useState<FormState>(() => ({
    direction: 'INCREASE',
    percentage: '5',
    scope: 'ALL',
    line: 'DESIGNER_CLASSIC',
    brandId: brands[0]?.id ?? '',
    categoryId: categoryOptions[0]?.id ?? '',
    includeDrafts: false,
    includeFixedPolicies: true,
    rounding: 'PESO',
    reason: 'Actualización periódica de precios',
  }));
  const [preview, setPreview] = useState<AdjustmentPreview | null>(null);
  const [history, setHistory] = useState<AdjustmentHistoryEntry[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await request<AdjustmentHistoryResponse>(
        '/admin/prices/adjustments?page=1&pageSize=8',
      );
      setHistory(response.data);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingHistory(false);
    }
  }, [request]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!form.brandId && brands[0]?.id) {
      setForm((current) => ({ ...current, brandId: brands[0].id }));
    }
  }, [brands, form.brandId]);

  useEffect(() => {
    if (!form.categoryId && categoryOptions[0]?.id) {
      setForm((current) => ({ ...current, categoryId: categoryOptions[0].id }));
    }
  }, [categoryOptions, form.categoryId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setError('');
  }

  function adjustmentPayload(confirmed = false) {
    return {
      direction: form.direction,
      percentage: Number(form.percentage),
      scope: form.scope,
      ...(form.scope === 'LINE' ? { line: form.line } : {}),
      ...(form.scope === 'BRAND' ? { brandId: form.brandId } : {}),
      ...(form.scope === 'CATEGORY' ? { categoryId: form.categoryId } : {}),
      includeDrafts: form.includeDrafts,
      includeFixedPolicies:
        (form.scope === 'ALL' || form.scope === 'LINE') &&
        form.includeFixedPolicies,
      rounding: form.rounding,
      reason: form.reason.trim(),
      ...(confirmed ? { confirmed: true } : {}),
    };
  }

  function validateForm() {
    const percentage = Number(form.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0) {
      return 'Escribe un porcentaje mayor a 0.';
    }
    if (form.direction === 'DECREASE' && percentage >= 100) {
      return 'Una reducción debe ser menor a 100 %.';
    }
    if (form.scope === 'BRAND' && !form.brandId) {
      return 'Selecciona una marca.';
    }
    if (form.scope === 'CATEGORY' && !form.categoryId) {
      return 'Selecciona una categoría.';
    }
    if (form.reason.trim().length < 5) {
      return 'Explica brevemente el motivo del ajuste.';
    }
    return '';
  }

  async function createPreview() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoadingPreview(true);
    setError('');
    try {
      const response = await request<AdjustmentPreview>(
        '/admin/prices/percentage/preview',
        {
          method: 'POST',
          body: JSON.stringify(adjustmentPayload()),
        },
      );
      setPreview(response);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function applyAdjustment() {
    if (!preview) return;
    const changeCount =
      preview.summary.affectedVariants + preview.summary.affectedFixedPolicies;
    if (!changeCount) return;

    const action = form.direction === 'INCREASE' ? 'aumentar' : 'reducir';
    const confirmed = window.confirm(
      `Vas a ${action} ${form.percentage}% en ${preview.summary.affectedProducts} productos. Esta acción cambia los precios publicados. ¿Deseas continuar?`,
    );
    if (!confirmed) return;

    setApplying(true);
    setError('');
    try {
      const response = await request<AdjustmentPreview & { batchId: string }>(
        '/admin/prices/percentage/apply',
        {
          method: 'POST',
          body: JSON.stringify(adjustmentPayload(true)),
        },
      );
      setPreview(null);
      await loadHistory();
      onSuccess(
        `Precios actualizados en ${response.summary.affectedProducts} productos.`,
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setApplying(false);
    }
  }

  const hasApplicableChanges = Boolean(
    preview &&
      preview.summary.affectedVariants + preview.summary.affectedFixedPolicies > 0,
  );

  return (
    <div className="priceManager">
      <div className="priceManager__workspace">
        <section className="adminPanel priceManager__form">
          <div className="priceManager__sectionTitle">
            <div>
              <span className="adminEyebrow">Configuración</span>
              <h2>Define el ajuste</h2>
            </div>
            <ShieldCheck aria-hidden="true" size={21} />
          </div>

          <div className="priceManager__direction" role="group" aria-label="Tipo de ajuste">
            <button
              className={form.direction === 'INCREASE' ? 'isActive' : ''}
              onClick={() => update('direction', 'INCREASE')}
              type="button"
            >
              <ArrowUp size={16} />
              Aumentar
            </button>
            <button
              className={form.direction === 'DECREASE' ? 'isActive' : ''}
              onClick={() => update('direction', 'DECREASE')}
              type="button"
            >
              <ArrowDown size={16} />
              Reducir
            </button>
          </div>

          <div className="priceManager__percentage">
            <label className="adminField">
              <span>Porcentaje</span>
              <div>
                <input
                  inputMode="decimal"
                  max="500"
                  min="0.01"
                  onChange={(event) => update('percentage', event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.percentage}
                />
                <i aria-hidden="true">%</i>
              </div>
            </label>
            <div className="priceManager__presets" aria-label="Porcentajes frecuentes">
              {PRESETS.map((preset) => (
                <button
                  className={form.percentage === String(preset) ? 'isActive' : ''}
                  key={preset}
                  onClick={() => update('percentage', String(preset))}
                  type="button"
                >
                  {preset} %
                </button>
              ))}
            </div>
          </div>

          <label className="adminField">
            <span>Aplicar a</span>
            <select
              onChange={(event) => update('scope', event.target.value as AdjustmentScope)}
              value={form.scope}
            >
              <option value="ALL">Todo el catálogo publicado</option>
              <option value="LINE">Una línea de precio</option>
              <option value="BRAND">Una marca</option>
              <option value="CATEGORY">Una categoría</option>
            </select>
          </label>

          {form.scope === 'LINE' && (
            <label className="adminField">
              <span>Línea</span>
              <select
                onChange={(event) => update('line', event.target.value as ProductLine)}
                value={form.line}
              >
                {Object.entries(LINE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          )}

          {form.scope === 'BRAND' && (
            <label className="adminField">
              <span>Marca</span>
              <select
                onChange={(event) => update('brandId', event.target.value)}
                value={form.brandId}
              >
                <option value="">Selecciona una marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </label>
          )}

          {form.scope === 'CATEGORY' && (
            <label className="adminField">
              <span>Categoría</span>
              <select
                onChange={(event) => update('categoryId', event.target.value)}
                value={form.categoryId}
              >
                <option value="">Selecciona una categoría</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>
          )}

          <label className="adminField">
            <span>Redondeo comercial</span>
            <select
              onChange={(event) => update('rounding', event.target.value as RoundingMode)}
              value={form.rounding}
            >
              <option value="CENT">Al centavo más cercano</option>
              <option value="PESO">Al peso más cercano</option>
              <option value="FIVE_PESOS">Al múltiplo de $5 más cercano</option>
              <option value="TEN_PESOS">Al múltiplo de $10 más cercano</option>
            </select>
            <small>Ejemplo: $383 con redondeo a $10 se convierte en $380.</small>
          </label>

          <div className="priceManager__checks">
            <label>
              <input
                checked={form.includeDrafts}
                onChange={(event) => update('includeDrafts', event.target.checked)}
                type="checkbox"
              />
              <span>Incluir productos en borrador</span>
            </label>
            {(form.scope === 'ALL' || form.scope === 'LINE') && (
              <label>
                <input
                  checked={form.includeFixedPolicies}
                  onChange={(event) => update('includeFixedPolicies', event.target.checked)}
                  type="checkbox"
                />
                <span>Actualizar líneas con precio fijo</span>
              </label>
            )}
          </div>

          <label className="adminField">
            <span>Motivo del cambio</span>
            <textarea
              maxLength={240}
              onChange={(event) => update('reason', event.target.value)}
              placeholder="Ej. Ajuste anual de proveedor 2026"
              value={form.reason}
            />
            <small>Este texto queda guardado en el historial administrativo.</small>
          </label>

          {error && (
            <div className="priceManager__message priceManager__message--error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="adminPrimaryButton adminPrimaryButton--wide"
            disabled={loadingPreview}
            onClick={() => void createPreview()}
            type="button"
          >
            {loadingPreview ? <span className="buttonSpinner" /> : <Eye size={16} />}
            {loadingPreview ? 'Calculando...' : 'Generar vista previa'}
          </button>
          <p className="priceManager__safety">
            La vista previa no modifica ningún precio ni pedido existente.
          </p>
        </section>

        <section className="adminPanel priceManager__preview">
          <div className="priceManager__sectionTitle">
            <div>
              <span className="adminEyebrow">Antes de confirmar</span>
              <h2>Impacto del cambio</h2>
            </div>
            {preview && <small>{formatDate(preview.generatedAt, { dateStyle: 'short', timeStyle: 'short' })}</small>}
          </div>

          {!preview ? (
            <div className="priceManager__empty">
              <Eye size={25} />
              <strong>Primero revisa el resultado</strong>
              <p>Configura el porcentaje y genera una vista previa para conocer cada precio afectado.</p>
            </div>
          ) : (
            <>
              <div className="priceManager__stats">
                <div>
                  <span>Productos</span>
                  <strong>{preview.summary.affectedProducts}</strong>
                </div>
                <div>
                  <span>Variantes</span>
                  <strong>{preview.summary.affectedVariants + preview.summary.affectedFixedVariants}</strong>
                </div>
                <div>
                  <span>Precio mínimo</span>
                  <strong>{formatMoney(preview.summary.nextMinimumCents)}</strong>
                  <small>Antes {formatMoney(preview.summary.currentMinimumCents)}</small>
                </div>
                <div>
                  <span>Precio máximo</span>
                  <strong>{formatMoney(preview.summary.nextMaximumCents)}</strong>
                  <small>Antes {formatMoney(preview.summary.currentMaximumCents)}</small>
                </div>
              </div>

              <div className={`priceManager__delta ${preview.summary.totalDeltaCents < 0 ? 'isNegative' : ''}`}>
                <span>Variación total sobre una unidad de cada variante</span>
                <strong>
                  {preview.summary.totalDeltaCents > 0 ? '+' : ''}
                  {formatMoney(preview.summary.totalDeltaCents)}
                </strong>
              </div>

              {preview.warnings.map((warning) => (
                <div className="priceManager__message priceManager__message--warning" key={warning}>
                  <AlertTriangle size={16} />
                  <span>{warning}</span>
                </div>
              ))}

              {preview.sample.length > 0 ? (
                <div className="priceManager__tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto o regla</th>
                        <th>Actual</th>
                        <th>Nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((item) => (
                        <tr key={`${item.kind}-${item.id}`}>
                          <td>
                            <strong>{item.label}</strong>
                            <small>
                              {item.kind === 'POLICY'
                                ? `${LINE_LABELS[item.line]} · precio fijo`
                                : item.sku}
                            </small>
                          </td>
                          <td>{formatMoney(item.currentPriceCents)}</td>
                          <td>
                            <strong>{formatMoney(item.nextPriceCents)}</strong>
                            <small className={item.differenceCents < 0 ? 'isNegative' : ''}>
                              {item.differenceCents > 0 ? '+' : ''}
                              {formatMoney(item.differenceCents)}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <small>Se muestran hasta 12 cambios como muestra.</small>
                </div>
              ) : (
                <div className="priceManager__message">
                  <CheckCircle2 size={16} />
                  <span>Con esta configuración ningún precio cambiaría.</span>
                </div>
              )}

              <button
                className="adminPrimaryButton adminPrimaryButton--wide"
                disabled={!hasApplicableChanges || applying}
                onClick={() => void applyAdjustment()}
                type="button"
              >
                {applying ? <span className="buttonSpinner" /> : <ShieldCheck size={16} />}
                {applying ? 'Aplicando cambios...' : 'Confirmar y actualizar precios'}
              </button>
            </>
          )}
        </section>
      </div>

      <section className="adminPanel priceManager__history">
        <div className="priceManager__sectionTitle">
          <div>
            <span className="adminEyebrow">Auditoría</span>
            <h2>Historial de ajustes</h2>
          </div>
          <button
            aria-label="Actualizar historial"
            disabled={loadingHistory}
            onClick={() => void loadHistory()}
            title="Actualizar historial"
            type="button"
          >
            <RefreshCw className={loadingHistory ? 'isSpinning' : ''} size={17} />
          </button>
        </div>

        {loadingHistory && !history.length ? (
          <div className="priceManager__historyEmpty"><span className="buttonSpinner" /></div>
        ) : history.length ? (
          <div className="priceManager__historyList">
            {history.map((entry) => (
              <article key={entry.id}>
                <span className="priceManager__historyIcon"><History size={16} /></span>
                <div>
                  <strong>
                    {entry.request.direction === 'INCREASE' ? 'Aumento' : 'Reducción'} de {entry.request.percentage} %
                  </strong>
                  <p>{entry.reason}</p>
                  <small>
                    {scopeLabel(entry.request, brands, categoryOptions)} · {entry.summary.affectedProducts} productos
                  </small>
                </div>
                <div>
                  <strong>{entry.actor?.name ?? 'Administrador'}</strong>
                  <small>{formatDate(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="priceManager__historyEmpty">
            <History size={21} />
            <span>Aún no hay ajustes masivos registrados.</span>
          </div>
        )}
      </section>
    </div>
  );
}
