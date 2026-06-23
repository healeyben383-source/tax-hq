# Finish brief — Tax HQ

The upstream statement of *finish intent* — the standard this project must reach
for its intended use. The **Finish Profile Reviewer** reads this file: if it is
filled in, the reviewer compares the project against it; if left blank, the
reviewer infers intent from context and states its confidence.

Fill in what you know. Leave a field blank rather than inventing an answer.
Field list mirrors `D:\dev\prompt-library\finish-profiles\README.md`.

## Finish Brief

- **Project type** — what kind of thing this is:
  Existing, in-progress internal web app (Next.js + Supabase). Single-user.
- **Intended user** — who actually uses it:
  Ben (the owner) only. Private desktop admin console; not shared in-app.
- **Primary finish profile** — the main profile that should apply:
  internal-ops-tool
- **Secondary finish profile** — the next most relevant profile, if any:
  trust-critical-workflow (secure records hold TFN/ABN/bank/identity; reveal +
  audit + encryption are involved).
- **Public / client-facing / internal / mobile / trust-critical** — which of
  these the project is (one or more):
  Internal + trust-critical. Not public, not client-facing, not mobile.
- **Tone** — how the copy and UI should read:
  Plain, calm, factual. States status (saved / pending / missing / estimated)
  without spin. No marketing voice, no reassurance it hasn't earned.
- **What this must feel like** — the intended impression when finished:
  A careful internal tax-record and evidence organiser. Tax-time material stays
  visible, reviewable, and less messy. The user can trust that what's labelled
  "real" is real and what's estimated/pending is clearly marked.
- **What this must not become** — the scope ceiling; what to never drift into:
  A tax-advice engine, accounting/bookkeeping platform, financial-compliance
  product, tax-agent tool, multi-user client portal, or speculative finance SaaS.
- **Known trust/safety concerns** — sensitive data, approvals, automation risks:
  - Secure records hold real sensitive identifiers, encrypted with a single
    server-held key (env var). Key loss = permanent data loss; no rotation/KMS yet.
  - Reveal route decrypts on a valid session only — no MFA / re-auth gate (scoped
    out for now). Audit write is best-effort, non-blocking.
  - Recurring sweep auto-creates expenses with `deductible = true` — an assumption,
    not a verified eligibility decision.
  - FX conversion uses a hard-coded placeholder rate; AUD figures are estimates.
- **No-scope-creep notes** — features explicitly out of bounds for this build:
  No tax/legal/accounting advice, no deduction-eligibility logic, no ATO-rule
  engine, no multi-user, no export/reporting product, no live FX feed promises.
- **Facts that must not be invented** — claims, numbers, names that must stay
  truthful:
  Income/expense/AUD figures, deduction eligibility, ATO rules, FX rates, the
  real vs mocked/estimated/pending status of any data, and what is actually
  encrypted/audited/configured. Never present an estimate as an exact figure.
- **Confidence** — how sure the intent is (High / Medium / Low):
  High (intent and scope are well-grounded in the code and the brief).

## Notes

- `no-scope-creep-pass.md` is always applied by the reviewer, regardless of the
  profiles chosen above.
- The reviewer's core rule: this changes the quality bar, not the product scope.
