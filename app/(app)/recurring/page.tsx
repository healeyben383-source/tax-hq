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
import { daysUntil, formatDate, formatMoneyExplicit } from "@/lib/format";
import type { Currency } from "@/lib/types";
import {
  createRecurringSubscriptionAction,
  updateRecurringSubscriptionAction,
} from "./actions";
import {
  initialCreateRecurringState,
  type CreateRecurringState,
} from "./form-state";
import { DeleteRecurringSubscriptionButton } from "./delete-button";
import { RecurringForm } from "./recurring-form";
import { RestoreRecurringSubscriptionButton } from "./restore-button";

type SubscriptionListRow = {
  id: string;
  amount: number | string;
  currency: string;
  cadence: string;
  next_renewal_on: string;
  cancelled_on: string | null;
  active: boolean;
  notes: string | null;
  provider: { name: string } | null;
};

type SubscriptionFullRow = {
  id: string;
  provider_id: string;
  amount: number | string;
  currency: string;
  cadence: string;
  next_renewal_on: string;
  started_on: string | null;
  cancelled_on: string | null;
  notes: string | null;
};

type ProviderOption = { id: string; name: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RecurringPage({
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
    .from("recurring_subscriptions")
    .select(
      "id, amount, currency, cadence, next_renewal_on, cancelled_on, active, notes, provider:providers(name)",
    );
  const filteredList = viewArchived
    ? baseList.not("deleted_at", "is", null)
    : baseList.is("deleted_at", null);
  const subscriptionsResult = await filteredList
    .order("next_renewal_on", { ascending: true })
    .returns<SubscriptionListRow[]>();

  const providersResult = await supabase
    .from("providers")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<ProviderOption[]>();

  const subscriptions = subscriptionsResult.data ?? [];
  const providers = providersResult.data ?? [];
  const loadError = subscriptionsResult.error;

  // Edit target lookup — RLS-scoped. Non-owner / missing id → editNotFound.
  let editTarget: SubscriptionFullRow | null = null;
  if (editId) {
    const { data: targetData } = await supabase
      .from("recurring_subscriptions")
      .select(
        "id, provider_id, amount, currency, cadence, next_renewal_on, started_on, cancelled_on, notes",
      )
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetData) {
      editTarget = targetData as SubscriptionFullRow;
    }
  }

  const editNotFound = editRequested && !editTarget;

  // Edge case: original provider has been soft-deleted since the row was
  // created. Show a red notice and reset provider_id so the user must pick.
  const visibleProviderIds = new Set(providers.map((p) => p.id));

  let providerMissing = false;
  let editInitial: CreateRecurringState | null = null;
  if (editTarget) {
    const hasValidProvider = visibleProviderIds.has(editTarget.provider_id);
    providerMissing = !hasValidProvider;
    editInitial = {
      error: null,
      values: {
        provider_id: hasValidProvider ? editTarget.provider_id : "",
        amount: String(editTarget.amount),
        currency: editTarget.currency,
        cadence: editTarget.cadence,
        next_renewal_on: editTarget.next_renewal_on,
        started_on: editTarget.started_on ?? "",
        cancelled_on: editTarget.cancelled_on ?? "",
        notes: editTarget.notes ?? "",
      },
    };
  }

  const showAnyForm = showAdd || editRequested;

  // Header summary: rough monthly spend across active subscriptions.
  // Mirrors the previous mock display; uses a flat 1.56 USD→AUD multiplier
  // for non-AUD lines because no FX layer exists yet.
  const now = new Date();
  const monthlyEquivAud = subscriptions
    .filter((s) => s.active && s.cadence === "monthly")
    .reduce((sum, s) => {
      const amt = Number(s.amount);
      return sum + (s.currency === "AUD" ? amt : amt * 1.56);
    }, 0);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Recurring
          </h1>
          <p className="text-sm text-subtle mt-1">
            {viewArchived
              ? `Showing archived subscriptions · ${subscriptions.length} item${subscriptions.length === 1 ? "" : "s"}.`
              : `Active subscriptions · ~${formatMoneyExplicit(monthlyEquivAud, "AUD")} monthly equivalent.`}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {viewArchived ? (
            <Link
              href="/recurring"
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              ← View active
            </Link>
          ) : (
            <>
              <Link
                href="/recurring?archived=1"
                className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
              >
                View archived
              </Link>
              <Link
                href={showAnyForm ? "/recurring" : "/recurring?add=1"}
                className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                {showAnyForm ? "Cancel" : "Add subscription"}
              </Link>
            </>
          )}
        </div>
      </div>

      {editNotFound ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Subscription not found or you do not have permission to edit it.
        </div>
      ) : null}

      {showAdd ? (
        <RecurringForm
          action={createRecurringSubscriptionAction}
          initial={initialCreateRecurringState}
          submitLabel="Add subscription"
          pendingLabel="Adding…"
          providers={providers}
        />
      ) : null}

      {editTarget && editInitial ? (
        <RecurringForm
          action={updateRecurringSubscriptionAction}
          initial={editInitial}
          submitLabel="Save subscription"
          pendingLabel="Saving…"
          subscriptionId={editTarget.id}
          providers={providers}
          providerMissing={providerMissing}
        />
      ) : null}

      {loadError ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load subscriptions.</div>
          <p className="mt-1 text-red-700/90">{loadError.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Provider</TH>
              <TH className="text-right">Amount</TH>
              <TH>Cadence</TH>
              <TH>Next renewal</TH>
              <TH>Days</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {subscriptions.length === 0 ? (
              <EmptyRow colSpan={7}>
                {viewArchived
                  ? "No archived subscriptions."
                  : "No subscriptions yet. Click “Add subscription” to create one."}
              </EmptyRow>
            ) : (
              subscriptions.map((s) => {
                const days = daysUntil(s.next_renewal_on, now);
                return (
                  <TR
                    key={s.id}
                    className={viewArchived ? "opacity-70" : undefined}
                  >
                    <TD>{s.provider?.name ?? "—"}</TD>
                    <TD className="text-right tabular-nums whitespace-nowrap">
                      {formatSubscriptionAmount(Number(s.amount), s.currency)}
                    </TD>
                    <TD className="capitalize text-subtle">{s.cadence}</TD>
                    <TD className="text-subtle whitespace-nowrap">
                      {formatDate(s.next_renewal_on)}
                    </TD>
                    <TD>{renderDaysBadge(s.active, days)}</TD>
                    <TD>
                      <Badge tone={s.active ? "success" : "muted"}>
                        {s.active ? "Active" : "Cancelled"}
                      </Badge>
                    </TD>
                    <TD>
                      {viewArchived ? (
                        <div className="flex items-center gap-3">
                          <Badge tone="muted">Archived</Badge>
                          <RestoreRecurringSubscriptionButton id={s.id} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/recurring?edit=${s.id}`}
                            className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
                          >
                            Edit
                          </Link>
                          <DeleteRecurringSubscriptionButton id={s.id} />
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </DataTable>
      </Card>
    </>
  );
}

// Renders the source-currency amount via the shared explicit-currency
// formatter, then for USD also appends a rough AUD equivalent using the same
// flat 1.56 multiplier the page header already relies on (no real FX layer
// yet).
function formatSubscriptionAmount(amount: number, currency: string): string {
  const primary = formatMoneyExplicit(amount, currency as Currency);
  if (currency === "USD") {
    return `${primary} (~${formatMoneyExplicit(amount * 1.56, "AUD")})`;
  }
  return primary;
}

function renderDaysBadge(active: boolean, days: number) {
  if (!active) return <span className="text-xs text-subtle">—</span>;
  const tone =
    days < 0 ? "danger" : days <= 7 ? "warning" : days <= 30 ? "neutral" : "muted";
  const label =
    days < 0
      ? "overdue"
      : days === 0
        ? "today"
        : days === 1
          ? "tomorrow"
          : `${days}d`;
  return <Badge tone={tone}>{label}</Badge>;
}
