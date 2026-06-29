# Current state — Tax HQ

Fast-moving snapshot for Tax HQ (dev port 3007). Update at the end of
every working session, or whenever something material changes. Pair with
`project-memory.md` for stable context.

Do not paste secrets, tokens, or API keys into this file.

## Last updated

2026-06-23 — Tax HQ truth-fix pass (Settings + dashboard quick links).

## What works

Golden paths verified end-to-end. Trim entries that are no longer relevant.

- Dashboard, providers, expenses, documents, recurring, checklist, secure records
  and audit log are all Supabase-backed with owner-scoped RLS. `lib/mock-data.ts`
  has been removed — no UI reads mock data anymore.
- Settings page now reports the real wired state (Supabase Auth, RLS, AES-256-GCM,
  audit-logged reveals, private document bucket) and labels deferred items honestly.

## What is broken or in-flight

File paths and line numbers where helpful.

- Nothing in-flight from this pass. `npm run lint` and `npm run build` both pass.
  (Build emits a pre-existing, unrelated "middleware → proxy" deprecation warning.)

## Open questions

Decisions blocked on input or an external dependency.

- Whether secure-record reveals need an MFA / re-auth gate for a single-user
  instance (currently deferred — decrypts on a valid session only).

## Where to resume

One line. The exact next command, file to open, or question to answer.

- Decide on the reveal MFA gate, or replace the placeholder FX rate in `lib/fx.ts`.

## Recent shipped changes

Newest first. Trim to the last five entries.

- Settings truth fix: `app/(app)/settings/page.tsx` copy now reflects actual state.
- Dashboard quick links now read providers from Supabase (`app/(app)/page.tsx`),
  with a "No providers yet" empty state; removed the mock import.
- Deleted orphaned `lib/mock-data.ts` (last consumer migrated).
