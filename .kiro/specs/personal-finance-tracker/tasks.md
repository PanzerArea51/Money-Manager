# Implementation Plan: Personal Finance Tracker

## Overview

The design uses TypeScript, so all tasks use TypeScript with `strict` mode. The plan follows this order: project scaffold, pure `domain` layer with tests, `db` layer with tests, app shell, Accounts, Transactions (income/expense), History, Transfers, Cash Flow, Receipts, then polish.

Rules that apply to every task (from `.kiro/steering`):
- Runtime dependencies are exactly `react`, `react-dom`, `idb`. Dev dependencies are `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fake-indexeddb`, `fast-check` and `@types/*`. `fast-check` is approved as a devDependency only.
- Named exports only, no `any`, no enums, no `parseFloat` on money, no `toISOString()` for calendar dates.
- Only `src/db` touches IndexedDB. Run tests with `vitest --run`. Do not start dev servers; ask the user to run `npm run dev`.
- Every property test uses at least 100 runs and carries the tag comment `Feature: personal-finance-tracker, Property N: <text>`.

## Tasks

- [ ] 1. Scaffold the project
  - [-] 1.1 Create the Vite + React + TypeScript project files and initialize git
    - Run `git init` and add `.gitignore` (node_modules, dist)
    - Create `package.json` with scripts `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest --run`)
    - Install runtime deps `react`, `react-dom`, `idb`; dev deps `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fake-indexeddb`, `fast-check`, `@types/react`, `@types/react-dom`
    - Create `tsconfig.json` with `strict: true`, `vite.config.ts`, `index.html`, `src/main.tsx`, and a stub `src/App.tsx`
    - Create the empty folder structure from `structure.md`: `src/domain`, `src/db`, `src/hooks`, `src/components`, `src/features`, `src/utils`, `src/styles`
    - Make an initial commit
    - _Requirements: 13.2, 13.3_

  - [ ] 1.2 Configure Vitest
    - Add the `test` block to `vite.config.ts` (environment `jsdom` is NOT added unless a UI test needs it; use `node` by default and a per-file `@vitest-environment` comment for UI tests)
    - Add a trivial smoke test that confirms `vitest --run` exits 0
    - If UI tests are later wanted, `jsdom` and `@testing-library/react` need explicit user approval first
    - _Requirements: 13.8, 13.9_

  - [ ] 1.3 Create base CSS
    - Create `src/styles/variables.css` (colors for income/expense/transfer/negative, spacing, radii, font sizes, `--tap-size: 44px`, focus color)
    - Create `src/styles/reset.css` and `src/styles/base.css` (mobile-first at 360px, `prefers-reduced-motion` rule, visible focus outline, centered 960px column at `min-width: 768px`)
    - Import the styles in `src/main.tsx`
    - _Requirements: 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

