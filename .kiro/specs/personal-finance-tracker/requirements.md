# Requirements Document

## Introduction

The Finance_Tracker is a mobile-first, local-first personal finance web application for a single user on a single device. It is built with React, TypeScript, Vite and plain CSS, and stores all data in the browser's IndexedDB. It has no backend, authentication, cloud sync, bank API integration or payment processing.

The user manages multiple Accounts, records Income, Expense and Transfer transactions, attaches Receipts, reviews a weekly History, and views Cash Flow summaries by day, week or month.

Confirmed decisions (these supersede the steering files where they differ):

1. A Transaction has a required title and a time (defaulting to the current time). There is no separate note field.
2. An Account that has transactions cannot be deleted; it can be archived instead. Only an Account with no transactions can be hard-deleted. Archived Accounts are hidden from account selectors.
3. The Combined_Balance includes only active (non-archived) Accounts.
4. Transfers appear in History cards with a neutral style distinct from Income and Expense.
5. A Transfer is a single record with a source Account, a destination Account, a title (default "Transfer"), a date, a time and an optional Receipt.
6. Cash Flow has a day/week/month toggle with previous/next navigation. Weeks start on Monday. Transfers are excluded from Cash Flow.
7. The only currency is MYR. Amounts are integer sen. Receipts are limited to about 5 MB. Negative balances are allowed. Dates are stored as local `YYYY-MM-DD` strings.

## Glossary

- **Finance_Tracker**: The complete web application described in this document.
- **Account**: A user-defined wallet with a name, type, starting balance and archived flag.
- **Active_Account**: An Account that is not archived.
- **Archived_Account**: An Account whose archived flag is set. It is hidden from account selectors but retains its transactions.
- **Account_Manager**: The component that creates, edits, archives and deletes Accounts.
- **Starting_Balance**: The integer sen amount an Account holds before any Transaction is applied.
- **Account_Balance**: Starting_Balance plus Income, minus Expense, plus incoming Transfers, minus outgoing Transfers for one Account. It is always derived and never stored.
- **Combined_Balance**: The sum of Account_Balance over all Active_Accounts.
- **Sen**: The integer unit of money, where 100 sen equal RM 1.00.
- **Transaction**: A record of kind Income, Expense or Transfer.
- **Income**: A Transaction that adds an amount to one Account.
- **Expense**: A Transaction that subtracts an amount from one Account.
- **Transfer**: A single Transaction that moves an amount from a source Account to a different destination Account.
- **Transaction_Manager**: The component that creates, edits, deletes and displays Transactions.
- **Transaction_Form**: The user interface for entering or editing a Transaction.
- **Transaction_Details**: The view that shows all fields of one Transaction.
- **Receipt**: An optional file in JPG, JPEG, PNG or PDF format attached to a Transaction.
- **Receipt_Store**: The component that stores, retrieves and removes Receipts.
- **History_View**: The view that lists Transactions grouped by calendar week.
- **Week_Card**: An expandable card in the History_View representing one calendar week, Monday to Sunday.
- **Cash_Flow_View**: The view that shows Total_Income, Total_Expenses and Net_Cash_Flow for a selected period.
- **Period**: A single day, a Monday-to-Sunday week, or a calendar month, chosen with the period toggle.
- **Total_Income**: The sum of amounts of all Income Transactions dated within a Period.
- **Total_Expenses**: The sum of amounts of all Expense Transactions dated within a Period.
- **Net_Cash_Flow**: Total_Income minus Total_Expenses for a Period.
- **Money_Parser**: The component that converts a user-entered decimal string into integer Sen.
- **Money_Formatter**: The component that converts integer Sen into a localized MYR display string.
- **Storage_Layer**: The component that reads and writes data in IndexedDB.
- **Floating_Action_Button**: A persistent circular button for adding a Transaction.
- **Tab_Bar**: The bottom navigation bar used to switch between top-level views.

## Requirements

### Requirement 1: Create Accounts

**User Story:** As a user, I want to create multiple accounts with a starting balance, so that I can track money held in different places.

#### Acceptance Criteria

