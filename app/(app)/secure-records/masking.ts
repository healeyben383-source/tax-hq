// Pure masking helpers. No server-only restriction so the same logic can
// be reused in client previews later if needed. Whitespace is collapsed
// for display so the masked output is stable regardless of how the user
// formatted the input (e.g. "123 456 789" vs "123-456-789" vs "123456789").

const MASK_CHAR = "•";

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function maskTail(value: string, keep: number): string {
  const trimmed = normalize(value);
  if (trimmed.length === 0) return "";
  // Spec: if the input is shorter than `keep`, mask all but the last 1 char.
  if (trimmed.length <= keep) {
    const visible = trimmed.slice(-1);
    const hidden = MASK_CHAR.repeat(Math.max(0, trimmed.length - 1));
    return hidden + visible;
  }
  return MASK_CHAR.repeat(trimmed.length - keep) + trimmed.slice(-keep);
}

export function maskSecretValue(value: string, kind: string): string {
  switch (kind) {
    case "tfn":
    case "abn":
      return maskTail(value, 3);
    case "bank_account":
      return maskTail(value, 4);
    case "identity":
    case "recovery":
    case "other":
    default:
      return maskTail(value, 4);
  }
}
