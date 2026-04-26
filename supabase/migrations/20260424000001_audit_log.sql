-- Audit log — minimal v1 for Secure Record reveal events.
-- Append-only by convention: no UPDATE/DELETE policies, so RLS users can't
-- mutate or remove rows. (Service role still bypasses RLS — reserve for
-- archival jobs.)
--
-- Field names match what the reveal route handler writes:
--   owner_id     — the row owner whose record was acted on
--   entity_type  — e.g. 'secure_record'
--   entity_id    — the targeted row's id
--   action       — e.g. 'reveal'
--   created_at   — set by default
--
-- TODO(audit-extensions): add ip, user_agent, actor_id (when collaborators
--   are added), and metadata jsonb when a future event needs structured info.
-- TODO(append-only-strict): if user-initiated INSERT spoofing becomes a
--   concern, switch the writer to the service role and remove the insert
--   policy here. For a single-owner admin tool the cost-benefit isn't there
--   yet.

create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete restrict,
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null,
  created_at   timestamptz not null default now()
);

create index audit_log_owner_created_idx
  on public.audit_log (owner_id, created_at desc);

create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Owner can SELECT their own log entries (read-only audit viewer is future
-- work, but the policy is in place).
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (auth.uid() = owner_id);

-- Owner can INSERT entries with their own owner_id. RLS prevents spoofing
-- another user's owner_id; the route handler always supplies user.id.
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (auth.uid() = owner_id);

-- Deliberately no update or delete policies — append-only at the policy layer.
