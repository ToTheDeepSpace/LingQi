type ProfileLike = Record<string, unknown>;

function integerBalance(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

export function miniappAccountMergePreflight(source: ProfileLike, target: ProfileLike): string | null {
  if (!source.id || !target.id || source.id === target.id) return '账号合并目标不正确';
  if (source.auth_provider !== 'wechat_miniapp' || !source.wechat_mini_openid || source.phone) {
    return '当前账号不是可自动合并的临时微信账号';
  }
  if (source.wechat_openid || source.email || source.password_hash) {
    return '当前账号还绑定了其他登录方式，请联系客服处理';
  }
  if (integerBalance(source.paid_balance) !== 0
      || integerBalance(source.balance) !== 30
      || integerBalance(source.bonus_balance) !== 30) {
    return '当前微信账号已有余额变化，请联系客服合并账号';
  }
  if (target.is_banned) return '原网站账号已被限制登录，请联系管理员申诉';
  if (!target.phone || !target.phone_verified_at) return '原网站账号尚未完成手机号验证';
  if (target.wechat_mini_openid && target.wechat_mini_openid !== source.wechat_mini_openid) {
    return '原网站账号已经绑定其他小程序微信，请联系客服处理';
  }
  if (source.wechat_unionid && target.wechat_unionid && source.wechat_unionid !== target.wechat_unionid) {
    return '原网站账号已经绑定其他微信身份，请联系客服处理';
  }
  return null;
}

export function miniappAccountMergeErrorMessage(error: unknown) {
  const text = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : String(error || '');
  if (text.includes('MINIAPP_ACCOUNT_HAS_ACTIVITY')) return '当前微信账号已有发布、互动或关联资料，请联系客服合并账号';
  if (text.includes('MINIAPP_ACCOUNT_WALLET_CHANGED')) return '当前微信账号已有余额变化，请联系客服合并账号';
  if (text.includes('TARGET_WECHAT_CONFLICT')) return '原网站账号已经绑定其他微信身份，请联系客服处理';
  if (text.includes('TARGET_PHONE_MISMATCH')) return '手机号验证结果与原网站账号不一致，请重新获取验证码';
  if (text.includes('SOURCE_NOT_PRISTINE_MINIAPP')) return '当前账号不是可自动合并的临时微信账号';
  if (text.includes('PROFILE_NOT_FOUND')) return '账号不存在，请重新登录后再试';
  return '账号暂时无法自动合并，请联系客服处理';
}
