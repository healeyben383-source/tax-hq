export type Currency = "AUD" | "USD" | "EUR" | "GBP";

export type ProviderCategory =
  | "AI"
  | "Software"
  | "Hosting"
  | "Payments"
  | "Finance"
  | "Other";

export type BillingType = "subscription" | "usage" | "one-off";

export type InvoiceSource = "email" | "portal" | "manual";

export type RenewalCycle = "monthly" | "annual" | "quarterly" | "ad-hoc";

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  loginEmail: string;
  billingType: BillingType;
  invoiceSource: InvoiceSource;
  renewalCycle: RenewalCycle;
  notes?: string;
}

export type ExpenseCategory =
  | "AI tools"
  | "Software"
  | "Hosting"
  | "Fees"
  | "Hardware"
  | "Other";

export interface Expense {
  id: string;
  providerId: string;
  date: string; // ISO date
  amount: number;
  currency: Currency;
  audAmount: number;
  category: ExpenseCategory;
  deductible: boolean;
  invoiceSaved: boolean;
  notes?: string;
}

export type DocumentType = "invoice" | "receipt" | "statement" | "contract" | "other";

export type FileStatus = "missing" | "pending" | "saved";

export interface DocumentRecord {
  id: string;
  title: string;
  providerId: string;
  type: DocumentType;
  month: number; // 1-12
  taxYear: string; // e.g. "FY25-26"
  fileStatus: FileStatus;
  notes?: string;
}

export type Cadence = "monthly" | "annual" | "quarterly";

export interface RecurringSubscription {
  id: string;
  providerId: string;
  amount: number;
  currency: Currency;
  cadence: Cadence;
  renewalDate: string; // ISO date
  active: boolean;
  notes?: string;
}

export type TaskStatus = "todo" | "in-progress" | "done";

export interface MonthlyTask {
  id: string;
  label: string;
  month: number; // 1-12
  year: number;
  status: TaskStatus;
  dueDate?: string;
}

export type SecurityLevel = "low" | "medium" | "high";

// TODO(encryption): SecureRecord must NEVER hold raw sensitive values client-side.
// `maskedValue` is the only field safe to render. Any real value must be stored
// server-side encrypted (e.g. pgsodium / KMS-backed envelope encryption) and
// only decrypted for a specific authorised request. See /secure-records page.
export interface SecureRecord {
  id: string;
  label: string;
  maskedValue: string;
  notes?: string;
  securityLevel: SecurityLevel;
}
