import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Routes, Route, useLocation } from 'react-router-dom';
import type React from 'react';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { pageLoaders, preloadRoute } from './lib/routePreload';
import './App.css';

const Home = lazy(pageLoaders.home);
const Explore = lazy(pageLoaders.explore);
const CreatorProfile = lazy(pageLoaders.creatorProfile);
const Login = lazy(pageLoaders.login);
const Dashboard = lazy(pageLoaders.dashboard);
const Admin = lazy(pageLoaders.admin);
const CommunityModeration = lazy(pageLoaders.moderation);
const Rankings = lazy(pageLoaders.rankings);
const CityReputation = lazy(pageLoaders.cityReputation);
const ReputationDossier = lazy(pageLoaders.reputationDossier);
const DmWall = lazy(pageLoaders.dmWall);
const BoundaryVotes = lazy(pageLoaders.boundaryVotes);
const CreateRanking = lazy(pageLoaders.createRanking);
const Commissions = lazy(pageLoaders.commissions);
const CreateCommission = lazy(pageLoaders.createCommission);
const Carpools = lazy(pageLoaders.carpools);
const CreateCarpool = lazy(pageLoaders.createCarpool);
const Wallet = lazy(pageLoaders.wallet);
const Referrals = lazy(pageLoaders.referrals);
const Roadmap = lazy(pageLoaders.roadmap);
const Scripts = lazy(pageLoaders.scripts);
const ScriptContribute = lazy(pageLoaders.scriptContribute);
const Guides = lazy(pageLoaders.guides);
const CreateGuide = lazy(pageLoaders.createGuide);
const GuideIncome = lazy(pageLoaders.guideIncome);
const CertificationPage = lazy(pageLoaders.certification);
const ShopDashboard = lazy(pageLoaders.shopDashboard);
const Contact = lazy(pageLoaders.contact);
const ReviewRules = lazy(() => pageLoaders.legal().then(module => ({ default: module.ReviewRules })));
const UserAgreement = lazy(() => pageLoaders.legal().then(module => ({ default: module.UserAgreement })));
const PrivacyPolicy = lazy(() => pageLoaders.legal().then(module => ({ default: module.PrivacyPolicy })));
const SecurityAssessment = lazy(() => pageLoaders.legal().then(module => ({ default: module.SecurityAssessment })));
const BusinessLicense = lazy(() => pageLoaders.legal().then(module => ({ default: module.BusinessLicense })));

const CONTACT_EMAIL = 'basara-twenty@foxmail.com';
const ICP_RECORD_NO = '冀ICP备2026019163号-1';
const MPS_RECORD_NO = '冀公网安备13310202000316号';
const MPS_RECORD_URL = 'https://beian.mps.gov.cn/#/query/webSearch?code=13310202000316';

