# YIELD

A wallet-first Solana investment dashboard prototype. Connect a Solana wallet,
deposit devnet USDC, watch a simulated investment position accrue daily, and
redeem it back to your wallet — with a backend that never trusts client-supplied
numbers for anything money-related.

**This is a prototype.** Investment figures are simulated and do not represent
an offer of securities or a guarantee of returns. It runs on Solana **devnet**
only — no real funds are ever used.

## Architecture at a glance

- **Frontend:** Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS.
- **Identity:** Solana wallet address only. No email/password/accounts. Sign-in
  is a Sign-In-With-Solana–style challenge: the backend issues a short-lived
  signed challenge, the wallet signs it, the backend verifies the signature and
  issues an httpOnly session cookie (JWT, HS256).
- **Backend:** Next.js Route Handlers under `src/app/api/**`, backed by a
  service layer under `src/lib/services/**` — no financial logic lives in API
  route files or UI components.
- **Database:** PostgreSQL via Supabase. Schema in `supabase/migrations/`.
  Money-moving operations (deposit confirmation, redemption, withdrawal) run as
  atomic Postgres functions (`supabase/migrations/0002_ledger_functions.sql`)
  so "check balance, then write" can never race, and a transaction signature
  can never be credited twice.
- **Realtime:** Server-Sent Events (`/api/stream`) polling a per-user dashboard
  snapshot and pushing changes to the browser — scoped to the authenticated
  session without needing to bridge wallet-based auth into Supabase's
  `auth.uid()`/RLS model. (Supabase Realtime could replace this if that bridge
  is added later — see Known limitations.)
