# Next actions — Tax HQ

The short list of what to do next. This is the "pick up here" file. Keep it small
and current — when something is done, move it out, don't let this grow into a
backlog dump.

## Do next

The 1–3 highest-value things, most important first. Each should be a concrete,
bounded action.

- [x] Fix the Settings page so it stops misreporting state. Done 2026-06-23 —
      `app/(app)/settings/page.tsx` now shows Supabase Auth, owner-scoped RLS,
      Supabase Postgres, private document bucket, AES-256-GCM, and audit-logged
      reveals, with MFA/rotation/exports/email-ingest labelled "Deferred".
- [x] Replace the dashboard "Quick links" mock data. Done 2026-06-23 —
      `app/(app)/page.tsx` now queries providers from Supabase (RLS-scoped, top 4 by
      name) with a "No providers yet" empty state. `lib/mock-data.ts` deleted.
- [ ] Confirm the secure-records reveal trust posture is acceptable as-is, or add a
      re-auth/MFA gate. Reveal currently decrypts on a valid session with no second
      factor (deliberately scoped out — see risks.md). Decide before relying on it.

## Soon

Worth doing, but not the immediate next step.

- Make `deductible` an explicit user choice rather than a sweep default. The
  recurring sweep sets `deductible = true` on auto-created expenses; flag clearly
  that this is an assumption, not an eligibility ruling.
- Replace the placeholder FX rate (`lib/fx.ts`, hard-coded 1.56 USD→AUD) with a real
  source or per-row stored `fx_rate`/`fx_rate_date`, and label AUD totals as
  estimates until then.
- (Done 2026-06-23) `lib/mock-data.ts` removed — last consumer (dashboard quick
  links) migrated to a Supabase query.

## Blocked / waiting

Items stalled on a decision, an input, or an external dependency. Note what each
is waiting on.

- MFA / re-auth on reveal — waiting on a decision about whether it's needed for a
  single-user private instance.

## Done recently

Newest first. Trim to the last five. Pair with `current-state.md` for the live
snapshot.

- Persist document amount; standardise/improve currency display (recent commits).
- Added Domains expense + provider categories.
- Added recurring-expense provenance (`generated_from_recurring_id`) for sweep dedupe.
- Added audit_log table + reveal writer.
