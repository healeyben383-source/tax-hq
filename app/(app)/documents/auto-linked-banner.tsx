"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { unlinkDocumentExpenseAction } from "./actions";

// Variant of the success banner shown after createDocumentAction auto-links
// a freshly-created document to an expense. Adds two contextual actions:
//   - "Change match" → opens the document in the existing edit form, which
//     already includes the linked-expense select.
//   - "Unlink"       → posts to unlinkDocumentExpenseAction. The action is
//     owner-scoped, RLS-safe, and fail-silent.
//
// The auto-dismiss timer is longer here than the plain saved banner (8s vs
// 3s) so the user has time to read and react. URL flags (saved, auto_linked,
// doc) are stripped on mount so a refresh doesn't re-show the banner.
export function AutoLinkedBanner({ documentId }: { documentId: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const keys = ["saved", "auto_linked", "doc"];
    let mutated = false;
    for (const k of keys) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        mutated = true;
      }
    }
    if (mutated) {
      const cleaned =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", cleaned);
    }
  }, []);

  // Native confirm() — matches the DeleteDocumentButton pattern. Cancel
  // calls preventDefault so the form never reaches the server action.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Unlink this document from its expense?")) {
      event.preventDefault();
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-3 flex-wrap"
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600"
      />
      <span>Document saved and linked to matching expense</span>
      <span aria-hidden className="text-emerald-700/60">
        ·
      </span>
      <Link
        href={`/documents?edit=${documentId}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        Change match
      </Link>
      <span aria-hidden className="text-emerald-700/60">
        ·
      </span>
      {/* Plain form so the action runs server-side, RLS-scoped, no client
          Supabase. onClick stopPropagation isn't needed — the banner sits
          outside any clickable container. */}
      <form
        action={unlinkDocumentExpenseAction}
        onSubmit={handleSubmit}
        className="inline-flex"
      >
        <input type="hidden" name="document_id" value={documentId} />
        <button
          type="submit"
          className="font-medium underline-offset-4 hover:underline bg-transparent border-0 p-0 cursor-pointer text-emerald-800"
        >
          Unlink
        </button>
      </form>
    </div>
  );
}
