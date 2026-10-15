import { es } from "./es";

// Single locale for now. Adding a language means adding a catalog with the
// same shape and choosing it here.
export const t = es;
export const locale = "es-ES";

/** Replaces `{name}` placeholders. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function formatBudget(budget: number | null): string {
  if (budget == null) return t.common.noBudget;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(budget);
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return t.common.noDate;
  // Plain dates are calendar days: format them in UTC so the day never shifts.
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

/** Compact calendar day, e.g. "24 dic 2026". */
export function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return t.common.noDate;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${isoDate}T00:00:00Z`))
    .replace(".", "");
}
