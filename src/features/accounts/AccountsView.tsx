import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { formatMoney } from '../../domain/money';
import type { Sen } from '../../domain/types';
import { useAccounts } from '../../hooks/useAccounts';
import type { BalanceState } from '../../hooks/useAccounts';
import { useFinance } from '../../hooks/FinanceProvider';
import { AccountCard } from './AccountCard';
import { AccountForm } from './AccountForm';
import { DeleteBlockedDialog } from './DeleteBlockedDialog';
import './AccountsView.css';

/** `null` = closed, `'new'` = create, otherwise the id of the account being edited. */
type FormTarget = null | 'new' | string;

type PendingAction =
  | { kind: 'archive'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'blocked'; id: string; count: number };

function CombinedBalance({ combined }: { combined: BalanceState }) {
  const value: Sen | null = combined === 'unavailable' || !combined.ok ? null : combined.value;
  const className =
    value !== null && value < 0
      ? 'accounts-view__combined-value accounts-view__combined-value--negative'
      : 'accounts-view__combined-value';
  return (
    <section className="accounts-view__combined" aria-label="Combined balance">
      <span className="accounts-view__combined-label">Combined balance</span>
      {value === null ? (
        <span className="accounts-view__combined-unavailable" role="alert">
          Unavailable
        </span>
      ) : (
        <span className={className}>{formatMoney(value)}</span>
      )}
    </section>
  );
}

export function AccountsView() {
  const { status, reload } = useFinance();
  const accounts = useAccounts();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <p className="accounts-view__status" role="status">
        Loading accounts…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <div className="accounts-view__status" role="alert">
        <p>Your accounts could not be loaded.</p>
        <Button onClick={() => void reload()}>Retry</Button>
      </div>
    );
  }

  const all = [...accounts.active, ...accounts.archived];
  const editing =
    formTarget !== null && formTarget !== 'new' ? all.find((a) => a.id === formTarget) : undefined;
  const closeForm = () => setFormTarget(null);
  const pendingAccount = pending ? all.find((a) => a.id === pending.id) : undefined;

  /** Closes the edit form so only one dialog is open at a time. */
  function startAction(action: PendingAction) {
    setFormTarget(null);
    setPending(action);
  }

  async function archive(id: string) {
    const result = await accounts.archiveAccount(id);
    setPending(null);
    if (!result.ok) setActionError(result.message);
  }

  async function restore(id: string) {
    const result = await accounts.restoreAccount(id);
    if (result.ok) closeForm();
    else setActionError(result.message);
  }

  async function remove(id: string) {
    const result = await accounts.deleteAccount(id);
    if (result.ok) {
      setPending(null);
    } else if (result.blockingCount !== undefined) {
      setPending({ kind: 'blocked', id, count: result.blockingCount });
    } else {
      setPending(null);
      setActionError(result.message);
    }
  }

  return (
    <div className="accounts-view">
      <CombinedBalance combined={accounts.combined} />

      <div className="accounts-view__toolbar">
        <Button onClick={() => setFormTarget('new')}>Add account</Button>
      </div>

      {accounts.active.length === 0 ? (
        <EmptyState
          message="No active accounts yet."
          actionLabel="Add your first account"
          onAction={() => setFormTarget('new')}
        />
      ) : (
        <ul className="accounts-view__list" aria-label="Active accounts">
          {accounts.active.map((account) => (
            <li key={account.id}>
              <AccountCard account={account} onSelect={() => setFormTarget(account.id)} />
            </li>
          ))}
        </ul>
      )}

      <div className="accounts-view__toolbar">
        <Button
          variant="secondary"
          onClick={() => setShowArchived((shown) => !shown)}
        >
          {showArchived ? 'Hide archived accounts' : `Show archived accounts (${accounts.archived.length})`}
        </Button>
      </div>

      {showArchived ? (
        <section aria-labelledby="accounts-view-archived-heading">
          <h2 id="accounts-view-archived-heading" className="accounts-view__heading">
            Archived accounts
          </h2>
          {accounts.archived.length === 0 ? (
            <EmptyState message="No archived accounts." />
          ) : (
            <ul className="accounts-view__list">
              {accounts.archived.map((account) => (
                <li key={account.id}>
                  <AccountCard account={account} onSelect={() => setFormTarget(account.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {formTarget === 'new' ? (
        <Modal title="Add account" onClose={closeForm}>
          <AccountForm
            onCancel={closeForm}
            onSubmit={async (draft) => {
              const result = await accounts.createAccount(draft);
              if (result.ok) closeForm();
              return result;
            }}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit account" onClose={closeForm}>
          <AccountForm
            account={editing}
            onCancel={closeForm}
            onSubmit={async (draft) => {
              const result = await accounts.updateAccount(editing.id, draft);
              if (result.ok) closeForm();
              return result;
            }}
          />
          <div className="accounts-view__manage">
            {editing.archived ? (
              <Button variant="secondary" onClick={() => void restore(editing.id)}>
                Restore account
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => startAction({ kind: 'archive', id: editing.id })}
              >
                Archive account
              </Button>
            )}
            <Button variant="danger" onClick={() => startAction({ kind: 'delete', id: editing.id })}>
              Delete account
            </Button>
          </div>
        </Modal>
      ) : null}

      {pendingAccount && pending?.kind === 'archive' ? (
        <ConfirmDialog
          title="Archive account?"
          itemName={pendingAccount.name}
          message="It will be hidden from the active list and left out of the combined balance. Its transactions are kept, and you can restore it later."
          confirmLabel="Archive"
          onConfirm={() => void archive(pendingAccount.id)}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pendingAccount && pending?.kind === 'delete' ? (
        <ConfirmDialog
          title="Delete account?"
          itemName={pendingAccount.name}
          message="This permanently deletes the account. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => void remove(pendingAccount.id)}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pendingAccount && pending?.kind === 'blocked' ? (
        <DeleteBlockedDialog
          accountName={pendingAccount.name}
          transactionCount={pending.count}
          onArchive={() => void archive(pendingAccount.id)}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {actionError ? (
        <Modal title="Action failed" onClose={() => setActionError(null)}>
          <p role="alert">{actionError}</p>
          <Button onClick={() => setActionError(null)}>Close</Button>
        </Modal>
      ) : null}
    </div>
  );
}
