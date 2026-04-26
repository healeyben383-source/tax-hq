"use client";

import { restoreMonthlyTaskAction } from "./actions";

export function RestoreTaskButton({ id }: { id: string }) {
  return (
    <form action={restoreMonthlyTaskAction} className="inline">
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
