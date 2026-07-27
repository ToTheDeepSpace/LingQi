import type { AuthSession } from '../types'
import { PRIVACY_VERSION, TERMS_VERSION } from '../content/legalDocuments'
import { apiRequest, readAuth, writeAuth } from './api'

const LEGAL_CONSENT_KEY = 'jumulu:miniapp:legal-consent'

export function hasCurrentLegalConsent() {
  const consent = uni.getStorageSync(LEGAL_CONSENT_KEY) as { termsVersion?: string; privacyVersion?: string } | null
  return consent?.termsVersion === TERMS_VERSION && consent?.privacyVersion === PRIVACY_VERSION
}

function rememberLegalConsent() {
  uni.setStorageSync(LEGAL_CONSENT_KEY, {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptedAt: new Date().toISOString(),
  })
}

export async function refreshCurrentUser(options: { silent?: boolean } = {}) {
  const current = readAuth()
  if (!current?.token) return null
  try {
    let session = current
    if (session.auth_client !== 'wechat-miniapp') {
      const refreshed = await apiRequest<{ token: string; auth_client: 'wechat-miniapp' }>('/lc/miniapp/auth/refresh', {
        method: 'POST',
      })
      session = { ...session, ...refreshed }
      writeAuth(session)
    }
    const profile = await apiRequest<Omit<AuthSession, 'token'>>('/lc/me')
    const next = { ...session, ...profile, token: session.token }
    writeAuth(next)
    uni.$emit('jumulu:auth-changed', next)
    return next
  } catch (error) {
    if (!options.silent) throw error
    return null
  }
}

export async function loginWithWechat(options: { legalAccepted: boolean }) {
  if (!options.legalAccepted) throw new Error('请先阅读并同意用户协议和隐私政策')
  const login = await uni.login({ provider: 'weixin' })
  if (!login.code) throw new Error('微信登录凭证获取失败')
  const auth = await apiRequest<AuthSession>('/lc/miniapp/auth/wechat', {
    method: 'POST',
    data: {
      code: login.code,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    },
  })
  rememberLegalConsent()
  writeAuth(auth)
  uni.$emit('jumulu:auth-changed', auth)
  return auth
}

export function logout() {
  writeAuth(null)
  uni.$emit('jumulu:auth-changed', null)
}
