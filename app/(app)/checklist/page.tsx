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
import { formatDate, formatMonth } from "@/lib/format";
import {
  createMonthlyTaskAction,
  updateMonthlyTaskAction,
} from "./actions";
import { ChecklistForm } from "./checklist-form";
import {
  emptyMonthlyTaskValues,
  type CreateMonthlyTaskState,
} from "./form-state";
import { DeleteTaskButton } from "./delete-button";
import { QuickStatus } from "./quick-status";
import { RestoreTaskButton } from "./restore-button";

type TaskListRow = {
  id: string;
  label: string;
  status: string;
  due_on: string | null;
  created_at: string;
};

type TaskFullRow = {
  id: string;
  label: string;
  period_year: number;
  period_month: number;
  status: string;
  due_on: string | null;
  notes: string | null;
  template_key: string | null;
};

const statusOrder: Record<string, number> = {
  todo: 0,
  "in-progress": 1,
  done: 2,
};

const statusTone: Record<string, "muted" | "info" | "success"> = {
  todo: "muted",
  "in-progress": "info",
  done: "success",
};

const statusLabel: Record<string, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string;
    edit?: string;
    month?: string;
    year?: string;
    archived?: string;
  }>;
}) {
  const { add, edit, month, year, archived } = await searchParams;
  const viewArchived = archived === "1";
  const editRequested =
    !viewArchived && typeof edit === "string" && edit.length > 0;
  const editId = editRequested && uuidPattern.test(edit) ? edit : null;
  const showAdd = !viewArchived && !editRequested && add === "1";

  // Period selection: URL month/year wins when both are valid; otherwise we
  // fall back to today. "Both-or-neither" — partial input is treated as
  // missing so we don't render a half-decided header.
  const today = new Date();
  const monthFromUrl = Number(month);
  const yearFromUrl = Number(year);
  const periodFromUrlValid =
    Number.isInteger(monthFromUrl) &&
    monthFromUrl >= 1 &&
    monthFromUrl <= 12 &&
    Number.isInteger(yearFromUrl) &&
    yearFromUrl >= 2020 &&
    yearFromUrl <= 2100;
  const periodMonth = periodFromUrlValid
    ? monthFromUrl
    : today.getMonth() + 1;
  const periodYear = periodFromUrlValid ? yearFromUrl : today.getFullYear();

  // Build href helpers. The selected month/year propagates to Add / Edit /
  // Cancel hrefs only if it was supplied in the URL — keeps URLs clean when
  // the user is on the default view. Archived flag preserved across these
  // navigations so the user stays in the view they chose.
  function buildHref(extra?: {
    add?: boolean;
    edit?: string;
    archived?: boolean;
  }): string {
    const params = new URLSearchParams();
    if (periodFromUrlValid) {
      params.set("month", String(periodMonth));
      params.set("year", String(periodYear));
    }
    if (extra?.archived ?? viewArchived) params.set("archived", "1");
    if (extra?.add) params.set("add", "1");
    if (extra?.edit) params.set("edit", extra.edit);
    const q = params.toString();
    return q ? `/checklist?${q}` : "/checklist";
  }

  const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1;
  const prevYear = periodMonth === 1 ? periodYear - 1 : periodYear;
  const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
  const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  // Prev/next preserve the archived flag too.
  const archivedQs = viewArchived ? "&archived=1" : "";
  const prevHref = `/checklist?month=${prevMonth}&year=${prevYear}${archivedQs}`;
  const nextHref = `/checklist?month=${nextMonth}&year=${nextYear}${archivedQs}`;

  const supabase = await createSupabaseServerClient();

  const baseList = supabase
    .from("monthly_tasks")
    .select("id, label, status, due_on, created_at")
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth);
  const filteredList = viewArchived
    ? baseList.not("deleted_at", "is", null)
    : baseList.is("deleted_at", null);
  const { data, error } = await filteredList.returns<TaskListRow[]>();

  const tasks = data ?? [];

  // Custom sort: status priority (todo, in-progress, done), then due_on ASC
  // (nulls last), then created_at ASC. Postgres can't easily express the
  // status priority via supabase-js .order(), so we sort in JS — list size
  // for a single month is small.
  const sorted = tasks.slice().sort((a, b) => {
    const sa = statusOrder[a.status] ?? 999;
    const sb = statusOrder[b.status] ?? 999;
    if (sa !== sb) return sa - sb;
    if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on);
    if (a.due_on) return -1;
    if (b.due_on) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  const total = sorted.length;
  const done = sorted.filter((t) => t.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  // Edit target lookup, scoped by RLS.
  let editTarget: TaskFullRow | null = null;
  if (editId) {
    const { data: targetData } = await supabase
      .from("monthly_tasks")
      .select(
        "id, label, period_year, period_month, status, due_on, notes, template_key",
      )
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetData) editTarget = targetData as TaskFullRow;
  }

  const editNotFound = editRequested && !editTarget;

  const editInitial: CreateMonthlyTaskState | null = editTarget
    ? {
        error: null,
        values: {
          label: editTarget.label,
          period_year: String(editTarget.period_year),
          period_month: String(editTarget.period_month),
          status: editTarget.status,
          due_on: editTarget.due_on ?? "",
          notes: editTarget.notes ?? "",
          template_key: editTarget.template_key ?? "",
        },
      }
    : null;

  // Add-form initial state — selected month/year as defaults so adding from
  // a non-current view defaults to that period.
  const addInitial: CreateMonthlyTaskState = {
    error: null,
    values: {
      ...emptyMonthlyTaskValues,
      period_year: String(periodYear),
      period_month: String(periodMonth),
    },
  };

  const showAnyForm = showAdd || editRequested;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Monthly checklist
          </h1>
          <p className="text-sm text-subtle mt-1 flex items-center gap-2 flex-wrap">
            <Link
              href={prevHref}
              aria-label="Previous month"
              className="text-muted hover:text-foreground"
            >
              ←
            </Link>
            <span className="text-foreground font-medium">
              {formatMonth(periodMonth, periodYear)}
            </span>
            <Link
              href={nextHref}
              aria-label="Next month"
              className="text-muted hover:text-foreground"
            >
              →
            </Link>
            <span>
              · {done} of {total} complete ({pct}%).
            </span>
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {viewArchived ? (
            <Link
              href={buildHref({ archived: false })}
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              ← View active
            </Link>
          ) : (
            <>
              <Link
                href={buildHref({ archived: true })}
                className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
              >
                View archived
              </Link>
              <Link
                href={showAnyForm ? buildHref() : buildHref({ add: true })}
                className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                {showAnyForm ? "Cancel" : "Add task"}
              </Link>
            </>
          )}
        </div>
      </div>

      {editNotFound ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Task not found or you do not have permission to edit it.
        </div>
      ) : null}

      {showAdd ? (
        <ChecklistForm
          action={createMonthlyTaskAction}
          initial={addInitial}
          submitLabel="Add task"
          pendingLabel="Adding…"
        />
      ) : null}

      {editTarget && editInitial ? (
        <ChecklistForm
          action={updateMonthlyTaskAction}
          initial={editInitial}
          submitLabel="Save task"
          pendingLabel="Saving…"
          taskId={editTarget.id}
        />
      ) : null}

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load tasks.</div>
          <p className="mt-1 text-red-700/90">{error.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Task</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sorted.length === 0 ? (
              <EmptyRow colSpan={4}>
                {viewArchived
                  ? "No archived tasks for this month."
                  : "No tasks for this month yet. Click “Add task” to create one."}
              </EmptyRow>
            ) : (
              sorted.map((t) => (
                <TR
                  key={t.id}
                  className={viewArchived ? "opacity-70" : undefined}
                >
                  <TD>{t.label}</TD>
                  <TD className="text-subtle">
                    {t.due_on ? formatDate(t.due_on) : "—"}
                  </TD>
                  <TD>
                    <Badge tone={statusTone[t.status] ?? "muted"}>
                      {statusLabel[t.status] ?? t.status}
                    </Badge>
                  </TD>
                  <TD>
                    {viewArchived ? (
                      <div className="flex items-center gap-3">
                        <Badge tone="muted">Archived</Badge>
                        <RestoreTaskButton id={t.id} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <QuickStatus id={t.id} current={t.status} />
                        <span className="text-subtle text-xs">·</span>
                        <Link
                          href={buildHref({ edit: t.id })}
                          className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteTaskButton
                          id={t.id}
                          redirectMonth={
                            periodFromUrlValid ? periodMonth : undefined
                          }
                          redirectYear={
                            periodFromUrlValid ? periodYear : undefined
                          }
                        />
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
