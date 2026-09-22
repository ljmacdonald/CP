-- YIELD prototype schema
-- All monetary columns are stored as BIGINT "minor units" (2-decimal integer, e.g. kobo/cents)
-- to avoid floating point drift. Never store money as FLOAT/NUMERIC-with-float semantics.

create extension if not exists "pgcrypto";

-- ============================================================================
-- users
-- ============================================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed'))
);

create index if not exists idx_users_wallet_address on users (wallet_address);

-- ============================================================================
-- investment_products
-- ============================================================================
create table if not exists investment_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- target annual rate stored in basis points (2500 = 25.00%) to stay integer-safe
  target_annual_rate_bps integer not null check (target_annual_rate_bps >= 0),
  cycle_days integer not null check (cycle_days > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- investment_positions
-- ============================================================================
create table if not exists investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  product_id uuid not null references investment_products (id),
  principal_minor_units bigint not null check (principal_minor_units >= 0),
  units bigint not null default 0,
  start_date timestamptz not null,
  maturity_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'matured', 'redeemed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_positions_user_id on investment_positions (user_id);
create index if not exists idx_positions_status on investment_positions (status);

-- ============================================================================
-- ledger_accounts
-- ============================================================================
create table if not exists ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  account_type text not null check (account_type in ('cash', 'invested', 'earnings')),
  currency text not null default 'NGN',
  balance_minor_units bigint not null default 0 check (balance_minor_units >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_type, currency)
);

-- ============================================================================
-- ledger_entries (immutable double-entry log; balances are derived/cached on ledger_accounts)
-- ============================================================================
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  account_id uuid not null references ledger_accounts (id),
  entry_type text not null check (entry_type in ('credit', 'debit')),
  amount_minor_units bigint not null check (amount_minor_units > 0),
  currency text not null default 'NGN',
  reference_type text not null check (reference_type in ('deposit', 'withdrawal', 'accrual', 'redemption', 'adjustment')),
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_entries_user_id on ledger_entries (user_id);
create index if not exists idx_ledger_entries_reference on ledger_entries (reference_type, reference_id);

-- ============================================================================
-- deposits
-- ============================================================================
create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  wallet_address text not null,
  requested_amount_minor_units bigint not null check (requested_amount_minor_units > 0),
  actual_amount_minor_units bigint,
  asset text not null default 'SOL',
  transaction_signature text unique,
  status text not null default 'pending' check (
    status in ('pending', 'submitted', 'confirming', 'verifying', 'confirmed', 'failed', 'expired', 'rejected')
  ),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_deposits_tx_signature on deposits (transaction_signature) where transaction_signature is not null;
create index if not exists idx_deposits_user_id on deposits (user_id);
create index if not exists idx_deposits_status on deposits (status);

-- ============================================================================
-- withdrawals
-- ============================================================================
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  amount_minor_units bigint not null check (amount_minor_units > 0),
  asset text not null default 'SOL',
  destination_wallet text not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed', 'rejected')
  ),
  transaction_signature text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_withdrawals_user_id on withdrawals (user_id);
create index if not exists idx_withdrawals_status on withdrawals (status);

-- ============================================================================
-- daily_accruals
-- ============================================================================
create table if not exists daily_accruals (
  id uuid primary key default gen_random_uuid(),
  investment_position_id uuid not null references investment_positions (id) on delete cascade,
  date date not null,
  opening_value_minor_units bigint not null,
  accrual_amount_minor_units bigint not null,
  closing_value_minor_units bigint not null,
  rate_bps integer not null,
  created_at timestamptz not null default now(),
  unique (investment_position_id, date)
);

create index if not exists idx_accruals_position_id on daily_accruals (investment_position_id);

-- ============================================================================
-- redemption_quotes
-- ============================================================================
create table if not exists redemption_quotes (
  id uuid primary key default gen_random_uuid(),
  investment_position_id uuid not null references investment_positions (id) on delete cascade,
  current_value_minor_units bigint not null,
  liquidity_adjustment_minor_units bigint not null default 0,
  redemption_value_minor_units bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_redemption_quotes_position_id on redemption_quotes (investment_position_id);

-- ============================================================================
-- transactions (unified activity feed)
-- ============================================================================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'earning', 'redemption')),
  amount_minor_units bigint not null,
  asset text not null default 'NGN',
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'failed', 'rejected')
  ),
  blockchain_signature text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on transactions (user_id);
create index if not exists idx_transactions_type on transactions (type);

-- ============================================================================
-- audit_logs
-- ============================================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'admin', 'system')),
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists trg_products_updated_at on investment_products;
create trigger trg_products_updated_at before update on investment_products
  for each row execute function set_updated_at();

drop trigger if exists trg_positions_updated_at on investment_positions;
create trigger trg_positions_updated_at before update on investment_positions
  for each row execute function set_updated_at();

drop trigger if exists trg_ledger_accounts_updated_at on ledger_accounts;
create trigger trg_ledger_accounts_updated_at before update on ledger_accounts
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security
-- All tables are locked down by default. The service-role key (server only)
-- bypasses RLS entirely, which is how the backend performs privileged writes.
-- Authenticated end-user access, if ever added via Supabase Auth, would need
-- narrowly-scoped SELECT policies below; the prototype's API routes are the
-- only writers and always go through the service role.
-- ============================================================================
alter table users enable row level security;
alter table investment_products enable row level security;
alter table investment_positions enable row level security;
alter table ledger_accounts enable row level security;
alter table ledger_entries enable row level security;
alter table deposits enable row level security;
alter table withdrawals enable row level security;
alter table daily_accruals enable row level security;
alter table redemption_quotes enable row level security;
alter table transactions enable row level security;
alter table audit_logs enable row level security;

-- Public product listing is safe to expose read-only for the marketing/landing page.
create policy products_public_read on investment_products
  for select using (status = 'active');
