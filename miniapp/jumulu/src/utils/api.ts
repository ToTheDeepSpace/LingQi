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

export function decoded(value: string | number | null | undefined) {
  const text = String(value ?? '')
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
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
  sandbox_test_completed?: boolean
}

type ServicePaymentCreation = {
  purchase: ServicePurchase
  already_paid: boolean
  payment?: {
    mode: 'short_series_goods'
    signData: string
    paySig: string
    signature: string
    expires_at: string
    sandbox_test?: boolean
    amount_fen?: number
    amount_yuan?: string
  }
}

type WechatVirtualPaymentRuntime = {
  requestVirtualPayment(options: Omit<NonNullable<ServicePaymentCreation['payment']>, 'expires_at'> & {
    success: () => void
    fail: (reason: unknown) => void
  }): void
}

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function virtualPaymentError(reason: unknown) {
  const payload = reason && typeof reason === 'object'
    ? reason as { errCode?: number; err_code?: number; errMsg?: string; message?: string }
    : {}
  const code = Number(payload.errCode ?? payload.err_code)
  const raw = payload.errMsg || payload.message || errorText(reason, '支付未完成')
  if (code === -2 || /cancel/i.test(raw)) return new Error('已取消支付', { cause: reason })
  if (code === -4) return new Error('本次支付被微信风控拦截，请稍后重试', { cause: reason })
  if (code === -15002) return new Error('订单号已使用，请重新点击支付', { cause: reason })
  if ([-15005, -15006, -15007].includes(code) || /signature|签名|session/i.test(raw)) {
    return new Error('微信支付会话已失效，请重新发起支付', { cause: reason })
  }
  if (code === -15008) return new Error('微信虚拟支付商户配置尚未完成', { cause: reason })
  if (code === -15010 || /not.?publish|未发布|商品不存在/i.test(raw)) {
    return new Error('该虚拟道具尚未发布，请联系平台处理', { cause: reason })
  }
  if (code === -15011) return new Error('当前小程序版本与支付环境不匹配', { cause: reason })
  if (code === -15013) return new Error('道具价格与微信后台不一致，请联系平台处理', { cause: reason })
  if (code === -15014) return new Error('道具刚发布尚未生效，请约十分钟后重试', { cause: reason })
  if (code === -15018) return new Error('该虚拟道具未通过微信审核，请联系平台处理', { cause: reason })
  if (code === -15020) return new Error('操作太快，请稍后再试', { cause: reason })
  if (code === -15021) return new Error('小程序交易暂时受限，请稍后再试', { cause: reason })
  return new Error(raw, { cause: reason })
}

export async function requestServicePayment(productType: ServiceProductType, targetId: string) {
  await requireLogin()
  const login = await new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({ provider: 'weixin', success: resolve, fail: reject })
  })
  if (!login.code) throw new Error('微信登录会话获取失败，请重试')
  const creation = await apiRequest<ServicePaymentCreation>('/lc/miniapp/virtual-service-payments/create', {
    method: 'POST',
    data: { productType, targetId, loginCode: login.code },
  })
  if (creation.already_paid || creation.purchase.paid) return creation.purchase
  if (!creation.payment) throw new Error('微信虚拟支付参数缺失，请稍后重试')
  if (creation.payment.sandbox_test) {
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '沙箱支付测试',
        content: `本次只支付 ${creation.payment?.amount_yuan || '0.01'} 元，用于验证微信支付链路，不会开通正式服务权益。是否继续？`,
        confirmText: '继续测试',
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) throw new Error('已取消支付测试')
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const wechat = (globalThis as unknown as { wx: WechatVirtualPaymentRuntime }).wx
      if (!wechat?.requestVirtualPayment) {
        reject(new Error('当前微信版本不支持虚拟支付，请升级微信后重试'))
        return
      }
      const payment = creation.payment!
      wechat.requestVirtualPayment({
        mode: payment.mode,
        signData: payment.signData,
        paySig: payment.paySig,
        signature: payment.signature,
        success: () => resolve(),
        fail: reject,
      })
    })
  } catch (reason) {
    throw virtualPaymentError(reason)
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const purchase = await apiRequest<ServicePurchase>(
        `/lc/service-payments/${encoded(creation.purchase.id)}/status?refresh=1`,
      )
      if (purchase.sandbox_test_completed) {
        throw new Error('沙箱支付测试完成：已支付 0.01 元，未开通正式服务权益')
      }
      if (purchase.paid) return purchase
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes('沙箱支付测试完成')) throw reason
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