1. WHEN the user submits a name of 1 to 50 characters after trimming leading and trailing whitespace, an Account type of cash, bank or e-wallet, and a valid Starting_Balance, THE Account_Manager SHALL create an Active_Account with the trimmed name and persist it through the Storage_Layer.
2. THE Account_Manager SHALL accept an Account type of cash, bank or e-wallet.
3. IF the Account name is empty or contains only whitespace, THEN THE Account_Manager SHALL reject the Account, display a message stating that a name is required, and leave the stored accounts unchanged.
4. IF the Account name exceeds 50 characters after trimming leading and trailing whitespace, THEN THE Account_Manager SHALL reject the Account, display a message stating the maximum length of 50 characters, and leave the stored accounts unchanged.
5. WHEN the user enters a Starting_Balance, THE Money_Parser SHALL convert the entered decimal string into integer Sen without floating-point arithmetic.
6. THE Account_Manager SHALL accept a Starting_Balance that is zero, positive or negative.
7. IF the Starting_Balance is not a valid decimal amount with at most two fraction digits, THEN THE Account_Manager SHALL reject the Account, display a message describing the expected format, and leave the stored accounts unchanged.
8. IF the Starting_Balance has an absolute value in Sen greater than 99,999,999,999 (RM 999,999,999.99), THEN THE Account_Manager SHALL reject the Account, display a message stating the amount is too large, and leave the stored accounts unchanged.
9. IF the Account type is not cash, bank or e-wallet, THEN THE Account_Manager SHALL reject the Account, display a message listing the three accepted types, and leave the stored accounts unchanged.
10. IF the Storage_Layer fails to persist the Account, THEN THE Account_Manager SHALL not add the Account to the displayed account list, display a message stating that the Account could not be saved, and leave the stored accounts unchanged.

### Requirement 2: Edit, Archive and Delete Accounts

**User Story:** As a user, I want to edit, archive or delete accounts, so that I can keep my account list accurate without losing transaction history.

#### Acceptance Criteria

1. WHEN the user submits changes to an Account name, type or Starting_Balance, THE Account_Manager SHALL validate the values with the rules of Requirement 1, persist the changes and display the updated Account in the account list within 1 second.
2. IF the submitted values fail validation under the rules of Requirement 1, THEN THE Account_Manager SHALL reject the edit, display an error message identifying each invalid field, and keep the previously stored values of the Account unchanged.
3. WHEN the user edits the Starting_Balance of an Account, THE Finance_Tracker SHALL recompute the Account_Balance and the Combined_Balance from the new value and display both recomputed values within 1 second.
4. WHEN the user archives an Active_Account, THE Account_Manager SHALL set the archived flag, keep all Transactions of that Account unchanged, and remove the Account from the Active_Account list within 1 second.
5. WHEN the user restores an Archived_Account, THE Account_Manager SHALL clear the archived flag and make the Account available again as an Active_Account within 1 second.
6. WHEN the user requests deletion of an Account that has no Transactions, THE Account_Manager SHALL ask for confirmation and, after the user confirms, remove the Account and its entry from the account list.
7. IF the user cancels the deletion confirmation or dismisses it without confirming, THEN THE Account_Manager SHALL keep the Account unchanged.
8. IF the user requests deletion of an Account that has one or more Transactions, THEN THE Account_Manager SHALL refuse the deletion, display a message stating the number of Transactions that block the deletion, offer to archive the Account instead, and keep the Account and all its Transactions unchanged.
9. THE Transaction_Form SHALL list only Active_Accounts in its account selectors.
10. WHEN a Transaction references an Archived_Account, THE Transaction_Details SHALL display the name of that Account.

### Requirement 3: Display Account Balances

**User Story:** As a user, I want to see each account's balance and my combined balance, so that I know how much money I have.

#### Acceptance Criteria

