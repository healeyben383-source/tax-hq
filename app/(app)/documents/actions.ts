"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types, constants and option lists live in
// ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  documentFileStatusOptions,
  documentTypeOptions,
  type CreateDocumentState,
  type CreateDocumentValues,
} from "./form-state";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ParsedNumbers = {
  doc_month: number | null;
  doc_year: number | null;
  tax_year_start: number;
};

// Filter values that the Documents page accepts via `?type=`. Mirrored here
// so updateDocumentAction can validate the hidden return-to hint before
// constructing a redirect URL (avoids open-redirect / arbitrary-path risk).
const allowedReturnToTypes = new Set([
  "invoice",
  "receipt",
  "statement",
  "unlinked-receipts",
]);

function readReturnToTypeRedirect(formData: FormData): string {
  const raw = String(formData.get("return_to_type") ?? "").trim();
  if (raw && allowedReturnToTypes.has(raw)) {
    return `/documents?type=${raw}&saved=1`;
  }
  return "/documents?saved=1";
}

function readValues(formData: FormData): CreateDocumentValues {
  return {
    provider_id: String(formData.get("provider_id") ?? "").trim(),
    expense_id: String(formData.get("expense_id") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    type: String(formData.get("type") ?? ""),
    file_status: String(formData.get("file_status") ?? ""),
    doc_month: String(formData.get("doc_month") ?? "").trim(),
    doc_year: String(formData.get("doc_year") ?? "").trim(),
    tax_year_start: String(formData.get("tax_year_start") ?? "").trim(),
    is_private: formData.get("is_private") === "1",
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function validateValues(values: CreateDocumentValues): {
  error: string | null;
  parsed: ParsedNumbers | null;
} {
  if (!values.provider_id) {
    return { error: "Provider is required.", parsed: null };
  }
  if (!values.title) {
    return { error: "Title is required.", parsed: null };
  }
  if (!documentTypeOptions.includes(values.type)) {
    return { error: "Type is not recognised.", parsed: null };
  }
  if (!documentFileStatusOptions.includes(values.file_status)) {
    return { error: "File status is not recognised.", parsed: null };
  }

  if (!values.tax_year_start) {
    return { error: "Tax year start is required.", parsed: null };
  }
  const tax_year_start = Number(values.tax_year_start);
  if (
    !Number.isInteger(tax_year_start) ||
    tax_year_start < 1900 ||
    tax_year_start > 2100
  ) {
    return {
      error: "Tax year start must be a valid year between 1900 and 2100.",
      parsed: null,
    };
  }

  let doc_month: number | null = null;
  if (values.doc_month) {
    const m = Number(values.doc_month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { error: "Month must be between 1 and 12.", parsed: null };
    }
    doc_month = m;
  }

  let doc_year: number | null = null;
  if (values.doc_year) {
    const y = Number(values.doc_year);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      return {
        error: "Year must be a valid year between 1900 and 2100.",
        parsed: null,
      };
    }
    doc_year = y;
  }

  // Month implies year. Avoids the "April —" display case.
  if (doc_month !== null && doc_year === null) {
    return {
      error: "Year is required when a month is selected.",
      parsed: null,
    };
  }

  return { error: null, parsed: { doc_month, doc_year, tax_year_start } };
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

async function ensureExpenseIsOwned(
  supabase: ServerSupabase,
  expenseId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Selected expense not found.";
  return null;
}

// Recompute expense.invoice_saved from the expense's active documents.
// True iff at least one non-deleted document for this expense has
// file_status='saved'. RLS on both tables keeps this scoped to the caller.
// Errors are swallowed — the main document write already succeeded and this
// is a downstream consistency update.
// TODO(atomicity): collapse the document write + this recompute into a
// Postgres function so they commit or roll back as one.
async function recomputeInvoiceSaved(
  supabase: ServerSupabase,
  expenseId: string | null,
): Promise<void> {
  if (!expenseId) return;
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("expense_id", expenseId)
    .eq("file_status", "saved")
    .is("deleted_at", null);
  const invoice_saved = (count ?? 0) > 0;
  await supabase
    .from("expenses")
    .update({ invoice_saved })
    .eq("id", expenseId)
    .is("deleted_at", null);
}

// Per spec: create/update sync runs only when the new status is 'saved' or
// 'missing'. 'pending' never touches the expense.
function shouldSyncOnWrite(fileStatus: string): boolean {
  return fileStatus === "saved" || fileStatus === "missing";
}

// Upload helpers — kept tiny and local. PDFs and images only, 25 MB cap.
const STORAGE_BUCKET = "documents";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function readUploadedFile(formData: FormData): File | null {
  const raw = formData.get("file");
  return raw instanceof File && raw.size > 0 ? raw : null;
}

function validateUploadedFile(file: File): string | null {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return "Only PDF or image files are allowed.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File is larger than the 25 MB limit.";
  }
  return null;
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\/\\\0]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
  return cleaned || "file";
}

type UploadedInfo = {
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
};

// Server-side upload via the user's authenticated client. The bucket's RLS
// already restricts writes to objects whose first path segment equals
// auth.uid() — we mirror that here by always prefixing with `${user.id}/`.
async function uploadDocumentFile(
  supabase: ServerSupabase,
  userId: string,
  documentId: string,
  file: File,
): Promise<{ info: UploadedInfo | null; error: string | null }> {
  const safeName = sanitizeFilename(file.name);
  const storagePath = `${userId}/${documentId}/${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return { info: null, error: error.message };
  }

  return {
    info: {
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
    },
    error: null,
  };
}

export async function createDocumentAction(
  _prev: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState> {
  const values = readValues(formData);

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { doc_month, doc_year, tax_year_start } = v.parsed;

  // Validate the file (if any) BEFORE writing the row, so a bad upload
  // never creates an orphaned document record.
  const uploadedFile = readUploadedFile(formData);
  if (uploadedFile) {
    const fileError = validateUploadedFile(uploadedFile);
    if (fileError) return { error: fileError, values };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", values };

  const providerError = await ensureProviderIsOwned(supabase, values.provider_id);
  if (providerError) return { error: providerError, values };

  if (values.expense_id) {
    const expenseError = await ensureExpenseIsOwned(supabase, values.expense_id);
    if (expenseError) return { error: expenseError, values };
  }

  const { data: inserted, error } = await supabase
    .from("documents")
    .insert({
      // owner_id is authoritative — never from the form.
      owner_id: user.id,
      provider_id: values.provider_id,
      expense_id: values.expense_id || null,
      title: values.title,
      type: values.type,
      file_status: values.file_status,
      doc_month,
      doc_year,
      tax_year_start,
      is_private: values.is_private,
      created_via: "manual",
      notes: values.notes || null,
      // storage_* fields stay NULL until the file upload below succeeds.
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Insert failed.", values };
  }
  const documentId = (inserted as { id: string }).id;

  if (uploadedFile) {
    const upload = await uploadDocumentFile(
      supabase,
      user.id,
      documentId,
      uploadedFile,
    );
    if (upload.error || !upload.info) {
      // Roll back the insert so the user can resubmit cleanly. Hard-delete
      // is safe here: the row was just created and has no other references.
      await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("owner_id", user.id);
      return {
        error: `File upload failed: ${upload.error ?? "unknown error"}`,
        values,
      };
    }
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        storage_bucket: upload.info.storage_bucket,
        storage_path: upload.info.storage_path,
        mime_type: upload.info.mime_type,
        size_bytes: upload.info.size_bytes,
      })
      .eq("id", documentId)
      .eq("owner_id", user.id);
    if (updateError) {
      return { error: updateError.message, values };
    }
  }

  if (shouldSyncOnWrite(values.file_status)) {
    await recomputeInvoiceSaved(supabase, values.expense_id || null);
  }

  revalidatePath("/documents");
  redirect("/documents?saved=1");
}

export async function updateDocumentAction(
  _prev: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState> {
  const id = String(formData.get("id") ?? "").trim();
  const values = readValues(formData);

  if (!id) return { error: "Missing document id.", values };

  const v = validateValues(values);
  if (v.error || !v.parsed) {
    return { error: v.error ?? "Invalid values.", values };
  }
  const { doc_month, doc_year, tax_year_start } = v.parsed;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", values };

  const providerError = await ensureProviderIsOwned(supabase, values.provider_id);
  if (providerError) return { error: providerError, values };

  if (values.expense_id) {
    const expenseError = await ensureExpenseIsOwned(supabase, values.expense_id);
    if (expenseError) return { error: expenseError, values };
  }

  // We need the OLD expense_id so we can also re-sync it if the user moved
  // this document to a different expense (or unlinked it). The OLD storage
  // fields are also needed if the user ticks "Remove attached file".
  const { data: previous } = await supabase
    .from("documents")
    .select("expense_id, storage_bucket, storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const previousRow = previous as
    | {
        expense_id: string | null;
        storage_bucket: string | null;
        storage_path: string | null;
      }
    | null;
  const previousExpenseId = previousRow?.expense_id ?? null;

  const { data, error } = await supabase
    .from("documents")
    .update({
      provider_id: values.provider_id,
      expense_id: values.expense_id || null,
      title: values.title,
      type: values.type,
      file_status: values.file_status,
      doc_month,
      doc_year,
      tax_year_start,
      is_private: values.is_private,
      notes: values.notes || null,
      // owner_id, created_via, storage_* deliberately omitted — immutable here.
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: error.message, values };

  if (!data || data.length === 0) {
    return {
      error: "Document not found or you do not have permission to edit it.",
      values,
    };
  }

  // Optional file replacement during edit. Other fields are already saved at
  // this point; on upload failure we surface the error so the user can retry,
  // but we do NOT roll the document fields back (consistent with expectations
  // for an edit flow — partial save is OK as long as the user is told).
  //
  // Upload wins over Remove: if the user attached a new file AND ticked
  // "Remove attached file", we treat that as a replace and ignore the
  // checkbox. They can untick or save again to clear.
  const uploadedFile = readUploadedFile(formData);
  const wantsRemoveFile = formData.get("remove_file") === "1";
  if (uploadedFile) {
    const fileError = validateUploadedFile(uploadedFile);
    if (fileError) return { error: fileError, values };

    const upload = await uploadDocumentFile(
      supabase,
      user.id,
      id,
      uploadedFile,
    );
    if (upload.error || !upload.info) {
      return {
        error: `File upload failed: ${upload.error ?? "unknown error"}`,
        values,
      };
    }
    const { error: storageUpdateError } = await supabase
      .from("documents")
      .update({
        storage_bucket: upload.info.storage_bucket,
        storage_path: upload.info.storage_path,
        mime_type: upload.info.mime_type,
        size_bytes: upload.info.size_bytes,
      })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (storageUpdateError) {
      return { error: storageUpdateError.message, values };
    }
  } else if (wantsRemoveFile) {
    // Best-effort storage delete; per spec, errors here are non-blocking and
    // we always clear the DB fields so the row's CHECK stays consistent
    // (both storage_bucket and storage_path null together).
    if (previousRow?.storage_bucket && previousRow.storage_path) {
      await supabase.storage
        .from(previousRow.storage_bucket)
        .remove([previousRow.storage_path]);
    }
    const { error: clearError } = await supabase
      .from("documents")
      .update({
        storage_bucket: null,
        storage_path: null,
        mime_type: null,
        size_bytes: null,
      })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (clearError) {
      return { error: clearError.message, values };
    }
  }

  // If the user moved this document between expenses, the OLD expense also
  // needs its invoice_saved recomputed (it may have lost its only saved doc).
  const newExpenseId = values.expense_id || null;
  if (shouldSyncOnWrite(values.file_status)) {
    await recomputeInvoiceSaved(supabase, newExpenseId);
  }
  if (previousExpenseId && previousExpenseId !== newExpenseId) {
    await recomputeInvoiceSaved(supabase, previousExpenseId);
  }

  revalidatePath("/documents");
  // If the form was opened from a filtered list (e.g. ?type=unlinked-receipts),
  // bounce back to that filter so the user doesn't lose their context. Hidden
  // input is validated against an allowlist; unknown values fall through to
  // the unfiltered default.
  redirect(readReturnToTypeRedirect(formData));
}

// Direct form-action signature — invoked from the delete button's <form>
// without useActionState. No state to return; redirects on completion.
export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/documents");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Read the row first (RLS-scoped) so we can recompute the linked expense
  // afterwards. A non-owned / missing id returns null and we redirect quietly.
  const { data: existing } = await supabase
    .from("documents")
    .select("expense_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const expenseIdToSync = existing
    ? (existing as { expense_id: string | null }).expense_id
    : null;

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (!error) {
    // Always recompute on delete — a saved doc disappearing may flip the
    // expense's invoice_saved to false.
    await recomputeInvoiceSaved(supabase, expenseIdToSync);
  }

  revalidatePath("/documents");
  redirect("/documents");
}

// Inline link action — wires an effectively-unlinked receipt to one of the
// caller's active expenses without going through the full edit form.
// Validation failures redirect quietly to the unlinked-receipts list (the
// row stays visible there if nothing changed; the user can try again).
export async function linkReceiptToExpenseAction(
  formData: FormData,
): Promise<void> {
  const documentId = String(formData.get("document_id") ?? "").trim();
  const expenseId = String(formData.get("expense_id") ?? "").trim();

  const fallback = "/documents?type=unlinked-receipts";
  const linkUuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !linkUuidPattern.test(documentId) ||
    !linkUuidPattern.test(expenseId)
  ) {
    redirect(fallback);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Confirm the document is owned, is a receipt, and isn't deleted. RLS
  // filters by owner; we add explicit owner_id, type, deleted_at checks.
  const { data: docRow } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .eq("type", "receipt")
    .is("deleted_at", null)
    .maybeSingle();
  if (!docRow) {
    redirect(fallback);
  }

  // Confirm the expense is owned and active.
  const { data: expRow } = await supabase
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!expRow) {
    redirect(fallback);
  }

  // Set expense_id. owner_id is intentionally omitted — ownership is
  // immutable through this code path.
  const { error: linkError } = await supabase
    .from("documents")
    .update({ expense_id: expenseId })
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (linkError) {
    // Quiet fallback — the row will still appear in the unlinked-receipts
    // list on next render, so the user can retry.
    redirect(fallback);
  }

  // Best-effort audit. Metadata only — no expense amount, provider, notes,
  // filename. Same swallow-and-continue pattern as the secure-record reveal
  // route: audit failures must never block the user-facing action.
  try {
    await supabase.from("audit_log").insert({
      owner_id: user.id,
      entity_type: "document",
      entity_id: documentId,
      action: "link_receipt",
    });
  } catch {
    // intentional silent swallow — audit is non-blocking
  }

  revalidatePath("/documents");
  revalidatePath("/");
  revalidatePath("/audit-log");
  // After link, the row drops out of the unlinked-receipts filter naturally.
  // `linked=1` drives the transient "Receipt linked" banner.
  redirect(`${fallback}&linked=1`);
}
