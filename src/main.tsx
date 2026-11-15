import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FinanceProvider } from './hooks/FinanceProvider';
import './styles/variables.css';
import './styles/reset.css';
import './styles/base.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <FinanceProvider>
        <App />
      </FinanceProvider>
    </ErrorBoundary>
  </StrictMode>,
);
