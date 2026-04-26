-- Add "Domains" to the provider category CHECK constraint.
--
-- Why: domain registrars (e.g. Porkbun) shouldn't be classified as Hosting
-- at the provider level. Mirrors the equivalent expense-category change in
-- 20260426000001_expense_category_domains.sql.
--
-- Existing rows are untouched — this just widens the allowlist.
--
-- The constraint name `providers_category_check` is the default Postgres
-- assigns to the inline `check (...)` declared in the init migration.

alter table public.providers
  drop constraint providers_category_check;

alter table public.providers
  add constraint providers_category_check
  check (category in ('AI','Software','Hosting','Domains','Payments','Finance','Other'));