1. THE Finance_Tracker SHALL display the Account_Balance of each Active_Account in an account card.
2. THE Finance_Tracker SHALL display the Combined_Balance as the sum of Account_Balance over all Active_Accounts.
3. WHEN a Transaction is created, edited or deleted, THE Finance_Tracker SHALL update the displayed Account_Balance values and the Combined_Balance within 1 second and without a manual refresh.
4. THE Finance_Tracker SHALL derive each Account_Balance from the Starting_Balance and the Transactions, and SHALL NOT persist the Account_Balance.
5. THE Money_Formatter SHALL display every monetary value in MYR with exactly two fraction digits.
6. WHILE an Account_Balance or the Combined_Balance is negative, THE Finance_Tracker SHALL display the value with a leading minus sign and a negative-amount visual style that differs from the style used for zero and positive amounts.
7. WHERE the user chooses to view Archived_Accounts, THE Finance_Tracker SHALL list Archived_Accounts in a section separate from Active_Accounts, display the Account_Balance of each Archived_Account, and exclude Archived_Accounts from the Combined_Balance.
8. WHEN no Active_Account exists, THE Finance_Tracker SHALL display a Combined_Balance of MYR 0.00 and an empty-state message indicating that no active accounts exist.
9. IF an Account_Balance cannot be calculated because the Transactions cannot be read, THEN THE Finance_Tracker SHALL display an error indication on the affected account card, SHALL NOT display a balance value for that account, and SHALL display the Combined_Balance as unavailable.

### Requirement 4: Create Income and Expense Transactions

**User Story:** As a user, I want to record income and expenses, so that my account balances stay current.

#### Acceptance Criteria

1. WHEN the user submits a title of 1 to 100 characters after trimming whitespace, an amount from 0.01 to 999,999,999.99 with at most two fraction digits, a type of Income or Expense, an Active_Account, a date, and a time, THE Transaction_Manager SHALL create an Income or Expense Transaction and persist it through the Storage_Layer.
2. WHEN the Transaction_Form opens, THE Transaction_Form SHALL default the date to the current local date and the time to the current local time.
3. THE Transaction_Form SHALL limit the title input to 100 characters and SHALL treat the title as valid only if its length after trimming leading and trailing whitespace is 1 to 100 characters.
4. IF the title is empty after trimming whitespace, THEN THE Transaction_Manager SHALL reject the Transaction, SHALL NOT persist it, SHALL retain all other entered form values, and SHALL display a message stating that a title is required.
5. WHEN the user enters an amount, THE Money_Parser SHALL convert the entered decimal string into integer Sen without floating-point arithmetic.
6. IF the amount is zero, negative, not a valid decimal with at most two fraction digits, or greater than 99,999,999,999 Sen, THEN THE Transaction_Manager SHALL reject the Transaction, SHALL NOT persist it, SHALL retain all entered form values, and SHALL display a message describing which of these conditions failed.
7. IF no Account is selected, THEN THE Transaction_Manager SHALL reject the Transaction, SHALL NOT persist it, SHALL retain all entered form values, and SHALL display a message stating that an Account is required.
8. WHEN a Transaction is created, THE Transaction_Manager SHALL store the date as a local `YYYY-MM-DD` string and the time as a local 24-hour `HH:mm` string.
9. WHEN an Income Transaction is created, THE Finance_Tracker SHALL add its amount in Sen to the Account_Balance of the selected Account.
10. WHEN an Expense Transaction is created, THE Finance_Tracker SHALL subtract its amount in Sen from the Account_Balance of the selected Account.
11. WHEN an Expense would make an Account_Balance negative, THE Transaction_Manager SHALL create the Transaction and SHALL store the resulting negative Account_Balance.
12. WHEN no Active_Account exists and the user activates the Floating_Action_Button, THE Finance_Tracker SHALL display a prompt to create an Account first and SHALL NOT open the Transaction_Form.
13. IF the Storage_Layer fails to persist a Transaction, THEN THE Transaction_Manager SHALL NOT change any Account_Balance, SHALL retain all entered form values, and SHALL display a message stating that the Transaction could not be saved.

### Requirement 5: Create Transfers

**User Story:** As a user, I want to move money between my own accounts, so that my balances match where the money actually is.

#### Acceptance Criteria

