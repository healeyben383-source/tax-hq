"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  error: string | null;
  email?: string;
};

function safeNext(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow same-origin, absolute-path redirects. Blocks open-redirect
  // tricks like `?next=https://evil.com` or `?next=//evil.com`.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Email and password are required.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Don't leak which half was wrong. Supabase already returns a generic
    // "Invalid login credentials" for email/password mismatches.
    return { error: error.message, email };
  }

  redirect(next);
}
