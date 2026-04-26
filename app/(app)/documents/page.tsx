import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  DataTable,
  EmptyRow,
  TBody,
  TH,
  THead,
  TR,
} from "@/components/ui/data-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatMoneyExplicit, formatMonth } from "@/lib/format";
import { isEffectivelyUnlinkedReceipt } from "@/lib/receipts";
import type { Currency, FileStatus } from "@/lib/types";
import { createDocumentAction, updateDocumentAction } from "./actions";
import { DocumentForm, type ExpenseOption } from "./document-form";
import { DocumentRow } from "./document-row";
import {
  currentTaxYearStart,
  formatTaxYearLabel,
  initialCreateDocumentState,
  type CreateDocumentState,
} from "./form-state";
import { AutoLinkedBanner } from "./auto-linked-banner";
import { AutoDismissSuccess } from "./success-banner";

type DocumentExpenseEmbed = {
  id: string;
  spent_on: string;
  amount: number | string;
  currency: string;
  deleted_at: string | null;
} | null;

type DocumentListRow = {
  id: string;
  title: string;
  type: string;
  file_status: FileStatus;
  doc_month: number | null;
  doc_year: number | null;
  tax_year_start: number;
  is_private: boolean;
  notes: string | null;
  storage_path: string | null;
  expense_id: string | null;
  created_at: string;
  provider: { name: string } | null;
  expense: DocumentExpenseEmbed;
};

type DocumentFullRow = {
  id: string;
  provider_id: string;
  expense_id: string | null;
  title: string;
  type: string;
  file_status: string;
  doc_month: number | null;
  doc_year: number | null;
  tax_year_start: number;
  is_private: boolean;
  notes: string | null;
  storage_path: string | null;
  amount: number | string | null;
};

type ProviderOption = { id: string; name: string };