1. WHEN the user submits a source Account, a different destination Account, an amount, a date and a time that pass the validation rules in criterion 5, THE Transaction_Manager SHALL create exactly one Transfer record containing both Account references and persist it through the Storage_Layer.
2. THE Transaction_Form SHALL default the Transfer title to "Transfer" and SHALL accept a user-edited title of 1 to 100 characters.
3. IF the user submits a Transfer title that is empty or longer than 100 characters, THEN THE Transaction_Manager SHALL reject the Transfer, display a message indicating the allowed title length of 1 to 100 characters, and create no Transfer record.
4. IF the source Account and the destination Account are the same, THEN THE Transaction_Manager SHALL reject the Transfer, display a message stating that two different Accounts are required, create no Transfer record, and leave all Account_Balances unchanged.
5. THE Transaction_Manager SHALL validate the Transfer amount, date and time with the rules of Requirement 4, and IF validation fails, THEN THE Transaction_Manager SHALL reject the Transfer, display a message identifying the invalid field, create no Transfer record, and leave all Account_Balances unchanged.
6. WHEN a Transfer is created, THE Finance_Tracker SHALL subtract its amount from the Account_Balance of the source Account and add the same amount to the Account_Balance of the destination Account.
7. WHEN a Transfer is created between two Active_Accounts, THE Finance_Tracker SHALL keep the Combined_Balance equal to its value before the Transfer.
8. THE Finance_Tracker SHALL exclude Transfers from Total_Income, Total_Expenses and Net_Cash_Flow.
9. WHERE the user attaches a Receipt to a Transfer, THE Transaction_Form SHALL accept it and THE Transaction_Manager SHALL store it with the Transfer under the Receipt rules of Requirement 9; the Receipt SHALL be optional, and a Transfer without a Receipt SHALL be accepted.
10. IF the Storage_Layer fails to persist a Transfer, THEN THE Transaction_Manager SHALL display an error message indicating the Transfer was not saved, create no Transfer record, leave both Account_Balances unchanged, and retain the values the user entered in the Transaction_Form.

### Requirement 6: Edit, Delete and View Transactions

**User Story:** As a user, I want to view, edit and delete transactions, so that I can correct mistakes.

#### Acceptance Criteria

1. WHEN the user selects a Transaction, THE Finance_Tracker SHALL display the Transaction_Details with title, kind, amount, Account (or source and destination Accounts), date, time and Receipt status within 500 ms of the selection.
2. WHEN the user submits changes to a Transaction, THE Transaction_Manager SHALL validate the values with the rules of Requirements 4 and 5, persist the changes and display the updated Transaction_Details within 1 second of submission.
3. IF validation of submitted changes fails, THEN THE Transaction_Manager SHALL reject the submission, leave the stored Transaction unchanged, keep the entered values in the Transaction_Form and display an error message identifying each invalid field.
4. WHEN a Transaction is edited, THE Finance_Tracker SHALL recompute all Account_Balance values, the Combined_Balance, the History_View and the Cash_Flow_View from the updated data within 1 second of the persisted change.
5. WHEN the user requests deletion of a Transaction, THE Transaction_Manager SHALL display a confirmation prompt that offers confirm and cancel actions and SHALL leave the Transaction unchanged until the user chooses one.
6. WHEN the user cancels the deletion confirmation, THE Transaction_Manager SHALL close the prompt and keep the Transaction and its attached Receipt unchanged.
7. WHEN the user confirms deletion of a Transaction, THE Transaction_Manager SHALL remove the Transaction and its attached Receipt in a single IndexedDB transaction, so that either both are removed or neither is removed.
8. WHEN a Transaction is deleted, THE Finance_Tracker SHALL recompute all Account_Balance values, the Combined_Balance, the History_View and the Cash_Flow_View within 1 second of the persisted deletion.
9. WHEN the user edits a Transaction that references an Archived_Account, THE Transaction_Form SHALL keep the Archived_Account selected and list it as a selectable option for that Transaction only.
10. IF a persistence operation fails, THEN THE Finance_Tracker SHALL leave the stored data unchanged, keep the displayed Account_Balance values, Combined_Balance, History_View and Cash_Flow_View unchanged, and display an error message indicating which action (edit or delete) failed.

### Requirement 7: Weekly History

