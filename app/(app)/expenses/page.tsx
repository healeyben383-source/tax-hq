import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/data-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/types";
import { createExpenseAction, updateExpenseAction } from "./actions";
import {
  initialCreateExpenseState,
  type CreateExpenseState,
} from "./form-state";
import { DeleteExpenseButton } from "./delete-button";
import { ExpenseForm } from "./expense-form";
import { RestoreExpenseButton } from "./restore-button";

type ExpenseListRow = {
  id: string;
  spent_on: string;
  amount: number;
  currency: string;
  aud_amount: number;
  category: string;
  deductible: boolean;
  invoice_saved: boolean;
  notes: string | null;
  provider: { name: string } | null;
};

type ExpenseFullRow = {
  id: string;
  provider_id: string;
  spent_on: string;
  amount: number | string;
  currency: string;
  aud_amount: number | string;
  category: string;
  deductible: boolean;
  invoice_saved: boolean;
  notes: string | null;
};

type ProviderOption = { id: string; name: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string;
    edit?: string;
    archived?: string;
  }>;
}) {
  const { add, edit, archived } = await searchParams;

  const viewArchived = archived === "1";
  const editRequested =
    !viewArchived && typeof edit === "string" && edit.length > 0;
  const editId = editRequested && uuidPattern.test(edit) ? edit : null;
  const showAdd = !viewArchived && !editRequested && add === "1";

  const supabase = await createSupabaseServerClient();

  const baseList = supabase
    .from("expenses")
    .select(
      "id, spent_on, amount, currency, aud_amount, category, deductible, invoice_saved, notes, provider:providers(name)",
    );
  const filteredList = viewArchived
    ? baseList.not("deleted_at", "is", null)
    : baseList.is("deleted_at", null);
  const expensesResult = await filteredList
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<ExpenseListRow[]>();

  const providersResult = await supabase
    .from("providers")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<ProviderOption[]>();

  const expenses = expensesResult.data ?? [];
  const providers = providersResult.data ?? [];
  const loadError = expensesResult.error;

  // Load the row being edited, scoped by RLS. A non-owner / missing id falls
  // through to editNotFound without crashing the page.
  let editTarget: ExpenseFullRow | null = null;
  if (editId) {
    const { data: targetData } = await supabase
      .from("expenses")
      .select(
        "id, provider_id, spent_on, amount, currency, aud_amount, category, deductible, invoice_saved, notes",
      )
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetData) {
      editTarget = targetData as ExpenseFullRow;
    }
  }

  const editNotFound = editRequested && !editTarget;

  const editInitial: CreateExpenseState | null = editTarget
    ? {
        error: null,
        values: {
          provider_id: editTarget.provider_id,
          spent_on: editTarget.spent_on,
          amount: String(editTarget.amount),
          currency: editTarget.currency,
          aud_amount: String(editTarget.aud_amount),
          category: editTarget.category,
          deductible: editTarget.deductible,
          invoice_saved: editTarget.invoice_saved,
          notes: editTarget.notes ?? "",
        },
      }
    : null;

  const showAnyForm = showAdd || editRequested;

  const totalAud = expenses.reduce(
    (sum, e) => sum + Number(e.aud_amount ?? 0),
    0,
  );

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Expenses
          </h1>
          <p className="text-sm text-subtle mt-1">
            {viewArchived
              ? `Showing archived expenses · ${expenses.length} item${expenses.length === 1 ? "" : "s"}.`
              : `${expenses.length} item${expenses.length === 1 ? "" : "s"} · ${formatMoney(totalAud, "AUD")} total (AUD equivalent).`}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {viewArchived ? (
            <Link
              href="/expenses"
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              ← View active
            </Link>
          ) : (
            <>
              <Link
                href="/expenses?archived=1"
                className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
              >
                View archived
              </Link>
              <Link
                href={showAnyForm ? "/expenses" : "/expenses?add=1"}
                className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                {showAnyForm ? "Cancel" : "Add expense"}
              </Link>
            </>
          )}
        </div>
      </div>

      {editNotFound ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Expense not found or you do not have permission to edit it.
        </div>
      ) : null}

      {showAdd ? (
        <ExpenseForm
          action={createExpenseAction}
          initial={initialCreateExpenseState}
          submitLabel="Add expense"
          pendingLabel="Adding…"
          providers={providers}
        />
      ) : null}

      {editTarget && editInitial ? (
        <ExpenseForm
          action={updateExpenseAction}
          initial={editInitial}
          submitLabel="Save expense"
          pendingLabel="Saving…"
          providers={providers}
          expenseId={editTarget.id}
        />
      ) : null}

      {loadError ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load expenses.</div>
          <p className="mt-1 text-red-700/90">{loadError.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Provider</TH>
              <TH>Category</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">AUD</TH>
              <TH>Deductible</TH>
              <TH>Invoice</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {expenses.length === 0 ? (
              <EmptyRow colSpan={8}>
                {viewArchived
                  ? "No archived expenses."
                  : "No expenses yet. Click “Add expense” to create one."}
              </EmptyRow>
            ) : (
              expenses.map((e) => (
                <TR
                  key={e.id}
                  className={viewArchived ? "opacity-70" : undefined}
                >
                  <TD className="text-subtle whitespace-nowrap">
                    {formatDate(e.spent_on)}
                  </TD>
                  <TD>{e.provider?.name ?? "—"}</TD>
                  <TD>
                    <Badge tone="neutral">{e.category}</Badge>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatMoney(Number(e.amount), e.currency as Currency)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatMoney(Number(e.aud_amount), "AUD")}
                  </TD>
                  <TD>
                    <Badge tone={e.deductible ? "success" : "muted"}>
                      {e.deductible ? "Yes" : "No"}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={e.invoice_saved ? "success" : "danger"}>
                      {e.invoice_saved ? "Saved" : "Missing"}
                    </Badge>
                  </TD>
                  <TD>
                    {viewArchived ? (
                      <div className="flex items-center gap-3">
                        <Badge tone="muted">Archived</Badge>
                        <RestoreExpenseButton id={e.id} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/expenses?edit=${e.id}`}
                          className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteExpenseButton id={e.id} />
                      </div>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </Card>
    </>
  );
}
