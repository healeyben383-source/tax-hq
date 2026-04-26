// Single source of truth for the placeholder FX conversion the app uses
// while no real FX feed exists. Replace this with a live rate source (or
// per-row stored fx_rate / fx_rate_date on expenses) when one ships.
//
// Why this lives here, separate from format.ts: numeric estimation is a
// different concern from display rendering. format.ts already pulls Currency
// in for type-safe locale formatting; this module stays free of presentation
// concerns so it's safe to import from server actions, page-load sweeps, and
// other non-display code paths.

// Indicative AUD per 1 USD. Conservative high-side estimate so we lean
// towards over-recording rather than under-reporting deductible spend.
export const DEFAULT_USD_TO_AUD_RATE = 1.56;

// Returns an AUD-equivalent amount for any source currency. For currencies
// without a defined rate we fall back to the USD rate — matches the existing
// dashboard behaviour where any non-AUD amount was multiplied by 1.56. Better
// to over-estimate than to default to 1:1 and silently under-record.
export function estimateAudAmount(amount: number, currency: string): number {
  if (currency === "AUD") return amount;
  if (currency === "USD") return amount * DEFAULT_USD_TO_AUD_RATE;
  return amount * DEFAULT_USD_TO_AUD_RATE;
}
