import type { Currency } from "./types";

export function formatMoney(amount: number, currency: Currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
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
