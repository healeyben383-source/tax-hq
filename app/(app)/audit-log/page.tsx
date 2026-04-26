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

type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};

// Known option lists for the dropdowns. Keep in sync as new audit writers
// land. The server still accepts any string via the query string, so a
// hand-typed URL will filter correctly even before the option is added.
const actionOptions: string[] = ["reveal", "link_receipt"];
const entityTypeOptions: string[] = ["secure_record", "document"];

// entity_type → list page. Single source of truth for the per-row View link.
// Deep-links (e.g. to a specific row's edit URL) can replace these once the
// audit table starts carrying enough metadata to guarantee the target still
// exists.
const entityViewHref: Record<string, string> = {
  secure_record: "/secure-records",
  document: "/documents",
};

const rangeOptions: { value: string; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const validRanges = new Set(["24h", "7d", "30d"]);

function computeSinceIso(range: string): string | null {
  if (!validRanges.has(range)) return null;
  const ms =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

// Same trick the dashboard helpers use: an unconstrained generic + a tiny
// runtime cast keeps the call-site types but stops TS from chasing
// PostgrestFilterBuilder's recursive types when filters are conditionally
// chained inside one function.
type AuditFilterable = {
  eq(column: string, value: string): AuditFilterable;
  gte(column: string, value: string): AuditFilterable;
};

function applyAuditFilters<T>(
  query: T,
  filterAction: string,
  filterEntityType: string,
  sinceIso: string | null,
): T {
  let chain = query as unknown as AuditFilterable;
  if (filterAction) chain = chain.eq("action", filterAction);
  if (filterEntityType) chain = chain.eq("entity_type", filterEntityType);
  if (sinceIso) chain = chain.gte("created_at", sinceIso);
  return chain as unknown as T;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entity_type?: string;
    range?: string;
  }>;
}) {
  const params = await searchParams;
  const filterAction = (params.action ?? "").trim();
  const filterEntityType = (params.entity_type ?? "").trim();
  const filterRange = validRanges.has(params.range ?? "") ? params.range! : "";
  const sinceIso = filterRange ? computeSinceIso(filterRange) : null;

  const hasActiveFilter = Boolean(
    filterAction || filterEntityType || filterRange,
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await applyAuditFilters(
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, created_at"),
    filterAction,
    filterEntityType,
    sinceIso,
  )
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<AuditLogRow[]>();

  const rows = data ?? [];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Audit log
        </h1>
        <p className="text-sm text-subtle mt-1">
          {hasActiveFilter
            ? `Filtered to the most recent 50 matching events.`
            : `Most recent 50 events for your account.`}
        </p>
      </div>

      {/* Plain GET form — no JS, no client Supabase. URL params drive the
          query above on submit. */}
      <form
        method="get"
        action="/audit-log"
        className="mb-5 flex flex-wrap items-end gap-3"
      >
        <FilterSelect
          label="Action"
          name="action"
          options={[
            { value: "", label: "Any action" },
            ...actionOptions.map((v) => ({ value: v, label: v })),
          ]}
          defaultValue={filterAction}
        />
        <FilterSelect
          label="Entity type"
          name="entity_type"
          options={[
            { value: "", label: "Any type" },
            ...entityTypeOptions.map((v) => ({ value: v, label: v })),
          ]}
          defaultValue={filterEntityType}
        />
        <FilterSelect
          label="Time range"
          name="range"
          options={rangeOptions}
          defaultValue={filterRange}
        />
        <button
          type="submit"
          className="h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Apply
        </button>
        {hasActiveFilter ? (
          <Link
            href="/audit-log"
            className="h-9 inline-flex items-center text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load audit log.</div>
          <p className="mt-1 text-red-700/90">{error.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Action</TH>
              <TH>Entity type</TH>
              <TH>Entity id</TH>
              <TH>When</TH>
              <TH>View</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>
                {hasActiveFilter
                  ? "No activity matches these filters."
                  : "No activity recorded yet"}
              </EmptyRow>
            ) : (
              rows.map((r) => {
                const viewHref = entityViewHref[r.entity_type];
                return (
                  <TR key={r.id}>
                    <TD>
                      <Badge tone="info">{r.action}</Badge>
                    </TD>
                    <TD>
                      <Badge tone="neutral">{r.entity_type}</Badge>
                    </TD>
                    <TD className="font-mono text-xs text-subtle">
                      {r.entity_id}
                    </TD>
                    <TD className="text-subtle whitespace-nowrap">
                      {formatTimestamp(r.created_at)}
                    </TD>
                    <TD>
                      {viewHref ? (
                        // Plain <a> rather than next/link: Next 16's typed-
                        // routes inference on a runtime-string href triggers
                        // a deep type instantiation that OOMs tsc on this
                        // codebase. The destination is an internal route, so
                        // a hard navigation is fine for an audit click-through.
                        <a
                          href={viewHref}
                          className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-subtle">—</span>
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

function FilterSelect({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
