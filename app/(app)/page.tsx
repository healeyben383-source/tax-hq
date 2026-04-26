import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardStat } from "@/components/ui/card";
import {
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { providers } from "@/lib/mock-data";
import {
  daysUntil,
  formatDate,
  formatMoneyExplicit,
  formatMonth,
} from "@/lib/format";
import { isEffectivelyUnlinkedReceipt } from "@/lib/receipts";
import { runRecurringExpenseSweep } from "@/lib/recurring-sweep";
import type { Currency, FileStatus } from "@/lib/types";

type MissingInvoiceRow = {
  id: string;
  spent_on: string;
  aud_amount: number | string;
  provider: { name: string } | null;
};

type UpcomingRenewalRow = {
  id: string;
  amount: number | string;
  currency: string;
  next_renewal_on: string;
  provider: { name: string } | null;
};

type MonthExpenseRow = {
  aud_amount: number | string;
};

type UnlinkedReceiptTallyRow = {
  id: string;
  expense_id: string | null;
  expense: { deleted_at: string | null } | null;
};

type RecentDocRow = {
  id: string;
  title: string;
  type: string;
  file_status: FileStatus;
  doc_month: number | null;
  doc_year: number | null;
  provider: { name: string } | null;
};

const recentDocStatusTone: Record<FileStatus, "success" | "warning" | "danger"> =
  {
    saved: "success",
    pending: "warning",
    missing: "danger",
  };

// Single source of truth for "what counts as a missing invoice".
// Both the list and count queries below pipe through this so they cannot
// drift apart — change the predicate here and both follow.
//
// The generic stays unconstrained and the chain runs through a tiny runtime
// cast: constraining T against Supabase's PostgrestFilterBuilder shape blows
// up TS with "Type instantiation is excessively deep" at the call site. The
// call site still gets the full builder type back via the `T` round-trip.
type MissingInvoiceFilterable = {
  is(column: string, value: null): MissingInvoiceFilterable;
  eq(column: string, value: boolean): MissingInvoiceFilterable;
};

function applyMissingInvoiceFilters<T>(query: T): T {
  const q = query as unknown as MissingInvoiceFilterable;
  return q.is("deleted_at", null).eq("invoice_saved", false) as unknown as T;
}

// Single source of truth for "what counts as an upcoming renewal".
// Both the list and count queries pipe through this with the same cutoff so
// they cannot drift apart. Same generic-cast trick as above.
type UpcomingRenewalFilterable = {
  is(column: string, value: null): UpcomingRenewalFilterable;
  lte(column: string, value: string): UpcomingRenewalFilterable;
};

function applyUpcomingRenewalFilters<T>(query: T, cutoffIso: string): T {
  const q = query as unknown as UpcomingRenewalFilterable;
  return q
    .is("deleted_at", null)
    .is("cancelled_on", null)
    .lte("next_renewal_on", cutoffIso) as unknown as T;
}

// TODO(db): the rest of this page still reads from mock data — only the
// "Missing invoices" card below is wired to Supabase.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Materialise any due recurring subscriptions into expense rows before we
  // run the dashboard's stat / list queries, so the "This month" total and
  // "Missing invoices" list reflect today's state. Fail-silent internally.
  await runRecurringExpenseSweep(supabase);

  const { data: missingInvoiceData } = await applyMissingInvoiceFilters(
    supabase
      .from("expenses")
      .select("id, spent_on, aud_amount, provider:providers(name)"),
  )
    .order("spent_on", { ascending: false })
    .limit(10)
    .returns<MissingInvoiceRow[]>();
  const missingInvoiceRows: MissingInvoiceRow[] = missingInvoiceData ?? [];

  // Separate count query so the stat card reflects the true total rather
  // than capping at the table's limit of 10.
  const { count: missingInvoiceCountRaw, error: missingInvoiceCountError } =
    await applyMissingInvoiceFilters(
      supabase
        .from("expenses")
        .select("id", { count: "exact", head: true }),
    );
  const missingInvoiceCount = missingInvoiceCountRaw ?? 0;

  // Upcoming renewals: active subscriptions renewing on or before today + 30
  // days. Past-due rows are intentionally included so overdue renewals
  // surface here; the days-remaining label distinguishes them. RLS-scoped.
  const renewalCutoff = new Date();
  renewalCutoff.setDate(renewalCutoff.getDate() + 30);
  const renewalCutoffIso = renewalCutoff.toISOString().slice(0, 10);

  const { data: upcomingRenewalData } = await applyUpcomingRenewalFilters(
    supabase
      .from("recurring_subscriptions")
      .select("id, amount, currency, next_renewal_on, provider:providers(name)"),
    renewalCutoffIso,
  )
    .order("next_renewal_on", { ascending: true })
    .limit(10)
    .returns<UpcomingRenewalRow[]>();
  const upcomingRenewalRows: UpcomingRenewalRow[] = upcomingRenewalData ?? [];

  // Separate count query so the stat card reflects the true total rather
  // than capping at the table's limit of 10.
  const { count: upcomingRenewalCountRaw, error: upcomingRenewalCountError } =
    await applyUpcomingRenewalFilters(
      supabase
        .from("recurring_subscriptions")
        .select("id", { count: "exact", head: true }),
      renewalCutoffIso,
    );
  const upcomingRenewalCount = upcomingRenewalCountRaw ?? 0;

  // This month: sum aud_amount for expenses where spent_on is in the
  // current calendar month. Built as plain ISO strings to sidestep timezone
  // surprises with Date.toISOString (which converts to UTC). RLS-scoped.
  const today = new Date();
  const yyyy = today.getFullYear();
  const monthIndex = today.getMonth(); // 0..11
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthStartIso = `${yyyy}-${pad2(monthIndex + 1)}-01`;
  const nextMonthStartIso =
    monthIndex === 11
      ? `${yyyy + 1}-01-01`
      : `${yyyy}-${pad2(monthIndex + 2)}-01`;

  const { data: monthExpenseData, error: monthExpenseError } = await supabase
    .from("expenses")
    .select("aud_amount")
    .is("deleted_at", null)
    .gte("spent_on", monthStartIso)
    .lt("spent_on", nextMonthStartIso)
    .returns<MonthExpenseRow[]>();
  const monthTotalAud = (monthExpenseData ?? []).reduce(
    (sum, e) => sum + Number(e.aud_amount),
    0,
  );

  // Recent documents: latest 5 by creation. RLS-scoped. Errors degrade to
  // an empty list which renders the "No recent documents" empty-state row.
  const { data: recentDocData } = await supabase
    .from("documents")
    .select(
      "id, title, type, file_status, doc_month, doc_year, provider:providers(name)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<RecentDocRow[]>();
  const recentDocRows: RecentDocRow[] = recentDocData ?? [];

  // Unlinked receipts: matches the Documents page's "effectively unlinked"
  // definition — receipt with no expense_id, OR linked expense soft-deleted,
  // OR linked expense missing via RLS. Fetch all receipts (small set) and
  // tally in JS rather than try to express the OR through PostgREST embeds.
  const { data: unlinkedReceiptData, error: unlinkedReceiptError } =
    await supabase
      .from("documents")
      .select("id, expense_id, expense:expenses(deleted_at)")
      .is("deleted_at", null)
      .eq("type", "receipt")
      .returns<UnlinkedReceiptTallyRow[]>();
  const unlinkedReceiptCount = (unlinkedReceiptData ?? []).filter((d) =>
    isEffectivelyUnlinkedReceipt({ ...d, type: "receipt" }),
  ).length;

  // Checklist for the current month — counts only, no list. RLS-scoped.
  // Errors degrade to a "—" / "Could not load" stat card.
  const { data: checklistTaskData, error: checklistTaskError } = await supabase
    .from("monthly_tasks")
    .select("id, status")
    .is("deleted_at", null)
    .eq("period_year", yyyy)
    .eq("period_month", monthIndex + 1)
    .returns<{ id: string; status: string }[]>();
  const checklistTasks = checklistTaskData ?? [];
  const checklistTotal = checklistTasks.length;
  const checklistDone = checklistTasks.filter((t) => t.status === "done").length;
  const checklistPct =
    checklistTotal === 0
      ? 0
      : Math.round((checklistDone / checklistTotal) * 100);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const quickProviders = providers.slice(0, 4);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatMonth(currentMonth, currentYear)} · overview of spend, renewals and outstanding items.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardBody>
            <CardStat
              label="This month"
              value={
                monthExpenseError
                  ? "—"
                  : formatMoneyExplicit(monthTotalAud, "AUD")
              }
              hint={monthExpenseError ? "Could not load" : "Current month"}
            />
          </CardBody>
        </Card>
        <Link href="/expenses?invoice=missing" className="block">
          <Card className="hover:border-slate-300 transition-colors">
            <CardBody>
              <CardStat
                label="Missing invoices"
                value={
                  missingInvoiceCountError ? "—" : String(missingInvoiceCount)
                }
                hint={
                  missingInvoiceCountError
                    ? "Could not load"
                    : missingInvoiceCount > 0
                      ? "Follow up required →"
                      : "All filed"
                }
              />
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody>
            <CardStat
              label="Upcoming renewals"
              value={
                upcomingRenewalCountError
                  ? "—"
                  : String(upcomingRenewalCount)
              }
              hint={
                upcomingRenewalCountError ? "Could not load" : "Next 30 days"
              }
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardStat
              label="Checklist"
              value={
                checklistTaskError
                  ? "—"
                  : `${checklistDone} / ${checklistTotal}`
              }
              hint={
                checklistTaskError
                  ? "Could not load"
                  : checklistTotal === 0
                    ? "No checklist tasks"
                    : `${checklistPct}% complete`
              }
            />
            {!checklistTaskError ? (
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900"
                  style={{ width: `${checklistPct}%` }}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
        <Link
          href="/documents?type=unlinked-receipts"
          className="block"
        >
          <Card className="hover:border-slate-300 transition-colors">
            <CardBody>
              <CardStat
                label="Unlinked receipts"
                value={
                  unlinkedReceiptError ? "—" : String(unlinkedReceiptCount)
                }
                hint={
                  unlinkedReceiptError
                    ? "Could not load"
                    : unlinkedReceiptCount > 0
                      ? "Needs linking →"
                      : "All linked"
                }
              />
            </CardBody>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader
            title="Upcoming renewals"
            description="Subscriptions renewing in the next 30 days"
            action={
              <Link
                href="/recurring"
                className="text-xs text-muted hover:text-foreground"
              >
                View all →
              </Link>
            }
          />
          <DataTable>
            <THead>
              <TR>
                <TH>Provider</TH>
                <TH>Amount</TH>
                <TH>Renewal date</TH>
                <TH>Days remaining</TH>
              </TR>
            </THead>
            <TBody>
              {upcomingRenewalRows.length === 0 ? (
                <EmptyRow colSpan={4}>No upcoming renewals</EmptyRow>
              ) : (
                upcomingRenewalRows.map((r) => {
                  const days = daysUntil(r.next_renewal_on, now);
                  return (
                    <TR key={r.id}>
                      <TD>{r.provider?.name ?? "—"}</TD>
                      <TD className="tabular-nums whitespace-nowrap">
                        {formatMoneyExplicit(
                          Number(r.amount),
                          r.currency as Currency,
                        )}
                      </TD>
                      <TD className="text-subtle whitespace-nowrap">
                        {formatDate(r.next_renewal_on)}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            days < 0
                              ? "danger"
                              : days <= 7
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {days < 0
                            ? "overdue"
                            : days === 0
                              ? "today"
                              : `in ${days} days`}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </DataTable>
        </Card>

        <Card>
          <CardHeader
            title="Missing invoices"
            description="Expenses without a saved invoice"
            action={
              <Link
                href="/expenses"
                className="text-xs text-muted hover:text-foreground"
              >
                View all →
              </Link>
            }
          />
          <DataTable>
            <THead>
              <TR>
                <TH>Provider</TH>
                <TH className="text-right">Amount</TH>
                <TH>Date</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {missingInvoiceRows.length === 0 ? (
                <EmptyRow colSpan={4}>All invoices accounted for</EmptyRow>
              ) : (
                missingInvoiceRows.map((e) => (
                  <TR key={e.id}>
                    <TD>{e.provider?.name ?? "—"}</TD>
                    <TD className="text-right tabular-nums whitespace-nowrap">
                      {formatMoneyExplicit(Number(e.aud_amount), "AUD")}
                    </TD>
                    <TD className="text-subtle">{formatDate(e.spent_on)}</TD>
                    <TD>
                      <Badge tone="danger">Missing</Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </DataTable>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent documents"
            action={
              <Link
                href="/documents"
                className="text-xs text-muted hover:text-foreground"
              >
                View all →
              </Link>
            }
          />
          <DataTable>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Provider</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {recentDocRows.length === 0 ? (
                <EmptyRow colSpan={3}>No recent documents</EmptyRow>
              ) : (
                recentDocRows.map((d) => {
                  const period =
                    d.doc_month && d.doc_year
                      ? formatMonth(d.doc_month, d.doc_year)
                      : null;
                  return (
                    <TR key={d.id}>
                      <TD>
                        <div>{d.title}</div>
                        <div className="text-xs text-subtle mt-0.5">
                          <span className="capitalize">{d.type}</span>
                          {period ? ` · ${period}` : ""}
                        </div>
                      </TD>
                      <TD className="text-subtle">
                        {d.provider?.name ?? "—"}
                      </TD>
                      <TD>
                        <Badge tone={recentDocStatusTone[d.file_status]}>
                          {d.file_status}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </DataTable>
        </Card>

        <Card>
          <CardHeader title="Quick links" description="Key providers" />
          <CardBody className="flex flex-col gap-1">
            {quickProviders.map((p) => (
              <Link
                key={p.id}
                href="/providers"
                className="flex items-center justify-between px-2 py-2 rounded-md text-sm hover:bg-slate-50"
              >
                <span className="text-foreground">{p.name}</span>
                <span className="text-xs text-subtle">{p.category}</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
