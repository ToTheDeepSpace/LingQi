export type AuthAccountKind = 'phone' | 'email';
export type AuthStep = 'account' | 'password' | 'register' | 'reset';

export type AuthIdentityResult = {
  exists: boolean;
  hasPassword: boolean;
};

export type AuthConfig = {
  wechatEnabled?: boolean;
};

export function phoneDigits(input: string) {
  return input.replace(/\D/g, '');
}

export function isValidPhone(input: string) {
  return /^1[3-9]\d{9}$/.test(phoneDigits(input));
}

export function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function getAuthAccountKind(input: string): AuthAccountKind | null {
  if (isValidPhone(input)) return 'phone';
  if (isValidEmail(input)) return 'email';
  return null;
}

export function normalizeAuthAccount(input: string, kind: AuthAccountKind) {
  return kind === 'phone' ? phoneDigits(input) : input.trim().toLowerCase();
}

export function getNextAuthStep(result: AuthIdentityResult): { step: AuthStep; message: string } {
  if (!result.exists) {
    return { step: 'register', message: '这个账号还没有注册，先获取验证码创建账号。' };
  }
  if (!result.hasPassword) {
    return { step: 'reset', message: '这个账号已经注册，但还没有设置网页登录密码，请先验证账号并设置密码。' };
  }
  return { step: 'password', message: '这个账号已经注册，直接输入密码登录就行。' };
}

export function shouldShowWechatLogin(config: AuthConfig | null | undefined) {
  return Boolean(config?.wechatEnabled);
}
