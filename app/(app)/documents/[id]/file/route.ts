import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /documents/{id}/file
// Mints a short-lived signed URL for the document's stored file and 302s the
// caller to it. RLS scopes the document lookup to the signed-in user, so
// non-owned / missing / file-less ids redirect quietly to /documents. The
// signed URL itself comes from the user's authenticated client and the bucket
// policy further restricts to the `{auth.uid()}/...` prefix.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fallback = new URL("/documents", request.url);

  if (!uuidPattern.test(id)) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { data } = await supabase
    .from("documents")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as
    | { storage_bucket: string | null; storage_path: string | null }
    | null;

  if (!row || !row.storage_bucket || !row.storage_path) {
    return NextResponse.redirect(fallback);
  }

  const { data: signed, error } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60);

  if (error || !signed?.signedUrl) {
    return NextResponse.redirect(fallback);
  }

  return NextResponse.redirect(signed.signedUrl);
}
