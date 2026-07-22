export const pageLoaders = {
  home: () => import('../pages/Home'),
  explore: () => import('../pages/Explore'),
  creatorProfile: () => import('../pages/CreatorProfile'),
  login: () => import('../pages/Login'),
  dashboard: () => import('../pages/Dashboard'),
  accountStatus: () => import('../pages/AccountStatus'),
  followSettings: () => import('../pages/FollowSettings'),
  admin: () => import('../pages/Admin'),
  moderation: () => import('../pages/CommunityModeration'),
  rankings: () => import('../pages/Rankings'),
  rankingDetail: () => import('../pages/RankingDetail'),
  cityReputation: () => import('../pages/CityReputation'),
  reputationDossier: () => import('../pages/ReputationDossier'),
  dmWall: () => import('../pages/DmWall'),
  dmRating: () => import('../pages/DmRating'),
  dmProfile: () => import('../pages/DmProfile'),
  chantoLeaderboard: () => import('../pages/ChantoLeaderboard'),
  stores: () => import('../pages/Stores'),
  storeRating: () => import('../pages/StoreRating'),
  storeProfile: () => import('../pages/StoreProfile'),
  boundaryVotes: () => import('../pages/BoundaryVotes'),
  createRanking: () => import('../pages/CreateRanking'),
  commissions: () => import('../pages/Commissions'),
  createCommission: () => import('../pages/CreateCommission'),
  carpools: () => import('../pages/Carpools'),
  createCarpool: () => import('../pages/CreateCarpool'),
  wallet: () => import('../pages/Wallet'),
  referrals: () => import('../pages/Referrals'),
  roadmap: () => import('../pages/Roadmap'),
  scripts: () => import('../pages/Scripts'),
  roleRatingDetail: () => import('../pages/RoleRatingDetail'),
  rateScriptRole: () => import('../pages/RateScriptRole'),
  scriptContribute: () => import('../pages/ScriptContribute'),
  guides: () => import('../pages/Guides'),
  createGuide: () => import('../pages/CreateGuide'),
  guideIncome: () => import('../pages/GuideIncome'),
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
  '/dashboard/profile': pageLoaders.dashboard,
  '/dashboard/services': pageLoaders.dashboard,
  '/dashboard/services/works': pageLoaders.dashboard,
  '/dashboard/services/availability': pageLoaders.dashboard,
  '/dashboard/wallet': pageLoaders.dashboard,
  '/dashboard/account': pageLoaders.dashboard,
  '/dashboard/certification': pageLoaders.dashboard,
  '/dashboard/posts': pageLoaders.dashboard,
  '/dashboard/referrals': pageLoaders.dashboard,
  '/account-status': pageLoaders.accountStatus,
  '/follows': pageLoaders.followSettings,
  '/admin': pageLoaders.admin,
  '/moderation': pageLoaders.moderation,
  '/rankings': pageLoaders.rankings,
  '/rankings/:id': pageLoaders.rankingDetail,
  '/city': pageLoaders.cityReputation,
  '/reputation/city': pageLoaders.cityReputation,
  '/reputation/dossier': pageLoaders.reputationDossier,
  '/dm-wall': pageLoaders.dmWall,
  '/dm': pageLoaders.dmWall,
  '/dm/rate': pageLoaders.dmRating,
  '/dm/:id': pageLoaders.dmProfile,
  '/chanto': pageLoaders.chantoLeaderboard,
  '/stores': pageLoaders.stores,
  '/stores/rate': pageLoaders.storeRating,
  '/stores/:id': pageLoaders.storeProfile,
  '/boundary-votes': pageLoaders.boundaryVotes,
  '/rankings/new': pageLoaders.createRanking,
  '/commissions': pageLoaders.commissions,
  '/commissions/new': pageLoaders.createCommission,
  '/carpools': pageLoaders.carpools,
  '/carpools/new': pageLoaders.createCarpool,
  '/wallet': pageLoaders.wallet,
  '/referrals': pageLoaders.referrals,
  '/roadmap': pageLoaders.roadmap,
  '/scripts': pageLoaders.scripts,
  '/scripts/roles/:targetId': pageLoaders.roleRatingDetail,
  '/scripts/rate': pageLoaders.rateScriptRole,
  '/scripts/contribute': pageLoaders.scriptContribute,
  '/guides': pageLoaders.guides,
  '/guides/new': pageLoaders.createGuide,
  '/guides/income': pageLoaders.guideIncome,
  '/income': pageLoaders.guideIncome,
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
  if (pathname.startsWith('/dm/') && pathname !== '/dm/rate') return '/dm/:id';
  if (pathname.startsWith('/stores/') && pathname !== '/stores/rate') return '/stores/:id';
  if (pathname.startsWith('/rankings/') && pathname !== '/rankings/new') return '/rankings/:id';
  if (pathname.startsWith('/scripts/roles/')) return '/scripts/roles/:targetId';
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
