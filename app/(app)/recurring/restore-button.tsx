"use client";

import { restoreRecurringSubscriptionAction } from "./actions";

export function RestoreRecurringSubscriptionButton({ id }: { id: string }) {
  return (
    <form action={restoreRecurringSubscriptionAction} className="inline">
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
