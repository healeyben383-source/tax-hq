"use client";

import { useActionState } from "react";
import {
  recurringCadenceOptions,
  recurringCurrencyOptions,
  type CreateRecurringState,
} from "./form-state";

type ProviderOption = { id: string; name: string };

type RecurringFormAction = (
  prev: CreateRecurringState,
  formData: FormData,
) => Promise<CreateRecurringState>;

export function RecurringForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  subscriptionId,
  providers,
  providerMissing,
}: {
  action: RecurringFormAction;
  initial: CreateRecurringState;
  submitLabel: string;
  pendingLabel: string;
  subscriptionId?: string;
  providers: ProviderOption[];
  providerMissing?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    CreateRecurringState,
    FormData
  >(action, initial);

  // Defensive fallbacks — if upstream ever breaks, render a clean form.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  const noProviders = providers.length === 0;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      {/* noValidate — all validation is server-side; errors render inline. */}
      <form
        action={formAction}
        noValidate
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {subscriptionId ? (
          <input type="hidden" name="id" value={subscriptionId} />
        ) : null}

        {noProviders ? (
          <div
            role="note"
            className="md:col-span-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
          >
            Create a provider first. Visit Providers → Add provider.
          </div>
        ) : null}

        {providerMissing ? (
          <div
            role="alert"
            className="md:col-span-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2"
          >
            The original provider for this subscription has been removed.
            Select a different provider before saving.
          </div>
        ) : null}

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-subtle">
            Provider<span className="text-red-700"> *</span>
          </span>
          <select
            name="provider_id"
            defaultValue={values.provider_id}
            required
            disabled={noProviders}
            className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:bg-slate-50 disabled:text-subtle"
          >
            <option value="" disabled>
              Select a provider…
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={values.amount}
        />
        <SelectField
          label="Currency"
          name="currency"
          options={recurringCurrencyOptions}
          defaultValue={values.currency}
        />

        <SelectField
          label="Cadence"
          name="cadence"
          options={recurringCadenceOptions}
          defaultValue={values.cadence}
        />
        <Field
          label="Next renewal"
          name="next_renewal_on"
          type="date"
          required
          defaultValue={values.next_renewal_on}
        />

        <Field
          label="Started on"
          name="started_on"
          type="date"
          defaultValue={values.started_on}
          hint="Optional. When the subscription began."
        />
        <Field
          label="Cancelled on"
          name="cancelled_on"
          type="date"
          defaultValue={values.cancelled_on}
          hint="Set to mark this subscription cancelled."
        />

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
            disabled={pending || noProviders}
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
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  step?: string;
  min?: string;
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
        step={step}
        min={min}
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
  options: string[];
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
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
