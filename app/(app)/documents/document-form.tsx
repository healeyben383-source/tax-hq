"use client";

import { useActionState, useMemo, useRef, type ChangeEvent } from "react";
import {
  documentFileStatusOptions,
  documentMonthOptions,
  documentTypeOptions,
  type CreateDocumentState,
} from "./form-state";

type ProviderOption = { id: string; name: string };

export type ExpenseOption = {
  id: string;
  label: string;
  provider_id: string;
  month: string; // "1".."12"
  year: string; // "YYYY"
};

type DocumentFormAction = (
  prev: CreateDocumentState,
  formData: FormData,
) => Promise<CreateDocumentState>;

export function DocumentForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  documentId,
  providers,
  expenses,
  providerMissing,
  existingFileName,
  returnToType,
}: {
  action: DocumentFormAction;
  initial: CreateDocumentState;
  submitLabel: string;
  pendingLabel: string;
  documentId?: string;
  providers: ProviderOption[];
  expenses: ExpenseOption[];
  providerMissing?: boolean;
  existingFileName?: string;
  // When the form is opened from a filtered list, the parent passes the
  // filter value here so the server action can redirect back to the same
  // filtered URL on save. Server-side allowlist validates the value.
  returnToType?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateDocumentState,
    FormData
  >(action, initial);

  // Defensive fallbacks — if upstream ever breaks, render a clean form.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  const providerRef = useRef<HTMLSelectElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const expenseById = useMemo(() => {
    const map = new Map<string, ExpenseOption>();
    for (const e of expenses) map.set(e.id, e);
    return map;
  }, [expenses]);

  // Autofill provider / month / year from the selected expense, but only
  // where the user hasn't filled the field yet. Never override existing input.
  function handleExpenseChange(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    if (!id) return;
    const expense = expenseById.get(id);
    if (!expense) return;
    if (providerRef.current && providerRef.current.value === "") {
      providerRef.current.value = expense.provider_id;
    }
    if (monthRef.current && monthRef.current.value === "") {
      monthRef.current.value = expense.month;
    }
    if (yearRef.current && yearRef.current.value === "") {
      yearRef.current.value = expense.year;
    }
  }

  const noProviders = providers.length === 0;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      {/* noValidate — all validation happens server-side so the user sees
          inline messages, not native browser popups. */}
      <form
        action={formAction}
        noValidate
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {documentId ? (
          <input type="hidden" name="id" value={documentId} />
        ) : null}
        {returnToType ? (
          <input type="hidden" name="return_to_type" value={returnToType} />
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
            The original provider for this document has been removed. Select a
            different provider before saving.
          </div>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-subtle">
            Provider<span className="text-red-700"> *</span>
          </span>
          <select
            ref={providerRef}
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

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-subtle">Linked expense</span>
          <select
            name="expense_id"
            defaultValue={values.expense_id}
            onChange={handleExpenseChange}
            className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          >
            <option value="">— none —</option>
            {expenses.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-2">
          <Field
            label="Title"
            name="title"
            required
            defaultValue={values.title}
          />
        </div>

        <SelectField
          label="Type"
          name="type"
          required
          options={documentTypeOptions}
          defaultValue={values.type}
        />
        <SelectField
          label="File status"
          name="file_status"
          required
          options={documentFileStatusOptions}
          defaultValue={values.file_status}
        />

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-subtle">Month</span>
          <select
            ref={monthRef}
            name="doc_month"
            defaultValue={values.doc_month}
            className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          >
            {documentMonthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-subtle">Year</span>
          <input
            ref={yearRef}
            name="doc_year"
            type="number"
            min="1900"
            max="2100"
            defaultValue={values.doc_year}
            className="border border-border rounded-md h-9 px-3 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          <span className="text-[11px] text-subtle">
            Required when a month is selected.
          </span>
        </label>

        <Field
          label="Tax year start"
          name="tax_year_start"
          type="number"
          min="1900"
          max="2100"
          required
          defaultValue={values.tax_year_start}
          hint="Australian FY start year. e.g. 2025 = FY25-26."
        />

        {/* Optional document amount — persisted on the row; feeds the
            create-action's auto-matcher and is editable later for audit.
            Always rendered; blank clears the column on save. */}
        <Field
          label="Document amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.amount}
          hint="Optional — improves auto-matching accuracy."
        />

        <div className="flex items-end gap-6 pb-1">
          <CheckField
            label="Private (hide from future collaborators)"
            name="is_private"
            defaultChecked={values.is_private}
          />
        </div>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-subtle">File</span>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/*"
            className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-slate-50"
          />
          <span className="text-[11px] text-subtle">
            {existingFileName
              ? `Currently attached: ${existingFileName}. Uploading replaces it.`
              : "PDF or image. Max 25 MB."}
          </span>
        </label>

        {existingFileName ? (
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              name="remove_file"
              value="1"
              className="h-4 w-4 rounded border-border accent-slate-900"
            />
            Remove attached file
          </label>
        ) : null}

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

type Option = string | { value: string; label: string };

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  hint,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  step?: string;
  min?: string;
  max?: string;
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
        max={max}
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
        className="border border-border rounded-md h-9 px-2 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
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
