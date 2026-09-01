import type { ReferralSummary } from '../types'
import { apiRequest, readAuth } from './api'

const INCOMING_REFERRAL_KEY = 'jumulu:referral:incoming'
const OWN_REFERRAL_KEY = 'jumulu:referral:own'

export const DEFAULT_SHARE_IMAGE = '/static/share/jumulu-share-default.jpg'

function normalizeReferralCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

export function rememberIncomingReferral(query?: Record<string, unknown> | null) {
  const code = normalizeReferralCode(query?.ref || query?.referralCode || query?.referral_code)
  if (code) uni.setStorageSync(INCOMING_REFERRAL_KEY, code)
  return code
}

export function readIncomingReferral() {
  return normalizeReferralCode(uni.getStorageSync(INCOMING_REFERRAL_KEY))
}

export function clearIncomingReferral() {
  uni.removeStorageSync(INCOMING_REFERRAL_KEY)
}

export function cacheOwnReferralCode(value: unknown) {
  const code = normalizeReferralCode(value)
  if (code) uni.setStorageSync(OWN_REFERRAL_KEY, code)
  return code
}

export function readOwnReferralCode() {
  return normalizeReferralCode(uni.getStorageSync(OWN_REFERRAL_KEY))
}

export async function loadReferralSummary() {
  if (!readAuth()?.token) return null
  const summary = await apiRequest<ReferralSummary>('/lc/referrals/me')
  cacheOwnReferralCode(summary.referral_code)
  return summary
}

export function sharePath(path: string, referralCode = readOwnReferralCode()) {
  const code = normalizeReferralCode(referralCode)
  if (!code || /(?:\?|&)ref=/.test(path)) return path
  return `${path}${path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(code)}`
}

export function shareQuery(query = '', referralCode = readOwnReferralCode()) {
  const normalized = String(query || '').trim().replace(/^\?/, '')
  const code = normalizeReferralCode(referralCode)
  if (!code || /(?:^|&)ref=/.test(normalized)) return normalized
  return [normalized, `ref=${encodeURIComponent(code)}`].filter(Boolean).join('&')
}

export function shareImage(preferred?: string | null) {
  const value = String(preferred || '').trim()
  return value || DEFAULT_SHARE_IMAGE
}

export function inviteSharePayload() {
  return {
    title: '来剧幕录查 DM 口碑，一起记录真实体验',
    path: sharePath('/pages/index/index'),
    imageUrl: DEFAULT_SHARE_IMAGE,
  }
}

export function pageSharePayload(title: string, path: string, preferredImage?: string | null) {
  return {
    title,
    path: sharePath(path),
    imageUrl: shareImage(preferredImage),
  }
}

export function timelineSharePayload(title: string, query = '', preferredImage?: string | null) {
  return {
    title,
    query: shareQuery(query),
    imageUrl: shareImage(preferredImage),
  }
}
