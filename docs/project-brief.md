# Project brief — Tax HQ

The stable statement of *why this project exists and what it is for*. Hand-curated,
updated rarely. This is the "what we agreed to build" anchor. Pair with
`finish-brief.md` (the standard it must reach), `current-state.md` (fast-moving
snapshot), and `project-memory.md` (long-lived context).

## Identity

- Name: Tax HQ
- Slug: tax-hq
- Type: existing
- Dev port: 3007
- Path: D:\dev\tax-hq

## The job

One or two sentences: the single problem this project solves.

- A private, single-user organiser for tax-time material: keep track of providers,
  expenses, recurring subscriptions, invoices/receipts, a monthly checklist, and a
  few sensitive identity references — so what is recorded, what evidence exists, and
  what is still missing stays visible and reviewable before tax time.

## Intended user

Who actually uses this, and in what setting (desktop, field, client review)?

- Audience: Ben (the owner) only. Single-owner model — every row is scoped to one
  authenticated user via RLS. Not multi-user, not shared with an accountant in-app.
- Where/when used: desktop, private admin console (the UI literally labels itself
  "Private admin console · Internal tool. Not for external sharing"). Used through
  the year to record spend and evidence, and at tax time to review what's filed.

## In scope

The bounded list of what this build covers. Keep it short.

- Providers, expenses, recurring subscriptions, documents (invoices/receipts/
  statements/contracts), a monthly checklist, and secure records — all CRUD with
  soft-delete + restore, backed by Supabase with owner-scoped RLS.
- Dashboard surfacing outstanding items: missing invoices, upcoming renewals,
  this-month spend, checklist progress, unlinked receipts.
- Document file upload to a private storage bucket + short-lived signed-URL viewing;
  receipt↔expense linking (incl. auto-linking).
- Secure records (TFN/ABN/bank/identity) encrypted at rest (AES-256-GCM), masked on
  display, with an audit-logged reveal route.
- Recurring → expense sweep that materialises due subscriptions on page load.

## Out of scope

What this project is deliberately NOT — the scope ceiling. Add to this whenever a
tempting extra comes up.

- NOT a tax-advice or deduction-eligibility engine. The `deductible` flag is a
  user/record assertion, not a ruling on what the ATO allows.
- NOT an accounting / bookkeeping / double-entry platform.
- NOT a tax-agent or compliance product, and not a multi-user / client-portal tool.
- NOT a source of authoritative financial figures: non-AUD amounts are converted
  with a hard-coded placeholder FX rate (estimate), not a live feed.
- No exports/reporting, no email ingest, no OCR yet (schema leaves room; not built).

## Definition of done

The plain-English bar for "this is finished for its purpose".

- The owner can record providers/expenses/recurring/documents/checklist/secure
  records, and at a glance see what's missing or outstanding, without the data being
  misleading about what is real vs estimated vs pending.
- Sensitive values are never exposed in plaintext except through the deliberate,
  audited reveal path; everything else is owner-scoped by RLS.
- The app stays an honest internal organiser — it never starts implying tax/legal/
  accounting advice or presenting estimates as exact financial fact.

## Links

- Finish standard: `finish-brief.md`
- Current snapshot: `current-state.md`
- Long-lived context: `project-memory.md`
- Decisions / risks / next: `decisions.md`, `risks.md`, `next-actions.md`
