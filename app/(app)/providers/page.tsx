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
import type { Provider } from "@/lib/types";
import { createProviderAction, updateProviderAction } from "./actions";
import {
  initialCreateProviderState,
  type CreateProviderState,
} from "./form-state";
import { DeleteProviderButton } from "./delete-button";
import { ProviderForm } from "./provider-form";
import { RestoreProviderButton } from "./restore-button";

type ProviderListRow = {
  id: string;
  name: string;
  category: Provider["category"];
  login_email: string | null;
  billing_type: Provider["billingType"];
  invoice_source: Provider["invoiceSource"];
  renewal_cycle: Provider["renewalCycle"];
  notes: string | null;
};

type ProviderFullRow = ProviderListRow & { slug: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string;
    edit?: string;
    warn?: string;
    archived?: string;
  }>;
}) {
  const { add, edit, warn, archived } = await searchParams;

  // Archived view suppresses add/edit forms.
  const viewArchived = archived === "1";
  const editRequested =
    !viewArchived && typeof edit === "string" && edit.length > 0;
  const editId = editRequested && uuidPattern.test(edit) ? edit : null;
  const showAdd = !viewArchived && !editRequested && add === "1";

  const supabase = await createSupabaseServerClient();

  const baseList = supabase
    .from("providers")
    .select(
      "id, name, category, login_email, billing_type, invoice_source, renewal_cycle, notes",
    );
  const filteredList = viewArchived
    ? baseList.not("deleted_at", "is", null)
    : baseList.is("deleted_at", null);
  const { data, error } = await filteredList
    .order("name", { ascending: true })
    .returns<ProviderListRow[]>();

  // Load the row being edited, scoped by RLS. A non-owner / missing id falls
  // through to editNotFound without crashing the page.
  let editTarget: ProviderFullRow | null = null;
  if (editId) {
    const { data: targetData } = await supabase
      .from("providers")
      .select(
        "id, name, slug, category, login_email, billing_type, invoice_source, renewal_cycle, notes",
      )
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetData) {
      editTarget = targetData as ProviderFullRow;
    }
  }

  const editNotFound = editRequested && !editTarget;

  const editInitial: CreateProviderState | null = editTarget
    ? {
        error: null,
        values: {
          name: editTarget.name,
          slug: editTarget.slug,
          category: editTarget.category,
          billing_type: editTarget.billing_type,
          invoice_source: editTarget.invoice_source,
          renewal_cycle: editTarget.renewal_cycle,
          login_email: editTarget.login_email ?? "",
        },
      }
    : null;

  const showAnyForm = showAdd || editRequested;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Providers
          </h1>
          <p className="text-sm text-subtle mt-1">
            {viewArchived
              ? "Showing archived providers."
              : "Accounts that generate recurring or ad-hoc charges."}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {viewArchived ? (
            <Link
              href="/providers"
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              ← View active
            </Link>
          ) : (
            <>
              <Link
                href="/providers?archived=1"
                className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
              >
                View archived
              </Link>
              <Link
                href={showAnyForm ? "/providers" : "/providers?add=1"}
                className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                {showAnyForm ? "Cancel" : "Add provider"}
              </Link>
            </>
          )}
        </div>
      </div>

      {editNotFound ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Provider not found.
        </div>
      ) : null}

      {warn === "linked" ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This provider has linked records and cannot be deleted yet.
        </div>
      ) : null}

      {warn === "slug-conflict" ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cannot restore — another active provider with the same slug already
          exists. Edit or remove the conflicting provider first.
        </div>
      ) : null}

      {showAdd ? (
        <ProviderForm
          action={createProviderAction}
          initial={initialCreateProviderState}
          submitLabel="Add provider"
          pendingLabel="Adding…"
        />
      ) : null}

      {editTarget && editInitial ? (
        <ProviderForm
          action={updateProviderAction}
          initial={editInitial}
          submitLabel="Save provider"
          pendingLabel="Saving…"
          providerId={editTarget.id}
        />
      ) : null}

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">Could not load providers.</div>
          <p className="mt-1 text-red-700/90">{error.message}</p>
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Category</TH>
              <TH>Login email</TH>
              <TH>Billing</TH>
              <TH>Invoice source</TH>
              <TH>Renewal</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {!data || data.length === 0 ? (
              <EmptyRow colSpan={7}>
                {viewArchived
                  ? "No archived providers."
                  : "No providers yet. Click “Add provider” to create one."}
              </EmptyRow>
            ) : (
              data.map((p) => (
                <TR
                  key={p.id}
                  className={viewArchived ? "opacity-70" : undefined}
                >
                  <TD>
                    <div className="font-medium">{p.name}</div>
                    {p.notes ? (
                      <div className="text-xs text-subtle mt-0.5">{p.notes}</div>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone="neutral">{p.category}</Badge>
                  </TD>
                  <TD className="text-subtle">{p.login_email ?? "—"}</TD>
                  <TD className="capitalize">{p.billing_type}</TD>
                  <TD className="capitalize text-subtle">{p.invoice_source}</TD>
                  <TD className="capitalize">{p.renewal_cycle}</TD>
                  <TD>
                    {viewArchived ? (
                      <div className="flex items-center gap-3">
                        <Badge tone="muted">Archived</Badge>
                        <RestoreProviderButton id={p.id} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/providers?edit=${p.id}`}
                          className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteProviderButton id={p.id} />
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
