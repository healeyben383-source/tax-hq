// Plain module — no "use server". The server-action file can only export
// async functions, so the state shape, initial state, and option lists live
// here.

export type CreateDocumentValues = {
  provider_id: string;
  expense_id: string;
  title: string;
  type: string;
  file_status: string;
  doc_month: string; // "" or "1".."12"
  doc_year: string; // "" or "YYYY"
  tax_year_start: string; // "YYYY" (required)
  is_private: boolean;
  notes: string;
  // Optional document amount. Not stored on the row — used only by
  // findLikelyExpenseForDocument to refine auto-matching during create.
  // Persisted on form-state so a validation error round-trip preserves it.
  amount: string;
};

export type CreateDocumentState = {
  error: string | null;
  values: CreateDocumentValues;
};

// Australian FY: 1 Jul – 30 Jun. Month >= 7 → that year; else previous year.
// Pure helper; caller is responsible for calling at request time so the
// default stays accurate across financial years.
export function currentTaxYearStart(now: Date = new Date()): number {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 7 ? year : year - 1;
}

export const emptyDocumentValues: CreateDocumentValues = {
  provider_id: "",
  expense_id: "",
  title: "",
  type: "invoice",
  file_status: "missing",
  doc_month: "",
  doc_year: "",
  tax_year_start: "", // page.tsx fills this with the current FY at render time
  is_private: false,
  notes: "",
  amount: "",
};

export const initialCreateDocumentState: CreateDocumentState = {
  error: null,
  values: emptyDocumentValues,
};

// Must match the CHECK constraint on public.documents.type.
export const documentTypeOptions: string[] = [
  "invoice",
  "receipt",
  "statement",
  "contract",
  "other",
];

// Must match the CHECK constraint on public.documents.file_status.
export const documentFileStatusOptions: string[] = [
  "missing",
  "pending",
  "saved",
];

export const documentMonthOptions: { value: string; label: string }[] = [
  { value: "", label: "Select month (optional)" },
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

// Display helper shared between the list and the table UI.
// 2025 → "FY25-26", 2026 → "FY26-27".
export function formatTaxYearLabel(startYear: number): string {
  const a = String(startYear).slice(-2).padStart(2, "0");
  const b = String(startYear + 1)
    .slice(-2)
    .padStart(2, "0");
  return `FY${a}-${b}`;
}
