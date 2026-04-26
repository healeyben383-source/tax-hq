-- Tax HQ — initial schema.
--
-- Single-user model: every row carries owner_id, keyed to auth.users.
-- No collaborator table in v1 — widen SELECT policies later if needed,
-- but NEVER widen secure_records beyond owner.
--
-- TODO(audit): no audit_log table yet. Planned shape and writers listed
--   at the bottom of this file.
-- TODO(encryption): secure_records has ciphertext/nonce/encryption_key_id
--   columns, but no app code writes them yet. v1 will use a single
--   server-held key; upgrade to KMS + rotation later without schema change.
-- TODO(retention): deleted_at columns support soft delete. Queries must
--   filter `deleted_at is null` — partial indexes below assume that.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------
create table public.providers (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete restrict,
  name           text not null,
  slug           text not null,
  category       text not null
                  check (category in ('AI','Software','Hosting','Payments','Finance','Other')),
  login_email    text,
  billing_type   text not null
                  check (billing_type in ('subscription','usage','one-off')),
  invoice_source text not null
                  check (invoice_source in ('email','portal','manual')),
  renewal_cycle  text not null
                  check (renewal_cycle in ('monthly','quarterly','annual','ad-hoc')),
  website        text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index providers_owner_slug_uq
  on public.providers (owner_id, slug)
  where deleted_at is null;

create index providers_owner_idx
  on public.providers (owner_id)
  where deleted_at is null;

create index providers_owner_category_idx
  on public.providers (owner_id, category)
  where deleted_at is null;

create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete restrict,
  provider_id     uuid not null references public.providers(id) on delete restrict,
  spent_on        date not null,
  amount          numeric(14,2) not null,
  currency        char(3) not null,
  aud_amount      numeric(14,2) not null,
  fx_rate         numeric(14,6),
  fx_rate_date    date,
  category        text not null
                   check (category in ('AI tools','Software','Hosting','Fees','Hardware','Other')),
  deductible      boolean not null default false,
  invoice_saved   boolean not null default false,
  tax_year_start  smallint not null,
  source          text not null default 'manual'
                   check (source in ('manual','import','email_ingest','ocr')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index expenses_owner_spent_on_idx
  on public.expenses (owner_id, spent_on desc)
  where deleted_at is null;

create index expenses_owner_provider_idx
  on public.expenses (owner_id, provider_id)
  where deleted_at is null;

create index expenses_owner_tax_year_idx
  on public.expenses (owner_id, tax_year_start)
  where deleted_at is null;

create index expenses_owner_deductible_idx
  on public.expenses (owner_id)
  where deductible and deleted_at is null;

-- Derive tax_year_start from spent_on (Australian FY: 1 Jul – 30 Jun).
-- If spent_on is in Jul–Dec, tax_year_start = that calendar year.
-- If spent_on is in Jan–Jun, tax_year_start = previous calendar year.
create or replace function public.compute_tax_year_start_from_spent_on()
returns trigger
language plpgsql
as $$
begin
  if new.spent_on is not null then
    new.tax_year_start := case
      when extract(month from new.spent_on) >= 7
        then extract(year from new.spent_on)::smallint
      else (extract(year from new.spent_on) - 1)::smallint
    end;
  end if;
  return new;
end;
$$;

create trigger expenses_tax_year_start_ins
  before insert on public.expenses
  for each row execute function public.compute_tax_year_start_from_spent_on();

create trigger expenses_tax_year_start_upd
  before update of spent_on on public.expenses
  for each row execute function public.compute_tax_year_start_from_spent_on();

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete restrict,
  provider_id     uuid not null references public.providers(id) on delete restrict,
  expense_id      uuid references public.expenses(id) on delete set null,
  title           text not null,
  type            text not null
                   check (type in ('invoice','receipt','statement','contract','other')),
  doc_month       smallint check (doc_month between 1 and 12),
  doc_year        smallint,
  tax_year_start  smallint not null,
  file_status     text not null default 'missing'
                   check (file_status in ('missing','pending','saved')),
  storage_bucket  text,
  storage_path    text,
  mime_type       text,
  size_bytes      bigint,
  sha256          bytea,
  is_private      boolean not null default false,
  created_via     text not null default 'manual'
                   check (created_via in ('manual','upload','email_ingest','ocr')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- If a file is attached, both bucket and path must be set.
  constraint documents_storage_consistency check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  )
);

create index documents_owner_tax_year_idx
  on public.documents (owner_id, tax_year_start, doc_year desc nulls last, doc_month desc nulls last)
  where deleted_at is null;

create index documents_owner_provider_idx
  on public.documents (owner_id, provider_id)
  where deleted_at is null;

create index documents_owner_expense_idx
  on public.documents (owner_id, expense_id)
  where expense_id is not null and deleted_at is null;

-- A given object in storage can only back one document row.
create unique index documents_storage_path_uq
  on public.documents (storage_bucket, storage_path)
  where storage_path is not null and deleted_at is null;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recurring_subscriptions
-- ---------------------------------------------------------------------------
create table public.recurring_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete restrict,
  provider_id      uuid not null references public.providers(id) on delete restrict,
  amount           numeric(14,2) not null,
  currency         char(3) not null,
  cadence          text not null
                    check (cadence in ('monthly','quarterly','annual')),
  next_renewal_on  date not null,
  started_on       date,
  cancelled_on     date,
  active           boolean generated always as (cancelled_on is null) stored,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index recurring_owner_renewal_idx
  on public.recurring_subscriptions (owner_id, next_renewal_on)
  where deleted_at is null;

create index recurring_owner_active_idx
  on public.recurring_subscriptions (owner_id)
  where active and deleted_at is null;

create trigger recurring_set_updated_at
  before update on public.recurring_subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- monthly_tasks
-- ---------------------------------------------------------------------------
create table public.monthly_tasks (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete restrict,
  label          text not null,
  period_year    smallint not null,
  period_month   smallint not null check (period_month between 1 and 12),
  status         text not null default 'todo'
                  check (status in ('todo','in-progress','done')),
  due_on         date,
  completed_at   timestamptz,
  template_key   text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index monthly_tasks_owner_period_idx
  on public.monthly_tasks (owner_id, period_year, period_month)
  where deleted_at is null;

create index monthly_tasks_owner_open_idx
  on public.monthly_tasks (owner_id)
  where status <> 'done' and deleted_at is null;

create or replace function public.set_completed_at_on_done()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' and new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'done' and old.status is distinct from 'done' then
      new.completed_at := now();
    elsif new.status <> 'done' then
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger monthly_tasks_completed_at
  before insert or update on public.monthly_tasks
  for each row execute function public.set_completed_at_on_done();

create trigger monthly_tasks_set_updated_at
  before update on public.monthly_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- secure_records
--
-- Schema supports envelope encryption, but no app code writes ciphertext yet.
-- TODO(encryption): when wiring the write path:
--   * Encrypt plaintext server-side with an AEAD (libsodium / AES-GCM).
--   * Store ciphertext + nonce + encryption_key_id.
--   * Derive masked_value from plaintext at write time.
--   * Never log or return plaintext except through a dedicated reveal handler.
-- TODO(rotation): v1 uses a single key; add rotation by writing rows with a
--   new encryption_key_id and re-encrypting in a background job.
-- ---------------------------------------------------------------------------
create table public.secure_records (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete restrict,
  label               text not null,
  kind                text not null
                       check (kind in ('tfn','abn','bank_account','identity','recovery','other')),
  masked_value        text not null,
  security_level      text not null
                       check (security_level in ('low','medium','high')),
  ciphertext          bytea,
  nonce               bytea,
  encryption_key_id   text,
  last_decrypted_at   timestamptz,
  last_decrypted_by   uuid,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  -- All-or-nothing: if ciphertext is set, nonce and key id must be too.
  constraint secure_records_encryption_consistency check (
    (ciphertext is null and nonce is null and encryption_key_id is null)
    or (ciphertext is not null and nonce is not null and encryption_key_id is not null)
  )
);

create index secure_records_owner_idx
  on public.secure_records (owner_id)
  where deleted_at is null;

create trigger secure_records_set_updated_at
  before update on public.secure_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TODO(audit): append-only audit_log — add in a later migration.
--
-- Planned shape:
--   id            uuid primary key default gen_random_uuid(),
--   occurred_at   timestamptz not null default now(),
--   actor_id      uuid,             -- auth.uid() at event time
--   owner_id      uuid,             -- row owner context
--   action        text not null,    -- e.g. 'secure_record.read'
--   target_table  text,
--   target_id     uuid,
--   metadata      jsonb,            -- never plaintext secrets
--   ip            inet,
--   user_agent    text
--
-- Policies: owner SELECT only; INSERT restricted to service role via server
--   handlers; NO update or delete policies (immutable).
--
-- Writers to wire later:
--   * secure_records decrypt / reveal
--   * document download (signed-url mint)
--   * document upload / delete
--   * auth signin / mfa
-- ---------------------------------------------------------------------------
