// Plain module — no "use server". The server-action file can only export
// async functions, so the state shape, initial state, and option lists live
// here.

export type CreateExpenseValues = {
  provider_id: string;
  spent_on: string; // YYYY-MM-DD
  amount: string;
  currency: string;
  aud_amount: string;
  category: string;
  deductible: boolean;
  invoice_saved: boolean;
  notes: string;
};

export type CreateExpenseState = {
  error: string | null;
  values: CreateExpenseValues;
};

export const emptyExpenseValues: CreateExpenseValues = {
  provider_id: "",
  spent_on: "",
  amount: "",
  currency: "AUD",
  aud_amount: "",
  category: "AI tools",
  deductible: true,
  invoice_saved: false,
  notes: "",
};

export const initialCreateExpenseState: CreateExpenseState = {
  error: null,
  values: emptyExpenseValues,
};

// Must match the CHECK constraint on public.expenses.category.
export const expenseCategoryOptions: string[] = [
  "AI tools",
  "Hosting",
  "Domains",
  "Software",
  "Fees",
  "Hardware",
  "Other",
];

// `currency` is char(3) with no CHECK in the DB — this whitelist is an
// app-level guardrail. Extend when you genuinely spend in a new currency.
export const expenseCurrencyOptions: string[] = ["AUD", "USD", "EUR", "GBP"];
