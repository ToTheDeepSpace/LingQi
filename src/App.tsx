import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Routes, Route, useLocation } from 'react-router-dom';
import type React from 'react';
import Navbar from './components/Navbar';
import BrandLogo from './components/BrandLogo';
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
const DmRating = lazy(pageLoaders.dmRating);
const DmProfile = lazy(pageLoaders.dmProfile);
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
const RoleRatingDetail = lazy(pageLoaders.roleRatingDetail);
const RateScriptRole = lazy(pageLoaders.rateScriptRole);
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
          <Route path="/dm" element={<DmWall />} />
          <Route path="/dm/rate" element={<DmRating />} />
          <Route path="/dm/:id" element={<DmProfile />} />
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
          <Route path="/scripts/roles/:targetId" element={<RoleRatingDetail />} />
          <Route path="/scripts/rate" element={<RateScriptRole />} />
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
      background: '#fffdf8',
      borderTop: '1px solid rgba(201,146,46,0.22)',
      padding: '22px 20px 18px',
      marginTop: 'auto',
      color: 'rgba(71,85,105,0.78)',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <BrandLogo />
            <span style={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'rgba(71,85,105,0.68)' }}>
              幕前有演绎，幕后有记录。
            </span>
          </div>
          <nav aria-label="页脚导航" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px 14px', flexWrap: 'wrap' }}>
            <FooterLink to="/contact">建议反馈</FooterLink>
            <FooterLink to="/terms">用户协议</FooterLink>
            <FooterLink to="/privacy">隐私政策</FooterLink>
            <FooterLink to="/business-license">经营主体</FooterLink>
            <FooterExternal href={`mailto:${CONTACT_EMAIL}`}>客服邮箱</FooterExternal>
          </nav>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(201,146,46,0.12)', fontSize: '0.72rem', color: 'rgba(71,85,105,0.54)' }}>
          <span>© {new Date().getFullYear()} 剧幕录</span>
          <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(39,83,137,0.72)', textDecoration: 'none', fontWeight: 700 }}>{ICP_RECORD_NO}</a>
            <a href={MPS_RECORD_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(39,83,137,0.72)', textDecoration: 'none', fontWeight: 700 }}>{MPS_RECORD_NO}</a>
          </span>
        </div>
      </div>
    </footer>
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

const footerLinkStyle: React.CSSProperties = {
  color: 'rgba(39,83,137,0.78)',
  textDecoration: 'none',
  fontSize: '0.76rem',
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
