# Technology

## Stack
- React + TypeScript (`strict: true`)
- Vite (build and dev server)
- Plain CSS with CSS variables (no CSS framework, no CSS-in-JS)
- IndexedDB for all persistence
- Vitest for tests

## Dependencies (approved list)
- Runtime: `react`, `react-dom`, `idb` (tiny IndexedDB promise wrapper).
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fake-indexeddb`, `@types/*`.
- Anything else needs explicit user approval. Prefer platform APIs (`Intl`, `crypto.randomUUID`, `Blob`, `URL.createObjectURL`).

## Key decisions
- **Local-first**: no network calls, no backend, no auth. Do not add cloud infrastructure.
- **Money**: integer sen (`number`, branded type `Sen`). No floats for money. Convert from/to user-entered decimal strings only at the UI boundary. Format with `Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' })`.
- **Derived balances**: balance = opening balance + sum of transaction effects. Never persisted.
- **Transfers**: one transaction record with `fromAccountId` and `toAccountId`.
- **Dates**: stored as local `YYYY-MM-DD` strings, plus `createdAt` ISO timestamp. Weeks start Monday (single constant).
- **IDs**: `crypto.randomUUID()`.
- **State**: React Context + hooks. No Redux/Zustand.
- **Navigation**: bottom tab bar driven by React state. No router library unless approved.
- **Receipts**: stored as Blobs in a separate IndexedDB object store, referenced by `receiptId`. Images and PDFs only. PDFs open with the browser's native viewer (no pdf.js). Revoke object URLs when done.
- **Persistence safety**: call `navigator.storage.persist()` on startup.
- **Schema changes**: IndexedDB version bumps with explicit migration steps in `src/db`.

## IndexedDB stores
- `accounts` (key: `id`)
- `transactions` (key: `id`; indexes: `date`, `accountId`)
- `receipts` (key: `id`; value: blob + mime type + name + size)

## Commands
- `npm run dev` start dev server (run manually by the user)
- `npm run build` type-check and build
- `npm run test` run Vitest once (`vitest --run`)

## Testing
- Unit-test all pure domain logic: money parsing/formatting, balances, week grouping, cash flow summaries.
- Repository tests use `fake-indexeddb`.
- UI tests are optional and kept minimal.
