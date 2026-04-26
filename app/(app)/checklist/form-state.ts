// Plain module — no "use server". The server-action file can only export
// async functions, so the state shape, initial state, and option lists live
// here.

export type CreateMonthlyTaskValues = {
  label: string;
  period_year: string;
  period_month: string;
  status: string;
  due_on: string; // "" or YYYY-MM-DD
  notes: string;
  template_key: string;
};

export type CreateMonthlyTaskState = {
  error: string | null;
  values: CreateMonthlyTaskValues;
};

export const emptyMonthlyTaskValues: CreateMonthlyTaskValues = {
  label: "",
  period_year: "",
  period_month: "",
  status: "todo",
  due_on: "",
  notes: "",
  template_key: "",
};

export const initialCreateMonthlyTaskState: CreateMonthlyTaskState = {
  error: null,
  values: emptyMonthlyTaskValues,
};

// Must match the CHECK constraint on public.monthly_tasks.status.
export const monthlyTaskStatusOptions: string[] = [
  "todo",
  "in-progress",
  "done",
];

// For the form select — pretty labels next to wire values.
export const monthlyTaskStatusSelectOptions: {
  value: string;
  label: string;
}[] = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const monthlyTaskMonthOptions: { value: string; label: string }[] = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];