- [ ] 2. Domain: types and money
  - [ ] 2.1 Implement `domain/types.ts` and `domain/money.ts`
    - Define `Sen`, `LocalDate`, `LocalTime`, `Result`, `Account`, `Transaction` union, `Receipt`, input and error types
    - Implement `MAX_SEN`, `isSen`, `checkedAdd`, `parseMoney` (hand-written scanner, integer arithmetic only) and `formatMoney` (`RM1,234.56`, `-RM12.50`)
    - _Requirements: 1.5, 1.7, 3.5, 10.1, 10.2, 10.3, 10.4, 10.7, 10.8_

  - [ ] 2.2 Create shared fast-check arbitraries in `domain/testing/arbitraries.ts`
    - Generators: `sen` (biased to 0, ±1, ±MAX_SEN), `moneyString` (valid and invalid), `localDate` (1970 to 2100, biased to month ends, leap days, Mondays, Sundays), `localTime`, `account`, `transaction` (all three kinds referencing generated account IDs), and a `shuffle` helper
    - _Requirements: 13.5_

  - [ ] 2.3 Write unit tests for money parsing and formatting
    - Cover `parseMoney` (passing cases like "12.5" and "0.05", empty input, each rejection reason) and `formatMoney` (zero, negative, grouping, max value)
    - Cover `checkedAdd` at and beyond ±99,999,999,999
    - _Requirements: 10.2, 10.3, 10.4, 10.8, 13.5_

  - [ ] 2.4 Write property test for parser exactness
    - **Property 1: Parser returns the exact integer sen value**
    - **Validates: Requirements 1.5, 1.6, 4.5, 10.2**

  - [ ] 2.5 Write property test for parser rejection
    - **Property 2: Parser rejects malformed input with a reason**
    - **Validates: Requirements 1.7, 10.3**

  - [ ] 2.6 Write property test for format-then-parse round trip
    - **Property 3: Format then parse round trip**
    - **Validates: Requirements 10.5**

  - [ ] 2.7 Write property test for parse-format-parse stability
    - **Property 4: Parse, format, parse is stable**
    - **Validates: Requirements 10.6**

  - [ ] 2.8 Write property test for formatted money shape
    - **Property 5: Formatted money has a fixed shape**
    - **Validates: Requirements 3.5, 3.6, 8.2, 10.4**

  - [ ] 2.9 Write property test for checked addition
    - **Property 6: Checked addition respects the sen range**
    - **Validates: Requirements 10.1, 10.7, 10.8**

- [ ] 3. Domain: dates, weeks and periods
  - [ ] 3.1 Implement `domain/date.ts` and `domain/week.ts`
    - `parseLocalDate` (rejects `2025-02-30`), `addDays`, weekday, `todayLocal`, `nowLocalTime` (using local getters, no `toISOString`)
    - `WEEK_START = 1` constant, `weekStart`, `weekEnd`, `periodFor`, `shiftPeriod` (month shift uses first day of adjacent month), `isWithin` (inclusive)
    - _Requirements: 4.2, 4.8, 7.1, 8.1, 8.4, 8.5, 8.12_

  - [ ] 3.2 Write unit tests for date and period boundaries
    - Sunday to Monday transition, last day of a 28-day February, last day of a 29-day February (leap year), last day of a 30-day month, last day of a 31-day month, December 31 to January 1
    - Invalid dates and times
    - _Requirements: 13.5, 13.6_

  - [ ] 3.3 Write property test for week and month periods
    - **Property 20: A week period is Monday to Sunday and contains its anchor**
    - **Validates: Requirements 7.1, 8.5**

  - [ ] 3.4 Write property test for period shifting
    - **Property 21: Shifting a period is reversible and moves by one unit**
    - **Validates: Requirements 7.10, 8.4**

- [ ] 4. Domain: balances and account rules
  - [ ] 4.1 Implement `domain/balance.ts`
    - `accountBalance` and `combinedBalance` (active accounts only) using `checkedAdd`
    - _Requirements: 2.3, 2.4, 3.2, 3.4, 3.7, 3.8, 4.9, 4.10, 4.11, 5.6, 10.7_

  - [ ] 4.2 Implement `domain/accounts.ts`
    - `selectableAccountIds(accounts, editedTransaction?)` and `blockingTransactionCount(accountId, transactions)`
    - _Requirements: 2.6, 2.8, 2.9, 6.9_

  - [ ] 4.3 Write unit tests for balances and account rules
    - Empty inputs, negative balances, transfers in and out, archived accounts excluded from combined balance, overflow result, selectable set with archived account of edited transaction, blocking count for all three reference fields
    - _Requirements: 13.5_

  - [ ] 4.4 Write property test for account balance
    - **Property 12: Account balance equals opening balance plus signed transaction effects**
    - **Validates: Requirements 2.3, 3.4, 4.9, 4.10, 4.11, 5.6, 10.7**

  - [ ] 4.5 Write property test for add-then-delete
    - **Property 13: Adding then deleting a transaction restores all balances**
    - **Validates: Requirements 6.4, 6.8**

  - [ ] 4.6 Write property test for combined balance
    - **Property 14: Combined balance sums active accounts only**
    - **Validates: Requirements 2.4, 2.5, 3.2, 3.7, 3.8**

  - [ ] 4.7 Write property test for transfers and combined balance
    - **Property 15: Transfers preserve the combined balance**
    - **Validates: Requirements 5.7**

  - [ ] 4.8 Write property test for total of all balances
    - **Property 16: Total of all balances ignores transfers**
    - **Validates: Requirements 10.9**

  - [ ] 4.9 Write property test for selectable accounts
    - **Property 11: Selectable accounts are the active accounts plus the edited transaction's own accounts**
    - **Validates: Requirements 2.9, 6.9**

  - [ ] 4.10 Write property test for account deletion blocking
    - **Property 26: Account deletion is blocked by every referencing transaction**
    - **Validates: Requirements 2.6, 2.8**

