<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { ProviderListing } from '../../types'
import { apiRequest, readAuth, requestServicePayment, requireLogin, uploadImageFile } from '../../utils/api'

type ListingState = {
  listing: ProviderListing | null
  latest_review?: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    review_note?: string | null
    created_at?: string | null
  } | null
  business_contact?: string | null
  contact_available?: boolean
  initial_fee_paid?: boolean
  initial_fee_yuan?: string
}

const state = ref<ListingState | null>(null)
const posterUrl = ref('')
const headline = ref('')
const description = ref('')
const heightCm = ref('')
const weightKg = ref('')
const roleTypesText = ref('')
const businessContact = ref('')
const contactAvailable = ref(true)
const loading = ref(false)
const uploading = ref(false)
const submitting = ref(false)
const toggling = ref(false)
const error = ref('')
const pending = computed(() => state.value?.latest_review?.status === 'pending')

function fill(listing: ProviderListing | null) {
  posterUrl.value = listing?.poster_url || ''
  headline.value = listing?.headline || ''
  description.value = listing?.description || ''
  heightCm.value = listing?.height_cm ? String(listing.height_cm) : ''
  weightKg.value = listing?.weight_kg ? String(listing.weight_kg) : ''
  roleTypesText.value = (listing?.role_types || []).join('、')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await requireLogin()
    state.value = await apiRequest<ListingState>('/lc/provider-listings/mine')
    fill(state.value.listing)
    businessContact.value = state.value.business_contact || ''
    contactAvailable.value = state.value.contact_available !== false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '委托条加载失败'
  } finally {
    loading.value = false
  }
}

async function choosePoster() {
  if (uploading.value) return
  try {
    const filePath = await new Promise<string>((resolve, reject) => {
      uni.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: result => resolve(result.tempFiles?.[0]?.tempFilePath || ''),
        fail: reject,
      })
    })
    if (!filePath) return
    uploading.value = true
    posterUrl.value = await uploadImageFile(filePath, 'commission-provider')
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    if (message && !message.includes('cancel')) uni.showToast({ title: message, icon: 'none' })
  } finally {
    uploading.value = false
  }
}

function roleTypes() {
  return roleTypesText.value.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean).slice(0, 12)
}

