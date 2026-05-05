import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-6">🌊</div>
            <h1 className="font-serif text-xl font-bold text-ink-800 mb-3">页面出错了</h1>
            <p className="text-sm text-ink-400 mb-6">{this.state.error?.message || '发生了未知错误'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="px-5 py-2.5 bg-ink-800 text-white text-sm rounded-[0.75rem] hover:bg-ink-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