- [ ] 5. Domain: cash flow, history and receipts list
  - [ ] 5.1 Implement `domain/cashflow.ts`
    - `summarize(txs, period)` returning total income, total expenses and net; transfers skipped; archived accounts included
    - _Requirements: 8.2, 8.3, 8.6, 8.7, 8.10, 8.12_

  - [ ] 5.2 Implement `domain/history.ts`
    - `compareTransactionsNewestFirst`, `groupByWeek` (week net uses the same rule as `summarize`), `findWeekForMonth`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.8, 7.9_

  - [ ] 5.3 Implement `domain/receipts.ts`
    - `receiptEntries(transactions)` returning exactly the transactions that have a `receiptId`
    - _Requirements: 9.9_

  - [ ] 5.4 Write unit tests for cash flow
    - Empty input gives zeros, total income, total expenses, net, transfer exclusion, archived-account inclusion, inclusive period ends
    - _Requirements: 13.5_

  - [ ] 5.5 Write unit tests for history grouping and receipts list
    - Empty input, ordering by date, time and `createdAt`, week net, transfers excluded from net, month lookup (found and not found), receipts list excludes transactions without a receipt
    - _Requirements: 13.5_

  - [ ] 5.6 Write property test for order independence
    - **Property 17: Results do not depend on transaction order**
    - **Validates: Requirements 10.10**

  - [ ] 5.7 Write property test for cash flow totals
    - **Property 18: Cash flow totals follow their definition**
    - **Validates: Requirements 8.2, 8.3, 8.7, 8.10, 8.12**

  - [ ] 5.8 Write property test for transfer exclusion
    - **Property 19: Transfers never affect cash flow**
    - **Validates: Requirements 5.8, 7.4, 7.8, 8.6**

  - [ ] 5.9 Write property test for history grouping
    - **Property 22: History grouping partitions transactions by week and orders them**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ] 5.10 Write property test for week net
    - **Property 23: Week net matches the cash flow of the week**
    - **Validates: Requirements 7.4**

  - [ ] 5.11 Write property test for month lookup
    - **Property 24: Month lookup finds the newest week touching the month**
    - **Validates: Requirements 7.9**

  - [ ] 5.12 Write property test for receipts list
    - **Property 25: Receipts list contains exactly the transactions with receipts**
    - **Validates: Requirements 9.9**

