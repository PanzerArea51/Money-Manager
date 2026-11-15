import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import './ErrorBoundary.css';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Defaults to reloading the page. Overridable for tests. */
  onReload?: () => void;
};

type ErrorBoundaryState = { failed: boolean };

/** Top-level boundary: shows a generic failure screen with a reload action. Stored data is not touched. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Unexpected error', error, info.componentStack);
  }

  private handleReload = (): void => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="error-boundary" role="alert">
        <h1 className="error-boundary__title">Something went wrong</h1>
        <p className="error-boundary__message">
          The app hit an unexpected error. Your saved data has not been changed. Reload to continue.
        </p>
        <Button onClick={this.handleReload}>Reload</Button>
      </main>
    );
  }
}
