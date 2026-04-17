import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px', textAlign: 'center',
          color: 'var(--text-primary, #fff)',
          background: 'var(--bg-primary, #1a1a1a)',
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <h2>应用出现错误</h2>
          <pre style={{ fontSize: '12px', opacity: 0.7, maxWidth: '600px', overflow: 'auto' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              marginTop: '20px', padding: '8px 24px',
              background: 'var(--accent-primary, #646cff)', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
