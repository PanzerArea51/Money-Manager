import { parseLocalDate, parseLocalTime } from './date';
import { MAX_SEN, parseMoney } from './money';
import type {
  AccountInput,
  AccountType,
  FieldErrors,
  Result,
  Sen,
  TransactionInput,
  TransactionKind,
} from './types';

export const MAX_ACCOUNT_NAME_LENGTH = 50;
export const MAX_TITLE_LENGTH = 100;
export const MAX_RECEIPT_BYTES = 5_242_880;

const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'e-wallet'];
const RECEIPT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'application/pdf'];

export type AccountDraft = { name: string; type: string; startingBalance: string };

export type TransactionDraft = {
  kind: TransactionKind;
  title: string;
  amount: string;
  date: string;
  time: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
};

function isAccountType(s: string): s is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(s);
}

function validTrimmedLength(s: string, max: number): boolean {
  const len = s.trim().length;
  return len >= 1 && len <= max;
}

function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function validateAccountInput(d: AccountDraft): Result<AccountInput, FieldErrors<AccountDraft>> {
  const errors: FieldErrors<AccountDraft> = {};

  if (!validTrimmedLength(d.name, MAX_ACCOUNT_NAME_LENGTH)) errors.name = 'name-length';

  if (!isAccountType(d.type)) errors.type = 'invalid-type';

  const balance = parseMoney(d.startingBalance, { allowNegative: true });
  if (!balance.ok) errors.startingBalance = balance.error;

  if (hasErrors(errors) || !balance.ok || !isAccountType(d.type)) return { ok: false, error: errors };
  return {
    ok: true,
    value: { name: d.name.trim(), type: d.type, openingBalance: balance.value },
  };
}

type AccountField = 'accountId' | 'fromAccountId' | 'toAccountId';

function checkAccount(
  id: string | undefined,
  selectable: ReadonlySet<string>,
): 'required' | 'not-selectable' | undefined {
  if (id === undefined || id === '') return 'required';
  return selectable.has(id) ? undefined : 'not-selectable';
}

export function validateTransactionInput(
  d: TransactionDraft,
  selectableAccountIds: ReadonlySet<string>,
): Result<TransactionInput, FieldErrors<TransactionDraft>> {
  const errors: FieldErrors<TransactionDraft> = {};

  if (!validTrimmedLength(d.title, MAX_TITLE_LENGTH)) errors.title = 'title-length';

  const amount = parseMoney(d.amount, { allowNegative: false });
  if (!amount.ok) errors.amount = amount.error;
  else if (amount.value <= 0) errors.amount = 'must-be-positive';
  else if (amount.value > MAX_SEN) errors.amount = 'out-of-range';

  const date = parseLocalDate(d.date);
  if (!date.ok) errors.date = date.error;

  const time = parseLocalTime(d.time);
  if (!time.ok) errors.time = time.error;

  const fields: AccountField[] = d.kind === 'transfer' ? ['fromAccountId', 'toAccountId'] : ['accountId'];
  for (const field of fields) {
    const err = checkAccount(d[field], selectableAccountIds);
    if (err !== undefined) errors[field] = err;
  }
  if (
    d.kind === 'transfer' &&
    errors.fromAccountId === undefined &&
    errors.toAccountId === undefined &&
    d.fromAccountId === d.toAccountId
  ) {
    errors.toAccountId = 'same-account';
  }

  if (hasErrors(errors) || !amount.ok || !date.ok || !time.ok) return { ok: false, error: errors };

  const base = {
    title: d.title.trim(),
    amount: amount.value as Sen,
    date: date.value,
    time: time.value,
  };
  if (d.kind === 'transfer') {
    return {
      ok: true,
      value: {
        ...base,
        kind: 'transfer',
        fromAccountId: d.fromAccountId as string,
        toAccountId: d.toAccountId as string,
      },
    };
  }
  return { ok: true, value: { ...base, kind: d.kind, accountId: d.accountId as string } };
}

export function validateReceiptFile(f: {
  type: string;
  size: number;
}): Result<void, 'unsupported-type' | 'too-large'> {
  if (!RECEIPT_TYPES.includes(f.type)) return { ok: false, error: 'unsupported-type' };
  if (f.size > MAX_RECEIPT_BYTES) return { ok: false, error: 'too-large' };
  return { ok: true, value: undefined };
}
