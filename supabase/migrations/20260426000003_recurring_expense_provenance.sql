-- Provenance for auto-generated recurring expenses.
--
-- Why: the page-load sweep currently relies on `notes ILIKE '%auto-generated%'`
-- to dedupe its own writes, and writes `source = 'manual'` because the source
-- CHECK doesn't accept 'recurring'. Both are fragile. This migration adds:
--   - auto_generated boolean — a structural marker (not parsed from text)
--   - generated_from_recurring_id uuid — link back to the source subscription
--   - 'recurring' as a permitted value on expenses.source
--
-- Existing rows are untouched — both new columns default sensibly and the
-- source CHECK is widened, never narrowed.
--
-- The constraint name `expenses_source_check` is the default Postgres
-- assigns to the inline `check (...)` declared in the init migration.

alter table public.expenses
  add column auto_generated boolean not null default false,
  add column generated_from_recurring_id uuid
    references public.recurring_subscriptions(id);

-- Helps the sweep's "have I already created this one?" lookup. Partial index
-- keeps it small — only the auto-generated, non-soft-deleted rows.
create index expenses_owner_recurring_idx
  on public.expenses (owner_id, generated_from_recurring_id)
  where auto_generated and deleted_at is null;

alter table public.expenses
  drop constraint expenses_source_check;

alter table public.expenses
  add constraint expenses_source_check
  check (source in ('manual','recurring','import','email_ingest','ocr'));
