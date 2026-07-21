import type { ApiEnvelope, AuthSession } from '../types'

export const API_BASE = 'https://jumulu.jusichen.com/api'
const AUTH_KEY = 'jumulu:miniapp:auth'

export function readAuth(): AuthSession | null {
  return uni.getStorageSync(AUTH_KEY) || null
}

export function writeAuth(auth: AuthSession | null) {
  if (auth) uni.setStorageSync(AUTH_KEY, auth)
  else uni.removeStorageSync(AUTH_KEY)
}

function errorText(value: unknown, fallback = '请求失败') {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') return value.message
  return fallback
}

type ApiRequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail' | 'complete'>

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const auth = readAuth()
  const header: Record<string, string> = {
    'content-type': 'application/json',
    'X-LC-Client': 'wechat-miniapp',
    ...((options.header || {}) as Record<string, string>),
  }
  if (auth?.token) header.Authorization = `Bearer ${auth.token}`

  const response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
    uni.request({
      ...options,
      url: `${API_BASE}${path}`,
      header,
      success: resolve,
      fail: reject,
    })
  })
  const body = response.data as ApiEnvelope<T>
  if (response.statusCode === 401) {
    writeAuth(null)
    uni.$emit('jumulu:auth-changed')
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || !body?.success) {
    throw new Error(errorText(body?.error, `请求失败 ${response.statusCode}`))
  }
  return body.data
}

export function encoded(value: string | number | null | undefined) {
  return encodeURIComponent(String(value ?? ''))
}

export async function requireLogin(): Promise<AuthSession> {
  const auth = readAuth()
  if (auth?.token) return auth
  uni.showToast({ title: '请先登录', icon: 'none' })
  uni.switchTab({ url: '/pages/mine/index' })
  throw new Error('请先登录')
}

export async function checkMiniContent(content: string, scene: string) {
  if (!content.trim()) return
  await apiRequest<{ checked: boolean }>('/lc/miniapp/content-check', {
    method: 'POST',
    data: { content: content.trim(), scene },
  })
}
