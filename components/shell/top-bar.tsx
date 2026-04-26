import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function TopBar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function signOut() {
    "use server";
    const client = await createSupabaseServerClient();
    await client.auth.signOut();
    redirect("/sign-in");
  }

  return (
    <header className="h-12 border-b border-border bg-surface/80 backdrop-blur flex items-center px-6 text-xs text-subtle">
      <span className="flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Local development
      </span>
      <form action={signOut} className="ml-auto flex items-center gap-4">
        <span className="text-muted">{user?.email ?? "—"}</span>
        <button
          type="submit"
          className="text-muted hover:text-foreground underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
