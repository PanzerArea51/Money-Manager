# Conventions

## General
- Prioritize simplicity and maintainability. Prefer the simplest solution that works.
- Do not add features, abstractions or dependencies that were not requested (YAGNI).
- Keep functions small and single-purpose. Prefer pure functions in `domain`.

## TypeScript
- `strict` mode on. No `any`; use `unknown` and narrow.
- Use named exports, not default exports.
- Naming: `PascalCase` components/types, `camelCase` functions/variables, `UPPER_SNAKE_CASE` constants. Component files are named after the component.
- Model variants with discriminated unions (e.g. `Transaction` by `kind`).
- Use `type` for data shapes; avoid enums (use string unions).

## Money
- Money is integer sen, typed as `Sen`. Never use floating-point math on money.
- Parse user input with a dedicated function that returns integer sen (or an error); never `parseFloat(x) * 100`.
- Format only at display time via shared formatter in `domain/money.ts`.
- Reject non-integer, zero, negative and unsafe-integer amounts at the form/domain boundary.

## Dates
- Store transaction dates as local `YYYY-MM-DD`. Do not use `toISOString()` for calendar dates (timezone bug).
- Week start (Monday) is a single constant. All week/month grouping goes through `domain/week.ts`.

## React
- Function components and hooks only.
- Keep components presentational where possible; put data logic in hooks.
- Handle loading, empty and error states for every async view.
- Revoke any `URL.createObjectURL` URLs on unmount.

## Data access
- Only `src/db` touches IndexedDB. Repositories expose async functions returning domain types.
- Wrap multi-store changes (e.g. deleting a transaction and its receipt) in a single IndexedDB transaction.
- Schema changes require a version bump and migration.

## CSS
- Mobile-first: base styles target ~360px width; use `min-width` media queries to enhance.
- Use CSS variables for colors, spacing, radii and font sizes (defined in `styles/`).
- Touch targets at least 44x44px. Respect `prefers-reduced-motion` and keep sufficient contrast.
- Use semantic HTML, labels for all inputs, and visible focus states.
- Co-locate component CSS; use class names prefixed by component to avoid collisions.

## Testing
- Every domain function has unit tests, including edge cases (zero, large amounts, week/month boundaries, transfers excluded from cash flow).
- Run tests with `vitest --run` (not watch mode).

## Workflow
- Do not run long-running dev servers from the agent; ask the user to run `npm run dev`.
- Small, focused commits with imperative messages (e.g. "Add balance calculation").
- Do not introduce authentication or cloud infrastructure unless the user explicitly asks.
