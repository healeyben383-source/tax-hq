-- Tax HQ — Row Level Security.
--
-- Every table denies by default and permits only `owner_id = auth.uid()`
-- for authenticated callers.
--
-- TODO(collaborators): if/when an accountant is granted scoped access,
--   widen SELECT on providers, expenses, documents, recurring_subscriptions,
--   and monthly_tasks by OR-ing a collaborator check. secure_records must
--   NEVER be widened — owner-only, forever.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.providers               enable row level security;
alter table public.expenses                enable row level security;
alter table public.documents               enable row level security;
alter table public.recurring_subscriptions enable row level security;
alter table public.monthly_tasks           enable row level security;
alter table public.secure_records          enable row level security;

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------
create policy providers_select on public.providers
  for select to authenticated
  using (auth.uid() = owner_id);

create policy providers_insert on public.providers
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy providers_update on public.providers
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy providers_delete on public.providers
  for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create policy expenses_select on public.expenses
  for select to authenticated
  using (auth.uid() = owner_id);

create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy expenses_update on public.expenses
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated
  using (auth.uid() = owner_id);

create policy documents_insert on public.documents
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy documents_update on public.documents
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy documents_delete on public.documents
  for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- recurring_subscriptions
-- ---------------------------------------------------------------------------
create policy recurring_select on public.recurring_subscriptions
  for select to authenticated
  using (auth.uid() = owner_id);

create policy recurring_insert on public.recurring_subscriptions
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy recurring_update on public.recurring_subscriptions
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy recurring_delete on public.recurring_subscriptions
  for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- monthly_tasks
-- ---------------------------------------------------------------------------
create policy monthly_tasks_select on public.monthly_tasks
  for select to authenticated
  using (auth.uid() = owner_id);

create policy monthly_tasks_insert on public.monthly_tasks
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy monthly_tasks_update on public.monthly_tasks
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy monthly_tasks_delete on public.monthly_tasks
  for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- secure_records — strict owner-only; never widen.
-- TODO(encryption): reveal path will be a server handler (not a SELECT), and
--   must enforce re-auth / MFA + write audit_log before decrypting.
-- ---------------------------------------------------------------------------
create policy secure_records_select on public.secure_records
  for select to authenticated
  using (auth.uid() = owner_id);

create policy secure_records_insert on public.secure_records
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy secure_records_update on public.secure_records
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy secure_records_delete on public.secure_records
  for delete to authenticated
  using (auth.uid() = owner_id);
