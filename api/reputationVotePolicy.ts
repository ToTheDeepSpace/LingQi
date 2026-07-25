export type ReputationVoteType = 'like' | 'dislike' | 'joy';
export type ReputationVoteChannel = 'stance' | 'joy';

export type ReputationVoteProfile = {
  phone?: string | null;
  phone_verified_at?: string | null;
  wechat_unionid?: string | null;
};

export function reputationVoteChannel(voteType: ReputationVoteType): ReputationVoteChannel {
  return voteType === 'joy' ? 'joy' : 'stance';
}

export function reputationVoteIdentityKind(profile: ReputationVoteProfile | null): 'phone' | 'wechat_unionid' | null {
  if (!profile) return null;
  if (profile.phone && profile.phone_verified_at) return 'phone';
  if (profile.wechat_unionid) return 'wechat_unionid';
  return null;
}

export function reputationVoteBlockReason(profile: ReputationVoteProfile | null): string {
  if (!profile) return '用户不存在';
  if (!reputationVoteIdentityKind(profile)) {
    return '投口碑票前请先验证手机号；已取得微信 UnionID 的账号也可以直接投票';
  }
  return '';
}
