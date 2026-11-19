import { useState } from 'react';
import { Button } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { FloatingActionButton } from './components/FloatingActionButton';
import { Modal } from './components/Modal';
import { PersistenceNotice } from './components/PersistenceNotice';
import { TabBar } from './components/TabBar';
import type { TabItem } from './components/TabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import type { ShoppingList, Transaction } from './domain/types';
import { AccountsView } from './features/accounts/AccountsView';
import { ReceiptsView } from './features/receipts/ReceiptsView';
import { ShoppingView } from './features/shopping/ShoppingView';
import { CashFlowView } from './features/summary/CashFlowView';
import { HistoryView } from './features/transactions/HistoryView';
import { TransactionDetails } from './features/transactions/TransactionDetails';
import { TransactionForm } from './features/transactions/TransactionForm';
import { useFinance } from './hooks/FinanceProvider';
import { useAccounts } from './hooks/useAccounts';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useTransactions } from './hooks/useTransactions';
import './App.css';

type TabId = 'accounts' | 'history' | 'cashflow' | 'shopping' | 'receipts';

const TABS: readonly (TabItem & { id: TabId })[] = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'history', label: 'History' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'receipts', label: 'Receipts' },
];

/** The Shopping and Receipts tabs have no FAB. */
const FAB_TABS: readonly TabId[] = ['accounts', 'history', 'cashflow'];

type EntryState = 'closed' | 'form' | 'no-accounts';
type SelectionState = { id: string; mode: 'details' | 'edit' } | null;

function isTabId(id: string): id is TabId {
  return TABS.some((tab) => tab.id === id);
}

function tabLabel(id: TabId): string {
  return TABS.find((tab) => tab.id === id)?.label ?? id;
}

export function App() {
  const { status, reload, accounts: allAccounts, persistenceDenied } = useFinance();
  const [activeTab, setActiveTab] = useState<TabId>('accounts');
  const [entry, setEntry] = useState<EntryState>('closed');
  const accounts = useAccounts();
  const { transactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const [selection, setSelection] = useState<SelectionState>(null);
  /** Shopping list to open when the Shopping tab is shown from the Receipts tab. */
  const [shoppingFocusId, setShoppingFocusId] = useState<string | null>(null);
  const { updateReady, apply, dismiss } = useServiceWorkerUpdate();

  if (status === 'fatal') {
    return (
      <main className="app app--blocking" role="alert">
        <h1 className="app__title">Cannot open local storage</h1>
        <p>
          The app could not open its database, so it cannot run safely. Close other tabs of this
          app or check that your browser allows site storage, then reload the page.
        </p>
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main className="app app--center" aria-busy="true">
        <p role="status">Loading…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app app--center">
        <div role="alert">
          <EmptyState
            message="Your data could not be loaded."
            actionLabel="Retry"
            onAction={() => void reload()}
          />
        </div>
      </main>
    );
  }

  const showFab = FAB_TABS.includes(activeTab);
  const closeEntry = () => setEntry('closed');
  const closeSelection = () => setSelection(null);
  const selected =
    selection === null ? undefined : transactions.find((t) => t.id === selection.id);

  return (
    <>
      <main className="app">
        <PersistenceNotice denied={persistenceDenied} />
        <UpdatePrompt visible={updateReady} onUpdate={apply} onDismiss={dismiss} />
        <h1 className="app__title">{tabLabel(activeTab)}</h1>
        <section aria-label={tabLabel(activeTab)}>
          {activeTab === 'accounts' ? (
            <AccountsView />
          ) : activeTab === 'history' ? (
            <HistoryView onSelectTransaction={(tx: Transaction) => setSelection({ id: tx.id, mode: 'details' })} />
          ) : activeTab === 'cashflow' ? (
            <CashFlowView />
          ) : activeTab === 'shopping' ? (
            <ShoppingView initialListId={shoppingFocusId} />
          ) : (
            <ReceiptsView
              onOpenTransaction={(tx: Transaction) => setSelection({ id: tx.id, mode: 'details' })}
              onOpenShoppingList={(list: ShoppingList) => {
                setShoppingFocusId(list.id);
                setActiveTab('shopping');
              }}
            />
          )}
        </section>
      </main>
      {showFab ? (
        <FloatingActionButton
          label="Add transaction"
          onClick={() => setEntry(accounts.active.length === 0 ? 'no-accounts' : 'form')}
        />
      ) : null}
      {entry === 'form' ? (
        <Modal title="Add transaction" onClose={closeEntry}>
          <TransactionForm
            accounts={accounts.active}
            onCancel={closeEntry}
            onSubmit={async (draft, receipt) => {
              const file =
                receipt.type === 'replace'
                  ? new File([receipt.receipt.blob], receipt.receipt.fileName, {
                      type: receipt.receipt.mimeType,
                    })
                  : undefined;
              const result = await createTransaction(draft, file);
              if (result.ok) closeEntry();
              return result;
            }}
          />
        </Modal>
      ) : null}
      {selection !== null && selected !== undefined && selection.mode === 'details' ? (
        <Modal title="Transaction" onClose={closeSelection}>
          <TransactionDetails
            transaction={selected}
            accounts={allAccounts}
            onEdit={() => setSelection({ id: selected.id, mode: 'edit' })}
            onDelete={async () => {
              const result = await deleteTransaction(selected.id);
              if (result.ok) closeSelection();
              return result;
            }}
            onClose={closeSelection}
          />
        </Modal>
      ) : null}
      {selection !== null && selected !== undefined && selection.mode === 'edit' ? (
        <Modal title="Edit transaction" onClose={closeSelection}>
          <TransactionForm
            accounts={accounts.active}
            transaction={selected}
            onCancel={() => setSelection({ id: selected.id, mode: 'details' })}
            onSubmit={async (draft, receipt) => {
              const result = await updateTransaction(selected.id, draft, receipt);
              if (result.ok) closeSelection();
              return result;
            }}
          />
        </Modal>
      ) : null}
      {entry === 'no-accounts' ? (
        <Modal title="Create an account first" onClose={closeEntry}>
          <p>You need an active account before you can add a transaction.</p>
          <Button
            onClick={() => {
              setActiveTab('accounts');
              closeEntry();
            }}
          >
            Go to Accounts
          </Button>
        </Modal>
      ) : null}
      <TabBar
        tabs={TABS}
        activeId={activeTab}
        onSelect={(id) => {
          if (!isTabId(id)) return;
          setShoppingFocusId(null);
          setActiveTab(id);
        }}
      />
    </>
  );
}
