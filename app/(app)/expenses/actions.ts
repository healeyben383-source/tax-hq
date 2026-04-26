"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types, constants and option lists live in
// ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  expenseCategoryOptions,
  expenseCurrencyOptions,
  type CreateExpenseState,
  type CreateExpenseValues,
} from "./form-state";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ParsedNumbers = { amount: number; audAmount: number };

function readValues(formData: FormData): CreateExpenseValues {
  return {
    provider_id: String(formData.get("provider_id") ?? "").trim(),
    spent_on: String(formData.get("spent_on") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    currency: String(formData.get("currency") ?? "")
      .trim()
      .toUpperCase(),
    aud_amount: String(formData.get("aud_amount") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    deductible: formData.get("deductible") === "1",
    invoice_saved: formData.get("invoice_saved") === "1",
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function validateValues(values: CreateExpenseValues): {
  error: string | null;
  parsed: ParsedNumbers | null;
} {
  if (!values.provider_id) {
    return { error: "Provider is required.", parsed: null };
  }
  if (!values.spent_on) {
    return { error: "Date is required.", parsed: null };
  }
  if (!isoDatePattern.test(values.spent_on)) {
    return { error: "Date must be in YYYY-MM-DD format.", parsed: null };
  }

  const amount = Number(values.amount);
  if (!values.amount || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number.", parsed: null };
  }

  const audAmount = Number(values.aud_amount);
  if (!values.aud_amount || !Number.isFinite(audAmount) || audAmount < 0) {
    return { error: "AUD amount must be a non-negative number.", parsed: null };
  }

  if (!expenseCurrencyOptions.includes(values.currency)) {
    return { error: "Currency is not supported.", parsed: null };
  }

  if (!expenseCategoryOptions.includes(values.category)) {
    return { error: "Category is not recognised.", parsed: null };
  }

  return { error: null, parsed: { amount, audAmount } };
}

// Defense-in-depth: ensure the submitted provider_id belongs to the signed-in
// user. RLS on `providers` restricts SELECT to owned rows, so a foreign or
// non-existent id returns null.
async function ensureProviderIsOwned(
  supabase: ServerSupabase,
  providerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("providers")
    .select("id")
    .eq("id", providerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Selected provider not found.";
  return null;
}

export async function createExpenseAction(
  _prev: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const values = readValues(formData);

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { amount, audAmount } = v.parsed;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values };
  }

  const providerError = await ensureProviderIsOwned(supabase, values.provider_id);
  if (providerError) {
    return { error: providerError, values };
  }

  const { error } = await supabase.from("expenses").insert({
    // owner_id is authoritative — taken from the authenticated session,
    // NEVER from the form. RLS `with check (auth.uid() = owner_id)` also
    // enforces this at the DB layer.
    owner_id: user.id,
    provider_id: values.provider_id,
    spent_on: values.spent_on,
    amount,
    currency: values.currency,
    aud_amount: audAmount,
    category: values.category,
    deductible: values.deductible,
    invoice_saved: values.invoice_saved,
    source: "manual",
    notes: values.notes || null,
    // tax_year_start is populated by the BEFORE INSERT trigger from spent_on.
    // fx_rate / fx_rate_date intentionally NULL — no FX conversion yet.
  });

  if (error) {
    return { error: error.message, values };
  }

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateExpenseAction(
  _prev: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const id = String(formData.get("id") ?? "").trim();
  const values = readValues(formData);

  if (!id) {
    return { error: "Missing expense id.", values };
  }

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { amount, audAmount } = v.parsed;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values };
  }

  const providerError = await ensureProviderIsOwned(supabase, values.provider_id);
  if (providerError) {
    return { error: providerError, values };
  }

  // Update is double-scoped: RLS enforces `auth.uid() = owner_id`, and we
  // also pin `.eq('owner_id', user.id)`. Never include owner_id in the
  // update payload — ownership is immutable through this code path.
  // `source` is intentionally omitted — the original create value stays.
  // `tax_year_start` is recomputed by a BEFORE UPDATE trigger when spent_on changes.
  const { data, error } = await supabase
    .from("expenses")
    .update({
      provider_id: values.provider_id,
      spent_on: values.spent_on,
      amount,
      currency: values.currency,
      aud_amount: audAmount,
      category: values.category,
      deductible: values.deductible,
      invoice_saved: values.invoice_saved,
      notes: values.notes || null,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { error: error.message, values };
  }

  // If RLS filtered the row out (not owner, or already soft-deleted) the
  // query returns no error but zero rows. Report cleanly.
  if (!data || data.length === 0) {
    return {
      error: "Expense not found or you do not have permission to edit it.",
      values,
    };
  }

  revalidatePath("/expenses");
  redirect("/expenses");
}

// Direct form-action signature — invoked from the per-row Delete button.
// Soft-delete only: sets deleted_at = now() on the owned row. Documents
// linked to this expense are intentionally NOT touched: the FK is
// `on delete set null` for hard deletes only — soft delete just stops the
// expense appearing in lists. Existing edit-form logic on /documents already
// resets a now-invisible expense_id to "— none —".
export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/expenses");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);
  // Silent no-op when RLS or the deleted_at filter zero-rows the update —
  // matches the Documents pattern.

  revalidatePath("/expenses");
  revalidatePath("/");
  redirect("/expenses");
}

// Restore an archived expense by clearing deleted_at. Owner-scoped via RLS
// and an explicit eq filter. No app-level conflict to handle — the FK to
// providers is `on delete restrict` for hard deletes only, and a soft-deleted
// provider doesn't break referential integrity.
export async function restoreExpenseAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/expenses?archived=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("expenses")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  revalidatePath("/expenses");
  revalidatePath("/");
  redirect("/expenses");
}