**User Story:** As a user, I want my transactions grouped by week in expandable cards, so that I can review recent activity at a glance.

#### Acceptance Criteria

1. THE History_View SHALL group Transactions into Week_Cards by calendar week, with each week starting on Monday at 00:00:00 and ending on Sunday at 23:59:59 in the user's local time zone.
2. THE History_View SHALL order Week_Cards from the newest week to the oldest week.
3. THE History_View SHALL order Transactions within a Week_Card by date and time, newest first, and SHALL order Transactions with identical date and time by creation time, newest first.
4. THE Week_Card SHALL display the week date range (first and last date of the week) and the week Net_Cash_Flow (total Income minus total Expense, excluding Transfers) in its collapsed state.
5. WHEN the user activates a collapsed Week_Card, THE History_View SHALL expand the card and display each Transaction in that week with its title, amount, Account and date.
6. WHEN the user activates an expanded Week_Card, THE History_View SHALL collapse the card.
7. THE History_View SHALL display Income amounts with a positive sign and an income color, and Expense amounts with a negative sign and an expense color.
8. THE History_View SHALL display Transfers with a neutral color and style distinct from Income and Expense, showing both the source and destination Account names, and SHALL exclude Transfers from the Week_Card Net_Cash_Flow.
9. WHEN the user selects a month, THE History_View SHALL scroll to the newest Week_Card that contains a date in that month and SHALL make that Week_Card visible within 1 second.
10. WHEN the user activates the previous or next control, THE History_View SHALL navigate to the adjacent older or newer week or month respectively, according to the current navigation mode (week or month).
11. IF the user activates the next control while viewing the current week or current month, THEN THE History_View SHALL keep the current view unchanged and SHALL display the next control as disabled.
12. IF a selected week or month contains no Transactions, THEN THE History_View SHALL display an empty state message indicating that no Transactions exist for that period.
13. WHEN the user selects a Transaction in a Week_Card, THE Finance_Tracker SHALL display the Transaction_Details for that Transaction.
14. WHILE the History_View is loading data, THE History_View SHALL display a loading indicator and SHALL hide it when loading completes.
15. IF the History_View fails to load data, THEN THE History_View SHALL replace the loading indicator with an error message indicating that loading failed and SHALL provide a retry control.

### Requirement 8: Cash Flow Summary

**User Story:** As a user, I want daily, weekly and monthly cash flow summaries, so that I can see how much I earn and spend.

#### Acceptance Criteria

1. THE Cash_Flow_View SHALL provide a toggle with exactly three options (day, week, month) to select the Period, and WHEN the Cash_Flow_View is first opened, THE Cash_Flow_View SHALL select month as the Period and the current local calendar month as the displayed Period.
2. THE Cash_Flow_View SHALL display Total_Income, Total_Expenses and Net_Cash_Flow for the selected Period, each formatted with two decimal places.
3. THE Finance_Tracker SHALL calculate Net_Cash_Flow as Total_Income minus Total_Expenses.
4. WHEN the user activates the previous or next control, THE Cash_Flow_View SHALL move the selected Period backward or forward by exactly one day, week or month according to the selected Period, and update Total_Income, Total_Expenses and Net_Cash_Flow for the new Period.
5. THE Cash_Flow_View SHALL define a week Period as the seven consecutive local calendar days from Monday 00:00 through Sunday 23:59:59.
6. THE Finance_Tracker SHALL exclude Transfers from Total_Income, Total_Expenses and Net_Cash_Flow.
7. THE Finance_Tracker SHALL include Transactions of Archived_Accounts in Total_Income and Total_Expenses.
8. IF Net_Cash_Flow is less than zero, THEN THE Cash_Flow_View SHALL display Net_Cash_Flow with a leading minus sign in the expense color.
9. IF Net_Cash_Flow is greater than zero, THEN THE Cash_Flow_View SHALL display Net_Cash_Flow in the income color.
10. IF a Period contains no Income or Expense Transactions, THEN THE Cash_Flow_View SHALL display 0.00 for Total_Income, Total_Expenses and Net_Cash_Flow.
11. WHEN a Transaction is created, edited or deleted, THE Cash_Flow_View SHALL update Total_Income, Total_Expenses and Net_Cash_Flow within 1 second without a manual refresh.
12. THE Finance_Tracker SHALL assign each Transaction to Periods using its stored local `YYYY-MM-DD` date, treating the first and last day of a Period as inclusive.

