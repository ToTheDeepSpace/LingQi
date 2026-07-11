export const PROFILE_REVIEW_FIELD_LABELS: Record<string, string> = {
  display_name: '昵称',
  avatar: '头像',
  bio: '个人简介',
  tags: '个人标签',
  city: '常驻城市',
  social_links: '社交主页',
  wechat: '微信号',
  available_cities: '可服务城市',
  travel_status: '常驻状态',
  contact_unlock_enabled: '联系方式解锁',
  contact_intent_amount: '联系意向金额',
  gender: '性别',
  sexual_orientation: '性取向',
  preferred_story_lines: '偏好故事线',
  avatar_focus_x: '头像展示位置',
  avatar_focus_y: '头像展示位置',
};

const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  weibo: '微博',
  bilibili: '哔哩哔哩',
  kuaishou: '快手',
  other: '其他主页',
};

function comparableValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function valueText(field: string, value: unknown) {
  if (field === 'avatar') return value ? '已上传新头像' : '移除头像';
  if (field === 'avatar_focus_x' || field === 'avatar_focus_y') return '已调整';
  if (field === 'contact_unlock_enabled') return value ? '开启' : '关闭';
  if (field === 'contact_intent_amount') return Number(value || 0) > 0 ? `${Number(value)} 契约币` : '不设置';
  if (field === 'social_links' && value && typeof value === 'object' && !Array.isArray(value)) {
    const links = Object.entries(value as Record<string, unknown>)
      .filter(([, url]) => typeof url === 'string' && url.trim())
      .map(([platform, url]) => `${SOCIAL_PLATFORM_LABELS[platform] || platform}：${String(url)}`);
    return links.length > 0 ? links.join('；') : '未填写';
  }
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join('、') : '未填写';
  if (value && typeof value === 'object') return '已更新';
  return value === undefined || value === null || value === '' ? '未填写' : String(value);
}

export function summarizeProfileReviewPayload(
  payload?: Record<string, unknown> | null,
  fallbackBefore?: Record<string, unknown> | null,
) {
  if (!payload || typeof payload !== 'object') return [];
  const patch = payload.profile_patch && typeof payload.profile_patch === 'object' && !Array.isArray(payload.profile_patch)
    ? payload.profile_patch as Record<string, unknown>
    : {};
  const savedBefore = payload.before_snapshot && typeof payload.before_snapshot === 'object' && !Array.isArray(payload.before_snapshot)
    ? payload.before_snapshot as Record<string, unknown>
    : null;
  const before = savedBefore || fallbackBefore || {};
  const hasReliableBefore = Boolean(savedBefore || fallbackBefore);
  const requestedFields = Array.isArray(payload.changed_fields)
    ? payload.changed_fields.map(String)
    : Object.keys(patch);
  const fields = requestedFields.filter(field => PROFILE_REVIEW_FIELD_LABELS[field] && field !== 'social_snapshots');
  const lines: string[] = [];
  const handled = new Set<string>();

  for (const field of fields) {
    if (field === 'avatar_focus_x' || field === 'avatar_focus_y') {
      if (handled.has('avatar_focus')) continue;
      handled.add('avatar_focus');
      const focusFields = ['avatar_focus_x', 'avatar_focus_y'].filter(key => key in patch);
      if (hasReliableBefore && focusFields.every(key => comparableValue(before[key]) === comparableValue(patch[key]))) continue;
      lines.push('头像展示位置：已调整');
      continue;
    }
    if (handled.has(field) || !(field in patch)) continue;
    handled.add(field);
    const nextValue = patch[field];
    const previousValue = before[field];
    if (hasReliableBefore && comparableValue(previousValue) === comparableValue(nextValue)) continue;
    const label = PROFILE_REVIEW_FIELD_LABELS[field];
    if (field === 'avatar') {
      lines.push(`${label}：${valueText(field, nextValue)}`);
    } else if (hasReliableBefore && Object.prototype.hasOwnProperty.call(before, field)) {
      lines.push(`${label}：${valueText(field, previousValue)} → ${valueText(field, nextValue)}`);
    } else {
      lines.push(`${label}：${valueText(field, nextValue)}`);
    }
  }

  if (Array.isArray(payload.role_preferences)) {
    const roles = (payload.role_preferences as Array<Record<string, unknown>>)
      .map(item => [item.script_name, item.role_name].filter(Boolean).join(' · '))
      .filter(Boolean);
    lines.push(`可接角色：${roles.length > 0 ? roles.join('；') : '已清空'}`);
  }
  return lines;
}

