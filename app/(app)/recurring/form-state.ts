// Plain module — no "use server". The server-action file can only export
// async functions, so the state shape, initial state, and option lists live
// here.

export type CreateRecurringValues = {
  provider_id: string;
  amount: string;
  currency: string;
  cadence: string;
  next_renewal_on: string; // YYYY-MM-DD
  started_on: string; // "" or YYYY-MM-DD
  cancelled_on: string; // "" or YYYY-MM-DD
  notes: string;
};

export type CreateRecurringState = {
  error: string | null;
  values: CreateRecurringValues;
};

export const emptyRecurringValues: CreateRecurringValues = {
  provider_id: "",
  amount: "",
  currency: "AUD",
  cadence: "monthly",
  next_renewal_on: "",
  started_on: "",
  cancelled_on: "",
  notes: "",
};

export const initialCreateRecurringState: CreateRecurringState = {
  error: null,
  values: emptyRecurringValues,
};

// Must match the CHECK constraint on public.recurring_subscriptions.cadence.
export const recurringCadenceOptions: string[] = [
  "monthly",
  "quarterly",
  "annual",
];

// `currency` is char(3) with no CHECK in the DB — this whitelist is an
// app-level guardrail. Mirrors expenses for consistency.
export const recurringCurrencyOptions: string[] = ["AUD", "USD", "EUR", "GBP"];
