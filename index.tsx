
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ─── React Error Boundary ────────────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CoVision] Unhandled React error:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0f172a', color: 'white', padding: 32, gap: 16,
          fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        }}>
          <div style={{ fontSize: 64 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#94a3b8', maxWidth: 400, margin: 0 }}>
            {this.state.error?.message || 'An unexpected error occurred in the application.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 32px',
              background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
              border: 'none', borderRadius: 12, color: 'white',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            Restart Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Global unhandled error fallback ────────────────────────────────────────
window.onerror = function(msg, url, line, col, error) {
  console.error('[CoVision] GLOBAL ERROR:', msg, 'at', url, ':', line, ':', col, error);
};

window.onunhandledrejection = function(event) {
  console.error('[CoVision] Unhandled Promise rejection:', event.reason);
};

// ─── Mount ───────────────────────────────────────────────────────────────────
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
