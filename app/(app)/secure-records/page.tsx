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
import { createSecureRecordAction } from "./actions";
import { initialCreateSecureRecordState } from "./form-state";
import { RevealButton } from "./reveal-button";
import { SecureRecordForm } from "./secure-record-form";

type SecureRecordRow = {
  id: string;
  label: string;
  kind: string;
  masked_value: string;
  security_level: string;
  notes: string | null;
  created_at: string;
};

const securityPriority: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const securityTone: Record<string, "danger" | "warning" | "muted"> = {
  high: "danger",
  medium: "warning",
  low: "muted",
};

const kindLabels: Record<string, string> = {
  tfn: "TFN",
  abn: "ABN",
  bank_account: "Bank account",
  identity: "Identity",
  recovery: "Recovery",
  other: "Other",
};

// TODO(encryption-rotation): single-key v1. When rotating, write rows with a
//   new encryption_key_id and migrate ciphertext in a background job.
// TODO(reveal): no reveal flow yet. When added, gate it behind a fresh
//   re-auth / MFA challenge and audit-log every decrypt.
// TODO(audit): per-read audit table is still TODO across the app; especially
//   important here.
export default async function SecureRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { add } = await searchParams;
  const showAdd = add === "1";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("secure_records")
    .select(
      "id, label, kind, masked_value, security_level, notes, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<SecureRecordRow[]>();

  const records = data ?? [];

  // Sort by security priority (high → medium → low). JS sort is stable so
  // within the same priority we keep the SQL-side `created_at DESC` order.
  const sorted = records.slice().sort((a, b) => {
    const pa = securityPriority[a.security_level] ?? 999;
    const pb = securityPriority[b.security_level] ?? 999;
    return pa - pb;
  });

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Secure records
          </h1>
          <p className="text-sm text-subtle mt-1">
            Identity and banking references. Encrypted at rest, masked on
            display.
          </p>
        </div>
        <Link
          href={showAdd ? "/secure-records" : "/secure-records?add=1"}
          className="shrink-0 inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          {showAdd ? "Cancel" : "Add secure record"}
        </Link>
      </div>

      <div className="mb-5 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Secure records are encrypted server-side. Values are masked by default.
      </div>

      {showAdd ? (
        <SecureRecordForm
          action={createSecureRecordAction}
          initial={initialCreateSecureRecordState}
          submitLabel="Add secure record"
          pendingLabel="Adding…"
        />
      ) : null}

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load secure records.</div>
          <p className="mt-1 text-red-700/90">{error.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Label</TH>
              <TH>Kind</TH>
              <TH>Masked value</TH>
              <TH>Sensitivity</TH>
              <TH>Notes</TH>
            </TR>
          </THead>
          <TBody>
            {sorted.length === 0 ? (
              <EmptyRow colSpan={5}>
                No secure records yet. Click &ldquo;Add secure record&rdquo; to
                create one.
              </EmptyRow>
            ) : (
              sorted.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.label}</TD>
                  <TD>
                    <Badge tone="neutral">
                      {kindLabels[r.kind] ?? r.kind}
                    </Badge>
                  </TD>
                  <TD>
                    <RevealButton id={r.id} masked={r.masked_value} />
                  </TD>
                  <TD>
                    <Badge tone={securityTone[r.security_level] ?? "muted"}>
                      {r.security_level}
                    </Badge>
                  </TD>
                  <TD className="text-subtle">{r.notes ?? "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </Card>
    </>
  );
}