- [ ] 6. Domain: validation
  - [ ] 6.1 Implement `domain/validation.ts`
    - `validateAccountInput`, `validateTransactionInput` (income, expense and transfer), `validateReceiptFile`
    - Return a `FieldErrors` map that reports every invalid field in one pass
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 1.9, 2.2, 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 9.1, 9.2, 9.3_

  - [ ] 6.2 Write unit tests for validation
    - Boundary lengths (50 and 51 character names, 100 and 101 character titles), whitespace-only names, zero and negative amounts, amount at and above the limit, invalid date and time, same-account transfer, unselectable account, receipt at 5,242,880 and 5,242,881 bytes, unsupported MIME type, multiple simultaneous errors
    - _Requirements: 13.5_

  - [ ] 6.3 Write property test for account validation
    - **Property 7: Account validation accepts exactly the valid drafts**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 1.9, 2.1**

  - [ ] 6.4 Write property test for transaction validation
    - **Property 8: Transaction validation accepts exactly the valid drafts**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 5.1, 5.3, 5.4, 5.5, 6.2**

  - [ ] 6.5 Write property test for error reporting
    - **Property 9: Validation reports every invalid field**
    - **Validates: Requirements 2.2, 6.3**

  - [ ] 6.6 Write property test for receipt file validation
    - **Property 10: Receipt file validation**
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [ ] 7. Checkpoint - Domain layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Data layer (IndexedDB)
  - [ ] 8.1 Implement `db/database.ts`
    - `openFinanceDb` using `idb`, `DB_NAME`, `DB_VERSION = 1`, stores `accounts`, `transactions` (indexes `date`, `accountId`) and `receipts`
    - Ordered `migrations` list run inside the upgrade callback; `DbOpenError`
    - _Requirements: 11.6, 11.7, 11.8_

  - [ ] 8.2 Implement `db/accountRepo.ts`
    - `list`, `get`, `add` (assigns `crypto.randomUUID()` and `createdAt`), `update` (ID never changes), `remove` (refuses if transactions reference the account), `countTransactions`
    - _Requirements: 1.1, 1.10, 2.1, 2.4, 2.5, 2.6, 2.8, 11.1, 11.9, 11.10_

  - [ ] 8.3 Implement `db/transactionRepo.ts`
    - `list`, `get`, `add(input, receipt?)`, `update(id, input, ReceiptChange)`, `remove`; each write that touches a receipt uses one IDB transaction over `['transactions', 'receipts']`
    - Replacing or removing a receipt deletes the previous receipt record
    - _Requirements: 4.1, 5.1, 6.2, 6.7, 9.5, 9.7, 11.1, 11.9, 11.10_

  - [ ] 8.4 Implement `db/receiptRepo.ts`
    - Read-only `get(id)` returning a `Receipt`
    - _Requirements: 9.5, 9.6, 9.11_

  - [ ] 8.5 Write tests for `openFinanceDb` and migrations against `fake-indexeddb`
    - Fresh database has the three stores and indexes; seed an old version, upgrade, and confirm all records are preserved; a throwing migration leaves the old data intact and rejects
    - _Requirements: 11.6, 11.7, 13.7_

  - [ ] 8.6 Write repository tests for accounts
    - Create, read, update, delete; ID stays the same on update; delete refused when a transaction references the account
    - _Requirements: 11.10, 13.7_

  - [ ] 8.7 Write repository tests for transactions
    - Create, read, update, delete for income, expense and transfer; atomic write with a receipt; simulated mid-write failure leaves both stores unchanged; delete removes the receipt; replace removes the old receipt
    - _Requirements: 6.7, 9.7, 11.9, 13.7_

  - [ ] 8.8 Write repository tests for receipts
    - Read a stored receipt (small Blob, assert size and MIME type); missing ID returns `undefined`
    - _Requirements: 9.5, 13.7_

- [ ] 9. Checkpoint - Data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. App shell and shared building blocks
  - [ ] 10.1 Create shared presentational components
    - `Button`, `Modal` (focus trap, Escape to dismiss), `TabBar` (four tabs, `aria-current="page"`, non-color active marker), `Card`, `EmptyState`, each with co-located CSS and prop-only data access
    - Controls at least 44x44px, 8px spacing
    - _Requirements: 12.2, 12.5, 12.7, 12.10, 12.12, 13.4_

  - [ ] 10.2 Implement `hooks/FinanceProvider.tsx` and `hooks/useStoragePersistence.ts`
    - Open the database, call `navigator.storage.persist()`, load accounts and transactions (not receipt blobs), expose `status` (`loading`, `ready`, `error`, `fatal`), `persistenceDenied`, `reload`, the repositories and state updaters
    - State is updated only after a successful write
    - _Requirements: 3.3, 11.3, 11.4, 11.5, 11.7, 11.8, 12.13, 12.14_

  - [ ] 10.3 Implement the `App.tsx` shell
    - Gate on `loading` and `fatal` (fatal shows only a blocking error screen), render `TabBar` and a placeholder for each of the four views (Accounts, History, Cash Flow, Receipts), wrap with `FinanceProvider` in `main.tsx`
    - Loading indicator, and error state with Retry that calls `reload()`
    - _Requirements: 11.7, 11.8, 12.1, 12.2, 12.13, 12.14_

