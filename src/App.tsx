import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import Wallet from './pages/Wallet';
import CertificationPage from './pages/CertificationPage';
import ShopDashboard from './pages/ShopDashboard';
import './App.css';

function AppLayout() {
  const { pathname } = useLocation();
  const showNavbar = pathname !== '/login' && pathname !== '/rankings/new' && pathname !== '/commissions/new';

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
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/certification" element={<CertificationPage />} />
        <Route path="/shop/dashboard" element={<ShopDashboard />} />
      </Routes>
      <footer style={{
        textAlign: 'center',
        padding: '24px 20px 32px',
        backgroundColor: 'rgba(11,26,48,0.96)',
        borderTop: '1px solid rgba(201,146,46,0.12)',
        marginTop: 'auto',
      }}>
        <a
          href="https://jusichen.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#d9a857',
            fontSize: '0.82rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          剧司辰 · 剧本杀排期系统 →
        </a>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
