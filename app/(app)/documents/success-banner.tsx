"use client";

import { useEffect, useState } from "react";

// Small transient banner that auto-dismisses after 3 seconds AND strips its
// driving query param(s) from the URL so a refresh doesn't re-show it.
// `paramKey` accepts a single name or an array — useful when one banner is
// driven by a primary param (`saved`) but should also clear a co-flag
// (`auto_linked`) so the URL settles back to the same place either way.
export function AutoDismissSuccess({
  message,
  paramKey = "saved",
}: {
  message: string;
  paramKey?: string | string[];
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Flatten the keys to a stable string so the dep array is array-shape
  // independent (otherwise a new array literal each render retriggers).
  const keysSerialised = Array.isArray(paramKey)
    ? paramKey.join(",")
    : paramKey;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const keys = keysSerialised.split(",");
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
  }, [keysSerialised]);

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