- [ ] 11. Accounts feature
  - [ ] 11.1 Implement `hooks/useAccounts.ts`
    - Active and archived lists with derived balances, `combined` (or `'unavailable'`), `createAccount`, `updateAccount`, `archiveAccount`, `restoreAccount`, `deleteAccount` returning `ActionResult`
    - Check balance limits before writing
    - _Requirements: 1.1, 1.10, 2.1, 2.3, 2.4, 2.5, 2.6, 2.8, 3.1, 3.2, 3.3, 3.9, 10.8_

  - [ ] 11.2 Build `features/accounts` UI
    - `AccountForm` (labels, per-field errors, kept values on failure), `AccountCard` (balance, negative style, error state), `AccountsView` (combined balance, archived toggle and section, empty and loading states)
    - _Requirements: 1.1, 1.3, 1.4, 1.7, 1.8, 1.9, 2.2, 3.1, 3.2, 3.6, 3.7, 3.8, 3.9, 12.5, 12.10, 12.12_

  - [ ] 11.3 Build `ConfirmDialog` and `DeleteBlockedDialog`
    - `ConfirmDialog` on `Modal` names the affected item with distinct confirm and cancel controls
    - `DeleteBlockedDialog` shows the blocking transaction count and offers Archive instead
    - _Requirements: 2.6, 2.7, 2.8, 12.15, 12.16_

  - [ ] 11.4 Wire archive, restore and delete flows and add `AccountsView` to `App.tsx`
    - Use the dialogs from 11.3 in `AccountsView`; replace the Accounts placeholder in `App.tsx`
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 12.15, 12.16_

  - [ ] 11.5 Write hook tests for `useAccounts`
    - Use a fake repository: create, edit, archive, restore, blocked delete, write failure leaves state unchanged
    - _Requirements: 1.10, 2.8_

- [ ] 12. Transactions: income and expense
  - [ ] 12.1 Implement `hooks/useTransactions.ts`
    - Expose `transactions`, `createTransaction(draft, file?)`, `updateTransaction(id, draft, receiptChange)`, `deleteTransaction(id)`, `history`, `cashFlow(period)`
    - Recompute affected balances with `checkedAdd` before writing and reject with an amount-limit message; update state only after a successful write
    - _Requirements: 4.1, 4.9, 4.10, 4.11, 4.13, 6.2, 6.4, 6.7, 6.8, 6.10, 10.8_

  - [ ] 12.2 Build `TransactionForm` for income and expense
    - Type selector (Income, Expense), title (max 100), amount, date and time defaulting to local now, account selector from `selectableAccountIds`, per-field errors, values kept on validation or save failure
    - Supports create and edit modes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8, 4.13, 6.3, 6.9, 12.10_

  - [ ] 12.3 Build `TransactionDetails` with edit and delete
    - Show title, kind, amount, account, date, time and receipt status (placeholder text until receipts are added); show archived account names; delete uses `ConfirmDialog`
    - _Requirements: 2.10, 6.1, 6.2, 6.5, 6.6, 6.7, 6.10, 12.15_

  - [ ] 12.4 Add the Floating_Action_Button and wire the form into `App.tsx`
    - FAB on Accounts, History and Cash Flow only, bottom-right above the Tab_Bar; with no active accounts show a "create an account first" prompt instead of opening the form
    - _Requirements: 4.12, 12.3, 12.4_

  - [ ] 12.5 Write hook tests for `useTransactions`
    - Create, edit and delete with a fake repository; negative balance allowed; overflow rejected with nothing written; write failure leaves state unchanged
    - _Requirements: 4.11, 4.13, 6.10, 10.8_

