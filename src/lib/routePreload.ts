export const pageLoaders = {
  home: () => import('../pages/Home'),
  explore: () => import('../pages/Explore'),
  creatorProfile: () => import('../pages/CreatorProfile'),
  login: () => import('../pages/Login'),
  dashboard: () => import('../pages/Dashboard'),
  admin: () => import('../pages/Admin'),
  rankings: () => import('../pages/Rankings'),
  createRanking: () => import('../pages/CreateRanking'),
  commissions: () => import('../pages/Commissions'),
  createCommission: () => import('../pages/CreateCommission'),
  carpools: () => import('../pages/Carpools'),
  createCarpool: () => import('../pages/CreateCarpool'),
  wallet: () => import('../pages/Wallet'),
  certification: () => import('../pages/CertificationPage'),
  shopDashboard: () => import('../pages/ShopDashboard'),
  legal: () => import('../pages/Legal'),
} as const;

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': pageLoaders.home,
  '/explore': pageLoaders.explore,
  '/explore/:id': pageLoaders.creatorProfile,
  '/login': pageLoaders.login,
  '/dashboard': pageLoaders.dashboard,
  '/admin': pageLoaders.admin,
  '/rankings': pageLoaders.rankings,
  '/rankings/new': pageLoaders.createRanking,
  '/commissions': pageLoaders.commissions,
  '/commissions/new': pageLoaders.createCommission,
  '/carpools': pageLoaders.carpools,
  '/carpools/new': pageLoaders.createCarpool,
  '/wallet': pageLoaders.wallet,
  '/certification': pageLoaders.certification,
  '/shop/dashboard': pageLoaders.shopDashboard,
  '/rules': pageLoaders.legal,
  '/terms': pageLoaders.legal,
  '/privacy': pageLoaders.legal,
};

const loadedRoutes = new Set<string>();
const pendingRoutes = new Map<string, Promise<unknown>>();

function routeKey(path: string) {
  const pathname = path.split('?')[0].split('#')[0];
  if (pathname.startsWith('/explore/') && pathname !== '/explore') return '/explore/:id';
  return pathname || '/';
}

export function preloadRoute(path: string) {
  const key = routeKey(path);
  const loader = routeLoaders[key];
  if (!loader || loadedRoutes.has(key) || pendingRoutes.has(key)) return;

  const request = loader()
    .then(result => {
      loadedRoutes.add(key);
      pendingRoutes.delete(key);
      return result;
    })
    .catch(error => {
      pendingRoutes.delete(key);
      throw error;
    });
  pendingRoutes.set(key, request);
}
