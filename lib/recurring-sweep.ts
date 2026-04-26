// Page-load sweep that materialises recurring subscriptions into expense rows
// when their next_renewal_on date arrives. Called from /expenses and / (the
// dashboard) before either page reads its data, so newly-created expenses
// appear in the same render. No cron / no background worker — the user
// loading a page is the trigger.
//
// Safety contract: this function NEVER throws. Every step is wrapped in
// try/catch and on any failure (RLS, constraint, transient error) the sweep
// silently degrades to a no-op so it can't break the page.
//
// Duplicate prevention is a two-pass check:
//   1. Primary (post-migration): look for an expense with the same
//      generated_from_recurring_id whose spent_on falls within ±1 day. This
//      is structural — no string parsing, no false positives from manually
//      entered rows that happen to have the same provider + amount.
//   2. Legacy fallback: rows created before the provenance migration only
//      have `notes ILIKE '%auto-generated%'` to identify them. The fallback
//      keeps those rows from being duplicated until they're either edited
//      (and the new column populated) or aged out naturally.
// If either match fires we skip the insert but still advance
// next_renewal_on so the sweep doesn't loop on the same date.
//
// FX: amounts are converted via estimateAudAmount (lib/fx.ts) so the
// placeholder rate lives in one place. aud_amount is NOT NULL on the
// expenses table.

import { estimateAudAmount } from "@/lib/fx";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const AUTO_NOTE = "Auto-generated from recurring subscription";

// Provider category → expense category. The two domains overlap but aren't
// identical: providers have AI / Payments / Finance, expenses have AI tools
// / Fees / Hardware. Anything without a clean match falls through to "Other"
// so the insert can never fail the CHECK constraint on category.
const providerToExpenseCategory: Record<string, string> = {
  AI: "AI tools",
  Software: "Software",
  Hosting: "Hosting",
  Domains: "Domains",
  Payments: "Other",
  Finance: "Other",
  Other: "Other",
};

type RecurringSweepRow = {
  id: string;
  provider_id: string;
  amount: number | string;
  currency: string;
  cadence: string;
  next_renewal_on: string;
  provider: { category: string } | null;
};

export async function runRecurringExpenseSweep(
  supabase: ServerSupabase,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const todayIso = isoDate(new Date());

    const { data, error } = await supabase
      .from("recurring_subscriptions")
      .select(
        "id, provider_id, amount, currency, cadence, next_renewal_on, provider:providers(category)",
      )
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .is("cancelled_on", null)
      .lte("next_renewal_on", todayIso)
      .returns<RecurringSweepRow[]>();
    if (error) return;

    for (const sub of data ?? []) {
      try {
        await sweepOne(supabase, user.id, sub);
      } catch {
        // Continue with the next subscription — one bad row must not block
        // the rest.
      }
    }
  } catch {
    // Never throw out of the sweep.
  }
}

async function sweepOne(
  supabase: ServerSupabase,
  userId: string,
  sub: RecurringSweepRow,
): Promise<void> {
  const amount = Number(sub.amount);
  const date = sub.next_renewal_on;

  const minus1 = addDays(date, -1);
  const plus1 = addDays(date, 1);

  // Primary dedupe: structural — same source subscription, ±1 day. Catches
  // every row this sweep has created since the provenance migration shipped.
  const { data: primaryDups } = await supabase
    .from("expenses")
    .select("id")
    .eq("owner_id", userId)
    .eq("generated_from_recurring_id", sub.id)
    .gte("spent_on", minus1)
    .lte("spent_on", plus1)
    .is("deleted_at", null)
    .limit(1);
  if (primaryDups && primaryDups.length > 0) {
    await advance(supabase, userId, sub);
    return;
  }

  // Legacy fallback: pre-migration rows only have the AUTO_NOTE marker.
  // Match on provider + amount + ±1 day + notes substring. Same caveat as
  // before — substring lets the marker text evolve without breaking dedupe.
  const { data: legacyDups } = await supabase
    .from("expenses")
    .select("id")
    .eq("owner_id", userId)
    .eq("provider_id", sub.provider_id)
    .eq("amount", amount)
    .gte("spent_on", minus1)
    .lte("spent_on", plus1)
    .ilike("notes", "%auto-generated%")
    .is("deleted_at", null)
    .limit(1);
  if (legacyDups && legacyDups.length > 0) {
    await advance(supabase, userId, sub);
    return;
  }

  const providerCategory = sub.provider?.category ?? "Other";
  const category = providerToExpenseCategory[providerCategory] ?? "Other";
  const audAmount = estimateAudAmount(amount, sub.currency);

  const { error: insertError } = await supabase.from("expenses").insert({
    owner_id: userId,
    provider_id: sub.provider_id,
    spent_on: date,
    amount,
    currency: sub.currency,
    aud_amount: audAmount,
    category,
    deductible: true,
    invoice_saved: false,
    source: "recurring",
    auto_generated: true,
    generated_from_recurring_id: sub.id,
    notes: AUTO_NOTE,
  });
  if (insertError) return;

  await advance(supabase, userId, sub);
}

async function advance(
  supabase: ServerSupabase,
  userId: string,
  sub: RecurringSweepRow,
): Promise<void> {
  const next = advanceDate(sub.next_renewal_on, sub.cadence);
  if (!next) return;
  await supabase
    .from("recurring_subscriptions")
    .update({ next_renewal_on: next })
    .eq("id", sub.id)
    .eq("owner_id", userId)
    .is("deleted_at", null);
}

function advanceDate(iso: string, cadence: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (cadence === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else if (cadence === "quarterly") {
    d.setUTCMonth(d.getUTCMonth() + 3);
  } else if (cadence === "annual") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    return null;
  }
  return isoDate(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