- [ ] 13. History feature
  - [ ] 13.1 Build `PeriodNavigator`
    - Shared previous/next control with label; next disabled when requested; 44x44px targets
    - _Requirements: 7.10, 7.11, 8.4, 12.7_

  - [ ] 13.2 Build `TransactionRow` and `WeekCard`
    - Expandable `WeekCard` (button with `aria-expanded`) showing date range and week net; rows show title, signed amount, account and date; income green with "+", expense red with "-"
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.13, 12.5, 12.6_

  - [ ] 13.3 Build `HistoryView`
    - Week and month navigation mode, month jump using `findWeekForMonth` with scroll, empty state per period, loading indicator, error with retry
    - _Requirements: 7.2, 7.9, 7.10, 7.11, 7.12, 7.14, 7.15, 12.12, 12.13, 12.14_

  - [ ] 13.4 Wire `HistoryView` and transaction selection into `App.tsx`
    - Replace the History placeholder; selecting a row opens `TransactionDetails`
    - _Requirements: 7.13, 6.1_

  - [ ] 13.5 Write a minimal UI test for `HistoryView`
    - Expand and collapse a week card, empty state
    - Requires user approval for `jsdom` and `@testing-library/react` before adding; skip if not approved
    - _Requirements: 7.5, 7.6, 7.12_

- [ ] 14. Transfers
  - [ ] 14.1 Extend `TransactionForm` for transfers
    - Third type option "Transfer" (exactly three options), source and destination selectors, title default "Transfer", same-account error, unchanged balances on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.10, 12.4_

  - [ ] 14.2 Show transfers in History and Details
    - Neutral gray style with a "Transfer" label and no sign in `TransactionRow`, source and destination names in `WeekCard` rows and `TransactionDetails`; verify week net excludes transfers
    - _Requirements: 5.8, 7.8, 12.6_

  - [ ] 14.3 Write hook tests for transfers
    - Create a transfer through `useTransactions`; confirm balances move, combined balance is unchanged and cash flow is unchanged; failed write changes nothing
    - _Requirements: 5.6, 5.7, 5.8, 5.10_

- [ ] 15. Cash Flow feature
  - [ ] 15.1 Build `features/summary/CashFlowView`
    - Day/week/month toggle (exactly three options, default current month), `PeriodNavigator`, Total_Income, Total_Expenses and Net_Cash_Flow with two decimals; net below zero shown with "-" in expense color, above zero in income color; empty, loading and error states
    - _Requirements: 8.1, 8.2, 8.4, 8.8, 8.9, 8.10, 8.11, 12.12, 12.13, 12.14_

  - [ ] 15.2 Wire `CashFlowView` into `App.tsx`
    - Replace the Cash Flow placeholder
    - _Requirements: 8.11, 12.2_

  - [ ] 15.3 Write tests for the Cash Flow period selection
    - Default period is the current month; shifting day, week and month moves by one unit; values refresh after a transaction change
    - _Requirements: 8.1, 8.4, 8.11_

