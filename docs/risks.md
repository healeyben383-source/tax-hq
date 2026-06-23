# Risks — Tax HQ

Known risks, sharp edges, and things that could bite later. Hand-curated. Review
at the end of each working session and before any handover or demo.

Do not paste secrets, tokens, or API keys into this file.

## How to use

One row per risk. Keep it blunt. Close a risk by moving it to "Resolved /
accepted" with a one-line outcome, rather than deleting it.

## Open risks

Highest impact first.

| Risk | Impact | Likelihood | Mitigation / next step |
| --- | --- | --- | --- |
| Single server-held encryption key (`SECURE_RECORDS_ENCRYPTION_KEY`). Losing it permanently locks all secure-record plaintext; there is no rotation or KMS. | High | Medium | Back up the key out-of-band; plan KMS + rotation (schema already supports `encryption_key_id`). |
| Reveal of TFN/ABN/bank values needs only a valid session — no MFA / re-auth. | High | Medium | Decide if acceptable for a single-user instance; otherwise add a re-auth/MFA gate and confirm audit write. |
| AUD amounts are estimates (placeholder 1.56 FX rate), not real conversions. Treating them as exact figures would be wrong. | Medium | High | Label totals as estimates; replace with live/stored FX rate (`lib/fx.ts`). |
| Settings page hardcodes "Mock (in-memory) / Not configured" for DB, encryption, audit — all actually wired. Misleads about what's real. | Medium | High | Update `app/(app)/settings/page.tsx` copy to reflect actual state. |
| Recurring sweep marks auto-created expenses `deductible = true` by default — an assumption, not an eligibility ruling. | Medium | Medium | Make deductibility an explicit choice; never imply ATO eligibility. |
| Dashboard "Quick links" still reads `lib/mock-data.ts`; the rest of the dashboard is live. | Low | High | Migrate to a Supabase query, then delete the mock module. |

## Trust / safety watch

Anything touching private data, approvals, payments, messages, or public-facing
automation. If any of these are live, consider a `trust-critical-workflow`
finish review and a ShipGuard scan before demo/handover.

- Secure records hold real sensitive identifiers (TFN/ABN/bank/identity). Treat the
  reveal path, encryption key handling, and audit coverage as trust-critical — a
  `trust-critical-workflow` review is warranted before any handover.
- Document files live in a private storage bucket served via short-lived (60s)
  signed URLs, RLS-scoped to the owner. Keep the bucket private; don't widen.
- This is an internal, single-owner tool ("Not for external sharing"). Do not add
  public/client-facing surfaces without re-reviewing the trust posture.

## Resolved / accepted

Newest first. One line each: what it was and how it was closed or why it was
accepted.

-
