import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { isStaleAssetError, recoverFromStaleAssetError } from '../lib/staleAssetRecovery';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (recoverFromStaleAssetError(error)) return;
    console.error('[page-error]', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const staleAsset = isStaleAssetError(this.state.error);
    const title = staleAsset ? '页面已经更新' : '这一页暂时没能打开';
    const description = staleAsset
      ? '你停留期间网站发布了新版本，重新载入后就能继续刚才的操作。'
      : '可能是网络短暂中断，也可能是页面状态发生了变化。重新载入通常可以恢复。';

    return (
      <main style={pageStyle}>
        <header style={headerStyle}>
          <a href="/" style={brandStyle} aria-label="返回剧幕录首页">
            <strong style={brandNameStyle}>剧幕录</strong>
            <span style={brandEnglishStyle}>JUMULU</span>
          </a>
        </header>

        <section style={contentStyle} aria-labelledby="page-error-title">
          <span style={statusStyle}>{staleAsset ? '版本更新' : '页面异常'}</span>
          <h1 id="page-error-title" style={titleStyle}>{title}</h1>
          <p style={descriptionStyle}>{description}</p>

          <div style={actionsStyle}>
            <button type="button" onClick={this.reload} style={primaryButtonStyle}>重新载入</button>
            <button type="button" onClick={this.goBack} style={secondaryButtonStyle}>返回上一页</button>
            <a href="/" style={homeLinkStyle}>回到首页</a>
          </div>

          {this.state.error?.message && (
            <details style={detailsStyle}>
              <summary style={summaryStyle}>查看错误信息</summary>
              <p style={errorTextStyle}>{this.state.error.message}</p>
            </details>
          )}
        </section>

        <footer style={footerStyle}>幕前有演绎，幕后有记录。</footer>
      </main>
    );
  }
}

const pageStyle: CSSProperties = { minHeight: '100vh', display: 'grid', gridTemplateRows: '56px 1fr auto', background: '#fffdf8', color: '#1f2937' };
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(31,41,55,0.08)', padding: '0 18px', background: 'rgba(255,255,255,0.82)' };
const brandStyle: CSSProperties = { display: 'inline-flex', alignItems: 'baseline', gap: 7, color: '#1f2937', textDecoration: 'none' };
const brandNameStyle: CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 18 };
const brandEnglishStyle: CSSProperties = { color: '#a66a1f', fontSize: 9, fontWeight: 900, letterSpacing: 0 };
const contentStyle: CSSProperties = { width: 'min(100% - 32px, 620px)', alignSelf: 'center', justifySelf: 'center', padding: '56px 0 72px' };
const statusStyle: CSSProperties = { display: 'inline-flex', border: '1px solid rgba(166,106,31,0.2)', borderRadius: 999, padding: '4px 9px', background: '#fff8e8', color: '#925f18', fontSize: 11, fontWeight: 900 };
const titleStyle: CSSProperties = { margin: '16px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', lineHeight: 1.2 };
const descriptionStyle: CSSProperties = { maxWidth: 520, margin: '12px 0 0', color: 'rgba(71,85,105,0.76)', fontSize: 14, lineHeight: 1.75 };
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 24 };
const buttonBaseStyle: CSSProperties = { minHeight: 42, borderRadius: 7, padding: '0 16px', fontSize: 13, fontWeight: 900, cursor: 'pointer' };
const primaryButtonStyle: CSSProperties = { ...buttonBaseStyle, border: 0, background: '#275389', color: '#fff' };
const secondaryButtonStyle: CSSProperties = { ...buttonBaseStyle, border: '1px solid rgba(39,83,137,0.18)', background: '#fff', color: '#275389' };
const homeLinkStyle: CSSProperties = { minHeight: 42, display: 'inline-flex', alignItems: 'center', padding: '0 8px', color: 'rgba(71,85,105,0.7)', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
const detailsStyle: CSSProperties = { marginTop: 30, borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 14, color: 'rgba(71,85,105,0.58)', fontSize: 12 };
const summaryStyle: CSSProperties = { width: 'fit-content', cursor: 'pointer', fontWeight: 800 };
const errorTextStyle: CSSProperties = { margin: '9px 0 0', borderRadius: 7, padding: 10, background: '#f8fafc', color: 'rgba(71,85,105,0.72)', lineHeight: 1.55, overflowWrap: 'anywhere' };
const footerStyle: CSSProperties = { borderTop: '1px solid rgba(31,41,55,0.06)', padding: '16px 18px', color: 'rgba(71,85,105,0.5)', fontSize: 11 };
