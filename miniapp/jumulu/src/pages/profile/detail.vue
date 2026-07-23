<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { ProviderListing } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'

type Profile = { id: string; display_name: string; avatar?: string | null; avatar_focus_x?: number | null; avatar_focus_y?: number | null; city?: string | null; bio?: string | null; tags?: string[]; identity_roles?: string[]; services?: Array<{ id: string; service_type?: string; price?: number; description?: string }>; portfolio?: Array<{ id: string; image_url: string; caption?: string }>; provider_listing?: ProviderListing | null }
const id = ref('')
const profile = ref<Profile | null>(null)
const loading = ref(false)
const error = ref('')
const inquiryOpen = ref(false)
const inquiryMessage = ref('')
const inquiryContact = ref('')
const inquiryBusy = ref(false)
const roleText: Record<string, string> = { player: '玩家', dm: 'DM', shop: '店家', store: '店家', creator: '服务者', photographer: '摄影师', makeup: '妆造师', costume: '服装商', prop: '道具师' }
async function load() {
  loading.value = true; error.value = ''
  try { profile.value = await apiRequest<Profile>(`/lc/creators/${encoded(id.value)}`) }
  catch (err) { error.value = err instanceof Error ? err.message : '用户主页加载失败' }
  finally { loading.value = false }
}
function previewAvatar() { if (profile.value?.avatar) uni.previewImage({ urls: [profile.value.avatar] }) }
function previewPortfolio(current: string) { uni.previewImage({ current, urls: (profile.value?.portfolio || []).map(item => item.image_url) }) }
function previewListing() { if (profile.value?.provider_listing?.poster_url) uni.previewImage({ urls: [profile.value.provider_listing.poster_url] }) }
function editListing() { uni.navigateTo({ url: '/pages/commissions/provider-edit' }) }
function openInquiry() {
  void requireLogin().then(() => {
    if (readAuth()?.id === id.value) return editListing()
    inquiryMessage.value = ''
    inquiryContact.value = ''
    inquiryOpen.value = true
  }).catch(() => undefined)
}
async function submitInquiry() {
  if (!inquiryMessage.value.trim() || !inquiryContact.value.trim()) {
    return uni.showToast({ title: '请填写咨询内容和联系方式', icon: 'none' })
  }
  inquiryBusy.value = true
  try {
    await apiRequest(`/lc/provider-listings/${encoded(id.value)}/inquiries`, {
      method: 'POST',
      data: { message: inquiryMessage.value.trim(), privateContact: inquiryContact.value.trim() },
    })
    inquiryOpen.value = false
    uni.showModal({ title: '申请已发送', content: '对方同意后，双方联系方式会在“委托-消息处理”中解锁。', showCancel: false })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    inquiryBusy.value = false
  }
}
onLoad(options => { id.value = String(options?.id || ''); void load() })
onShareAppMessage(() => ({ title: `${profile.value?.display_name || '用户'}｜剧幕录主页`, path: `/pages/profile/detail?id=${encoded(id.value)}` }))
</script>

