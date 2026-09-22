-- Atomic money-moving operations. These run as Postgres functions (not
-- multi-step application code) specifically so that "check balance, then
-- write" can never race between two concurrent requests, and so a deposit's
-- transaction_signature uniqueness is enforced inside the same transaction
-- that credits the ledger. The Next.js service layer calls these via
-- supabase.rpc(...) and never mutates balance columns directly.

-- ----------------------------------------------------------------------------
-- helper: get or create a ledger account for a user, locked for update
-- ----------------------------------------------------------------------------
create or replace function fn_get_or_create_ledger_account(
  p_user_id uuid,
  p_account_type text,
  p_currency text default 'NGN'
) returns ledger_accounts
language plpgsql
as $$
declare
  v_account ledger_accounts;
begin
  select * into v_account from ledger_accounts
    where user_id = p_user_id and account_type = p_account_type and currency = p_currency
    for update;

  if found then
    return v_account;
  end if;

  insert into ledger_accounts (user_id, account_type, currency, balance_minor_units)
  values (p_user_id, p_account_type, p_currency, 0)
  returning * into v_account;

  return v_account;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_confirm_deposit: idempotent deposit confirmation + investment application
--
-- Idempotency: the deposits row is looked up by id and locked FOR UPDATE; if
-- it is already 'confirmed' this is a no-op that returns the existing state.
-- The transaction_signature UNIQUE constraint on `deposits` is the hard
-- backstop against crediting the same on-chain transaction twice even under
-- concurrent verification attempts.
-- ----------------------------------------------------------------------------
create or replace function fn_confirm_deposit(
  p_deposit_id uuid,
  p_actual_amount_minor_units bigint,
  p_transaction_signature text,
  p_product_id uuid,
  p_cycle_days int,
  p_annual_rate_bps int,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
as $$
declare
  v_deposit deposits;
  v_position investment_positions;
  v_invested_account ledger_accounts;
  v_earnings_account ledger_accounts;
  v_elapsed_days int;
  v_total_cycle_days int;
  v_accrued bigint := 0;
  v_new_principal bigint;
begin
  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'deposit_not_found' using errcode = 'P0002';
  end if;

  if v_deposit.status = 'confirmed' then
    select * into v_position from investment_positions
      where user_id = v_deposit.user_id and status = 'active'
      order by created_at desc limit 1;
    return jsonb_build_object('credited', false, 'deposit', to_jsonb(v_deposit), 'position', to_jsonb(v_position));
  end if;

  if p_actual_amount_minor_units <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  update deposits
    set status = 'confirmed',
        actual_amount_minor_units = p_actual_amount_minor_units,
        transaction_signature = p_transaction_signature,
        confirmed_at = p_now
    where id = p_deposit_id
    returning * into v_deposit;

  v_invested_account := fn_get_or_create_ledger_account(v_deposit.user_id, 'invested');
  v_earnings_account := fn_get_or_create_ledger_account(v_deposit.user_id, 'earnings');

  select * into v_position from investment_positions
    where user_id = v_deposit.user_id and status = 'active'
    order by created_at desc limit 1
    for update;

  if not found then
    insert into investment_positions (
      user_id, product_id, principal_minor_units, units, start_date, maturity_date, status
    ) values (
      v_deposit.user_id, p_product_id, p_actual_amount_minor_units, p_actual_amount_minor_units,
      p_now, p_now + make_interval(days => p_cycle_days), 'active'
    ) returning * into v_position;

    update ledger_accounts set balance_minor_units = balance_minor_units + p_actual_amount_minor_units
      where id = v_invested_account.id;

    insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
    values (v_deposit.user_id, v_invested_account.id, 'credit', p_actual_amount_minor_units, 'deposit', v_deposit.id, 'Investment opened');
  else
    -- Top-up of an existing active position: crystallize accrued return into
    -- principal and restart the cycle timer from now. This is a documented
    -- simplifying assumption for the prototype (see README "Known limitations").
    v_total_cycle_days := greatest(1, (extract(day from v_position.maturity_date - v_position.start_date))::int);
    v_elapsed_days := least(greatest(0, (extract(day from p_now - v_position.start_date))::int), v_total_cycle_days);
    v_accrued := floor(v_position.principal_minor_units::numeric * p_annual_rate_bps / 10000 / 365 * v_elapsed_days);
    v_new_principal := v_position.principal_minor_units + v_accrued + p_actual_amount_minor_units;

    update investment_positions
      set principal_minor_units = v_new_principal,
          units = v_new_principal,
          start_date = p_now,
          maturity_date = p_now + make_interval(days => p_cycle_days)
      where id = v_position.id
      returning * into v_position;

    update ledger_accounts set balance_minor_units = balance_minor_units + p_actual_amount_minor_units + v_accrued
      where id = v_invested_account.id;

    if v_accrued > 0 then
      update ledger_accounts set balance_minor_units = balance_minor_units + v_accrued
        where id = v_earnings_account.id;

      insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
      values (v_deposit.user_id, v_earnings_account.id, 'credit', v_accrued, 'accrual', v_position.id, 'Accrued return crystallized on top-up');
    end if;

    insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
    values (v_deposit.user_id, v_invested_account.id, 'credit', p_actual_amount_minor_units, 'deposit', v_deposit.id, 'Investment top-up');
  end if;

  insert into transactions (user_id, type, amount_minor_units, asset, status, blockchain_signature)
  values (v_deposit.user_id, 'deposit', p_actual_amount_minor_units, 'NGN', 'confirmed', p_transaction_signature);

  insert into audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
  values ('system', v_deposit.user_id::text, 'deposit.confirmed', 'deposit', v_deposit.id::text,
    jsonb_build_object('amount_minor_units', p_actual_amount_minor_units, 'signature', p_transaction_signature));

  return jsonb_build_object('credited', true, 'deposit', to_jsonb(v_deposit), 'position', to_jsonb(v_position));
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_process_redemption: consumes a still-valid quote and closes the position
-- ----------------------------------------------------------------------------
create or replace function fn_process_redemption(
  p_quote_id uuid,
  p_user_id uuid,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
as $$
declare
  v_quote redemption_quotes;
  v_position investment_positions;
  v_invested_account ledger_accounts;
  v_cash_account ledger_accounts;
begin
  select * into v_quote from redemption_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  if v_quote.consumed_at is not null then
    raise exception 'quote_already_used' using errcode = 'P0003';
  end if;

  if v_quote.expires_at < p_now then
    raise exception 'quote_expired' using errcode = 'P0004';
  end if;

  select * into v_position from investment_positions
    where id = v_quote.investment_position_id and user_id = p_user_id
    for update;

  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;

  if v_position.status <> 'active' then
    raise exception 'position_not_active' using errcode = 'P0005';
  end if;

  v_invested_account := fn_get_or_create_ledger_account(p_user_id, 'invested');
  v_cash_account := fn_get_or_create_ledger_account(p_user_id, 'cash');

  if v_invested_account.balance_minor_units < v_position.principal_minor_units then
    raise exception 'insufficient_balance' using errcode = 'P0006';
  end if;

  update ledger_accounts set balance_minor_units = balance_minor_units - v_position.principal_minor_units
    where id = v_invested_account.id;

  update ledger_accounts set balance_minor_units = balance_minor_units + v_quote.redemption_value_minor_units
    where id = v_cash_account.id;

  update investment_positions set status = 'redeemed' where id = v_position.id
    returning * into v_position;

  update redemption_quotes set consumed_at = p_now where id = v_quote.id;

  insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
  values (p_user_id, v_invested_account.id, 'debit', v_position.principal_minor_units, 'redemption', v_position.id, 'Position closed');

  insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
  values (p_user_id, v_cash_account.id, 'credit', v_quote.redemption_value_minor_units, 'redemption', v_position.id, 'Redemption proceeds available for withdrawal');

  insert into transactions (user_id, type, amount_minor_units, asset, status)
  values (p_user_id, 'redemption', v_quote.redemption_value_minor_units, 'NGN', 'confirmed');

  insert into audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
  values ('user', p_user_id::text, 'redemption.completed', 'investment_position', v_position.id::text,
    jsonb_build_object('redemption_value_minor_units', v_quote.redemption_value_minor_units));

  return jsonb_build_object('position', to_jsonb(v_position), 'cash_balance', v_cash_account.balance_minor_units + v_quote.redemption_value_minor_units);
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_request_withdrawal: debits cash balance atomically, never allows negative
-- ----------------------------------------------------------------------------
create or replace function fn_request_withdrawal(
  p_user_id uuid,
  p_amount_minor_units bigint,
  p_destination_wallet text,
  p_asset text default 'SOL'
) returns jsonb
language plpgsql
as $$
declare
  v_cash_account ledger_accounts;
  v_withdrawal withdrawals;
begin
  if p_amount_minor_units <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  v_cash_account := fn_get_or_create_ledger_account(p_user_id, 'cash');

  if v_cash_account.balance_minor_units < p_amount_minor_units then
    raise exception 'insufficient_balance' using errcode = 'P0006';
  end if;

  update ledger_accounts set balance_minor_units = balance_minor_units - p_amount_minor_units
    where id = v_cash_account.id;

  insert into withdrawals (user_id, amount_minor_units, asset, destination_wallet, status)
  values (p_user_id, p_amount_minor_units, p_asset, p_destination_wallet, 'processing')
  returning * into v_withdrawal;

  insert into ledger_entries (user_id, account_id, entry_type, amount_minor_units, reference_type, reference_id, description)
  values (p_user_id, v_cash_account.id, 'debit', p_amount_minor_units, 'withdrawal', v_withdrawal.id, 'Withdrawal requested');

  insert into transactions (user_id, type, amount_minor_units, asset, status)
  values (p_user_id, 'withdrawal', p_amount_minor_units, 'NGN', 'pending');

  insert into audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
  values ('user', p_user_id::text, 'withdrawal.requested', 'withdrawal', v_withdrawal.id::text,
    jsonb_build_object('amount_minor_units', p_amount_minor_units, 'destination_wallet', p_destination_wallet));

  return to_jsonb(v_withdrawal);
end;
$$;
