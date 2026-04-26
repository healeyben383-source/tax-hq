"use client";

import { useEffect, useState } from "react";

// Small transient banner that auto-dismisses after 3 seconds AND strips its
// driving query param from the URL so a refresh doesn't re-show it.
export function AutoDismissSuccess({
  message,
  paramKey = "saved",
}: {
  message: string;
  paramKey?: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(paramKey)) {
      url.searchParams.delete(paramKey);
      const cleaned =
        url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", cleaned);
    }
  }, [paramKey]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2"
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600"
      />
      {message}
    </div>
  );
}
