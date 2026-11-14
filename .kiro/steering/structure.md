# Structure

## Layout
```
src/
  domain/        Pure TypeScript: types, money, balances, weeks, summaries. No React, no IndexedDB.
  db/            IndexedDB setup, migrations, repositories (accounts, transactions, receipts).
  features/
    accounts/    Account list, form, detail
    transactions/ Transaction form, weekly history, cards
    summary/     Daily/weekly/monthly cash flow views
    receipts/    Attach/preview receipt components
  components/    Shared presentational UI (Button, Modal, TabBar, EmptyState...)
  hooks/         Shared hooks and Context providers (e.g. useAccounts, useTransactions)
  styles/        Global CSS: variables, reset, base
  utils/         Small generic helpers unrelated to finance domain
  App.tsx        Shell and tab navigation
  main.tsx       Entry point
```
Each feature folder holds its components, feature-specific CSS and tests together.

## Layering rules
Dependency direction: `features/components` -> `hooks` -> `db` -> `domain`.
- `domain` imports nothing from other layers and is fully unit-testable.
- `db` imports only `domain` types. It is the only place that touches IndexedDB.
- UI never calls IndexedDB directly; it uses hooks.
- Features do not import from other features' internals. Share via `domain`, `hooks` or `components`.

## Data model (in `domain`)
- `Account`: `id`, `name`, `type`, `openingBalance: Sen`, `archived: boolean`, `createdAt`.
- `Transaction`: `id`, `kind: 'income' | 'expense' | 'transfer'`, `amount: Sen` (> 0), `date: 'YYYY-MM-DD'`, `accountId` (income/expense), `fromAccountId` and `toAccountId` (transfer), `note?`, `receiptId?`, `createdAt`.
- `Receipt`: `id`, `blob`, `mimeType`, `fileName`, `size`.

## File placement
- Tests sit next to source: `money.ts` + `money.test.ts`.
- One component per file; filename matches the component (`TransactionCard.tsx`, `TransactionCard.css`).
- Domain functions grouped by topic: `money.ts`, `balance.ts`, `week.ts`, `cashflow.ts`.
