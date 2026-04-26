"use client";

import { restoreExpenseAction } from "./actions";

export function RestoreExpenseButton({ id }: { id: string }) {
  return (
    <form action={restoreExpenseAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline"
      >
        Restore
      </button>
    </form>
  );
}
