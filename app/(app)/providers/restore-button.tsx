"use client";

import { restoreProviderAction } from "./actions";

// No confirm dialog — restore is non-destructive and reversible (just delete
// again if the user changes their mind).
export function RestoreProviderButton({ id }: { id: string }) {
  return (
    <form action={restoreProviderAction} className="inline">
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
