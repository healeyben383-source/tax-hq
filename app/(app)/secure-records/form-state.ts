// Plain module — no "use server". Server-action file may only export async
// functions. Note: state never carries the secret value; it's read directly
// from FormData inside the action and dropped immediately after encryption.

export type CreateSecureRecordValues = {
  label: string;
  kind: string;
  security_level: string;
  notes: string;
};

export type CreateSecureRecordState = {
  error: string | null;
  values: CreateSecureRecordValues;
};

export const emptySecureRecordValues: CreateSecureRecordValues = {
  label: "",
  kind: "tfn",
  security_level: "high",
  notes: "",
};

export const initialCreateSecureRecordState: CreateSecureRecordState = {
  error: null,
  values: emptySecureRecordValues,
};

// Must match the CHECK constraint on public.secure_records.kind.
export const secureRecordKindOptions: string[] = [
  "tfn",
  "abn",
  "bank_account",
  "identity",
  "recovery",
  "other",
];

// Display labels for the kind select.
export const secureRecordKindSelectOptions: {
  value: string;
  label: string;
}[] = [
  { value: "tfn", label: "TFN" },
  { value: "abn", label: "ABN" },
  { value: "bank_account", label: "Bank account" },
  { value: "identity", label: "Identity" },
  { value: "recovery", label: "Recovery" },
  { value: "other", label: "Other" },
];

// Must match the CHECK constraint on public.secure_records.security_level.
export const secureRecordSecurityLevelOptions: string[] = [
  "low",
  "medium",
  "high",
];
