# Decisions — Tax HQ

A running log of load-bearing decisions and the reasoning behind them. Append new
entries at the top. Keep the *why*, not just the *what*, so a future session does
not re-litigate a settled choice.

Do not paste secrets, tokens, or API keys into this file.

## How to use

One entry per decision. Keep each to a few lines. Mark a decision as Superseded
rather than deleting it, so the history stays honest.

## Log

Newest first.

> Note: dates below are taken from the relevant migration/commit where one exists.
> Decisions reconstructed from the code during the 2026-06-23 docs pass are marked
> "(derived)".

### 2026-04-26 — Recurring → expense sweep runs on page load, not via cron

- Decision: `lib/recurring-sweep.ts` materialises due subscriptions into expense
  rows when `/` or `/expenses` is loaded. It never throws (fail-silent), and uses a
  structural dedupe on `generated_from_recurring_id` (±1 day), with a legacy notes
  substring fallback for pre-provenance rows.
- Why: no background worker/cron in this single-user app; the user loading a page is
  a good-enough trigger and keeps "this month" / "missing invoices" current.
- Alternatives considered: scheduled job / edge function (more infra for one user).
- Status: Active.

### 2026-04-24 — Append-only audit log; reveal is the first writer

- Decision: `audit_log` table added; the secure-record reveal route inserts a
  metadata-only `reveal` event (never plaintext/ciphertext). Audit writes are
  best-effort and must never block the action they record.
- Why: trace access to sensitive records without coupling availability to logging.
- Alternatives considered: per-read DB trigger (harder to scope to app intent).
- Status: Active. More writers (download, upload/delete, auth) still planned.

### 2026-04-23 — Secure records: AES-256-GCM, single server-held key (v1)

- Decision: sensitive values encrypted server-side with AES-256-GCM; key read from
  `SECURE_RECORDS_ENCRYPTION_KEY` (base64, 32 bytes), `encryption_key_id = "v1-local"`.
  Schema (ciphertext/nonce/encryption_key_id) is ready for KMS + rotation later
  without a schema change. Reveal is implemented but has no MFA gate yet.
- Why: get encryption-at-rest + masking shipped without standing up a KMS first.
- Alternatives considered: pgsodium / KMS-backed envelope encryption (deferred).
- Status: Active. Rotation/KMS and a reveal re-auth gate are future work.

### 2026-04-23 — Single-owner model with owner-scoped RLS

- Decision: every table carries `owner_id` keyed to `auth.users`; RLS scopes all
  access to the owner. No collaborator table. `secure_records` must never be widened
  beyond owner.
- Why: the app is a private, single-user tool; simplest safe model.
- Alternatives considered: multi-user/sharing (out of scope).
- Status: Active.

### 2026-04-23 — Soft delete everywhere; Australian FY; AUD base (derived)

- Decision: all tables use `deleted_at` soft delete (+ restore in the UI); queries
  filter `deleted_at is null`. Base currency is AUD; tax year is the Australian FY
  (1 Jul–30 Jun), with `tax_year_start` derived from `spent_on` by a DB trigger.
- Why: recoverable deletes for a records tool; the owner files Australian tax.
- Alternatives considered: hard delete; storing tax year manually.
- Status: Active.

### 2026-04-23 — FX uses a hard-coded placeholder rate (derived)

- Decision: `lib/fx.ts` converts non-AUD amounts at a fixed 1.56 USD→AUD (and uses
  that rate for any non-USD currency too), biased high to over-record rather than
  under-report. This is a single source of truth, explicitly a placeholder.
- Why: no live FX feed yet; better to estimate consistently than default to 1:1.
- Alternatives considered: live FX API / per-row stored rate (deferred).
- Status: Active — AUD figures are estimates until replaced. See risks.md.
