export function formatMoney(cents: number | null | undefined, currency = 'MXN') {
  if (cents === null || cents === undefined) return 'Consultar precio';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const defaults: Intl.DateTimeFormatOptions = options?.dateStyle
    ? {}
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('es-MX', { ...defaults, ...options }).format(new Date(value));
}

export function initials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'FT';
}
