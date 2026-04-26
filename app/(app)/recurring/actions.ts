"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types, constants and option lists live in
// ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recurringCadenceOptions,
  recurringCurrencyOptions,
  type CreateRecurringState,
  type CreateRecurringValues,
} from "./form-state";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ParsedRecurring = {
  amount: number;
};

function readValues(formData: FormData): CreateRecurringValues {
  return {
    provider_id: String(formData.get("provider_id") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    currency: String(formData.get("currency") ?? "")
      .trim()
      .toUpperCase(),
    cadence: String(formData.get("cadence") ?? ""),
    next_renewal_on: String(formData.get("next_renewal_on") ?? "").trim(),
    started_on: String(formData.get("started_on") ?? "").trim(),
    cancelled_on: String(formData.get("cancelled_on") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function validateValues(values: CreateRecurringValues): {
  error: string | null;
  parsed: ParsedRecurring | null;
} {
  if (!values.provider_id) {
    return { error: "Provider is required.", parsed: null };
  }

  const amount = Number(values.amount);
  if (!values.amount || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number.", parsed: null };
  }

  if (!recurringCurrencyOptions.includes(values.currency)) {
    return { error: "Currency is not supported.", parsed: null };
  }

  if (!recurringCadenceOptions.includes(values.cadence)) {
    return { error: "Cadence is not recognised.", parsed: null };
  }

  if (!values.next_renewal_on) {
    return { error: "Next renewal date is required.", parsed: null };
  }
  if (!isoDatePattern.test(values.next_renewal_on)) {
    return {
      error: "Next renewal date must be in YYYY-MM-DD format.",
      parsed: null,
    };
  }

  if (values.started_on && !isoDatePattern.test(values.started_on)) {
    return {
      error: "Started-on date must be in YYYY-MM-DD format.",
      parsed: null,
    };
  }

  if (values.cancelled_on && !isoDatePattern.test(values.cancelled_on)) {
    return {
      error: "Cancelled-on date must be in YYYY-MM-DD format.",
      parsed: null,
    };
  }

  // ISO YYYY-MM-DD strings sort lexicographically — safe to compare directly.
  if (
    values.cancelled_on &&
    values.started_on &&
    values.cancelled_on < values.started_on
  ) {
    return {
      error: "Cancelled date cannot be before the start date.",
      parsed: null,
    };
  }

  return { error: null, parsed: { amount } };
}

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

export async function createRecurringSubscriptionAction(
  _prev: CreateRecurringState,
  formData: FormData,
): Promise<CreateRecurringState> {
  const values = readValues(formData);

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { amount } = v.parsed;

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

  const { error } = await supabase.from("recurring_subscriptions").insert({
    // owner_id is authoritative — taken from the authenticated session,
    // NEVER from the form. RLS `with check (auth.uid() = owner_id)` also
    // enforces this at the DB layer.
    owner_id: user.id,
    provider_id: values.provider_id,
    amount,
    currency: values.currency,
    cadence: values.cadence,
    next_renewal_on: values.next_renewal_on,
    started_on: values.started_on || null,
    cancelled_on: values.cancelled_on || null,
    notes: values.notes || null,
    // `active` is a GENERATED column — never write to it.
  });

  if (error) {
    return { error: error.message, values };
  }

  revalidatePath("/recurring");
  redirect("/recurring");
}

export async function updateRecurringSubscriptionAction(
  _prev: CreateRecurringState,
  formData: FormData,
): Promise<CreateRecurringState> {
  const id = String(formData.get("id") ?? "").trim();
  const values = readValues(formData);

  if (!id) {
    return { error: "Missing subscription id.", values };
  }

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { amount } = v.parsed;

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
  // `active` is GENERATED so it's never sent either.
  const { data, error } = await supabase
    .from("recurring_subscriptions")
    .update({
      provider_id: values.provider_id,
      amount,
      currency: values.currency,
      cadence: values.cadence,
      next_renewal_on: values.next_renewal_on,
      started_on: values.started_on || null,
      cancelled_on: values.cancelled_on || null,
      notes: values.notes || null,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { error: error.message, values };
  }

  if (!data || data.length === 0) {
    return {
      error:
        "Subscription not found or you do not have permission to edit it.",
      values,
    };
  }

  revalidatePath("/recurring");
  redirect("/recurring");
}

// Direct form-action signature — invoked from the per-row Delete button.
// Soft-delete only: sets deleted_at = now() on the owned row.
export async function deleteRecurringSubscriptionAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/recurring");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("recurring_subscriptions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  revalidatePath("/recurring");
  revalidatePath("/");
  redirect("/recurring");
}

// Restore an archived recurring subscription by clearing deleted_at.
export async function restoreRecurringSubscriptionAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/recurring?archived=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("recurring_subscriptions")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  revalidatePath("/recurring");
  revalidatePath("/");
  redirect("/recurring");
}
