import { BrowserRouter, Link, Routes, Route, useLocation } from 'react-router-dom';
import type React from 'react';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Explore from './pages/Explore';
import CreatorProfile from './pages/CreatorProfile';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Rankings from './pages/Rankings';
import CreateRanking from './pages/CreateRanking';
import Commissions from './pages/Commissions';
import CreateCommission from './pages/CreateCommission';
import Carpools from './pages/Carpools';
import CreateCarpool from './pages/CreateCarpool';
import Wallet from './pages/Wallet';
import CertificationPage from './pages/CertificationPage';
import ShopDashboard from './pages/ShopDashboard';
import { PrivacyPolicy, ReviewRules, UserAgreement } from './pages/Legal';
import './App.css';

function AppLayout() {
  const { pathname } = useLocation();
  const showNavbar = pathname !== '/login' && pathname !== '/rankings/new' && pathname !== '/commissions/new' && pathname !== '/carpools/new';

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/:id" element={<CreatorProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/rankings/new" element={<CreateRanking />} />
        <Route path="/commissions" element={<Commissions />} />
        <Route path="/commissions/new" element={<CreateCommission />} />
        <Route path="/carpools" element={<Carpools />} />
        <Route path="/carpools/new" element={<CreateCarpool />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/certification" element={<CertificationPage />} />
        <Route path="/shop/dashboard" element={<ShopDashboard />} />
        <Route path="/rules" element={<ReviewRules />} />
        <Route path="/terms" element={<UserAgreement />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
      <SiteFooter />
    </>
  );
}

function SiteFooter() {
  return (
    <footer style={{
      background: 'linear-gradient(180deg, #fffdf8 0%, #f7fbff 100%)',
      borderTop: '1px solid rgba(201,146,46,0.22)',
      padding: '42px 20px 30px',
      marginTop: 'auto',
      color: 'rgba(71,85,105,0.78)',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 28 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.35rem', color: '#1f2937', marginBottom: 10 }}>灵契</div>
            <p style={{ fontSize: '0.86rem', lineHeight: 1.8, margin: 0, maxWidth: 320 }}>
              与虚拟人之灵签订契约，让其附身一段时间。这里连接委托人、灵契师与完成降临所需的配套服务。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <FooterBadge>人工审核</FooterBadge>
              <FooterBadge>契约币原型期</FooterBadge>
              <FooterBadge>ICP备案中</FooterBadge>
            </div>
          </div>
          <FooterColumn title="主要入口">
            <FooterLink to="/explore">灵契大厅</FooterLink>
            <FooterLink to="/commissions">委托需求墙</FooterLink>
            <FooterLink to="/carpools">拼车区</FooterLink>
            <FooterLink to="/rankings">红黑白榜</FooterLink>
            <FooterLink to="/wallet">我的契约币</FooterLink>
          </FooterColumn>
          <FooterColumn title="发布与认证">
            <FooterLink to="/commissions/new">发布委托</FooterLink>
            <FooterLink to="/carpools/new">发布拼车</FooterLink>
            <FooterLink to="/rankings/new">发布口碑</FooterLink>
            <FooterLink to="/certification">身份认证</FooterLink>
            <FooterLink to="/dashboard">个人后台</FooterLink>
          </FooterColumn>
          <FooterColumn title="生态连接">
            <FooterExternal href="https://jusichen.com">剧司辰</FooterExternal>
            <FooterLink to="/shop/dashboard">店家后台</FooterLink>
            <FooterText>摄影师 / 妆造师</FooterText>
            <FooterText>服装商 / 道具师</FooterText>
          </FooterColumn>
          <FooterColumn title="规则与合规">
            <FooterLink to="/rules">审核规则</FooterLink>
            <FooterLink to="/terms">用户协议</FooterLink>
            <FooterLink to="/privacy">隐私政策</FooterLink>
            <FooterText>备案号待公示</FooterText>
          </FooterColumn>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 34, paddingTop: 18, borderTop: '1px solid rgba(201,146,46,0.14)', fontSize: '0.76rem', color: 'rgba(71,85,105,0.58)' }}>
          <span>© {new Date().getFullYear()} 灵契 LingQi. 原型期运营中。</span>
          <span>不公开联系方式、不展示实名，只显示昵称与认证标识。</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ color: '#1f2937', fontSize: '0.86rem', fontWeight: 900, marginBottom: 12 }}>{title}</h3>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} style={footerLinkStyle}>{children}</Link>;
}

function FooterExternal({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>{children}</a>;
}

function FooterText({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.8rem' }}>{children}</span>;
}

function FooterBadge({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(217,168,87,0.2)', color: '#d9a857', background: 'rgba(217,168,87,0.08)', fontSize: '0.72rem', fontWeight: 800 }}>{children}</span>;
}

const footerLinkStyle: React.CSSProperties = {
  color: 'rgba(39,83,137,0.78)',
  textDecoration: 'none',
  fontSize: '0.8rem',
  fontWeight: 650,
};

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
