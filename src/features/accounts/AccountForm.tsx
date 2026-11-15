import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import type { Account, FieldErrors } from '../../domain/types';
import { MAX_ACCOUNT_NAME_LENGTH } from '../../domain/validation';
import type { AccountDraft } from '../../domain/validation';
import type { AccountActionResult } from '../../hooks/useAccounts';
import './AccountForm.css';

type AccountFormProps = {
  /** Present in edit mode. */
  account?: Account;
  onSubmit: (draft: AccountDraft) => Promise<AccountActionResult>;
  onCancel: () => void;
};

const TYPE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'e-wallet', label: 'E-wallet' },
] as const;

/** Integer-only conversion from sen to an editable decimal string such as "-12.50". */
function senToInputString(sen: number): string {
  const abs = Math.abs(sen);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sen < 0 ? '-' : ''}${Math.floor(abs / 100)}.${fraction}`;
}

function initialDraft(account?: Account): AccountDraft {
  if (!account) return { name: '', type: 'cash', startingBalance: '0.00' };
  return {
    name: account.name,
    type: account.type,
    startingBalance: senToInputString(account.openingBalance),
  };
}

function nameMessage(name: string): string {
  return name.trim().length === 0
    ? 'A name is required.'
    : `The name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`;
}

function balanceMessage(key: string): string {
  if (key === 'out-of-range' || key === 'too-many-integer-digits') {
    return 'The amount is too large. The maximum is RM 999,999,999.99.';
  }
  return 'Enter an amount such as 120.50 or -35, with at most two decimal places.';
}

function fieldMessages(errors: FieldErrors<AccountDraft>, draft: AccountDraft) {
  return {
    name: errors.name === undefined ? undefined : nameMessage(draft.name),
    type:
      errors.type === undefined ? undefined : 'Choose one of the types: cash, bank or e-wallet.',
    startingBalance:
      errors.startingBalance === undefined ? undefined : balanceMessage(errors.startingBalance),
  };
}

export function AccountForm({ account, onSubmit, onCancel }: AccountFormProps) {
  const id = useId();
  const [draft, setDraft] = useState<AccountDraft>(() => initialDraft(account));
  const [errors, setErrors] = useState<FieldErrors<AccountDraft>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const messages = fieldMessages(errors, draft);

  function update(patch: Partial<AccountDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const result = await onSubmit(draft);
    setSaving(false);
    // On success the parent closes the form; on failure the entered values stay.
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setFormError(result.errors ? null : result.message);
    }
  }

  const nameId = `${id}-name`;
  const typeId = `${id}-type`;
  const balanceId = `${id}-balance`;

  return (
    <form className="account-form" onSubmit={handleSubmit} noValidate>
      <div className="account-form__field">
        <label htmlFor={nameId}>Name</label>
        <input
          id={nameId}
          type="text"
          value={draft.name}
          autoComplete="off"
          aria-invalid={messages.name !== undefined}
          aria-describedby={messages.name ? `${nameId}-error` : undefined}
          onChange={(e) => update({ name: e.target.value })}
        />
        {messages.name ? (
          <p id={`${nameId}-error`} className="account-form__error" role="alert">
            {messages.name}
          </p>
        ) : null}
      </div>

      <div className="account-form__field">
        <label htmlFor={typeId}>Type</label>
        <select
          id={typeId}
          value={draft.type}
          aria-invalid={messages.type !== undefined}
          aria-describedby={messages.type ? `${typeId}-error` : undefined}
          onChange={(e) => update({ type: e.target.value })}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {messages.type ? (
          <p id={`${typeId}-error`} className="account-form__error" role="alert">
            {messages.type}
          </p>
        ) : null}
      </div>

      <div className="account-form__field">
        <label htmlFor={balanceId}>Starting balance (RM)</label>
        <input
          id={balanceId}
          type="text"
          inputMode="decimal"
          value={draft.startingBalance}
          autoComplete="off"
          aria-invalid={messages.startingBalance !== undefined}
          aria-describedby={messages.startingBalance ? `${balanceId}-error` : undefined}
          onChange={(e) => update({ startingBalance: e.target.value })}
        />
        {messages.startingBalance ? (
          <p id={`${balanceId}-error`} className="account-form__error" role="alert">
            {messages.startingBalance}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p className="account-form__error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="account-form__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {account ? 'Save changes' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}
