"use client";

// Shared form body for both "add" and "edit" flows. The caller passes the
// server action, the initial state (empty for add, prefilled for edit), the
// button labels, and an optional providerId that gets serialised as a hidden
// `id` input for the update path.

import { useActionState } from "react";
import {
  providerBillingOptions,
  providerCategoryOptions,
  providerInvoiceSourceOptions,
  providerRenewalOptions,
  type CreateProviderState,
} from "./form-state";

type ProviderFormAction = (
  prev: CreateProviderState,
  formData: FormData,
) => Promise<CreateProviderState>;

export function ProviderForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  providerId,
}: {
  action: ProviderFormAction;
  initial: CreateProviderState;
  submitLabel: string;
  pendingLabel: string;
  providerId?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateProviderState,
    FormData
  >(action, initial);

  // Defensive fallbacks — if upstream ever breaks, render a clean form.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      <form
        action={formAction}
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {providerId ? (
          <input type="hidden" name="id" value={providerId} />
        ) : null}

        <Field label="Name" name="name" required defaultValue={values.name} />
        <Field
          label="Slug"
          name="slug"
          required
          defaultValue={values.slug}
          hint="Lowercase letters, numbers, hyphens. Used in storage paths."
        />
        <SelectField
          label="Category"
          name="category"
          options={providerCategoryOptions}
          defaultValue={values.category}
        />
        <SelectField
          label="Billing type"
          name="billing_type"
          options={providerBillingOptions}
          defaultValue={values.billing_type}
        />
        <SelectField
          label="Invoice source"
          name="invoice_source"
          options={providerInvoiceSourceOptions}
          defaultValue={values.invoice_source}
        />
        <SelectField
          label="Renewal cycle"
          name="renewal_cycle"
          options={providerRenewalOptions}
          defaultValue={values.renewal_cycle}
        />
        <div className="md:col-span-2">
          <Field
            label="Login email"
            name="login_email"
            type="email"
            defaultValue={values.login_email}
          />
        </div>

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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
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
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? options[0]}
        className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
