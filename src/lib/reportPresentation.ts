import { privacyReportDetailError } from './reportPolicy.js';

export type AdminReportPresentationInput = {
  id: string;
  target_type: string;
  target_id: string;
  target_sub_id?: string | null;
  reason: string;
  description?: string | null;
  target_snapshot?: Record<string, unknown> | null;
  evidence_files?: unknown[] | null;
  status?: string | null;
};

const TARGET_LABELS: Record<string, string> = {
  carpool: '拼车信息',
  ranking: '红黑榜',
  comment: '红黑榜评论',
  commission: '委托需求',
  profile: '公开个人主页',
  dm_affiliation: 'DM 任职关系',
  dossier: 'DM / 店家档案',
  dossier_image: '档案图片',
  dm_rating: 'DM 评价',
  store_rating: '店家评价',
  role_rating: '角色点评',
  rating_reply: '评价回复',
  provider_listing: '委托师委托条',
  guide: '攻略',
  service: '个人主页服务',
  portfolio: '个人主页作品',
  portfolio_image: '作品图片',
};

const SNAPSHOT_LABELS: Record<string, string> = {
  display_name: '主页昵称',
  role_type: '用户身份',
  city: '城市',
  event_date: '活动日期',
  needed_date: '委托开始日期',
  needed_end_date: '委托结束日期',
  script_name: '剧本',
  role_name: '角色',
  poster_name: '发布人',
  author_name: '作者',
  profile_name: '评价人',
  workplace: '任职店家',
  entity_type: '档案类型',
  ranking_type: '榜单类型',
  ranking_title: '所属榜单',
  subject_type: '评价对象类型',
  target_type: '委托对象类型',
  target_name: '对象名称',
  review_lane: '点评栏目',
  rating: '评分',
  node_type: '回复类型',
  service_type: '服务类型',
  headline: '委托条标题',
  role_types: '擅长角色类型',
  guide_type: '攻略类型',
  image_reference: '被举报图片位置',
  ranking_id: '榜单编号',
  carpool_id: '拼车编号',
  profile_id: '主页编号',
  dossier_id: '档案编号',
  creator_id: '发布人编号',
  dm_name: '档案名称',
  title: '标题',
};

const SNAPSHOT_VALUE_LABELS: Record<string, Record<string, string>> = {
  ranking_type: { red: '红榜', black: '黑榜', white: '口碑榜' },
  subject_type: { creator: '委托师', dm: 'DM', store: '店家', player: '玩家' },
  role_type: { creator: '委托师', dm: 'DM', store: '店家', player: '玩家' },
  entity_type: { dm: 'DM', store: '店家' },
  review_lane: { spoiler_free: '无剧透体验', spoiler: '有剧透深度体验' },
};

export function reportTargetLabel(targetType: string) {
  return TARGET_LABELS[targetType] || `其他内容（${targetType || '未知类型'}）`;
}

export function reportTargetLocation(report: AdminReportPresentationInput) {
  const subId = String(report.target_sub_id || '').trim();
  if (subId) return subId;
  if (report.target_type === 'comment') return `评论 ${report.target_id}`;
  if (report.target_type === 'dossier_image' || report.target_type === 'portfolio_image') return '图片（未标注序号）';
  if (report.target_type === 'profile') return '整个公开主页（未标注具体字段）';
  return `内容 ${report.target_id}`;
}

export function reportTargetPath(report: AdminReportPresentationInput) {
  const snapshot = report.target_snapshot || {};
  const targetId = encodeURIComponent(report.target_id);
  if (report.target_type === 'ranking') return `/rankings/${targetId}`;
  if (report.target_type === 'comment' && typeof snapshot.ranking_id === 'string') {
    return `/rankings/${encodeURIComponent(snapshot.ranking_id)}`;
  }
  if (report.target_type === 'profile' || report.target_type === 'provider_listing') return `/explore/${targetId}`;
  if (report.target_type === 'dossier' || report.target_type === 'dossier_image') {
    return snapshot.entity_type === 'store' ? `/stores/${targetId}` : `/dm/${targetId}`;
  }
  if (report.target_type === 'carpool') return '/carpools';
  if (report.target_type === 'commission') return '/commissions';
  if (report.target_type === 'guide') return '/guides';
  return '';
}

export function reportInformationGap(report: AdminReportPresentationInput) {
  if (!privacyReportDetailError(report.reason, report.description)) return '';
  const hasEvidence = Array.isArray(report.evidence_files) && report.evidence_files.length > 0;
  return hasEvidence
    ? '举报人选择了“侵犯隐私”，但没有说明具体隐私项或出现位置。请结合证据复核，不要仅凭原因标签下架。'
    : '举报人只选择了“侵犯隐私”，没有说明具体隐私项、出现位置，也没有提交证据。现有信息不足，不能据此直接下架。';
}

export function reportSnapshotEntries(snapshot?: Record<string, unknown> | null) {
  if (!snapshot) return [];
  return Object.entries(snapshot)
    .filter(([key, value]) => key !== 'content_preview' && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: SNAPSHOT_LABELS[key] || key,
      value: formatSnapshotValue(key, value),
    }));
}

export function reportContentPreview(snapshot?: Record<string, unknown> | null) {
  return typeof snapshot?.content_preview === 'string' ? snapshot.content_preview.trim() : '';
}

export function reportStatusLabel(status?: string | null) {
  if (status === 'resolved') return '已处理';
  if (status === 'dismissed') return '暂不处理';
  return '待处理';
}

function formatSnapshotValue(key: string, value: unknown) {
  const mapped = SNAPSHOT_VALUE_LABELS[key]?.[String(value)];
  if (mapped) return mapped;
  if (Array.isArray(value)) return value.map(item => String(item)).join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}
