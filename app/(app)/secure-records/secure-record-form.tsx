"use client";

import { useActionState } from "react";
import {
  secureRecordKindSelectOptions,
  secureRecordSecurityLevelOptions,
  type CreateSecureRecordState,
} from "./form-state";

type SecureRecordFormAction = (
  prev: CreateSecureRecordState,
  formData: FormData,
) => Promise<CreateSecureRecordState>;

export function SecureRecordForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: SecureRecordFormAction;
  initial: CreateSecureRecordState;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateSecureRecordState,
    FormData
  >(action, initial);

  // Defensive fallbacks. Note: state.values intentionally does NOT carry the
  // secret, so the password input is always rendered empty.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      <form
        action={formAction}
        noValidate
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2">
          <Field
            label="Label"
            name="label"
            required
            defaultValue={values.label}
            hint="Human-friendly name. Don’t put the secret value here."
          />
        </div>

        <SelectField
          label="Kind"
          name="kind"
          required
          options={secureRecordKindSelectOptions}
          defaultValue={values.kind}
        />
        <SelectField
          label="Security level"
          name="security_level"
          required
          options={secureRecordSecurityLevelOptions}
          defaultValue={values.security_level}
        />

        <div className="md:col-span-2">
          <Field
            label="Secret value"
            name="secret_value"
            type="password"
            required
            defaultValue=""
            autoComplete="new-password"
            hint="Encrypted server-side. Stored as ciphertext + nonce + key id; only the masked form is returned for display."
          />
        </div>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-subtle">Notes</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={values.notes}
            className="border border-border rounded-md px-3 py-2 text-sm bg-white text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="md:col-span-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2"
          >
            {error}
          </div>
        ) : null}

        <div className="md:col-span-2 flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={pending}
            className="h-9 px-3 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

type Option = string | { value: string; label: string };

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  hint,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="border border-border rounded-md h-9 px-3 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      />
      {hint ? <span className="text-[11px] text-subtle">{hint}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      >
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}
