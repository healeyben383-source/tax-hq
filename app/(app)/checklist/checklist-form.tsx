"use client";

import { useActionState } from "react";
import {
  monthlyTaskMonthOptions,
  monthlyTaskStatusSelectOptions,
  type CreateMonthlyTaskState,
} from "./form-state";

type ChecklistFormAction = (
  prev: CreateMonthlyTaskState,
  formData: FormData,
) => Promise<CreateMonthlyTaskState>;

export function ChecklistForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  taskId,
}: {
  action: ChecklistFormAction;
  initial: CreateMonthlyTaskState;
  submitLabel: string;
  pendingLabel: string;
  taskId?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateMonthlyTaskState,
    FormData
  >(action, initial);

  // Defensive fallbacks — if upstream ever breaks, render a clean form.
  const values = state?.values ?? initial.values;
  const error = state?.error ?? null;

  return (
    <div className="mb-6 bg-surface border border-border rounded-lg">
      {/* noValidate — server validates and renders inline errors. */}
      <form
        action={formAction}
        noValidate
        className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {taskId ? <input type="hidden" name="id" value={taskId} /> : null}

        <div className="md:col-span-2">
          <Field
            label="Label"
            name="label"
            required
            defaultValue={values.label}
          />
        </div>

        <SelectField
          label="Month"
          name="period_month"
          options={monthlyTaskMonthOptions}
          defaultValue={values.period_month}
          required
        />
        <Field
          label="Year"
          name="period_year"
          type="number"
          min="2020"
          max="2100"
          required
          defaultValue={values.period_year}
        />

        <SelectField
          label="Status"
          name="status"
          options={monthlyTaskStatusSelectOptions}
          defaultValue={values.status}
          required
        />
        <Field
          label="Due date"
          name="due_on"
          type="date"
          defaultValue={values.due_on}
          hint="Optional."
        />

        <div className="md:col-span-2">
          <Field
            label="Template key"
            name="template_key"
            defaultValue={values.template_key}
            hint="Optional. Identifies a recurring task across months."
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
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
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
