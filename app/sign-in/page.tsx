import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · Tax HQ",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-lg font-semibold tracking-tight text-foreground">
            Tax HQ
          </div>
          <div className="text-xs text-subtle mt-1">
            Private admin console · sign in to continue
          </div>
        </div>
        <SignInForm next={next} />
        <p className="mt-6 text-center text-[11px] text-subtle">
          Access is limited to the account owner. Accounts are provisioned
          directly in Supabase.
        </p>
      </div>
    </div>
  );
}
