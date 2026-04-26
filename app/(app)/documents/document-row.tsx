"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TD } from "@/components/ui/data-table";
import type { FileStatus } from "@/lib/types";
import { linkReceiptToExpenseAction } from "./actions";
import { DeleteDocumentButton } from "./delete-button";

export type LinkableExpense = { id: string; label: string };

const statusTone: Record<FileStatus, "success" | "warning" | "danger"> = {
  saved: "success",
  pending: "warning",
  missing: "danger",
};

export type DocumentRowProps = {
  id: string;
  title: string;
  notes: string | null;
  providerName: string;
  expenseLabel: string | null;
  type: string;
  periodLabel: string;
  fileStatus: FileStatus;
  isPrivate: boolean;
  hasFile: boolean;
  unlinkedReceipt: boolean;
  // Empty list → render "No expenses to link" instead of a select.
  linkableExpenses: LinkableExpense[];
  // Active filter on the parent page, threaded into editHref so the user
  // returns to the same filtered list after saving / cancelling.
  currentType?: string;
};

// Entire row is clickable — navigates to the edit URL. The Edit link inside
// is a visible affordance and a fallback (e.g. for keyboard users opening via
// context menu). The Actions cell stops click propagation so Delete's form
// submission never races with the row-click navigation.
export function DocumentRow(props: DocumentRowProps) {
  const router = useRouter();
  const editHref = props.currentType
    ? `/documents?edit=${props.id}&type=${props.currentType}`
    : `/documents?edit=${props.id}`;

  return (
    <tr
      className="hover:bg-slate-50/60 cursor-pointer"
      onClick={() => router.push(editHref)}
    >
      <TD>
        <div className="font-medium">{props.title}</div>
        {props.notes ? (
          <div className="text-xs text-subtle mt-0.5">{props.notes}</div>
        ) : null}
      </TD>
      <TD className="text-subtle">{props.providerName}</TD>
      <TD className="text-subtle">
        {props.expenseLabel ? (
          props.expenseLabel
        ) : props.unlinkedReceipt ? (
          <div className="flex flex-col items-start gap-1.5">
            <Badge tone="warning">Unlinked receipt</Badge>
            {props.linkableExpenses.length === 0 ? (
              <span className="text-[11px] text-subtle">
                No expenses to link
              </span>
            ) : (
              // Inline linker — picks an active expense and posts to the
              // dedicated server action. onClick stopPropagation keeps the
              // surrounding tr's click-to-edit handler from firing.
              <form
                action={linkReceiptToExpenseAction}
                onClick={(event) => event.stopPropagation()}
                className="flex items-center gap-1"
              >
                <input type="hidden" name="document_id" value={props.id} />
                <select
                  name="expense_id"
                  defaultValue=""
                  required
                  className="border border-border rounded h-7 px-1.5 text-xs bg-white text-foreground max-w-[16rem] truncate focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  <option value="" disabled>
                    Pick expense…
                  </option>
                  {props.linkableExpenses.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="text-xs h-7 px-2 rounded-md border border-border bg-white text-foreground hover:bg-slate-50"
                >
                  Link
                </button>
              </form>
            )}
          </div>
        ) : (
          "—"
        )}
      </TD>
      <TD className="capitalize">{props.type}</TD>
      <TD className="text-subtle">{props.periodLabel}</TD>
      <TD>
        <Badge tone={statusTone[props.fileStatus]}>{props.fileStatus}</Badge>
      </TD>
      <TD>
        {props.isPrivate ? (
          <Badge tone="info">Private</Badge>
        ) : (
          <span className="text-xs text-subtle">—</span>
        )}
      </TD>
      <td
        className="px-5 py-3 align-middle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {props.hasFile ? (
            // Plain <a> — points at a Route Handler that 302s to a short-
            // lived signed URL, never exposes the storage path.
            <a
              href={`/documents/${props.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              View
            </a>
          ) : null}
          <Link
            href={editHref}
            className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
          >
            Edit
          </Link>
          <DeleteDocumentButton id={props.id} />
        </div>
      </td>
    </tr>
  );
}
