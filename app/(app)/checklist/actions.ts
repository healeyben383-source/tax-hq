"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types, constants and option lists live in
// ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  monthlyTaskStatusOptions,
  type CreateMonthlyTaskState,
  type CreateMonthlyTaskValues,
} from "./form-state";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type ParsedTask = {
  period_year: number;
  period_month: number;
};

function readValues(formData: FormData): CreateMonthlyTaskValues {
  return {
    label: String(formData.get("label") ?? "").trim(),
    period_year: String(formData.get("period_year") ?? "").trim(),
    period_month: String(formData.get("period_month") ?? "").trim(),
    status: String(formData.get("status") ?? ""),
    due_on: String(formData.get("due_on") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    template_key: String(formData.get("template_key") ?? "").trim(),
  };
}

function validateValues(values: CreateMonthlyTaskValues): {
  error: string | null;
  parsed: ParsedTask | null;
} {
  if (!values.label) {
    return { error: "Label is required.", parsed: null };
  }
  if (!values.period_year) {
    return { error: "Year is required.", parsed: null };
  }
  const period_year = Number(values.period_year);
  if (
    !Number.isInteger(period_year) ||
    period_year < 2020 ||
    period_year > 2100
  ) {
    return { error: "Year must be between 2020 and 2100.", parsed: null };
  }
  if (!values.period_month) {
    return { error: "Month is required.", parsed: null };
  }
  const period_month = Number(values.period_month);
  if (
    !Number.isInteger(period_month) ||
    period_month < 1 ||
    period_month > 12
  ) {
    return { error: "Month must be between 1 and 12.", parsed: null };
  }
  if (!monthlyTaskStatusOptions.includes(values.status)) {
    return { error: "Status is not recognised.", parsed: null };
  }
  if (values.due_on && !isoDatePattern.test(values.due_on)) {
    return {
      error: "Due date must be in YYYY-MM-DD format.",
      parsed: null,
    };
  }
  return { error: null, parsed: { period_year, period_month } };
}

export async function createMonthlyTaskAction(
  _prev: CreateMonthlyTaskState,
  formData: FormData,
): Promise<CreateMonthlyTaskState> {
  const values = readValues(formData);

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { period_year, period_month } = v.parsed;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values };
  }

  const { error } = await supabase.from("monthly_tasks").insert({
    // owner_id is authoritative — never from the form.
    owner_id: user.id,
    label: values.label,
    period_year,
    period_month,
    status: values.status,
    due_on: values.due_on || null,
    notes: values.notes || null,
    template_key: values.template_key || null,
    // completed_at is set/cleared by the BEFORE INSERT/UPDATE trigger when
    // status transitions to/from 'done'. Do not write it from app code.
  });

  if (error) {
    return { error: error.message, values };
  }

  revalidatePath("/checklist");
  revalidatePath("/");
  // Redirect to the task's period so the user lands on the view that now
  // contains the row they just created or edited.
  redirect(`/checklist?month=${period_month}&year=${period_year}`);
}

export async function updateMonthlyTaskAction(
  _prev: CreateMonthlyTaskState,
  formData: FormData,
): Promise<CreateMonthlyTaskState> {
  const id = String(formData.get("id") ?? "").trim();
  const values = readValues(formData);

  if (!id) {
    return { error: "Missing task id.", values };
  }

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { period_year, period_month } = v.parsed;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values };
  }

  // Update is double-scoped: RLS enforces `auth.uid() = owner_id`, and we
  // also pin `.eq('owner_id', user.id)`. Never include owner_id in the
  // payload — ownership is immutable through this code path. `completed_at`
  // is also omitted so the BEFORE UPDATE trigger keeps it in sync with status.
  const { data, error } = await supabase
    .from("monthly_tasks")
    .update({
      label: values.label,
      period_year,
      period_month,
      status: values.status,
      due_on: values.due_on || null,
      notes: values.notes || null,
      template_key: values.template_key || null,
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
      error: "Task not found or you do not have permission to edit it.",
      values,
    };
  }

  revalidatePath("/checklist");
  revalidatePath("/");
  // Redirect to the task's period so the user lands on the view that now
  // contains the row they just created or edited.
  redirect(`/checklist?month=${period_month}&year=${period_year}`);
}

// Direct form-action signature — invoked from the per-row "Mark X" buttons
// without useActionState. Quiet no-op on bad input (the buttons are
// server-rendered, so this only triggers on tampering). No redirect: the
// action runs, revalidates, and the user stays on whatever URL they were on
// (e.g. /checklist or /checklist?edit=<id>).
// Direct form-action signature — invoked from the per-row Delete button.
// Soft-delete only. Honours optional `redirect_month`/`redirect_year` hidden
// inputs so the user lands back on the same view they were on.
export async function deleteMonthlyTaskAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();

  const monthRaw = Number(formData.get("redirect_month"));
  const yearRaw = Number(formData.get("redirect_year"));
  const validRedirect =
    Number.isInteger(monthRaw) &&
    monthRaw >= 1 &&
    monthRaw <= 12 &&
    Number.isInteger(yearRaw) &&
    yearRaw >= 2020 &&
    yearRaw <= 2100;
  const redirectUrl = validRedirect
    ? `/checklist?month=${monthRaw}&year=${yearRaw}`
    : "/checklist";

  if (!id) {
    redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase
    .from("monthly_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  revalidatePath("/checklist");
  revalidatePath("/");
  redirect(redirectUrl);
}

export async function updateMonthlyTaskStatusAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "");

  if (!id || !monthlyTaskStatusOptions.includes(status)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("monthly_tasks")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);
  // completed_at handled by trigger when status transitions to/from 'done'.

  revalidatePath("/checklist");
  revalidatePath("/");
}

// Restore an archived task by clearing deleted_at. Reads the row's period
// first so we can redirect to the month/year the restored task lives in,
// matching the create/update redirect convention.
export async function restoreMonthlyTaskAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/checklist?archived=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data: existing } = await supabase
    .from("monthly_tasks")
    .select("period_year, period_month")
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  const periodTuple = existing as
    | { period_year: number; period_month: number }
    | null;
  if (!periodTuple) {
    // Non-owned / not actually archived → silent return to archived view.
    redirect("/checklist?archived=1");
  }

  await supabase
    .from("monthly_tasks")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null);

  revalidatePath("/checklist");
  revalidatePath("/");
  redirect(
    `/checklist?month=${periodTuple.period_month}&year=${periodTuple.period_year}`,
  );
}
