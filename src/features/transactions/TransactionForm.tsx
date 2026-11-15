import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { selectableAccountIds } from '../../domain/accounts';
import { nowLocalTime, todayLocal } from '../../domain/date';
import type {
  Account,
  ReceiptChange,
  Sen,
  Transaction,
  TransactionKind,
} from '../../domain/types';
import { ReceiptPicker } from '../receipts/ReceiptPicker';
import { MAX_TITLE_LENGTH } from '../../domain/validation';
import type { TransactionDraft } from '../../domain/validation';
import type { ActionResult } from '../../hooks/actionResult';
import './TransactionForm.css';

const TRANSFER_TITLE = 'Transfer';
const KIND_OPTIONS: readonly { kind: TransactionKind; label: string }[] = [
  { kind: 'income', label: 'Income' },
  { kind: 'expense', label: 'Expense' },
  { kind: 'transfer', label: 'Transfer' },
];
type EntryField = 'title' | 'amount' | 'date' | 'time' | 'accountId' | 'fromAccountId' | 'toAccountId';

export type TransactionFormProps = {
  accounts: readonly Account[];
  /** When set, the form edits this transaction; otherwise it creates one. */
  transaction?: Transaction;
  /** Receives the raw draft. Validation happens in the hook. */
  onSubmit: (
    draft: TransactionDraft,
    receipt: ReceiptChange,
  ) => Promise<ActionResult<TransactionDraft>>;
  onCancel: () => void;
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'title-length': `Enter a title of 1 to ${MAX_TITLE_LENGTH} characters.`,
  empty: 'Enter an amount.',
  'invalid-characters': 'Use digits and one decimal point only.',
  'must-be-positive': 'Amount must be greater than zero.',
  'out-of-range': 'Amount is too large.',
  'invalid-date': 'Enter a valid date.',
  'invalid-time': 'Enter a valid time.',
  required: 'Choose an account.',
  'not-selectable': 'Choose an active account.',
  'same-account': 'Choose two different accounts.',
};
const FALLBACK_ERROR = 'Check this value.';

function errorText(key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  return ERROR_MESSAGES[key] ?? FALLBACK_ERROR;
}

/** Integer sen to a plain decimal string such as "12.50" (no float math). */
function senToInputString(value: Sen): string {
  const rm = Math.floor(value / 100);
  const sen = value % 100;
  return `${rm}.${sen < 10 ? '0' : ''}${sen}`;
}

function initialDraft(transaction: TransactionFormProps['transaction']): TransactionDraft {
  if (transaction === undefined) {
    return {
      kind: 'expense',
      title: '',
      amount: '',
      date: todayLocal(),
      time: nowLocalTime(),
      accountId: '',
      fromAccountId: '',
      toAccountId: '',
    };
  }
  if (transaction.kind === 'transfer') {
    return {
      kind: 'transfer',
      title: transaction.title,
      amount: senToInputString(transaction.amount),
      date: transaction.date,
      time: transaction.time,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
    };
  }
  return {
    kind: transaction.kind,
    title: transaction.title,
    amount: senToInputString(transaction.amount),
    date: transaction.date,
    time: transaction.time,
    accountId: transaction.accountId,
  };
}

