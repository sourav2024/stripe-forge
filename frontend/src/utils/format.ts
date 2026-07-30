/**
 * Money arrives from the API as integer minor units (e.g. cents). Format it to a
 * localized currency string, e.g. formatMoney(1234, 'usd') -> "$12.34".
 */
export function formatMoney(minor: number, currency = 'usd'): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(minor / 100);
  } catch {
    // Unknown currency code: fall back to a plain decimal with the code appended.
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

/** Compact number formatting, e.g. 12000 -> "12K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}

/** Human-readable date/time, e.g. "Jul 15, 2026, 4:20 PM". */
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/** Short date, e.g. "Jul 15, 2026". */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}

/** Relative time, e.g. "3 hours ago". */
export function formatRelative(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'just now';
}

/** Truncate a long id for compact display, keeping head + tail. */
export function shortId(id: string, head = 8): string {
  if (id.length <= head + 4) return id;
  return `${id.slice(0, head)}…${id.slice(-4)}`;
}
