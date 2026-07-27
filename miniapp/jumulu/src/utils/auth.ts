import type { AuthSession } from '../types'
import { apiRequest, readAuth, writeAuth } from './api'

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

export async function loginWithWechat() {
  const login = await uni.login({ provider: 'weixin' })
  if (!login.code) throw new Error('微信登录凭证获取失败')
  const auth = await apiRequest<AuthSession>('/lc/miniapp/auth/wechat', {
    method: 'POST',
    data: { code: login.code },
  })
  writeAuth(auth)
  uni.$emit('jumulu:auth-changed', auth)
  return auth
}

export function logout() {
  writeAuth(null)
  uni.$emit('jumulu:auth-changed', null)
}
