/** Integer sen (100 sen = RM 1.00). Range is +/- MAX_SEN (see money.ts). */
export type Sen = number & { readonly __brand: 'Sen' };

/** Local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

/** Local 24-hour time, `HH:mm`. */
export type LocalTime = string;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type LimitExceeded = 'limit-exceeded';

export type AccountType = 'cash' | 'bank' | 'e-wallet';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Sen;
  archived: boolean;
  createdAt: string;
};

type TransactionBase = {
  id: string;
  title: string;
  amount: Sen;
  date: LocalDate;
  time: LocalTime;
  receiptId?: string;
  createdAt: string;
};

export type IncomeTransaction = TransactionBase & { kind: 'income'; accountId: string };
export type ExpenseTransaction = TransactionBase & { kind: 'expense'; accountId: string };
export type TransferTransaction = TransactionBase & {
  kind: 'transfer';
  fromAccountId: string;
  toAccountId: string;
};
export type Transaction = IncomeTransaction | ExpenseTransaction | TransferTransaction;
export type TransactionKind = Transaction['kind'];

export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

export type Receipt = {
  id: string;
  blob: Blob;
  mimeType: ReceiptMimeType;
  fileName: string;
  size: number;
};

/** Validated account data, before the repository assigns id and createdAt. */
export type AccountInput = {
  name: string;
  type: AccountType;
  openingBalance: Sen;
};

type TransactionInputBase = {
  title: string;
  amount: Sen;
  date: LocalDate;
  time: LocalTime;
};

/** Validated transaction data, before the repository assigns id and createdAt. */
export type TransactionInput =
  | (TransactionInputBase & { kind: 'income' | 'expense'; accountId: string })
  | (TransactionInputBase & { kind: 'transfer'; fromAccountId: string; toAccountId: string });

/** Validated receipt data, before the repository assigns an id. */
export type ReceiptInput = {
  blob: Blob;
  mimeType: ReceiptMimeType;
  fileName: string;
  size: number;
};

export type ReceiptChange =
  | { type: 'keep' }
  | { type: 'remove' }
  | { type: 'replace'; receipt: ReceiptInput };

/** Maps each invalid field to a message key. */
export type FieldErrors<T> = { [K in keyof T]?: string };

export type PeriodUnit = 'day' | 'week' | 'month';

/** Inclusive on both ends. */
export type Period = { unit: PeriodUnit; start: LocalDate; end: LocalDate };
