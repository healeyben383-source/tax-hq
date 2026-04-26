// Single source of truth for "what counts as an effectively-unlinked receipt".
//
// A receipt is effectively unlinked when:
//   - type === "receipt", AND
//   - expense_id is null, OR
//   - the embedded expense join didn't resolve (e.g. RLS hid the row), OR
//   - the embedded expense has been soft-deleted (deleted_at IS NOT NULL).
//
// Used by:
//   - app/(app)/documents/page.tsx       — list filter, tab count, per-row badge
//   - app/(app)/documents/actions.ts     — (indirectly via the page)
//   - app/(app)/page.tsx                 — dashboard stat count
//
// Pure / no I/O, so importable from any module (server or client).
export function isEffectivelyUnlinkedReceipt(d: {
  type: string;
  expense_id: string | null;
  expense: { deleted_at: string | null } | null;
}): boolean {
  if (d.type !== "receipt") return false;
  if (!d.expense_id) return true;
  if (!d.expense) return true;
  return d.expense.deleted_at !== null;
}
