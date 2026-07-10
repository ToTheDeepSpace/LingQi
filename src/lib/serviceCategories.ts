export type ServiceCategory = 'creator' | 'dm' | 'photographer' | 'makeup' | 'costume' | 'prop' | 'custom';

export type ServiceCategoryOption = {
  key: ServiceCategory;
  label: string;
  examples: string;
  identityRole?: string;
};

export const SERVICE_CATEGORY_OPTIONS: ServiceCategoryOption[] = [
  { key: 'creator', label: '角色委托师', examples: '角色委托 / 串场 NPC / 沉浸互动', identityRole: 'creator' },
  { key: 'dm', label: '自由 DM', examples: '带本 / 测本 / 店家临时用工', identityRole: 'dm' },
  { key: 'photographer', label: '摄影师', examples: '约拍 / 跟拍 / 出片', identityRole: 'photographer' },
  { key: 'makeup', label: '妆造师', examples: '妆造 / 发型 / 造型', identityRole: 'makeup' },
  { key: 'costume', label: '服装商', examples: '服装租赁 / 角色服', identityRole: 'costume' },
  { key: 'prop', label: '道具师', examples: '道具定制 / 伴手礼 / 小物', identityRole: 'prop' },
  { key: 'custom', label: '其他服务', examples: '写清楚具体能提供什么' },
];

const CATEGORY_KEYWORDS: Array<{ key: ServiceCategory; words: string[] }> = [
  { key: 'photographer', words: ['摄影', '约拍', '跟拍', '拍照', '拍摄', '出片', '修图', '写真'] },
  { key: 'makeup', words: ['妆造', '化妆', '造型', '发型', '妆面'] },
  { key: 'costume', words: ['服装', '租衣', '衣服', '角色服', '华服', 'cos服'] },
  { key: 'prop', words: ['道具', '小物', '伴手礼', '手作', '定制'] },
  { key: 'dm', words: ['自由dm', 'dm', '带本', '测本', '主持', '开本'] },
  { key: 'creator', words: ['角色委托', '委托', '沉浸互动', '串场', 'npc'] },
];

export function normalizeServiceCategory(value: unknown): ServiceCategory {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'custom';
  const direct = SERVICE_CATEGORY_OPTIONS.find(option => option.key === raw || option.label.toLowerCase() === raw);
  if (direct) return direct.key;
  const compact = raw.replace(/\s+/g, '');
  const matched = CATEGORY_KEYWORDS.find(({ words }) => words.some(word => compact.includes(word.toLowerCase())));
  return matched?.key || 'custom';
}

export function serviceCategoryLabel(value: unknown) {
  const category = normalizeServiceCategory(value);
  return SERVICE_CATEGORY_OPTIONS.find(option => option.key === category)?.label || '其他服务';
}

export function serviceCategoryIdentityRole(value: unknown) {
  const category = normalizeServiceCategory(value);
  return SERVICE_CATEGORY_OPTIONS.find(option => option.key === category)?.identityRole || '';
}

export function identityRolesFromServices(serviceTypes: unknown[]) {
  const roles: string[] = [];
  for (const serviceType of serviceTypes) {
    const role = serviceCategoryIdentityRole(serviceType);
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

export function mergeIdentityRoles(existing: unknown, additions: string[]) {
  const roles: string[] = [];
  const push = (value: unknown) => {
    const role = String(value || '').trim();
    if (role && !roles.includes(role)) roles.push(role);
  };
  if (Array.isArray(existing)) existing.forEach(push);
  additions.forEach(push);
  if (roles.length === 0) roles.push('player');
  return roles;
}

const DISPLAY_ROLE_PRIORITY = ['creator', 'dm', 'photographer', 'makeup', 'costume', 'prop', 'shop', 'player'];

export function primaryDisplayIdentityRole(roleType: unknown, identityRoles: unknown, verifiedDm = false, verifiedShop = false) {
  const roles = mergeIdentityRoles(identityRoles, [
    verifiedDm ? 'dm' : '',
    verifiedShop ? 'shop' : '',
  ].filter(Boolean));
  const normalizedRoleType = String(roleType || '').trim();
  if (normalizedRoleType && normalizedRoleType !== 'player') return normalizedRoleType;
  return DISPLAY_ROLE_PRIORITY.find(role => roles.includes(role)) || normalizedRoleType || roles[0] || 'player';
}