type ExpenseEmbedRow = {
  id: string;
  spent_on: string;
  amount: number | string;
  currency: string;
  provider_id: string;
  provider: { name: string } | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Type filter tabs only surface the most common kinds. Contract / other still
// exist in the schema and show under "All" — they just don't get their own tab.
// `unlinked-receipts` is a derived filter — see `isEffectivelyUnlinkedReceipt`.
const filterableTypes = new Set([
  "invoice",
  "receipt",
  "statement",
  "unlinked-receipts",
]);

// `isEffectivelyUnlinkedReceipt` lives in `lib/receipts.ts` — same predicate
// is used here, in actions.ts (indirectly via the page filter), and on the
// dashboard count, so it's centralised.

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string;
    edit?: string;
    saved?: string;
    type?: string;
    linked?: string;
    auto_linked?: string;
    doc?: string;
  }>;
}) {
  const { add, edit, saved, type, linked, auto_linked, doc } =
    await searchParams;

  const editRequested = typeof edit === "string" && edit.length > 0;
  const editId = editRequested && uuidPattern.test(edit) ? edit : null;
  const showAdd = !editRequested && add === "1";
  const showSaved = saved === "1";
  const showAutoLinked = auto_linked === "1";
  // Validate the auto-linked document id at render time so the banner is
  // only handed a known-good UUID. A tampered/empty value falls through to
  // the plain saved banner.
  const autoLinkedDocId =
    typeof doc === "string" && uuidPattern.test(doc) ? doc : null;
  const showLinked = linked === "1";
  const filterType =
    typeof type === "string" && filterableTypes.has(type) ? type : "";

  const supabase = await createSupabaseServerClient();

  // Const-ternary keeps the type chain stable (vs `let query = …; query = …`
  // which on Supabase's recursive builder types blows up tsc).
  // Note: the embedded `expense.deleted_at` is fetched so we can detect
  // receipts whose linked expense was soft-deleted — PostgREST embeds don't
  // filter by the parent's `deleted_at`, so the check happens in JS below.
  const baseDocsQuery = supabase
    .from("documents")
    .select(
      "id, title, type, file_status, doc_month, doc_year, tax_year_start, is_private, notes, storage_path, expense_id, created_at, provider:providers(name), expense:expenses(id, spent_on, amount, currency, deleted_at)",
    )
    .is("deleted_at", null);
  // For "unlinked-receipts" we fetch all receipts and post-filter in JS:
  // expressing `expense_id IS NULL OR expense.deleted_at IS NOT NULL` cleanly
  // through PostgREST embeds isn't worth the complexity for the data volume
  // an admin tool sees here.
  const filteredDocsQuery =
    filterType === "unlinked-receipts"
      ? baseDocsQuery.eq("type", "receipt")
      : filterType
        ? baseDocsQuery.eq("type", filterType)
        : baseDocsQuery;
  const documentsResult = await filteredDocsQuery
    .order("doc_year", { ascending: false, nullsFirst: false })
    .order("doc_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<DocumentListRow[]>();

  // Counts run unfiltered so the tab numbers stay stable when a filter is
  // active. Embeds `expense.deleted_at` so the unlinked-receipt count can
  // include receipts whose linked expense was soft-deleted.
  const { data: typeTallyData } = await supabase
    .from("documents")
    .select("type, expense_id, expense:expenses(deleted_at)")
    .is("deleted_at", null)
    .returns<
      {
        type: string;
        expense_id: string | null;
        expense: { deleted_at: string | null } | null;
      }[]
    >();
  const typeTally = typeTallyData ?? [];
  const counts = {
    all: typeTally.length,
    invoice: typeTally.filter((t) => t.type === "invoice").length,
    receipt: typeTally.filter((t) => t.type === "receipt").length,
    statement: typeTally.filter((t) => t.type === "statement").length,
    unlinkedReceipt: typeTally.filter(isEffectivelyUnlinkedReceipt).length,
  };

  const providersResult = await supabase
    .from("providers")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<ProviderOption[]>();

  const expensesResult = await supabase
    .from("expenses")
    .select(
      "id, spent_on, amount, currency, provider_id, provider:providers(name)",
    )
    .is("deleted_at", null)
    .order("spent_on", { ascending: false })
    .returns<ExpenseEmbedRow[]>();

  const rawDocuments = documentsResult.data ?? [];
  // For unlinked-receipts we narrow in JS to honour the effective definition
  // (covers null expense_id, missing-via-RLS, and soft-deleted-expense cases).
  const documents =
    filterType === "unlinked-receipts"
      ? rawDocuments.filter(isEffectivelyUnlinkedReceipt)
      : rawDocuments;
  const providers = providersResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const loadError = documentsResult.error;

  // Flat expense options for the form: "{Provider} — {DD Mon} — {CCY Amount}".
  // Currency-first to match the rest of the app (formatMoneyExplicit).
  const expenseOptions: ExpenseOption[] = expenses.map((e) => {
    const providerName = e.provider?.name ?? "Unknown";
    const amount = Number(e.amount);
    const date = new Date(e.spent_on);
    const shortDate = new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
    }).format(date);
    return {
      id: e.id,
      label: `${providerName} — ${shortDate} — ${formatMoneyExplicit(amount, e.currency as Currency)}`,
      provider_id: e.provider_id,
      month: String(date.getMonth() + 1),
      year: String(date.getFullYear()),
    };
  });

  // Linker labels for the inline picker on unlinked receipt rows. Format:
  // "24 Apr 2026 · OpenAI · USD 20.00", or fallback without provider.
  // Routed through formatMoneyExplicit so number grouping matches the rest of
  // the app (e.g. "AUD 1,234.50").
  const linkableExpenses = expenses.map((e) => {
    const date = new Date(e.spent_on);
    const fullDate = new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
    const amountText = formatMoneyExplicit(
      Number(e.amount),
      e.currency as Currency,
    );
    const providerName = e.provider?.name;
    return {
      id: e.id,
      label: providerName
        ? `${fullDate} · ${providerName} · ${amountText}`
        : `${fullDate} · ${amountText}`,
    };
  });

  // Edit target lookup, scoped by RLS.
  let editTarget: DocumentFullRow | null = null;
  if (editId) {
    const { data: targetData } = await supabase
      .from("documents")
      .select(
        "id, provider_id, expense_id, title, type, file_status, doc_month, doc_year, tax_year_start, is_private, notes, storage_path, amount",
      )
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetData) editTarget = targetData as DocumentFullRow;
  }

  const editNotFound = editRequested && !editTarget;

  // Edge cases in edit mode:
  //   - linked expense soft-deleted since creation → fall back to "— none —"
  //   - original provider soft-deleted → show red notice + reset provider_id
  const visibleExpenseIds = new Set(expenses.map((e) => e.id));
  const visibleProviderIds = new Set(providers.map((p) => p.id));

  let providerMissing = false;
  let editInitial: CreateDocumentState | null = null;
  if (editTarget) {
    const safeExpenseId =
      editTarget.expense_id && visibleExpenseIds.has(editTarget.expense_id)
        ? editTarget.expense_id
        : "";
    const hasValidProvider = visibleProviderIds.has(editTarget.provider_id);
    providerMissing = !hasValidProvider;
    editInitial = {
      error: null,
      values: {
        provider_id: hasValidProvider ? editTarget.provider_id : "",
        expense_id: safeExpenseId,
        title: editTarget.title,
        type: editTarget.type,
        file_status: editTarget.file_status,
        doc_month: editTarget.doc_month ? String(editTarget.doc_month) : "",
        doc_year: editTarget.doc_year ? String(editTarget.doc_year) : "",
        tax_year_start: String(editTarget.tax_year_start),
        is_private: editTarget.is_private,
        notes: editTarget.notes ?? "",
        // numeric(14,2) round-trips as either number or string from PostgREST;
        // normalise to a string for the form input.
        amount:
          editTarget.amount !== null && editTarget.amount !== undefined
            ? String(editTarget.amount)
            : "",
      },
    };
  }

  const addInitial: CreateDocumentState = {
    error: null,
    values: {
      ...initialCreateDocumentState.values,
      tax_year_start: String(currentTaxYearStart()),
    },
  };

  const showAnyForm = showAdd || editRequested;

  const groupedDocs = new Map<number, DocumentListRow[]>();
  for (const d of documents) {
    const list = groupedDocs.get(d.tax_year_start) ?? [];
    list.push(d);
    groupedDocs.set(d.tax_year_start, list);
  }
  const taxYears = [...groupedDocs.keys()].sort((a, b) => b - a);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Documents
          </h1>
          <p className="text-sm text-subtle mt-1">
            Invoices, receipts and statements — grouped by tax year.
          </p>
        </div>
        <Link
          href={
            showAnyForm
              ? // Editing within a filtered list → return to that filter on
                // Cancel; Add (no filter applied through the form) keeps the
                // existing /documents fallback.
                editRequested && filterType
                ? `/documents?type=${filterType}`
                : "/documents"
              : "/documents?add=1"
          }
          className="shrink-0 inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          {showAnyForm ? "Cancel" : "Add document"}
        </Link>
      </div>

      {showSaved && showAutoLinked && autoLinkedDocId ? (
        // Auto-link banner has its own URL-flag cleanup (saved + auto_linked
        // + doc) and a longer dismiss window so the user has time to act.
        <AutoLinkedBanner documentId={autoLinkedDocId} />
      ) : showSaved ? (
        <AutoDismissSuccess
          message="Document saved"
          paramKey={["saved", "auto_linked", "doc"]}
        />
      ) : null}
      {showLinked ? (
        <AutoDismissSuccess message="Receipt linked" paramKey="linked" />
      ) : null}

      {editNotFound ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Document not found or you do not have permission to edit it.
        </div>
      ) : null}

      <div className="mb-5 flex items-center gap-1 flex-wrap">
        <FilterTab
          href="/documents"
          active={!filterType}
          label="All"
          count={counts.all}
        />
        <FilterTab
          href="/documents?type=invoice"
          active={filterType === "invoice"}
          label="Invoices"
          count={counts.invoice}
        />
        <FilterTab
          href="/documents?type=receipt"
          active={filterType === "receipt"}
          label="Receipts"
          count={counts.receipt}
        />
        <FilterTab
          href="/documents?type=statement"
          active={filterType === "statement"}
          label="Statements"
          count={counts.statement}
        />
        <FilterTab
          href="/documents?type=unlinked-receipts"
          active={filterType === "unlinked-receipts"}
          label="Unlinked receipts"
          count={counts.unlinkedReceipt}
        />
      </div>

      {showAdd ? (
        <DocumentForm
          action={createDocumentAction}
          initial={addInitial}
          submitLabel="Add document"
          pendingLabel="Adding…"
          providers={providers}
          expenses={expenseOptions}
        />
      ) : null}

      {editTarget && editInitial ? (
        <DocumentForm
          action={updateDocumentAction}
          initial={editInitial}
          submitLabel="Save document"
          pendingLabel="Saving…"
          documentId={editTarget.id}
          providers={providers}
          expenses={expenseOptions}
          providerMissing={providerMissing}
          existingFileName={
            editTarget.storage_path
              ? (editTarget.storage_path.split("/").pop() ?? undefined)
              : undefined
          }
          // Preserve filter through Save: hidden return_to_type lands the user
          // back on the same filtered list with ?saved=1 appended.
          returnToType={filterType || undefined}
        />
      ) : null}

      {loadError ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load documents.</div>
          <p className="mt-1 text-red-700/90">{loadError.message}</p>
        </div>
      ) : null}

      {taxYears.length === 0 ? (
        <Card>
          <DataTable>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Provider</TH>
                <TH>Linked expense</TH>
                <TH>Type</TH>
                <TH>Period</TH>
                <TH>Status</TH>
                <TH>Privacy</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              <EmptyRow colSpan={8}>
                {filterType === "unlinked-receipts"
                  ? "All receipts are linked to active expenses."
                  : "No documents yet. Add your first invoice or receipt."}
              </EmptyRow>
            </TBody>
          </DataTable>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {taxYears.map((year) => {
            const list = groupedDocs.get(year) ?? [];
            return (
              <Card key={year}>
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {formatTaxYearLabel(year)}
                  </h2>
                  <span className="text-xs text-subtle">
                    {list.length} document{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <DataTable>
                  <THead>
                    <TR>
                      <TH>Title</TH>
                      <TH>Provider</TH>
                      <TH>Linked expense</TH>
                      <TH>Type</TH>
                      <TH>Period</TH>
                      <TH>Status</TH>
                      <TH>Privacy</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {list.map((d) => (
                      <DocumentRow
                        key={d.id}
                        id={d.id}
                        title={d.title}
                        notes={d.notes}
                        providerName={d.provider?.name ?? "—"}
                        expenseLabel={formatExpenseLabel(d.expense)}
                        type={d.type}
                        periodLabel={formatPeriod(d.doc_month, d.doc_year)}
                        fileStatus={d.file_status}
                        isPrivate={d.is_private}
                        hasFile={Boolean(d.storage_path)}
                        unlinkedReceipt={isEffectivelyUnlinkedReceipt(d)}
                        linkableExpenses={linkableExpenses}
                        currentType={filterType || undefined}
                      />
                    ))}
                  </TBody>
                </DataTable>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// Period column rule: "Month Year" only when both are present; otherwise "—".
function formatPeriod(month: number | null, year: number | null): string {
  if (month && year) return formatMonth(month, year);
  return "—";
}

function formatExpenseLabel(expense: DocumentExpenseEmbed): string | null {
  if (!expense) return null;
  return `${formatDate(expense.spent_on)} · ${formatMoneyExplicit(
    Number(expense.amount),
    expense.currency as Currency,
  )}`;
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "px-3 py-1.5 rounded-md text-sm bg-slate-100 text-foreground font-medium transition-colors"
          : "px-3 py-1.5 rounded-md text-sm text-muted hover:bg-slate-50 hover:text-foreground transition-colors"
      }
    >
      {label}{" "}
      <span className="text-xs text-subtle ml-0.5 tabular-nums">{count}</span>
    </Link>
  );
}