### Requirement 9: Receipts

**User Story:** As a user, I want to attach receipts to transactions and view them later, so that I keep proof of my spending.

#### Acceptance Criteria

1. WHEN the user selects a file to attach as a Receipt, THE Receipt_Store SHALL accept the file if its type is JPG, JPEG, PNG or PDF.
2. IF the selected file is not of type JPG, JPEG, PNG or PDF, THEN THE Receipt_Store SHALL reject the file, display a message listing the accepted types, and leave the Transaction's existing Receipt unchanged.
3. IF the selected file is larger than 5 MB (5,242,880 bytes) after any compression is applied, THEN THE Receipt_Store SHALL reject the file, display a message stating the 5 MB limit, and leave the Transaction's existing Receipt unchanged.
4. WHEN the user attaches a JPG, JPEG or PNG Receipt larger than 5 MB, THE Receipt_Store SHALL compress the image before applying the size check.
5. WHEN the Transaction is saved with a Receipt, THE Receipt_Store SHALL store the file in a store separate from Transactions, and THE Transaction SHALL reference the file by a unique identifier.
6. WHEN the user opens a Transaction that has a Receipt, THE Finance_Tracker SHALL display an image Receipt as an image preview and SHALL open a PDF Receipt in the browser's native viewer.
7. WHEN the user replaces or removes a Receipt on a Transaction and the change is saved, THE Receipt_Store SHALL delete the previous Receipt file so that it can no longer be retrieved by its former identifier.
8. WHEN the user closes a Receipt preview, THE Finance_Tracker SHALL revoke the object URL created for that preview.
9. WHEN the user opens the Receipts view, THE Finance_Tracker SHALL list every Transaction that has a Receipt and no Transaction without a Receipt.
10. WHEN the user selects an entry in the Receipts view, THE Finance_Tracker SHALL display that entry's Receipt using the same display behavior as criterion 6.
11. IF a Receipt cannot be read from the Storage_Layer, THEN THE Finance_Tracker SHALL display an error message indicating the Receipt could not be loaded, keep the Transaction visible with its other data unchanged, and keep the Receipts view usable.

### Requirement 10: Money Handling

**User Story:** As a user, I want exact money calculations, so that balances and totals are never off by rounding errors.

#### Acceptance Criteria

1. THE Finance_Tracker SHALL represent every monetary amount as a signed integer number of Sen within the range -99,999,999,999 to 99,999,999,999 (inclusive).
2. WHEN the Money_Parser receives a decimal string with an optional leading sign, 1 to 9 integer digits, and 0 to 2 fraction digits, THE Money_Parser SHALL return the exact integer Sen value (for example, "12.5" returns 1250 and "0.05" returns 5).
3. IF the input string is empty, contains any character other than digits, one decimal point and an optional leading sign, has more than two fraction digits, has more than 9 integer digits, or has a leading sign where the calling field permits only non-negative amounts, THEN THE Money_Parser SHALL return an error result identifying the rejection reason and SHALL leave the existing stored amount unchanged.
4. WHEN the Money_Formatter receives a Sen value, THE Money_Formatter SHALL return a MYR string formatted with the `en-MY` locale, always showing exactly two fraction digits (for example, 123456 returns "RM1,234.56").
5. FOR ALL Sen values within the range defined in criterion 1, formatting then parsing SHALL produce the original Sen value (round-trip property).
6. FOR ALL valid decimal strings accepted by criterion 2, parsing then formatting then parsing SHALL produce the same Sen value as the first parse (round-trip property).
7. THE Finance_Tracker SHALL calculate Account_Balance, Combined_Balance, Total_Income, Total_Expenses and Net_Cash_Flow using integer arithmetic only, with no floating-point intermediate values.
8. IF a calculated result falls outside the range defined in criterion 1, THEN THE Finance_Tracker SHALL reject the operation that caused it, display an error indicating the amount limit was exceeded, and SHALL leave all stored Transactions and balances unchanged.
9. FOR ALL sets of Transactions, THE Finance_Tracker SHALL produce an Account_Balance sum over all Accounts equal to the sum of Starting_Balance values plus Income minus Expense, independent of Transfers (invariant property).
10. FOR ALL orderings of the same set of Transactions, THE Finance_Tracker SHALL produce identical Account_Balance, Total_Income, Total_Expenses and Net_Cash_Flow values (confluence property).

