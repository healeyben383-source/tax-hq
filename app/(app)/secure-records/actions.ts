"use server";

// Server-action module. Per Next.js App Router rules, this file can ONLY
// export async functions. Shared types and constants live in ./form-state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  bufferToBytea,
  encryptSensitiveValue,
} from "./encryption";
import { maskSecretValue } from "./masking";
import {
  secureRecordKindOptions,
  secureRecordSecurityLevelOptions,
  type CreateSecureRecordState,
  type CreateSecureRecordValues,
} from "./form-state";

// Reads only NON-secret fields. The secret is read separately and never
// placed in the returned state object.
function readNonSecretValues(formData: FormData): CreateSecureRecordValues {
  return {
    label: String(formData.get("label") ?? "").trim(),
    kind: String(formData.get("kind") ?? ""),
    security_level: String(formData.get("security_level") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createSecureRecordAction(
  _prev: CreateSecureRecordState,
  formData: FormData,
): Promise<CreateSecureRecordState> {
  const values = readNonSecretValues(formData);

  // Read the secret in a tight scope. It must never reach the returned state
  // and must never be logged. Trim only for empty-check; preserve original
  // for encryption + masking so we don't silently change what the user typed.
  const secretRaw = formData.get("secret_value");
  const secret = typeof secretRaw === "string" ? secretRaw : "";

  if (!values.label) {
    return { error: "Label is required.", values };
  }
  if (!secureRecordKindOptions.includes(values.kind)) {
    return { error: "Kind is not recognised.", values };
  }
  if (!secureRecordSecurityLevelOptions.includes(values.security_level)) {
    return { error: "Security level is not recognised.", values };
  }
  if (!secret.trim()) {
    return { error: "Secret value is required.", values };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values };
  }

  let encrypted;
  try {
    encrypted = encryptSensitiveValue(secret);
  } catch (e) {
    // Don't leak details from the encryption layer to the client (the message
    // could hint at whether the env var is missing vs malformed). Show a
    // generic prompt; the operator can read the actual error in server logs.
    return {
      error:
        "Server-side encryption is not configured. Add SECURE_RECORDS_ENCRYPTION_KEY and restart.",
      values,
    };
    // The thrown Error itself stays in process logs only — never includes
    // the plaintext secret because the helper never sees it after this scope.
    void e;
  }

  const masked = maskSecretValue(secret, values.kind);

  const { error } = await supabase.from("secure_records").insert({
    // owner_id is authoritative — never from the form.
    owner_id: user.id,
    label: values.label,
    kind: values.kind,
    masked_value: masked,
    security_level: values.security_level,
    ciphertext: bufferToBytea(encrypted.ciphertext),
    nonce: bufferToBytea(encrypted.nonce),
    encryption_key_id: encrypted.encryption_key_id,
    notes: values.notes || null,
  });

  if (error) {
    return { error: error.message, values };
  }

  revalidatePath("/secure-records");
  redirect("/secure-records");
}
