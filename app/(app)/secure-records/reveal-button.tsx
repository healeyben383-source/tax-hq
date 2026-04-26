"use client";

import { useEffect, useRef, useState } from "react";

const REVEAL_DURATION_MS = 12_000;

// Holds the revealed plaintext only in component state for the duration of
// the timer (then setRevealed(null) clears the reference). Plaintext never
// touches localStorage, sessionStorage, cookies, the URL, or page HTML — the
// initial render only ships the masked value.
export function RevealButton({
  id,
  masked,
}: {
  id: string;
  masked: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Cancel any pending auto-hide when the row unmounts.
  useEffect(() => {
    return clearTimer;
  }, []);

  async function handleReveal() {
    if (!window.confirm("Reveal this sensitive value?")) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/secure-records/${id}/reveal`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("Could not reveal.");
        return;
      }
      const body: unknown = await response.json();
      const value =
        body && typeof body === "object" && "value" in body
          ? (body as { value: unknown }).value
          : null;
      if (typeof value !== "string") {
        setError("Could not reveal.");
        return;
      }
      setRevealed(value);
      clearTimer();
      timerRef.current = setTimeout(() => {
        setRevealed(null);
      }, REVEAL_DURATION_MS);
    } catch {
      setError("Could not reveal.");
    } finally {
      setPending(false);
    }
  }

  function handleHide() {
    clearTimer();
    setRevealed(null);
    setError(null);
  }

  if (revealed !== null) {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-foreground">{revealed}</span>
        <button
          type="button"
          onClick={handleHide}
          className="text-xs text-muted hover:text-foreground underline-offset-4 hover:underline"
        >
          Hide
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="font-mono text-sm text-subtle">{masked}</span>
      <button
        type="button"
        onClick={handleReveal}
        disabled={pending}
        className="text-xs text-muted hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending ? "Revealing…" : "Reveal"}
      </button>
      {error ? (
        <span className="text-xs text-red-700">{error}</span>
      ) : null}
    </span>
  );
}
