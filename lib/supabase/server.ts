import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for use in Server Components, Route Handlers
// and Server Actions. Reads + forwards the auth cookies bound to the current
// request, so RLS sees the signed-in user.
//
// Auth is not wired yet — calling this without a session returns a client
// that will make anonymous requests. Under our RLS policies, that means
// selects return zero rows (no error). Intentional.
//
// TODO(auth): once sign-in is added, Middleware should refresh the session
// so cookies are always current on the next server render.
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. This is expected; the
          // Middleware refresh path (added later) is what keeps sessions
          // current. Safe to swallow here.
        }
      },
    },
  });
}