- **Money:** every amount is a `bigint` "minor unit" (2 decimals, i.e. cents).
  Rate math (`src/lib/services/financialCalculationService.ts`) is computed as
  exact `BigInt` ratios (`principal * rateBps * days / (10_000 * 365)`, see
  `src/lib/money.ts`'s `bigIntFloorDiv`/`bigIntCeilDiv`) — since every operand
  is already an integer, this has zero floating-point or repeating-decimal
  rounding error, and always rounds in the platform's favor. USDC's own
  6-decimal on-chain representation is converted to/from this 2-decimal minor
  unit at the chain boundary only (`src/lib/solana/usdc.ts`); everywhere else
  in the codebase only ever sees minor units.
- **Deposit asset:** devnet USDC (an SPL token, mint address configurable via
  `NEXT_PUBLIC_USDC_MINT_ADDRESS`, defaulting to Circle's official devnet
  USDC). Deposits are pegged 1:1 to the app's displayed dollar amounts — no
  exchange rate is needed or used.

### Why this shape connects to real infrastructure without a frontend rewrite

- The frontend never computes a balance, an accrual, or a redemption amount —
  it only renders whatever the backend returns. Wiring `executeOnChainPayout`
  (`src/lib/services/withdrawalService.ts`) to a real treasury signer changes
  zero frontend code. Accepting an additional SPL token, or native SOL, is a
  matter of extending `transactionVerificationService`'s instruction parser
  and `depositService`'s intent builder — the deposit wizard and API contract
  stay the same.
- Every service function has a narrow, typed contract (see `src/lib/services/`)
  that a production implementation could replace independently.

## Project structure

```
src/
  app/
    (marketing pages: /, /how-it-works)
    dashboard/          Portfolio, deposit, investment detail, transactions
    admin/               Admin overview + product management
    api/                 Route handlers (auth, deposits, positions, redemption,
                          withdrawals, transactions, admin, stream)
  components/            UI split by area (wallet, landing, dashboard, deposit,
                          investment, transactions, admin, layout, ui)
  hooks/                 useAuth (wallet session), useDashboardStream (SSE)
  lib/
    auth/                Session + challenge JWTs
    api/                 Shared error mapping + in-memory rate limiter
    services/             walletService, depositService,
                          transactionVerificationService, ledgerService,
                          investmentService, accrualService, redemptionService,
                          adminService, withdrawalService,
                          financialCalculationService, dashboardService,
                          transactionsService
    solana/               RPC client (@solana/kit)
    supabase/             Service-role admin client
    validation/           Zod schemas for every API input
    money.ts              MinorUnits type + exact BigInt rounding helpers
  types/database.ts       Hand-authored row types mirroring the SQL schema
supabase/
  migrations/0001_init.sql              Tables, indexes, RLS
  migrations/0002_ledger_functions.sql  Atomic deposit/redemption/withdrawal functions
  seed/seed.sql                         Local dev seed data (one product)
tests/
  unit/    Vitest — services and pure logic
  e2e/     Playwright — user-facing flows
```

## Database schema

All monetary columns are `bigint` minor units. See
`supabase/migrations/0001_init.sql` for full column definitions and
constraints; tables are:

`users`, `investment_products`, `investment_positions`, `ledger_accounts`,
`ledger_entries`, `deposits`, `withdrawals`, `daily_accruals`,
`redemption_quotes`, `transactions`, `audit_logs`.

Money-moving state transitions are atomic Postgres functions
(`supabase/migrations/0002_ledger_functions.sql`):

- `fn_confirm_deposit` — idempotent deposit confirmation (keyed on the
  deposit row, backstopped by a `UNIQUE` constraint on
  `deposits.transaction_signature`) that credits the ledger and either opens
  or tops up the user's investment position.
- `fn_process_redemption` — consumes a still-valid redemption quote, debits
  the invested balance, credits cash.
- `fn_request_withdrawal` — debits cash atomically with a balance check;
  Postgres raises `insufficient_balance` rather than ever allowing the
  balance to go negative.

## Environment variables

See `.env.example`. Copy it to `.env.local` for local development and fill in
your own Supabase project + a generated `SESSION_SECRET`
(`openssl rand -base64 32`). Never commit `.env.local`.

## Commands

```bash
npm install

npm run dev          # local dev server
npm run build        # production build
npm run start         # run the production build

npm run lint          # ESLint
npm run typecheck    # tsc --noEmit

npm run test          # Vitest unit tests
npm run test:watch    # Vitest in watch mode
npm run test:e2e      # Playwright end-to-end tests (builds + starts the app itself)
```

### Setting up Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` then `0002_ledger_functions.sql`
   against it (via the SQL editor, or the Supabase CLI:
   `supabase db push`).
3. Optionally run `supabase/seed/seed.sql` for local development (creates the
   "Growth Portfolio" product — required for deposits to work at all, since
   the app always deposits into `getDefaultProduct()`'s active product).
4. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
5. Set `DEPOSIT_WALLET_ADDRESS` to a devnet wallet you control (this is where
   deposits are verified against) and `ADMIN_WALLET_ADDRESSES` to your own
   wallet address to access `/admin`.

## Tests completed

**Unit (Vitest, `npm run test`)** — 48 tests across 8 files:

- Wallet connection: address normalization, Sign-In-With-Solana signature
  verification (including a simulated impersonation attempt and a tampered
  message).
- Deposit intent creation, and duplicate transaction-signature rejection.
- Valid and invalid on-chain transaction verification (wrong destination,
  wrong sender, failed transaction, transaction not found) against a mocked
  Solana RPC client.
- Daily accrual and maturity-value calculation (exact BigInt arithmetic).
- Redemption quote generation and expired/already-used quote rejection.
- Withdrawal request success and negative-balance prevention (mapped from the
  atomic SQL function's error code).
- Admin authorization (allowlist membership).

**End-to-end (Playwright, `npm run test:e2e`)** — drives the real rendered app
against a self-installed [Wallet Standard](https://github.com/wallet-standard/wallet-standard)
mock wallet (`tests/e2e/helpers/fakeWallet.ts`) and mocked `/api/*` +
Solana RPC responses (no live Supabase/devnet needed to run these):

- Connect wallet → sign-in → land on dashboard.
- Deposit: amount entry → projection → confirm → wallet signature → submit →
  confirm → verify → success screen.
- Dashboard updates live via SSE when a deposit is confirmed, without a page
  reload.
- View investment detail (current value, earned, maturity, days remaining).
- Withdraw: request a redemption quote, confirm it, then withdraw the cash
  balance to the connected wallet.
- Landing page content, navigation, and unauthenticated redirects.

## Known limitations

- **No live database was available to develop against.** The schema, atomic
  SQL functions, and every service function are written and unit-tested
  against mocked Supabase responses, but have not been run against a real
  Postgres instance. Run the migrations against a real Supabase project and
  smoke-test the deposit → redemption → withdrawal flow before relying on
  this.
- **Only one SPL token (devnet USDC) is supported as a deposit asset**, and
  only via the `transferChecked` instruction (not the legacy `transfer`
  instruction, which doesn't carry the mint, and not the Token-2022 program).
  `transactionVerificationService` parses `spl-token` `transferChecked`
  instructions specifically; accepting native SOL or another SPL token means
  extending that parser and `depositService`'s intent builder.
- **Withdrawals are not automatically executed on-chain.** `fn_request_withdrawal`
  atomically debits the user's cash balance and creates a `withdrawals` row,
  but actually broadcasting a payout transaction requires a treasury signing
  key that is intentionally out of scope for a prototype's environment
  surface — see `executeOnChainPayout` in `withdrawalService.ts`, which is a
  documented extension point rather than a real implementation.
- **Topping up an active position re-bases it**: a second deposit while a
  position is already active crystallizes its accrued return into principal
  and restarts the cycle timer from the deposit time (see the comment in
  `fn_confirm_deposit`). This keeps the accrual math simple and auditable for
  a prototype; a production engine would likely track top-ups as separate
  lots instead.
- **The daily accrual snapshot job** (`accrualService.runDailyAccrualForAllActivePositions`)
  is exposed as an admin-triggered endpoint (`POST /api/admin/accruals/run`)
  rather than a real cron job, since there's no scheduler in this environment.
  Live/current values shown in the UI are always computed on the fly
  (`calculateAccrual`) regardless of whether this job has run — the persisted
  `daily_accruals` rows are only used for backfilling the performance chart's
  history.
- **Rate limiting is in-memory**, fine for a single instance, not for a
  multi-instance deployment (see `src/lib/api/rateLimit.ts`).
- **Real-time updates use polling SSE** (every 2s) rather than
  Postgres-native push, to keep the realtime path correctly scoped to the
  authenticated user without adding a second auth system (Supabase Auth) just
  for Realtime's RLS. See `src/app/api/stream/route.ts`.

## Exact next steps for deployment

1. Provision a real Supabase project; run both migrations; run the seed (or a
   production equivalent) to create at least one `investment_products` row.
2. Generate and set a real `SESSION_SECRET`; set `DEPOSIT_WALLET_ADDRESS` to a
   wallet the operator controls and monitors; set `ADMIN_WALLET_ADDRESSES`.
3. Point `NEXT_PUBLIC_SOLANA_RPC_URL`/`SOLANA_RPC_URL` at a paid RPC provider
   (public devnet/mainnet endpoints rate-limit aggressively).
4. Replace the mock exchange rate with a real price feed.
5. Decide on and implement the withdrawal payout path (treasury multisig,
   custody provider, or manual ops review queue), replacing
   `executeOnChainPayout`.
6. Move rate limiting to a shared store (e.g. Upstash Redis) before running
   more than one instance.
7. Schedule `POST /api/admin/accruals/run` (or port its logic into a Supabase
   Edge Function on a cron schedule).
8. Before allowing mainnet, change `NEXT_PUBLIC_SOLANA_NETWORK` and re-audit
   every dollar figure, confirmation-commitment level, and the disclaimer
   copy on the landing page.
