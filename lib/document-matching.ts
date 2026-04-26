// Server-only helper that picks the most likely active, unlinked expense to
// associate with a freshly-created document. Used by createDocumentAction to
// auto-fill expense_id when the user didn't pick one explicitly. The match
// is intentionally conservative — same owner, same provider, same calendar
// month, invoice still missing — so a wrong link is unlikely. The user can
// always override afterwards via the edit form.
//
// Safety contract: this function NEVER throws. RLS scopes the query to the
// caller and an explicit owner_id check is layered on top. A query error
// returns null and the caller proceeds as if no match was found.
//
// Amount-aware matching: when the caller provides a positive `amount`, the
// helper first looks for candidates whose source `amount` is within ±0.50
// of the supplied value. If that finds a candidate, it wins. If not, the
// helper falls through to the original provider + month query so amount is
// purely additive — never narrows the result set vs. the no-amount call.
// Comparison is against expenses.amount (source currency), NOT aud_amount,
// so no FX conversion is involved.

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type FindLikelyExpenseArgs = {
  supabase: ServerSupabase;
  ownerId: string;
  providerId: string;
  docMonth: number;
  docYear: number;
  // Optional document amount in source currency. Triggers the amount-aware
  // first pass. Non-positive / undefined falls straight through to the
  // provider+month query.
  amount?: number;
};

// ±0.50 tolerance — wide enough to absorb tip rounding and minor invoice
// adjustments without crossing into "different transaction" territory.
const AMOUNT_MATCH_TOLERANCE = 0.5;

type ExpenseCandidate = {
  id: string;
  spent_on: string;
  aud_amount: number | string;
};

export async function findLikelyExpenseForDocument(
  args: FindLikelyExpenseArgs,
): Promise<{ id: string } | null> {
  try {
    const { supabase, ownerId, providerId, docMonth, docYear, amount } = args;

    if (!ownerId || !providerId) return null;
    if (!Number.isInteger(docMonth) || docMonth < 1 || docMonth > 12) {
      return null;
    }
    if (!Number.isInteger(docYear) || docYear < 1900 || docYear > 2100) {
      return null;
    }

    const { startIso, nextStartIso } = monthRange(docMonth, docYear);

    // Pass 1 — amount-aware. Only runs when the caller supplied a positive
    // amount. Same owner / provider / month / open-invoice constraints as
    // pass 2, plus a tight window around the supplied amount in the source
    // currency (no FX conversion).
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
      const lo = amount - AMOUNT_MATCH_TOLERANCE;
      const hi = amount + AMOUNT_MATCH_TOLERANCE;
      const { data: amountMatch, error: amountError } = await supabase
        .from("expenses")
        .select("id, spent_on, aud_amount")
        .eq("owner_id", ownerId)
        .eq("provider_id", providerId)
        .eq("invoice_saved", false)
        .is("deleted_at", null)
        .gte("spent_on", startIso)
        .lt("spent_on", nextStartIso)
        .gte("amount", lo)
        .lte("amount", hi)
        .order("spent_on", { ascending: false })
        .order("aud_amount", { ascending: false })
        .limit(1)
        .returns<ExpenseCandidate[]>();
      if (!amountError && amountMatch && amountMatch.length > 0) {
        return { id: amountMatch[0].id };
      }
      // Fall through to pass 2 — amount narrowed nothing, treat as a hint.
    }

    // Pass 2 — original provider + month query. Owner + provider + same
    // calendar month + still missing an invoice. RLS already restricts to
    // the caller; the explicit owner_id keeps us defensible against any
    // future RLS regression.
    const { data, error } = await supabase
      .from("expenses")
      .select("id, spent_on, aud_amount")
      .eq("owner_id", ownerId)
      .eq("provider_id", providerId)
      .eq("invoice_saved", false)
      .is("deleted_at", null)
      .gte("spent_on", startIso)
      .lt("spent_on", nextStartIso)
      .order("spent_on", { ascending: false })
      .order("aud_amount", { ascending: false })
      .limit(1)
      .returns<ExpenseCandidate[]>();

    if (error) return null;
    if (!data || data.length === 0) return null;
    return { id: data[0].id };
  } catch {
    return null;
  }
}

function monthRange(month: number, year: number): {
  startIso: string;
  nextStartIso: string;
} {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const startIso = `${year}-${pad2(month)}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStartIso = `${nextYear}-${pad2(nextMonth)}-01`;
  return { startIso, nextStartIso };
}
