# Product

## Purpose
A local-first, mobile-first personal finance tracker for a single user on a single device. Data lives only in the browser (IndexedDB). No authentication, no cloud, no sync.

## Core features
1. **Accounts (wallets)**: user creates, edits and archives multiple accounts manually. Each has a name, type (e.g. cash, bank, e-wallet), and opening balance.
2. **Automatic balances**: account balance = opening balance + income - expense +/- transfers. Always derived from transactions, never stored.
3. **Transactions**: three kinds.
   - Income: adds to one account.
   - Expense: subtracts from one account.
   - Transfer: moves money from one account to another (single record with from/to accounts).
   - All have amount, date, optional note, optional receipt.
4. **Weekly history**: transactions shown as cards, grouped by week (weeks start Monday), newest week first.
5. **Cash flow summaries**: daily, weekly and monthly totals of income, expense and net. Transfers are excluded from cash flow.
6. **Receipts**: optional image or PDF attached to a transaction. Max ~5 MB; images compressed on upload.

## Business rules
- All money is integer **sen** (RM 12.50 = 1250). Single currency: MYR.
- Amounts are positive; the transaction kind determines direction.
- A transfer must use two different accounts.
- Negative account balances are allowed.
- An account with transactions is archived, not deleted. Only an account with no transactions can be hard-deleted.
- Deleting or editing a transaction updates balances and summaries automatically.
- Transaction dates are local calendar dates (`YYYY-MM-DD`).

## Non-goals (for now)
Authentication, cloud sync, multi-currency, budgets, categories (free-text note only), bank import, OCR, recurring transactions, PWA install.

## Planned later (do not build unless asked)
JSON export/import backup, categories, PWA/offline install.

## UX principles
- Mobile-first: one-handed use, bottom tab navigation, large touch targets.
- Adding a transaction should take few taps.
- Clear empty states and confirmation before destructive actions.
