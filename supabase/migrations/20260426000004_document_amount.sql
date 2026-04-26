-- Persist optional document amount.
--
-- Why: the create-form already collects an optional amount as a hint for
-- the auto-matcher. Storing it on the row lets the edit form show / change
-- it later, opens the door to amount-aware matching on edit, and gives the
-- audit trail something to compare against without parsing notes.
--
-- Existing rows default to NULL — the column is nullable and the form
-- treats blank as "no amount". No data is rewritten.
--
-- Same precision as expenses.amount so any future cross-table comparison
-- doesn't need casting.

alter table public.documents
  add column amount numeric(14,2);
