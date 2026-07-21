import type { AuthSession } from '../types'
import { apiRequest, readAuth, writeAuth } from './api'

export async function refreshCurrentUser(options: { silent?: boolean } = {}) {
  const current = readAuth()
  if (!current?.token) return null
  try {
    const profile = await apiRequest<Omit<AuthSession, 'token'>>('/lc/me')
    const next = { ...current, ...profile, token: current.token }
    writeAuth(next)
    uni.$emit('jumulu:auth-changed', next)
    return next
  } catch (error) {
    if (!options.silent) throw error
    return null
  }
}

export async function loginWithWechat(displayName: string) {
  const name = displayName.trim()
  if (!name) throw new Error('首次注册请填写昵称')
  const login = await uni.login({ provider: 'weixin' })
  if (!login.code) throw new Error('微信登录凭证获取失败')
  const auth = await apiRequest<AuthSession>('/lc/miniapp/auth/wechat', {
    method: 'POST',
    data: { code: login.code, displayName: name },
  })
  writeAuth(auth)
  uni.$emit('jumulu:auth-changed', auth)
  return auth
}

export function logout() {
  writeAuth(null)
  uni.$emit('jumulu:auth-changed', null)
}
