// Fictional, local-only content. Never import this module into production.
export type DossierKind = 'DM' | '店家' | '剧本' | '角色';
export type DemoDossier = {
  id: string; name: string; kind: DossierKind; city: string; summary: string;
  source: string; facts: [string, string][]; related: string[];
  provider?: 'lin' | 'yue';
};
export const demoDossiers: DemoDossier[] = [
  { id: 'lin', name: '林川', kind: 'DM', city: '西安', summary: '情感演绎 · 克制细腻 · 可远征', source: '本人提供 · 示例', provider: 'lin', facts: [['擅长方向', '情感演绎、角色共创'], ['任职关系', '自由 DM · 本人提供（示例）'], ['常演剧本', '《暮色来信》· 虚构剧本']], related: ['letter', 'role'] },
  { id: 'yue', name: '知月', kind: 'DM', city: '西安', summary: '角色共创 · 自然松弛 · 同城优先', source: '本人提供 · 示例', provider: 'yue', facts: [['擅长方向', '情感表达、沉浸互动'], ['任职关系', '暂无已确认店家'], ['常演剧本', '《暮色来信》· 虚构剧本']], related: ['letter'] },
  { id: 'store', name: '演示剧场·甲', kind: '店家', city: '西安', summary: '城市剧场档案 · 场地与服务记录', source: '社区提供 · 示例', facts: [['经营信息', '本条是虚构店家，不可线下到访'], ['档案状态', '未认领 · 不代表店家已认证'], ['店内剧本', '《暮色来信》· 虚构示例']], related: ['letter'] },
  { id: 'letter', name: '暮色来信', kind: '剧本', city: '全国', summary: '虚构情感本 · 6人 · 约6小时', source: '社区提供 · 示例', facts: [['类型', '现代 / 情感 / 沉浸演绎'], ['人数与时长', '6人 · 约6小时（示例设定）'], ['评分栏目', '无剧透体验 / 剧透深评']], related: ['role', 'lin', 'yue'] },
  { id: 'role', name: '归舟', kind: '角色', city: '全国', summary: '《暮色来信》中的演绎角色 · 虚构', source: '社区提供 · 示例', facts: [['所属剧本', '暮色来信'], ['角色类型', '演绎角色'], ['无剧透简介', '一个等待旧友归来的人。']], related: ['letter', 'lin'] },
];
export type DemoEvent = {
  id: string; kind: '红榜' | '黑榜' | '白榜'; title: string; subject: string;
  tags: string[]; summary: string; response: string; dossier?: string;
};
export const demoEvents: DemoEvent[] = [
  { id: 'red', kind: '红榜', title: '散场后，那段没说完的事', subject: '林川 · 西安', tags: ['用户自述', '相关方已回应'], summary: '【虚构事件】玩家记录：演绎中遇到不适时，DM 先暂停确认边界，散场后也认真完成了复盘。这条记录关注具体服务体验，不替任何人做永久背书。', response: '【虚构回应】谢谢记录。每个人的边界不同，开场前的沟通和过程中的确认都很重要。', dossier: 'lin' },
  { id: 'black', kind: '黑榜', title: '约定的退费，后续处理到哪了？', subject: '演示店家·乙 · 虚构对象', tags: ['用户自述', '存在争议'], summary: '【虚构事件】一位玩家描述改期后的退费争议，双方对约定范围存在分歧。本卡片仅演示公开记录的结构，不对应真实店家，不代表平台已经认定责任。', response: '【演示状态】暂未收到相关方回应；不能把未回应等同于承认。' },
  { id: 'white', kind: '白榜', title: '演绎边界，开场前怎样讲清楚？', subject: '行业讨论 · 虚构示例', tags: ['经验交流'], summary: '【虚构讨论】哪些互动可以提前确认，过程中如何表达暂停？这里收集具体做法，不用一条通用规则替代每个人的同意。', response: '【演示说明】这是讨论记录，没有被评价的具体对象。' },
];
export const filterDossiers = (query: string, kind: DossierKind | '全部') => {
  const keyword = query.trim().toLocaleLowerCase();
  return demoDossiers.filter(item => (kind === '全部' || item.kind === kind)
    && `${item.name} ${item.city} ${item.summary}`.toLocaleLowerCase().includes(keyword));
};
