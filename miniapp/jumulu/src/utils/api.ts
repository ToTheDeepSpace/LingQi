import type { ApiEnvelope, AuthSession } from '../types'

let runtimeApiBase = 'https://jumulu.jusichen.com/api'
// #ifdef H5
if (import.meta.env.DEV) runtimeApiBase = '/api'
// #endif
export const API_BASE = runtimeApiBase
const AUTH_KEY = 'jumulu:miniapp:auth'
let mergedAccountPromptOpen = false

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
  if (response.statusCode === 401 || body?.code === 'ACCOUNT_MERGED') {
    writeAuth(null)
    uni.$emit('jumulu:auth-changed')
  }
  if (body?.code === 'ACCOUNT_MERGED' && !mergedAccountPromptOpen) {
    mergedAccountPromptOpen = true
    uni.showModal({
      title: '账号已合并',
      content: errorText(body.error, '微信临时账号已经合并，请重新登录原网站账号。'),
      showCancel: false,
      confirmText: '重新登录',
      complete: () => {
        mergedAccountPromptOpen = false
        uni.switchTab({ url: '/pages/mine/index' })
      },
    })
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

export async function uploadImageFile(filePath: string, scope: string) {
  const auth = await requireLogin()
  const response = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE}/lc/upload`,
      filePath,
      name: 'file',
      formData: { scope },
      header: { Authorization: `Bearer ${auth.token}`, 'X-LC-Client': 'wechat-miniapp' },
      success: resolve,
      fail: reject,
    })
  })
  let body: ApiEnvelope<{
    url: string
    content_check?: { id: string; status: 'pending' | 'pass' | 'review' | 'risky' | 'error'; trace_id?: string | null } | null
  }>
  try {
    body = JSON.parse(response.data) as ApiEnvelope<{
      url: string
      content_check?: { id: string; status: 'pending' | 'pass' | 'review' | 'risky' | 'error'; trace_id?: string | null } | null
    }>
  }
  catch { throw new Error('图片上传返回格式不正确') }
  if (body.code === 'ACCOUNT_MERGED') {
    writeAuth(null)
    uni.$emit('jumulu:auth-changed')
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || !body.success || !body.data?.url) {
    throw new Error(errorText(body.error, `图片上传失败 ${response.statusCode}`))
  }
  if (body.data.content_check?.status === 'pending') {
    uni.showToast({ title: '图片安全检查中', icon: 'none' })
  }
  return body.data.url
}

export async function uploadPrivateEvidence(filePath: string, kind: 'report' | 'feedback', recordId: string) {
  const auth = await requireLogin()
  const route = kind === 'report'
    ? `/lc/reports/${encoded(recordId)}/evidence`
    : `/lc/site-messages/${encoded(recordId)}/evidence`
  const response = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE}${route}`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${auth.token}`, 'X-LC-Client': 'wechat-miniapp' },
      success: resolve,
      fail: reject,
    })
  })
  let body: ApiEnvelope<{ file: { id: string; name: string } }>
  try { body = JSON.parse(response.data) as ApiEnvelope<{ file: { id: string; name: string } }> }
  catch { throw new Error('私密图片上传返回格式不正确') }
  if (response.statusCode < 200 || response.statusCode >= 300 || !body.success || !body.data?.file?.id) {
    throw new Error(errorText(body.error, `私密图片上传失败 ${response.statusCode}`))
  }
  return body.data.file
}

export type ServiceProductType = 'dossier_claim' | 'provider_listing' | 'provider_contact'

export type ServicePurchase = {
  id: string
  product_type: ServiceProductType
  target_id: string
  amount_fen: number
  amount_yuan: string
  status: 'unpaid' | 'paid' | 'refunded'
  paid: boolean
  paid_at?: string | null
  contact_available?: boolean
  business_contact?: string | null
  contact_updated_at?: string | null
}

type ServicePaymentCreation = {
  purchase: ServicePurchase
  already_paid: boolean
  payment?: {
    timeStamp: string
    nonceStr: string
    package: string
    signType: 'RSA'
    paySign: string
    out_trade_no: string
    expires_at: string
  }
}

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export async function requestServicePayment(productType: ServiceProductType, targetId: string) {
  await requireLogin()
  const creation = await apiRequest<ServicePaymentCreation>('/lc/service-payments/create', {
    method: 'POST',
    data: { productType, targetId },
  })
  if (creation.already_paid || creation.purchase.paid) return creation.purchase
  if (!creation.payment) throw new Error('微信支付参数缺失，请稍后重试')

  try {
    await new Promise<void>((resolve, reject) => {
      const paymentOptions = {
        provider: 'wxpay',
        timeStamp: creation.payment!.timeStamp,
        nonceStr: creation.payment!.nonceStr,
        package: creation.payment!.package,
        signType: creation.payment!.signType,
        paySign: creation.payment!.paySign,
        success: () => resolve(),
        fail: reject,
      } as unknown as UniApp.RequestPaymentOptions
      uni.requestPayment(paymentOptions)
    })
  } catch (reason) {
    const message = errorText(reason, '支付未完成')
    if (/cancel/i.test(message)) throw new Error('已取消支付', { cause: reason })
    throw new Error(message, { cause: reason })
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const purchase = await apiRequest<ServicePurchase>(
        `/lc/service-payments/${encoded(creation.purchase.id)}/status?refresh=1`,
      )
      if (purchase.paid) return purchase
    } catch {
      // 微信回调可能略晚于客户端返回，继续向服务端确认。
    }
    await wait(700 + attempt * 150)
  }
  throw new Error('支付结果仍在确认中，请稍后重试；同一项目不会重复收费')
}

export async function submitDossierClaim(input: {
  dossierId: string
  proofType: string
  claimNote: string
  proofFilePath: string
}) {
  const auth = await requireLogin()
  const response = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE}/lc/dm-dossiers/${encoded(input.dossierId)}/claim`,
      filePath: input.proofFilePath,
      name: 'proofFiles',
      formData: {
        proofType: input.proofType,
        claimNote: input.claimNote,
        truthConfirmed: 'true',
      },
      header: { Authorization: `Bearer ${auth.token}`, 'X-LC-Client': 'wechat-miniapp' },
      success: resolve,
      fail: reject,
    })
  })
  let body: ApiEnvelope<{ id: string; claim_id: string; claim_status: string }>
  try { body = JSON.parse(response.data) as ApiEnvelope<{ id: string; claim_id: string; claim_status: string }> }
  catch { throw new Error('认领提交返回格式不正确') }
  if (response.statusCode < 200 || response.statusCode >= 300 || !body.success) {
    throw new Error(errorText(body.error, `认领提交失败 ${response.statusCode}`))
  }
  return body.data
}
