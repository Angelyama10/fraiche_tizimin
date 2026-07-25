export function formatMoney(cents: number | null | undefined, currency = 'MXN') {
  if (cents === null || cents === undefined) return 'Consultar precio';
  const hasFraction = Math.abs(cents) % 100 !== 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
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
