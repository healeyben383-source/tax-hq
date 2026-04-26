// Plain module — no "use server". This is important: the server action file
// is only permitted to export async functions, so the state shape, initial
// state, and option lists live here.

export type CreateProviderValues = {
  name: string;
  slug: string;
  category: string;
  billing_type: string;
  invoice_source: string;
  renewal_cycle: string;
  login_email: string;
};

export type CreateProviderState = {
  error: string | null;
  values: CreateProviderValues;
};

export const emptyProviderValues: CreateProviderValues = {
  name: "",
  slug: "",
  category: "AI",
  billing_type: "subscription",
  invoice_source: "email",
  renewal_cycle: "monthly",
  login_email: "",
};

export const initialCreateProviderState: CreateProviderState = {
  error: null,
  values: emptyProviderValues,
};

export const providerCategoryOptions: string[] = [
  "AI",
  "Software",
  "Hosting",
  "Domains",
  "Payments",
  "Finance",
  "Other",
];
export const providerBillingOptions: string[] = [
  "subscription",
  "usage",
  "one-off",
];
export const providerInvoiceSourceOptions: string[] = [
  "email",
  "portal",
  "manual",
];
export const providerRenewalOptions: string[] = [
  "monthly",
  "quarterly",
  "annual",
  "ad-hoc",
];
