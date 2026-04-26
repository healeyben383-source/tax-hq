import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptSensitiveValue } from "../../encryption";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /secure-records/{id}/reveal
// Returns the decrypted plaintext for one owned, non-deleted secure record.
// RLS scopes the lookup to the caller; no MFA gate yet (deliberately scoped
// out per spec). Response is JSON `{ value: string }` and is explicitly
// no-store so intermediaries / browser caches never retain the plaintext.
//
// Errors are JSON too with appropriate status codes — never include the
// underlying decrypt / DB error text (could leak schema or key state).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return jsonNoStore({ error: "Not found" }, 404);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonNoStore({ error: "Not signed in" }, 401);
  }

  const { data } = await supabase
    .from("secure_records")
    .select("ciphertext, nonce")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as
    | { ciphertext: string | null; nonce: string | null }
    | null;
  if (!row || !row.ciphertext || !row.nonce) {
    return jsonNoStore({ error: "Not found" }, 404);
  }

  let plaintext: string;
  try {
    plaintext = decryptSensitiveValue(
      byteaToBuffer(row.ciphertext),
      byteaToBuffer(row.nonce),
    );
  } catch {
    // Don't surface the underlying error — could indicate key / nonce
    // mismatch, tampering, etc. Generic 500.
    return jsonNoStore({ error: "Could not reveal" }, 500);
  }

  // Best-effort audit. Only metadata — never plaintext, never ciphertext.
  // If the table isn't there yet, RLS rejects, or any other DB error fires,
  // we swallow silently so the reveal itself is never blocked.
  try {
    await supabase.from("audit_log").insert({
      owner_id: user.id,
      entity_type: "secure_record",
      entity_id: id,
      action: "reveal",
    });
  } catch {
    // intentional silent swallow — audit is non-blocking
  }

  return jsonNoStore({ value: plaintext }, 200);
}

function jsonNoStore(body: unknown, status: number): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private, max-age=0",
      Pragma: "no-cache",
    },
  });
}

// PostgREST returns bytea as `\x<hex>`. If the prefix is somehow missing,
// fall back to treating the whole string as hex.
function byteaToBuffer(bytea: string): Buffer {
  const hex = bytea.startsWith("\\x") ? bytea.slice(2) : bytea;
  return Buffer.from(hex, "hex");
}
