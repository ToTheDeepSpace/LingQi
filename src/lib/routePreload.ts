export const pageLoaders = {
  home: () => import('../pages/Home'),
  explore: () => import('../pages/Explore'),
  creatorProfile: () => import('../pages/CreatorProfile'),
  login: () => import('../pages/Login'),
  dashboard: () => import('../pages/Dashboard'),
  admin: () => import('../pages/Admin'),
  moderation: () => import('../pages/CommunityModeration'),
  rankings: () => import('../pages/Rankings'),
  cityReputation: () => import('../pages/CityReputation'),
  reputationDossier: () => import('../pages/ReputationDossier'),
  dmWall: () => import('../pages/DmWall'),
  boundaryVotes: () => import('../pages/BoundaryVotes'),
  createRanking: () => import('../pages/CreateRanking'),
  commissions: () => import('../pages/Commissions'),
  createCommission: () => import('../pages/CreateCommission'),
  carpools: () => import('../pages/Carpools'),
  createCarpool: () => import('../pages/CreateCarpool'),
  wallet: () => import('../pages/Wallet'),
  referrals: () => import('../pages/Referrals'),
  roadmap: () => import('../pages/Roadmap'),
  scriptContribute: () => import('../pages/ScriptContribute'),
  certification: () => import('../pages/CertificationPage'),
  shopDashboard: () => import('../pages/ShopDashboard'),
  contact: () => import('../pages/Contact'),
  legal: () => import('../pages/Legal'),
} as const;

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': pageLoaders.home,
  '/explore': pageLoaders.explore,
  '/explore/:id': pageLoaders.creatorProfile,
  '/login': pageLoaders.login,
  '/dashboard': pageLoaders.dashboard,
  '/admin': pageLoaders.admin,
  '/moderation': pageLoaders.moderation,
  '/rankings': pageLoaders.rankings,
  '/reputation/city': pageLoaders.cityReputation,
  '/reputation/dossier': pageLoaders.reputationDossier,
  '/dm-wall': pageLoaders.dmWall,
  '/boundary-votes': pageLoaders.boundaryVotes,
  '/rankings/new': pageLoaders.createRanking,
  '/commissions': pageLoaders.commissions,
  '/commissions/new': pageLoaders.createCommission,
  '/carpools': pageLoaders.carpools,
  '/carpools/new': pageLoaders.createCarpool,
  '/wallet': pageLoaders.wallet,
  '/referrals': pageLoaders.referrals,
  '/roadmap': pageLoaders.roadmap,
  '/scripts/contribute': pageLoaders.scriptContribute,
  '/certification': pageLoaders.certification,
  '/shop/dashboard': pageLoaders.shopDashboard,
  '/contact': pageLoaders.contact,
  '/rules': pageLoaders.legal,
  '/terms': pageLoaders.legal,
  '/privacy': pageLoaders.legal,
  '/security-assessment': pageLoaders.legal,
  '/business-license': pageLoaders.legal,
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
