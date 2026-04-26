import type { Currency } from "./types";

export function formatMoney(amount: number, currency: Currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Always renders "{CCY} {amount}" — never relies on locale currency symbols
// to disambiguate. Use for any user-facing money display where the source
// currency matters (table cells, stat values, list rows, header summaries).
// Note: prefer this over formatMoney for new code. formatMoney's en-AU
// locale renders AUD as "$29.99" but USD as "USD 31.90", which mixes formats
// and creates ambiguity.
export function formatMoneyExplicit(
  amount: number,
  currency: Currency = "AUD",
): string {
  const formatted = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatMonth(month: number, year: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = new Date(iso).getTime();
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}