async function submit() {
  if (!posterUrl.value || submitting.value || pending.value) {
    if (!posterUrl.value) uni.showToast({ title: '请先上传委托条主图', icon: 'none' })
    return
  }
  submitting.value = true
  error.value = ''
  try {
    if (!businessContact.value.trim()) throw new Error('请填写用于付费解锁的业务联系方式')
    if (!state.value?.listing && !state.value?.initial_fee_paid) {
      const auth = readAuth()
      if (!auth?.id) throw new Error('请先登录')
      await requestServicePayment('provider_listing', auth.id)
      state.value = { ...state.value!, initial_fee_paid: true }
    }
    await apiRequest('/lc/provider-listings/mine', {
      method: 'POST',
      data: {
        posterUrl: posterUrl.value,
        headline: headline.value.trim(),
        description: description.value.trim(),
        heightCm: heightCm.value || null,
        weightKg: weightKg.value || null,
        roleTypes: roleTypes(),
        businessContact: businessContact.value.trim(),
        contactAvailable: contactAvailable.value,
      },
    })
    uni.showModal({
      title: '已提交审核',
      content: '现有已通过版本会继续展示；首次发布则在审核通过后公开。',
      showCancel: false,
      success: () => uni.navigateBack(),
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

async function toggleActive() {
  const listing = state.value?.listing
  if (!listing || toggling.value) return
  toggling.value = true
  try {
    const next = await apiRequest<ProviderListing>('/lc/provider-listings/mine/active', {
      method: 'PUT',
      data: { active: !listing.is_active },
    })
    state.value = { ...state.value!, listing: next }
    uni.showToast({ title: next.is_active ? '已重新展示' : '已下架', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    toggling.value = false
  }
}

async function toggleContactAvailable() {
  if (!state.value?.listing || toggling.value) return
  toggling.value = true
  try {
    const next = !contactAvailable.value
    await apiRequest('/lc/provider-listings/mine/contact-available', {
      method: 'PUT',
      data: { available: next },
    })
    contactAvailable.value = next
    uni.showToast({ title: next ? '已开放联系' : '已暂停联系', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    toggling.value = false
  }
}

onShow(() => void load())
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="委托师资料" nav-title="我的委托条" title="我的委托条" description="一张主图加必要资料，审核通过后出现在委托师列表。" fallback="/pages/commissions/index" />
    <StatePanel :loading="loading" :error="error && !state ? error : ''" :empty="false" @retry="load" />
    <template v-if="state && !loading">
      <view v-if="pending" class="review-status pending">新版本正在人工审核</view>
      <view v-else-if="state.latest_review?.status === 'rejected'" class="review-status rejected">
        上次提交未通过：{{ state.latest_review.review_note || '请调整公开内容后重新提交' }}
      </view>
      <view v-if="!state.listing && !state.initial_fee_paid" class="fee-notice">
        <strong>首次上架 8.88 元</strong>
        <text>提交时唤起微信支付，审核通过后公开。以后修改委托条不再收费，但每次修改仍需审核。</text>
      </view>

      <view class="poster-field" @tap="choosePoster">
        <image v-if="posterUrl" :src="posterUrl" mode="aspectFill" />
        <view v-else class="poster-empty"><text>{{ uploading ? '上传中...' : '上传委托条主图' }}</text></view>
        <text v-if="posterUrl" class="poster-change">{{ uploading ? '上传中...' : '更换图片' }}</text>
      </view>

      <view class="form-grid">
        <view class="field full">
          <text class="field-label">一句话介绍</text>
          <input v-model="headline" class="input" maxlength="80" placeholder="例如：周末可约，偏情感陪伴位" />
        </view>
        <view class="field compact">
          <text class="field-label">身高（cm）</text>
          <input v-model="heightCm" class="input" type="number" maxlength="3" placeholder="100-250" />
        </view>
        <view class="field compact">
          <text class="field-label">体重（kg）</text>
          <input v-model="weightKg" class="input" type="number" maxlength="3" placeholder="30-300" />
        </view>
        <view class="field full">
          <text class="field-label">擅长角色类型</text>
          <input v-model="roleTypesText" class="input" maxlength="240" placeholder="用逗号分隔，例如：强势位、温柔陪伴、欢乐位" />
        </view>
        <view class="field full">
          <text class="field-label">补充说明</text>
          <textarea v-model="description" class="textarea" maxlength="1200" placeholder="档期、可服务城市和其他希望公开说明的内容" />
        </view>
        <view class="field full">
          <text class="field-label">业务联系方式 *</text>
          <input v-model="businessContact" class="input" maxlength="300" placeholder="微信号、手机号或其他专门用于接委托的方式" />
          <text class="field-hint">不会直接公开，只有同一用户支付一次 8.88 元后才可永久查看。</text>
        </view>
      </view>

      <view v-if="state.listing" class="listing-state">
        <view><strong>公开状态</strong><text>{{ state.listing.is_active ? '正在展示' : '已下架' }}</text></view>
        <button class="secondary-button" :loading="toggling" @tap="toggleActive">{{ state.listing.is_active ? '下架' : '重新展示' }}</button>
      </view>
      <view v-if="state.listing" class="listing-state">
        <view><strong>联系方式</strong><text>{{ contactAvailable ? '已向付费用户开放' : '已暂停显示' }}</text></view>
        <button class="secondary-button" :loading="toggling" @tap="toggleContactAvailable">{{ contactAvailable ? '暂停联系' : '重新开放' }}</button>
      </view>
      <text v-if="error" class="form-error">{{ error }}</text>
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting || pending" @tap="submit">{{ pending ? '等待审核' : !state.listing && !state.initial_fee_paid ? '支付 8.88 元并提交' : '提交审核' }}</button></view>
    </template>
  </view>
</template>

<style scoped>
.review-status { margin: 14rpx 0; padding: 15rpx 18rpx; border-radius: 8rpx; font-size: 22rpx; font-weight: 750; }
.review-status.pending { background: #fff6e4; color: #8b5919; }
.review-status.rejected { background: #fff1f0; color: #a53232; }
.fee-notice { margin-top: 14rpx; padding: 16rpx 18rpx; border: 1rpx solid #e7c88c; border-radius: 8rpx; background: #fff8e8; }
.fee-notice strong, .fee-notice text { display: block; }
.fee-notice strong { color: #8b5919; font-size: 25rpx; }
.fee-notice text, .field-hint { margin-top: 6rpx; color: #735b39; font-size: 21rpx; line-height: 1.55; }
.poster-field { position: relative; width: 100%; aspect-ratio: 16 / 9; margin-top: 14rpx; overflow: hidden; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #f5f2ec; }
.poster-field image { width: 100%; height: 100%; }
.poster-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #8b5919; font-size: 26rpx; font-weight: 850; }
.poster-change { position: absolute; right: 14rpx; bottom: 14rpx; padding: 8rpx 12rpx; border-radius: 6rpx; background: rgba(31,41,55,.78); color: #fff; font-size: 20rpx; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12rpx; }
.field.full { grid-column: 1 / -1; }
.field-label { margin-top: 18rpx; }
.textarea { min-height: 150rpx; }
.listing-state { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-top: 18rpx; padding: 16rpx 0; border-top: 1rpx solid #eceff2; }
.listing-state strong, .listing-state text { display: block; }
.listing-state strong { color: #27364a; font-size: 24rpx; }
.listing-state text { margin-top: 4rpx; color: #64748b; font-size: 21rpx; }
.listing-state button { width: auto; min-height: 60rpx; margin: 0; padding: 0 20rpx; font-size: 22rpx; line-height: 60rpx; }
.form-error { display: block; margin-top: 12rpx; color: #a53232; font-size: 22rpx; }
.submit { width: 100%; }
</style>
