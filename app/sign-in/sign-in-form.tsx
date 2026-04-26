"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="bg-surface border border-border rounded-lg p-6 flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next ?? "/"} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email ?? ""}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {state.error ? (
        <div
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-slate-900 text-white rounded-md text-sm font-medium h-9 hover:bg-slate-800 disabled:opacity-60 transition-colors"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="border border-border rounded-md h-9 px-3 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      />
    </label>
  );
}
