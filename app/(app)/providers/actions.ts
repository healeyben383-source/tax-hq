"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types and constants live in ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateProviderState,
  CreateProviderValues,
} from "./form-state";

const slugPattern = /^[a-z0-9-]+$/;

function readValues(formData: FormData): CreateProviderValues {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    billing_type: String(formData.get("billing_type") ?? ""),
    invoice_source: String(formData.get("invoice_source") ?? ""),
    renewal_cycle: String(formData.get("renewal_cycle") ?? ""),
    login_email: String(formData.get("login_email") ?? "").trim(),
  };
}

function validateShape(values: CreateProviderValues): string | null {
  if (!values.name || !values.slug) {
    return "Name and slug are required.";
  }
  if (!slugPattern.test(values.slug)) {
    return "Slug must be lowercase letters, numbers, and hyphens only.";
  }
  return null;
}

export async function createProviderAction(
  _prev: CreateProviderState,
  formData: FormData,
): Promise<CreateProviderState> {
  const values = readValues(formData);

  const shapeError = validateShape(values);
  if (shapeError) {
    return { error: shapeError, values };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in.", values };
  }

  const { error } = await supabase.from("providers").insert({
    // owner_id is authoritative — taken from the authenticated session,
    // NEVER from the form. RLS `with check (auth.uid() = owner_id)` also
    // enforces this at the database layer.
    owner_id: user.id,
    name: values.name,
    slug: values.slug,
    category: values.category,
    billing_type: values.billing_type,
    invoice_source: values.invoice_source,
    renewal_cycle: values.renewal_cycle,
    login_email: values.login_email || null,
  });

  if (error) {
    const friendly =
      error.code === "23505"
        ? `A provider with slug "${values.slug}" already exists.`
        : error.message;
    return { error: friendly, values };
  }

  revalidatePath("/providers");
  redirect("/providers");
}

export async function updateProviderAction(
  _prev: CreateProviderState,
  formData: FormData,
): Promise<CreateProviderState> {
  const id = String(formData.get("id") ?? "").trim();
  const values = readValues(formData);

  if (!id) {
    return { error: "Missing provider id.", values };
  }

  const shapeError = validateShape(values);
  if (shapeError) {
    return { error: shapeError, values };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in.", values };
  }

  // Update is double-scoped: RLS enforces `auth.uid() = owner_id`, and we also
  // pin `.eq('owner_id', user.id)` explicitly. Never include owner_id in the
  // update payload — ownership is immutable through this code path.
  const { data, error } = await supabase
    .from("providers")
    .update({
      name: values.name,
      slug: values.slug,
      category: values.category,
      billing_type: values.billing_type,
      invoice_source: values.invoice_source,
      renewal_cycle: values.renewal_cycle,
      login_email: values.login_email || null,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    const friendly =
      error.code === "23505"
        ? `A provider with slug "${values.slug}" already exists.`
        : error.message;
    return { error: friendly, values };
  }

  // If RLS filtered the row out (not owner, or already soft-deleted) the
  // query returns no error but zero rows. Report cleanly.
  if (!data || data.length === 0) {
    return {
      error: "Provider not found or no longer editable.",
      values,
    };
  }

  revalidatePath("/providers");
  redirect("/providers");
}

// Direct form-action signature — invoked from the per-row Delete button.
// Refuses to delete if any active linked records exist (expenses,
// documents, recurring_subscriptions). On refusal, redirects with
// `?warn=linked` so the page can render a friendly notice. Soft-delete only.
export async function deleteProviderAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/providers");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Confirm ownership + existence before doing anything else. Silent no-op
  // for non-owned / missing — matches the Documents pattern.
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) {
    redirect("/providers");
  }

  // Active linked-record check. Run the three counts in parallel.
  const [expensesResult, documentsResult, recurringResult] = await Promise.all([
    supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", id)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", id)
      .is("deleted_at", null),
    supabase
      .from("recurring_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", id)
      .is("deleted_at", null),
  ]);
  const linkedTotal =
    (expensesResult.count ?? 0) +
    (documentsResult.count ?? 0) +
    (recurringResult.count ?? 0);

  if (linkedTotal > 0) {
    redirect("/providers?warn=linked");
  }

  await supabase
    .from("providers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  revalidatePath("/providers");
  revalidatePath("/");
  redirect("/providers");
}

// Restore an archived provider by clearing deleted_at. The unique index on
// (owner_id, slug) is partial — `WHERE deleted_at IS NULL` — so restoring a
// row whose slug matches an existing active provider raises 23505. We map
// that to `?warn=slug-conflict` so the page renders a friendly notice.
export async function restoreProviderAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/providers?archived=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { error } = await supabase
    .from("providers")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  if (error?.code === "23505") {
    redirect("/providers?archived=1&warn=slug-conflict");
  }
  if (error) {
    redirect("/providers?archived=1");
  }

  revalidatePath("/providers");
  revalidatePath("/");
  redirect("/providers");
}
