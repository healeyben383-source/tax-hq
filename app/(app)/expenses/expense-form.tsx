"use client";

// Shared form body for both "add" and "edit" flows. The caller passes the
// server action, the initial state (empty for add, prefilled for edit), the
// button labels, the provider options to populate the select, and an optional
// `expenseId` that renders as a hidden `id` input for the update path.

import { useActionState } from "react";
import {
  expenseCategoryOptions,
  expenseCurrencyOptions,
  type CreateExpenseState,
} from "./form-state";

type ProviderOption = { id: string; name: string };

type ExpenseFormAction = (
  prev: CreateExpenseState,
  formData: FormData,
) => Promise<CreateExpenseState>;

export function ExpenseForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  providers,
  expenseId,
  returnToInvoice,
}: {
  action: ExpenseFormAction;
  initial: CreateExpenseState;
  submitLabel: string;
  pendingLabel: string;
  providers: ProviderOption[];
  expenseId?: string;
  // When the edit form was opened from a filtered list (e.g. ?invoice=missing),
  // the parent passes the filter value here so the server action can redirect
  // back to the same filtered URL on save. Server-side allowlist validates
  // the value — only "missing" is currently accepted.
  returnToInvoice?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateExpenseState,
    FormData
  >(action, initial);

  // Defensive fallbacks — if upstream ever breaks, render a clean form.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  const noProviders = providers.length === 0;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      <form
        action={formAction}
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {expenseId ? (
          <input type="hidden" name="id" value={expenseId} />
        ) : null}
        {returnToInvoice ? (
          <input
            type="hidden"
            name="return_to_invoice"
            value={returnToInvoice}
          />
        ) : null}

        {noProviders ? (
          <div
            role="note"
            className="md:col-span-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
          >
            Create a provider first. Visit Providers → Add provider.
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
          label="Date"
          name="spent_on"
          type="date"
          required
          defaultValue={values.spent_on}
        />
        <SelectField
          label="Category"
          name="category"
          options={expenseCategoryOptions}
          defaultValue={values.category}
        />

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
          options={expenseCurrencyOptions}
          defaultValue={values.currency}
        />

        <Field
          label="AUD amount"
          name="aud_amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={values.aud_amount}
          hint="AUD equivalent. Enter manually for now; FX conversion comes later."
        />

        <div className="flex items-end gap-6 pb-1">
          <CheckField
            label="Deductible"
            name="deductible"
            defaultChecked={values.deductible}
          />
          <CheckField
            label="Invoice saved"
            name="invoice_saved"
            defaultChecked={values.invoice_saved}
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
        className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
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

function CheckField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border accent-slate-900"
      />
      {label}
    </label>
  );
}