export const ADMIN_REVIEW_ACTIONS: Record<string, { label: string; outcome: 'approved' | 'rejected' | 'updated' }> = {
  admin_public_review_approved: { label: '公开内容审核', outcome: 'approved' },
  admin_public_review_rejected: { label: '公开内容审核', outcome: 'rejected' },
  admin_dm_dossier_approved: { label: 'DM / 店家建档审核', outcome: 'approved' },
  admin_dm_dossier_rejected: { label: 'DM / 店家建档审核', outcome: 'rejected' },
  admin_dm_dossier_claim_approved: { label: 'DM / 店家认领审核', outcome: 'approved' },
  admin_dm_dossier_claim_rejected: { label: 'DM / 店家认领审核', outcome: 'rejected' },
  admin_dm_dossier_merged: { label: 'DM档案合并', outcome: 'updated' },
  admin_store_dossier_merged: { label: '店家档案合并', outcome: 'updated' },
  admin_dm_rating_approved: { label: 'DM评分审核', outcome: 'approved' },
  admin_dm_rating_rejected: { label: 'DM评分审核', outcome: 'rejected' },
  admin_store_rating_approved: { label: '店家评分审核', outcome: 'approved' },
  admin_store_rating_rejected: { label: '店家评分审核', outcome: 'rejected' },
  admin_dm_identity_withdrawal_approved: { label: 'DM认证撤销', outcome: 'approved' },
  admin_dm_identity_withdrawal_rejected: { label: 'DM认证撤销', outcome: 'rejected' },
  admin_certification_approved: { label: '身份认证审核', outcome: 'approved' },
  admin_certification_rejected: { label: '身份认证审核', outcome: 'rejected' },
  admin_ranking_approved: { label: '红黑榜审核', outcome: 'approved' },
  admin_ranking_rejected: { label: '红黑榜审核', outcome: 'rejected' },
  admin_ranking_edited: { label: '红黑榜编辑', outcome: 'updated' },
  admin_script_contribution_approved: { label: '剧本库共建审核', outcome: 'approved' },
  admin_script_contribution_rejected: { label: '剧本库共建审核', outcome: 'rejected' },
  admin_guide_approved: { label: '攻略审核', outcome: 'approved' },
  admin_guide_rejected: { label: '攻略审核', outcome: 'rejected' },
  admin_guide_withdrawal_paid: { label: '创作者提现', outcome: 'approved' },
  admin_guide_withdrawal_rejected: { label: '创作者提现', outcome: 'rejected' },
  admin_commission_approved: { label: '委托需求审核', outcome: 'approved' },
  admin_commission_rejected: { label: '委托需求审核', outcome: 'rejected' },
  admin_carpool_approved: { label: '拼车审核', outcome: 'approved' },
  admin_carpool_rejected: { label: '拼车审核', outcome: 'rejected' },
  admin_wallet_recharge_approved: { label: '充值审核', outcome: 'approved' },
  admin_wallet_recharge_rejected: { label: '充值审核', outcome: 'rejected' },
  admin_profile_hidden: { label: '主页下线', outcome: 'updated' },
  admin_profile_restored: { label: '主页恢复', outcome: 'updated' },
  admin_profile_banned: { label: '账号限制', outcome: 'updated' },
  admin_profile_unbanned: { label: '解除账号限制', outcome: 'updated' },
  site_message_resolved: { label: '反馈处理', outcome: 'updated' },
};

export function moderationHistoryMetadataLines(metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== 'object') return [];
  const labels: Record<string, string> = {
    reason: '处理原因',
    reject_reason: '拒绝原因',
    review_note: '审核备注',
    admin_note: '管理员备注',
    reward_amount: '发放奖励',
    amount: '金额',
    entity_type: '对象类型',
  };
  return Object.entries(labels)
    .filter(([key]) => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '')
    .map(([key, label]) => `${label}：${String(metadata[key])}`);
}