function AppLayout() {
  const { pathname } = useLocation();
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const showNavbar = !isDashboardRoute && pathname !== '/login' && pathname !== '/rankings/new' && pathname !== '/commissions/new' && pathname !== '/carpools/new' && pathname !== '/guides/new';
  const showFooter = pathname !== '/login' && !isDashboardRoute;

  return (
    <>
      <ScrollToTop />
      {showNavbar && <Navbar />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:id" element={<CreatorProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/profile" element={<Dashboard />} />
          <Route path="/dashboard/services" element={<Dashboard />} />
          <Route path="/dashboard/services/works" element={<Dashboard />} />
          <Route path="/dashboard/services/availability" element={<Dashboard />} />
          <Route path="/dashboard/wallet" element={<Dashboard />} />
          <Route path="/dashboard/account" element={<Dashboard />} />
          <Route path="/dashboard/certification" element={<Dashboard />} />
          <Route path="/dashboard/posts" element={<Dashboard />} />
          <Route path="/dashboard/referrals" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/moderation" element={<CommunityModeration />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/city" element={<CityReputation />} />
          <Route path="/reputation/city" element={<CityReputation />} />
          <Route path="/reputation/dossier" element={<ReputationDossier />} />
          <Route path="/dm-wall" element={<DmWall />} />
          <Route path="/boundary-votes" element={<BoundaryVotes />} />
          <Route path="/rankings/new" element={<CreateRanking />} />
          <Route path="/commissions" element={<Commissions />} />
          <Route path="/commissions/new" element={<CreateCommission />} />
          <Route path="/carpools" element={<Carpools />} />
          <Route path="/carpools/new" element={<CreateCarpool />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="/scripts/contribute" element={<ScriptContribute />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/guides/new" element={<CreateGuide />} />
          <Route path="/guides/income" element={<GuideIncome />} />
          <Route path="/certification" element={<CertificationPage />} />
          <Route path="/shop/dashboard" element={<ShopDashboard />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/rules" element={<ReviewRules />} />
          <Route path="/terms" element={<UserAgreement />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/security-assessment" element={<SecurityAssessment />} />
          <Route path="/business-license" element={<BusinessLicense />} />
        </Routes>
      </Suspense>
      {showFooter && <SiteFooter />}
    </>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

function RouteFallback() {
  return (
    <main style={{ minHeight: '72vh', background: '#fffdf8', color: '#1f2937', padding: '84px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, rgba(217,168,87,0.24), rgba(238,246,255,0.95))', marginBottom: 24 }} />
        <div style={{ height: 22, width: '48%', maxWidth: 340, borderRadius: 999, background: 'rgba(217,168,87,0.14)', marginBottom: 14 }} />
        <div style={{ height: 14, width: '78%', borderRadius: 999, background: 'rgba(125,147,170,0.16)', marginBottom: 10 }} />
        <div style={{ height: 14, width: '62%', borderRadius: 999, background: 'rgba(125,147,170,0.12)' }} />
      </div>
    </main>
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
              <FooterBadge>公安备案已通过</FooterBadge>
            </div>
          </div>
          <FooterColumn title="主要入口">
            <FooterLink to="/explore">浏览灵契师</FooterLink>
            <FooterLink to="/commissions">委托需求墙</FooterLink>
            <FooterLink to="/carpools">拼车区</FooterLink>
            <FooterLink to="/rankings">红黑白榜</FooterLink>
            <FooterLink to="/reputation/city">城市口碑</FooterLink>
            <FooterLink to="/dm-wall">爱D墙 / 店家</FooterLink>
            <FooterLink to="/scripts">角色点评</FooterLink>
            <FooterLink to="/guides">攻略交易</FooterLink>
            <FooterLink to="/wallet">我的契约币</FooterLink>
            <FooterLink to="/referrals">我的邀请</FooterLink>
          </FooterColumn>
          <FooterColumn title="发布与认证">
            <FooterLink to="/commissions/new">发布委托</FooterLink>
            <FooterLink to="/carpools/new">发布拼车</FooterLink>
            <FooterLink to="/rankings/new">发布口碑</FooterLink>
            <FooterLink to="/scripts/contribute">维护剧本库</FooterLink>
            <FooterLink to="/guides/new">发布攻略</FooterLink>
            <FooterLink to="/guides/income">创作者收入</FooterLink>
            <FooterLink to="/scripts">给剧本评分</FooterLink>
            <FooterLink to="/certification">身份认证</FooterLink>
            <FooterLink to="/dashboard">个人后台</FooterLink>
          </FooterColumn>
          <FooterColumn title="生态连接">
            <FooterExternal href="https://jusichen.com">剧司辰</FooterExternal>
            <FooterLink to="/shop/dashboard">店家后台</FooterLink>
            <FooterLink to="/roadmap">AI 口碑路线图</FooterLink>
            <FooterExternal href="/ai/lingqi-overview.html">AI 可读说明</FooterExternal>
            <FooterLink to="/contact">投资洽谈 / 共建合作</FooterLink>
            <FooterText>摄影师 / 妆造师</FooterText>
            <FooterText>服装商 / 道具师</FooterText>
            <FooterText>大陆低成本模型优先</FooterText>
          </FooterColumn>
          <FooterColumn title="规则与合规">
            <FooterLink to="/rules">审核规则</FooterLink>
            <FooterLink to="/moderation">社区观察员审核台</FooterLink>
            <FooterLink to="/terms">用户协议</FooterLink>
            <FooterLink to="/privacy">隐私政策</FooterLink>
            <FooterLink to="/security-assessment">安全评估说明</FooterLink>
            <FooterLink to="/business-license">经营主体信息</FooterLink>
            <FooterLink to="/contact">联系我们 / 站内信</FooterLink>
            <FooterExternal href={`mailto:${CONTACT_EMAIL}`}>客服邮箱</FooterExternal>
            <FooterExternal href="https://beian.miit.gov.cn/">{ICP_RECORD_NO}</FooterExternal>
            <FooterExternal href={MPS_RECORD_URL}>{MPS_RECORD_NO}</FooterExternal>
          </FooterColumn>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 34, paddingTop: 18, borderTop: '1px solid rgba(201,146,46,0.14)', fontSize: '0.76rem', color: 'rgba(71,85,105,0.58)' }}>
          <span>© {new Date().getFullYear()} 灵契 LingQi. 原型期运营中。</span>
          <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(39,83,137,0.72)', textDecoration: 'none', fontWeight: 700 }}>{ICP_RECORD_NO}</a>
            <a href={MPS_RECORD_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(39,83,137,0.72)', textDecoration: 'none', fontWeight: 700 }}>{MPS_RECORD_NO}</a>
          </span>
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
  return (
    <Link
      to={to}
      style={footerLinkStyle}
      onMouseEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
    >
      {children}
    </Link>
  );
}

function FooterExternal({ href, children }: { href: string; children: React.ReactNode }) {
  const isMailto = href.startsWith('mailto:');
  return (
    <a
      href={href}
      target={isMailto ? undefined : '_blank'}
      rel={isMailto ? undefined : 'noopener noreferrer'}
      style={footerLinkStyle}
    >
      {children}
    </a>
  );
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
