"use client";

import { type FormEvent } from "react";
import { deleteDocumentAction } from "./actions";

// Wrapped in its own tiny client component so we can gate the submit on a
// native `window.confirm`. Sits inside a cell that already stops click
// propagation, so the row's click-to-edit handler doesn't fire.
export function DeleteDocumentButton({ id }: { id: string }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Are you sure you want to delete this document?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteDocumentAction} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm text-red-700 hover:text-red-900 underline-offset-4 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