### Requirement 11: Local Data Persistence

**User Story:** As a user, I want my data to stay on my device, so that I keep my finances private and available offline.

#### Acceptance Criteria

1. WHEN an Account, Transaction or Receipt is created or modified, THE Storage_Layer SHALL write it to IndexedDB in the user's browser and complete the write within 500 ms.
2. THE Finance_Tracker SHALL operate without network requests, a backend, authentication, cloud sync, bank APIs or payment processing, and SHALL issue 0 network requests during startup and during all create, read, update and delete operations.
3. WHEN the Finance_Tracker starts, THE Finance_Tracker SHALL request persistent storage from the browser.
4. IF the browser denies the persistent storage request, THEN THE Finance_Tracker SHALL continue to operate with the stored data unchanged and SHALL display a notice that the browser may delete stored data under storage pressure.
5. WHEN the Finance_Tracker starts, THE Storage_Layer SHALL load all stored Accounts, Transactions and Receipts, and THE Finance_Tracker SHALL display the previously saved data within 2 seconds for up to 10,000 Transactions.
6. WHEN the Storage_Layer database schema version increases, THE Storage_Layer SHALL apply explicit migration steps that preserve 100% of existing Accounts, Transactions and Receipts, with no record lost or altered in content other than fields the migration defines.
7. IF a schema migration fails, THEN THE Storage_Layer SHALL roll back to the pre-migration data, THE Finance_Tracker SHALL display an error message indicating that the migration failed, and THE Finance_Tracker SHALL NOT present the data-entry screens as functional.
8. IF IndexedDB is unavailable or fails to open, THEN THE Finance_Tracker SHALL display an error message stating that data cannot be stored and SHALL NOT present the data-entry screens as functional.
9. IF a write to IndexedDB fails, THEN THE Storage_Layer SHALL leave previously stored data unchanged and THE Finance_Tracker SHALL display an error message indicating that the change was not saved.
10. THE Storage_Layer SHALL assign each Account, Transaction and Receipt a unique identifier generated with `crypto.randomUUID()` at creation, and SHALL NOT change the identifier on later modification.
11. THE Finance_Tracker SHALL derive balances and summaries from stored Accounts and Transactions at read time, and SHALL NOT store balances or summaries as persisted values.

### Requirement 12: Navigation and Layout

**User Story:** As a user, I want clean, one-handed navigation on my phone that also works on desktop, so that I can record spending quickly anywhere.

#### Acceptance Criteria