export function TransactionForm({ accounts, transaction, onSubmit, onCancel }: TransactionFormProps) {
  const uid = useId();
  const [draft, setDraft] = useState<TransactionDraft>(() => initialDraft(transaction));
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionDraft, string>>>({});
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptChange>({ type: 'keep' });

  const selectable = selectableAccountIds(accounts, transaction);
  const choices = accounts.filter((a) => selectable.has(a.id));
  const isEdit = transaction !== undefined;

  function setField(field: EntryField, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function setKind(kind: TransactionKind) {
    setDraft((d) => {
      let title = d.title;
      if (kind === 'transfer' && title === '') title = TRANSFER_TITLE;
      else if (kind !== 'transfer' && d.kind === 'transfer' && title === TRANSFER_TITLE) title = '';
      return { ...d, kind, title };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const result = await onSubmit(draft, receipt);
      if (result.ok) {
        setErrors({});
      } else {
        setErrors(result.errors ?? {});
        setMessage(result.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function fieldProps(field: EntryField) {
    const id = `${uid}-${field}`;
    const error = errorText(errors[field]);
    return {
      id,
      error,
      errorId: `${id}-error`,
      aria: {
        'aria-invalid': error !== undefined,
        'aria-describedby': error !== undefined ? `${id}-error` : undefined,
      },
    };
  }

  const title = fieldProps('title');
  const amount = fieldProps('amount');
  const date = fieldProps('date');
  const time = fieldProps('time');
  const account = fieldProps('accountId');
  const from = fieldProps('fromAccountId');
  const to = fieldProps('toAccountId');
  const isTransfer = draft.kind === 'transfer';

  function accountSelect(
    label: string,
    props: ReturnType<typeof fieldProps>,
    field: 'accountId' | 'fromAccountId' | 'toAccountId',
    placeholder: string,
  ) {
    return (
      <div className="transaction-form__field">
        <label htmlFor={props.id}>{label}</label>
        <select
          id={props.id}
          value={draft[field] ?? ''}
          onChange={(e) => setField(field, e.target.value)}
          {...props.aria}
        >
          <option value="">{placeholder}</option>
          {choices.map((a) => (
            <option key={a.id} value={a.id}>
              {a.archived ? `${a.name} (archived)` : a.name}
            </option>
          ))}
        </select>
        {props.error !== undefined && (
          <p id={props.errorId} className="transaction-form__error">
            {props.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="transaction-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <fieldset className="transaction-form__kind">
        <legend>Type</legend>
        {KIND_OPTIONS.map(({ kind, label }) => (
          <label
            key={kind}
            className={`transaction-form__kind-option transaction-form__kind-option--${kind}`}
          >
            <input
              type="radio"
              name={`${uid}-kind`}
              value={kind}
              checked={draft.kind === kind}
              onChange={() => setKind(kind)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="transaction-form__field">
        <label htmlFor={title.id}>Title</label>
        <input
          id={title.id}
          type="text"
          value={draft.title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(e) => setField('title', e.target.value)}
          {...title.aria}
        />
        {title.error !== undefined && (
          <p id={title.errorId} className="transaction-form__error">
            {title.error}
          </p>
        )}
      </div>

      <div className="transaction-form__field">
        <label htmlFor={amount.id}>Amount (RM)</label>
        <input
          id={amount.id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={draft.amount}
          onChange={(e) => setField('amount', e.target.value)}
          {...amount.aria}
        />
        {amount.error !== undefined && (
          <p id={amount.errorId} className="transaction-form__error">
            {amount.error}
          </p>
        )}
      </div>

      <div className="transaction-form__row">
        <div className="transaction-form__field">
          <label htmlFor={date.id}>Date</label>
          <input
            id={date.id}
            type="date"
            value={draft.date}
            onChange={(e) => setField('date', e.target.value)}
            {...date.aria}
          />
          {date.error !== undefined && (
            <p id={date.errorId} className="transaction-form__error">
              {date.error}
            </p>
          )}
        </div>
        <div className="transaction-form__field">
          <label htmlFor={time.id}>Time</label>
          <input
            id={time.id}
            type="time"
            value={draft.time}
            onChange={(e) => setField('time', e.target.value)}
            {...time.aria}
          />
          {time.error !== undefined && (
            <p id={time.errorId} className="transaction-form__error">
              {time.error}
            </p>
          )}
        </div>
      </div>

      {isTransfer ? (
        <>
          {accountSelect('From account', from, 'fromAccountId', 'Select source account')}
          {accountSelect('To account', to, 'toAccountId', 'Select destination account')}
        </>
      ) : (
        accountSelect('Account', account, 'accountId', 'Select an account')
      )}

      <ReceiptPicker
        hasExisting={transaction?.receiptId !== undefined}
        value={receipt}
        onChange={setReceipt}
        disabled={saving}
      />

      {message !== undefined && (
        <p className="transaction-form__message" role="alert">
          {message}
        </p>
      )}

      <div className="transaction-form__actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  );
}