<template>
  <view class="page">
    <MiniNavBar title="用户主页" fallback="/pages/index/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !profile" @retry="load" />
    <template v-if="profile">
      <view class="hero surface">
        <image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill" @tap="previewAvatar" />
        <view v-else class="avatar placeholder">{{ profile.display_name.slice(0, 1) }}</view>
        <text class="name">{{ profile.display_name }}</text>
        <text class="city">{{ profile.city || '城市未设置' }}</text>
        <view v-if="profile.identity_roles?.length" class="chip-row roles"><text v-for="role in profile.identity_roles" :key="role" class="chip">{{ roleText[role] || role }}</text></view>
      </view>
      <view v-if="profile.bio || profile.tags?.length" class="section surface">
        <text class="section__title">个人简介</text>
        <text v-if="profile.bio" class="bio">{{ profile.bio }}</text>
        <view v-if="profile.tags?.length" class="chip-row"><text v-for="tag in profile.tags" :key="tag" class="chip">{{ tag }}</text></view>
      </view>
      <view v-if="profile.provider_listing" class="provider-listing surface">
        <image :src="profile.provider_listing.poster_url" mode="aspectFill" @tap="previewListing" />
        <view class="provider-listing__body">
          <view class="provider-listing__head"><text>委托条</text><text>{{ profile.provider_listing.is_active ? '可联系' : '已下架' }}</text></view>
          <text v-if="profile.provider_listing.headline" class="provider-listing__headline">{{ profile.provider_listing.headline }}</text>
          <text class="provider-listing__meta">{{ [profile.provider_listing.height_cm ? `${profile.provider_listing.height_cm}cm` : '', profile.provider_listing.weight_kg ? `${profile.provider_listing.weight_kg}kg` : ''].filter(Boolean).join(' · ') || '身高体重未填写' }}</text>
          <view v-if="profile.provider_listing.role_types?.length" class="chip-row provider-listing__roles"><text v-for="role in profile.provider_listing.role_types" :key="role" class="chip">{{ role }}</text></view>
          <text v-if="profile.provider_listing.description" class="provider-listing__description">{{ profile.provider_listing.description }}</text>
          <button class="primary-button inquiry" @tap="openInquiry">{{ readAuth()?.id === profile.id ? '编辑我的委托条' : '联系 TA' }}</button>
        </view>
      </view>
      <text v-if="profile.services?.length" class="section-title">提供的服务</text>
      <view v-for="service in profile.services" :key="service.id" class="service surface"><view><strong>{{ service.service_type || '服务' }}</strong><text>{{ service.description || '暂无说明' }}</text></view><text v-if="service.price" class="price">¥{{ service.price }}</text></view>
      <text v-if="profile.portfolio?.length" class="section-title">作品</text>
      <view v-if="profile.portfolio?.length" class="portfolio"><image v-for="item in profile.portfolio" :key="item.id" :src="item.image_url" mode="aspectFill" @tap="previewPortfolio(item.image_url)" /></view>
    </template>

    <view v-if="inquiryOpen" class="sheet-mask" @tap="!inquiryBusy && (inquiryOpen = false)"><view class="sheet" @tap.stop>
      <text class="sheet__title">联系 {{ profile?.display_name || '委托师' }}</text>
      <text class="field-label">想咨询什么 *</text><textarea v-model="inquiryMessage" class="textarea" maxlength="1200" placeholder="说明时间、城市、角色方向或其他需求" />
      <text class="field-label">同意后交换的联系方式 *</text><input v-model="inquiryContact" class="input" maxlength="300" placeholder="微信号、手机号或其他联系方式" />
      <text class="privacy">联系方式只在对方同意后向双方显示。</text>
      <view class="action-row"><button class="secondary-button" @tap="inquiryOpen = false">取消</button><button class="primary-button" :loading="inquiryBusy" @tap="submitInquiry">发送申请</button></view>
    </view></view>
  </view>
</template>

<style scoped>
.hero { padding: 28rpx; text-align: center; }
.avatar { width: 190rpx; height: 190rpx; border-radius: 50%; background: #f2ece4; }
.avatar.placeholder { display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #9a651e; font-family: serif; font-size: 68rpx; font-weight: 900; }
.name, .city { display: block; }
.name { margin-top: 14rpx; font-family: serif; font-size: 42rpx; font-weight: 900; }
.city { margin-top: 7rpx; color: #64748b; font-size: 24rpx; }
.roles { justify-content: center; margin-top: 14rpx; }
.section { margin-top: 14rpx; padding: 20rpx; }
.section__title, .bio { display: block; }
.section__title { margin-bottom: 10rpx; font-size: 28rpx; font-weight: 850; }
.bio { margin-bottom: 12rpx; color: #475569; line-height: 1.65; white-space: pre-wrap; }
.service { display: flex; justify-content: space-between; gap: 18rpx; margin-bottom: 12rpx; padding: 18rpx; }
.service strong, .service text { display: block; }
.service text { margin-top: 6rpx; color: #64748b; font-size: 23rpx; }
.price { color: #9a651e !important; font-size: 27rpx !important; font-weight: 900; }
.portfolio { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; }
.portfolio image { width: 100%; height: 260rpx; border-radius: 8rpx; background: #f2ece4; }
.provider-listing { margin-top: 14rpx; overflow: hidden; }
.provider-listing > image { width: 100%; aspect-ratio: 16 / 9; background: #f2ece4; }
.provider-listing__body { padding: 20rpx; }
.provider-listing__head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.provider-listing__head text:first-child { color: #27364a; font-size: 28rpx; font-weight: 900; }
.provider-listing__head text:last-child { color: #8b5919; font-size: 21rpx; font-weight: 800; }
.provider-listing__headline, .provider-listing__meta, .provider-listing__description { display: block; }
.provider-listing__headline { margin-top: 12rpx; color: #27364a; font-size: 27rpx; font-weight: 800; }
.provider-listing__meta { margin-top: 8rpx; color: #64748b; font-size: 22rpx; }
.provider-listing__roles { margin-top: 12rpx; }
.provider-listing__description { margin-top: 12rpx; color: #475569; font-size: 23rpx; line-height: 1.65; white-space: pre-wrap; }
.inquiry { width: 100%; margin-top: 16rpx; }
.sheet-mask { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: flex-end; background: rgba(31,41,55,.55); }
.sheet { width: 100%; padding: 28rpx 24rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 14rpx 14rpx 0 0; background: #fffdf8; }
.sheet__title { display: block; color: #1f2937; font-size: 31rpx; font-weight: 900; }
.privacy { display: block; margin: 12rpx 0; color: #64748b; font-size: 22rpx; line-height: 1.55; }
</style>