1. THE Finance_Tracker SHALL provide a Tab_Bar fixed to the bottom edge of the viewport that contains exactly four tabs, labeled Accounts, History, Cash Flow and Receipts, and that remains visible while the active view scrolls.
2. WHEN the user activates a tab in the Tab_Bar, THE Finance_Tracker SHALL display the corresponding view within 300 milliseconds and SHALL visually mark that tab as active with a style and an accessible current-state indication that do not depend on color alone.
3. WHILE the Accounts, History or Cash Flow view is displayed, THE Finance_Tracker SHALL display a Floating_Action_Button in the bottom-right area of the viewport, positioned above the Tab_Bar without overlapping it.
4. WHEN the user activates the Floating_Action_Button, THE Finance_Tracker SHALL open the Transaction_Form within 300 milliseconds with exactly three type options: Income, Expense and Transfer.
5. THE Finance_Tracker SHALL render Accounts, Week_Cards and summaries as cards, each with a visible container boundary (border or shadow), uniform padding of at least 12 CSS pixels, and no more than one level of nested cards.
6. THE Finance_Tracker SHALL display Income in green with a "+" sign, Expense in red with a "-" sign, and Transfer in a neutral gray with a "Transfer" label, so that meaning does not depend on color alone.
7. THE Finance_Tracker SHALL size every interactive control to at least 44 by 44 CSS pixels, with at least 8 CSS pixels of spacing between adjacent controls.
8. THE Finance_Tracker SHALL lay out its base styles for a viewport width of 360 CSS pixels without horizontal scrolling at any width from 360 CSS pixels up to 767 CSS pixels.
9. WHEN the viewport width is 768 CSS pixels or greater, THE Finance_Tracker SHALL display the content in a horizontally centered column with a maximum width of 960 CSS pixels, or in a multi-column layout of two or more columns.
10. THE Finance_Tracker SHALL provide a programmatically associated text label for every form input, use semantic HTML elements for navigation, headings, lists and buttons, and display a visible focus indicator with at least a 3:1 contrast ratio against adjacent colors on every keyboard-focusable control.
11. WHERE the user's system enables the reduced-motion preference, THE Finance_Tracker SHALL disable all non-essential animations and transitions, including tab transitions and Transaction_Form opening effects.
12. WHEN an asynchronous view completes loading with zero records, THE Finance_Tracker SHALL display an empty state containing a text message describing the absence of data and, where the view supports adding records, a prompt to add one.
13. WHILE an asynchronous view is loading, THE Finance_Tracker SHALL display a loading indicator in place of the view content.
14. IF an asynchronous view fails to load, THEN THE Finance_Tracker SHALL display an error message indicating that loading failed, SHALL provide a retry control, and SHALL leave previously saved data unchanged.
15. WHEN the user begins a destructive action, THE Finance_Tracker SHALL display a confirmation dialog naming the item to be affected, with distinct confirm and cancel controls, and SHALL perform the action only after the user activates confirm.
16. WHEN the user activates cancel or dismisses the confirmation dialog, THE Finance_Tracker SHALL close the dialog and SHALL leave all data unchanged.

### Requirement 13: Architecture and Testability

**User Story:** As a developer, I want a layered, minimal-dependency codebase with tested financial logic, so that the application stays maintainable and correct.

#### Acceptance Criteria

1. THE Finance_Tracker SHALL separate code into a domain layer of pure TypeScript functions that perform no IndexedDB access, no DOM access and no React imports, a data layer that alone accesses IndexedDB, and a user interface layer that accesses data only through hooks and makes zero direct calls to the data layer's IndexedDB functions.
2. THE Finance_Tracker SHALL declare exactly three entries, `react`, `react-dom` and `idb`, in the `dependencies` section of `package.json`, and SHALL declare all other packages, including `vitest` and `fake-indexeddb`, only in `devDependencies`.
3. THE Finance_Tracker SHALL compile with TypeScript `strict` mode enabled, zero compiler errors and zero explicit or implicit uses of the `any` type in source and test files.
4. THE Finance_Tracker SHALL provide five reusable presentational components, a button, a modal, a tab bar, a card and an empty state, each of which accepts data and callbacks through props and performs no data layer access.
5. THE Finance_Tracker SHALL provide unit tests for money parsing, money formatting, Account_Balance, Combined_Balance, week grouping, Period boundaries, Total_Income, Total_Expenses, Net_Cash_Flow and Transfer exclusion, with at least one passing test for each of the ten listed functions and at least one test of an empty input for each calculation.
6. THE Finance_Tracker SHALL provide unit tests for week and month boundary dates that cover the Sunday-to-Monday week transition, the last day of a 28-day February, the last day of a 29-day February in a leap year, the last day of a 30-day month, the last day of a 31-day month and the December 31 to January 1 year transition.
7. THE Finance_Tracker SHALL provide repository tests that run against `fake-indexeddb` and cover create, read, update and delete operations for each repository, without using a real browser IndexedDB instance.
8. WHEN the command `vitest --run` is executed, THE Finance_Tracker SHALL run all tests once, exit with code 0 if all tests pass, and exit with a non-zero code if any test fails.
9. IF any test fails when `vitest --run` is executed, THEN THE Finance_Tracker SHALL report the name of each failing test in the command output.
