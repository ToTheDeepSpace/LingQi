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
import './App.css';

function AppLayout() {
  const { pathname } = useLocation();
  // Login has its own full-screen layout
  const showNavbar = pathname !== '/login' && pathname !== '/rankings/new';

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
      </Routes>
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
