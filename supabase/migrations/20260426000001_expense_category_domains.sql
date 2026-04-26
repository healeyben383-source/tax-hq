-- Add "Domains" to the expense category CHECK constraint.
--
-- Why: Porkbun and other domain registrar charges were previously being
-- forced into "Hosting", which conflates two different cost lines.
-- Existing rows are untouched — this just widens the allowlist.
--
-- The constraint name `expenses_category_check` is the default Postgres
-- assigns to the inline `check (...)` declared in the init migration.

alter table public.expenses
  drop constraint expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (category in ('AI tools','Software','Hosting','Domains','Fees','Hardware','Other'));
