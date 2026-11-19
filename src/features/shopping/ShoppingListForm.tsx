import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { todayLocal } from '../../domain/date';
import { MAX_ITEM_NAME_LENGTH } from '../../domain/shopping';
import type { ShoppingListDraft } from '../../domain/shopping';
import type { Account, ReceiptChange, Sen, ShoppingItem, ShoppingList } from '../../domain/types';
import { MAX_TITLE_LENGTH } from '../../domain/validation';
import type { ActionResult } from '../../hooks/actionResult';
import { ReceiptPicker } from '../receipts/ReceiptPicker';
import './ShoppingListForm.css';

export type ShoppingListFormProps = {
  /** Accounts the user may pick: active accounts plus the list's current one. */
  accounts: readonly Account[];
  /** When set, the form edits this list; otherwise it creates one. */
  list?: ShoppingList;
  /** True when the list is completed: wallet, price and receipt are edited on the transaction. */
  locked?: boolean;
  onSubmit: (
    draft: ShoppingListDraft,
    receipt: ReceiptChange,
  ) => Promise<ActionResult<ShoppingListDraft>>;
  onCancel: () => void;
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'title-length': `Enter a title of 1 to ${MAX_TITLE_LENGTH} characters.`,
  'invalid-date': 'Enter a valid date.',
  'item-length': `Each item needs 1 to ${MAX_ITEM_NAME_LENGTH} characters.`,
  'too-many-items': 'This list has too many items.',
  'not-selectable': 'Choose an active wallet.',
  'invalid-characters': 'Use digits and one decimal point only.',
  'too-many-fraction-digits': 'Use at most two decimal places.',
  'too-many-integer-digits': 'Price is too large.',
  'must-be-positive': 'Price must be greater than zero.',
  'out-of-range': 'Price is too large.',
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

function initialDraft(list: ShoppingList | undefined): ShoppingListDraft {
  if (list === undefined) {
    return { title: '', date: todayLocal(), items: [], accountId: '', price: '' };
  }
  return {
    title: list.title,
    date: list.date,
    items: list.items,
    accountId: list.accountId ?? '',
    price: list.price === undefined ? '' : senToInputString(list.price),
  };
}

export function ShoppingListForm({ accounts, list, locked = false, onSubmit, onCancel }: ShoppingListFormProps) {
  const uid = useId();
  const [draft, setDraft] = useState<ShoppingListDraft>(() => initialDraft(list));
  const [newItem, setNewItem] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ShoppingListDraft, string>>>({});
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptChange>({ type: 'keep' });

  const isEdit = list !== undefined;

  function setField(field: 'title' | 'date' | 'accountId' | 'price', value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  /** Returns the items including any text still waiting in the "new item" box. */
  function itemsWithPending(): ShoppingItem[] {
    const name = newItem.trim();
    if (name === '') return draft.items;
    return [...draft.items, { id: crypto.randomUUID(), name, bought: false }];
  }

  function addItem() {
    const items = itemsWithPending();
    setDraft((d) => ({ ...d, items }));
    setNewItem('');
  }

  function removeItem(id: string) {
    setDraft((d) => ({ ...d, items: d.items.filter((item) => item.id !== id) }));
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addItem();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const result = await onSubmit({ ...draft, items: itemsWithPending() }, receipt);
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

  function fieldProps(field: keyof ShoppingListDraft) {
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
  const date = fieldProps('date');
  const items = fieldProps('items');
  const account = fieldProps('accountId');
  const price = fieldProps('price');

  return (
    <form className="shopping-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="shopping-form__field">
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
          <p id={title.errorId} className="shopping-form__error">
            {title.error}
          </p>
        )}
      </div>

      <div className="shopping-form__field">
        <label htmlFor={date.id}>Date</label>
        <input
          id={date.id}
          type="date"
          value={draft.date}
          onChange={(e) => setField('date', e.target.value)}
          {...date.aria}
        />
        {date.error !== undefined && (
          <p id={date.errorId} className="shopping-form__error">
            {date.error}
          </p>
        )}
      </div>

      <div className="shopping-form__field">
        <label htmlFor={items.id}>Items</label>
        <div className="shopping-form__add">
          <input
            id={items.id}
            type="text"
            value={newItem}
            maxLength={MAX_ITEM_NAME_LENGTH}
            placeholder="e.g. Milk"
            autoComplete="off"
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleItemKeyDown}
            {...items.aria}
          />
          <Button variant="secondary" onClick={addItem} disabled={newItem.trim() === ''}>
            Add item
          </Button>
        </div>
        {items.error !== undefined && (
          <p id={items.errorId} className="shopping-form__error">
            {items.error}
          </p>
        )}
        {draft.items.length === 0 ? (
          <p className="shopping-form__hint">No items yet.</p>
        ) : (
          <ul className="shopping-form__items">
            {draft.items.map((item) => (
              <li key={item.id} className="shopping-form__item">
                <span className="shopping-form__item-name">{item.name}</span>
                <Button variant="secondary" onClick={() => removeItem(item.id)}>
                  Remove
                  <span className="shopping-form__sr-only"> {item.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shopping-form__field">
        <label htmlFor={account.id}>Paid with (optional)</label>
        <select
          id={account.id}
          value={draft.accountId}
          disabled={locked}
          onChange={(e) => setField('accountId', e.target.value)}
          {...account.aria}
        >
          <option value="">No wallet</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.archived ? `${a.name} (archived)` : a.name}
            </option>
          ))}
        </select>
        {account.error !== undefined && (
          <p id={account.errorId} className="shopping-form__error">
            {account.error}
          </p>
        )}
      </div>

      <div className="shopping-form__field">
        <label htmlFor={price.id}>Price of the list, RM (optional)</label>
        <input
          id={price.id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={draft.price}
          disabled={locked}
          onChange={(e) => setField('price', e.target.value)}
          {...price.aria}
        />
        {price.error !== undefined && (
          <p id={price.errorId} className="shopping-form__error">
            {price.error}
          </p>
        )}
      </div>

      {locked ? (
        <p className="shopping-form__hint">
          This list is completed. Edit the wallet, price and receipt on its expense transaction in
          History.
        </p>
      ) : (
        <ReceiptPicker
          hasExisting={list?.receiptId !== undefined}
          value={receipt}
          onChange={setReceipt}
          disabled={saving}
        />
      )}

      {message !== undefined && (
        <p className="shopping-form__message" role="alert">
          {message}
        </p>
      )}

      <div className="shopping-form__actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add list'}
        </Button>
      </div>
    </form>
  );
}
