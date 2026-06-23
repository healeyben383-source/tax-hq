# Next actions — Tax HQ

The short list of what to do next. This is the "pick up here" file. Keep it small
and current — when something is done, move it out, don't let this grow into a
backlog dump.

## Do next

The 1–3 highest-value things, most important first. Each should be a concrete,
bounded action.

- [ ] Fix the Settings page so it stops misreporting state. `app/(app)/settings/page.tsx`
      is hardcoded to "Database: Mock (in-memory)", "Encryption: Not configured",
      "Audit log: Not configured" — all of which are actually wired now. It's copy
      only (no behaviour), but it misleads about what's real.
- [ ] Replace the dashboard "Quick links" mock data. `app/(app)/page.tsx` still
      imports `providers` from `lib/mock-data.ts` (the `quickProviders` slice);
      everything else on the dashboard is Supabase-backed. Swap it to a real query.
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
- Remove `lib/mock-data.ts` entirely once the last consumer (dashboard quick links)
  is migrated.

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
