import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM with a server-held key. The auth tag (16 bytes) is appended to
// the ciphertext so a single bytea column carries [encrypted | tag].
//
// Key rotation is intentionally out of scope for v1 — `encryption_key_id`
// is hard-coded to "v1-local" so a future rotation only has to fan out by id.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const ENCRYPTION_KEY_ID = "v1-local";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SECURE_RECORDS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECURE_RECORDS_ENCRYPTION_KEY is not set. Generate a 32-byte base64 key and add it to .env.local.",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error(
      "SECURE_RECORDS_ENCRYPTION_KEY must be a valid base64 string.",
    );
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SECURE_RECORDS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}).`,
    );
  }
  cachedKey = key;
  return key;
}

export type EncryptedPayload = {
  ciphertext: Buffer;
  nonce: Buffer;
  encryption_key_id: string;
};

export function encryptSensitiveValue(plaintext: string): EncryptedPayload {
  const key = getKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]),
    nonce,
    encryption_key_id: ENCRYPTION_KEY_ID,
  };
}

// Provided for completeness / future reveal flow. Intentionally not imported
// anywhere yet — the spec is "do NOT implement reveal".
export function decryptSensitiveValue(
  ciphertext: Buffer,
  nonce: Buffer,
  // encryption_key_id reserved for future per-key routing
): string {
  const key = getKey();
  if (ciphertext.length < TAG_BYTES + 1) {
    throw new Error("Ciphertext too short.");
  }
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const data = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

// Postgres bytea hex literal — Supabase JS serialises this string as JSON,
// PostgREST forwards it, and bytea_input parses `\x...` as hex.
export function bufferToBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}
