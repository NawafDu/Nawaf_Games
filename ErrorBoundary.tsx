import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render errors anywhere in the app
 * and presents a recovery screen instead of a blank white page —
 * important on iOS Safari where uncaught errors can otherwise leave the
 * user stuck with no way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center safe-area-screen">
          <div className="text-4xl">⚠️</div>
          <h1 className="font-display text-xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="max-w-xs text-sm text-white/60">
            Shadow Circuit hit an unexpected error. Reloading usually fixes
            this — your room may still be active.
          </p>
          <button
            onClick={this.handleReload}
            className="tap-target rounded-xl2 bg-signal px-6 py-3 font-display text-sm font-semibold text-ink-950 active:scale-95"
          >
            Reload App
          </button>
          {this.state.error && (
            <pre className="mt-4 max-w-full overflow-auto rounded-lg bg-black/40 p-3 text-left text-[10px] text-white/40">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