- [ ] 16. Receipts
  - [ ] 16.1 Implement `utils/compressImage.ts` and `hooks/useObjectUrl.ts`
    - Canvas-based compression for JPG/JPEG/PNG; `useObjectUrl(blob)` creates the URL in an effect and revokes it on cleanup and unmount
    - _Requirements: 9.4, 9.8_

  - [ ] 16.2 Build `ReceiptPicker` and integrate it into `TransactionForm`
    - Validate type and size with `validateReceiptFile`, compress images over 5 MB then re-validate, never compress PDFs, show the accepted types or the 5 MB message and keep the existing receipt on rejection
    - Support keep, remove and replace through `ReceiptChange` for income, expense and transfer
    - _Requirements: 5.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [ ] 16.3 Build `ReceiptPreview` and show receipts in `TransactionDetails`
    - Images shown via `<img>` from an object URL, PDFs opened in the browser's native viewer, URL revoked on close, "could not be loaded" error that leaves the transaction visible
    - _Requirements: 9.6, 9.8, 9.11_

  - [ ] 16.4 Implement `hooks/useReceipts.ts`, `ReceiptsView` and wire it into `App.tsx`
    - List exactly the transactions that have a receipt via `receiptEntries`; selecting an entry uses `ReceiptPreview`; empty, loading and error states
    - _Requirements: 9.9, 9.10, 9.11, 12.12, 12.13, 12.14_

  - [ ] 16.5 Write a test for object URL revocation
    - Spy on `URL.revokeObjectURL` and confirm it runs on close and unmount
    - _Requirements: 9.8_

- [ ] 17. Checkpoint - Features complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Polish and structural checks
  - [ ] 18.1 Add an error boundary and the persistence notice
    - Top-level `ErrorBoundary` with a reload action wrapping `App` in `main.tsx`; dismissible notice when `persistenceDenied` is true
    - _Requirements: 11.4, 12.14_

  - [ ] 18.2 Finish the CSS pass
    - Check every component for 44x44px targets and 8px spacing, 360px layout without horizontal scroll up to 767px, 768px centered column, reduced-motion handling for tab and form transitions, 3:1 focus indicator, card padding of at least 12px
    - _Requirements: 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

  - [ ] 18.3 Write structural smoke tests
    - `package.json` `dependencies` are exactly `react`, `react-dom`, `idb`; `domain` files import nothing from React, `db` or the DOM; nothing outside `src/db` references `indexedDB`; no `any` in `src`
    - _Requirements: 11.2, 13.1, 13.2, 13.3_

  - [ ] 18.4 Write a load-time test with 10,000 transactions
    - Seed `fake-indexeddb`, load all data and assert the load completes within 2 seconds
    - _Requirements: 11.5_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Unit tests and repository tests required by Requirements 13.5 to 13.7 are not marked optional.
- Property tests use `fast-check` with at least 100 runs and the tag `Feature: personal-finance-tracker, Property N: ...`.
- UI tests need `jsdom` and `@testing-library/react`, which are not on the approved list. Ask the user before adding them, or skip the UI test tasks.
- Image compression and the manual layout checklist (Requirements 12.5 to 12.11) are verified by review in the browser, not by automated tests.
- Each task references specific requirements for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "4.1", "4.2", "5.3", "8.1", "10.1"] },
    { "id": 4, "tasks": ["2.4", "3.2", "3.3", "4.3", "4.4", "4.9", "5.1", "5.12", "6.1", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["2.5", "3.4", "4.5", "4.10", "5.2", "5.4", "5.6", "5.7", "6.2", "6.3", "8.5", "8.6", "8.7", "8.8", "10.2"] },
    { "id": 6, "tasks": ["2.6", "4.6", "5.5", "5.8", "5.9", "6.4", "10.3", "11.1", "11.3", "12.1"] },
    { "id": 7, "tasks": ["2.7", "4.7", "5.10", "6.5", "11.2", "11.5", "12.2", "12.5", "13.1"] },
    { "id": 8, "tasks": ["2.8", "4.8", "5.11", "6.6", "11.4", "12.3", "13.2"] },
    { "id": 9, "tasks": ["2.9", "12.4", "13.3"] },
    { "id": 10, "tasks": ["13.4", "13.5", "14.1", "14.2", "15.1"] },
    { "id": 11, "tasks": ["14.3", "15.2", "16.1"] },
    { "id": 12, "tasks": ["15.3", "16.2", "16.3", "16.5"] },
    { "id": 13, "tasks": ["16.4"] },
    { "id": 14, "tasks": ["18.1", "18.2", "18.3", "18.4"] }
  ]
}
```
