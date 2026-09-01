<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { ProviderListing } from '../../types'
import { apiRequest, encoded, readAuth, requestServicePayment, requireLogin, type ServicePurchase } from '../../utils/api'
import { timelineSharePayload } from '../../utils/share'

type SocialPlatform = 'douyin' | 'xiaohongshu'
type Availability = { id: string; date: string; start_time?: string | null; end_time?: string | null; city?: string | null; location?: string | null; is_booked?: boolean }
type Profile = { id: string; display_name: string; avatar?: string | null; avatar_focus_x?: number | null; avatar_focus_y?: number | null; city?: string | null; bio?: string | null; tags?: string[]; identity_roles?: string[]; social_links?: Partial<Record<SocialPlatform, string>>; services?: Array<{ id: string; service_type?: string; price?: number; description?: string }>; portfolio?: Array<{ id: string; image_url: string; caption?: string }>; provider_listing?: ProviderListing | null }
const id = ref('')
const profile = ref<Profile | null>(null)
const availability = ref<Availability[]>([])
const loading = ref(false)
const error = ref('')
const inquiryBusy = ref(false)
const roleText: Record<string, string> = { player: '玩家', dm: 'DM', shop: '店家', store: '店家', creator: '服务者', photographer: '摄影师', makeup: '妆造师', costume: '服装商', prop: '道具师' }
const socialVisual: Record<SocialPlatform, { label: string; glyph: string }> = {
  douyin: { label: '抖音', glyph: '♪' },
  xiaohongshu: { label: '小红书', glyph: '书' },
}
const socialEntries = computed(() => (Object.entries(profile.value?.social_links || {}) as Array<[SocialPlatform, string]>)
  .filter(([platform, url]) => platform in socialVisual && typeof url === 'string' && url.trim())
  .map(([platform, url]) => ({ platform, url: url.trim(), ...socialVisual[platform] })))
const availableSlots = computed(() => availability.value.filter(item => !item.is_booked))
const visibleSlots = computed(() => availableSlots.value.slice(0, 20))
async function load() {
  loading.value = true; error.value = ''
  try {
    const [profileData, slots] = await Promise.all([
      apiRequest<Profile>(`/lc/creators/${encoded(id.value)}`),
      apiRequest<Availability[]>(`/lc/creators/${encoded(id.value)}/availability`).catch(() => []),
    ])
    profile.value = profileData
    availability.value = slots
  }
  catch (err) { error.value = err instanceof Error ? err.message : '用户主页加载失败' }
  finally { loading.value = false }
}
function previewAvatar() { if (profile.value?.avatar) uni.previewImage({ urls: [profile.value.avatar] }) }
function previewPortfolio(current: string) { uni.previewImage({ current, urls: (profile.value?.portfolio || []).map(item => item.image_url) }) }
function previewListing() { if (profile.value?.provider_listing?.poster_url) uni.previewImage({ urls: [profile.value.provider_listing.poster_url] }) }
function editListing() {
  void requireLogin().then(() => uni.navigateTo({ url: '/pages/commissions/provider-edit' })).catch(() => undefined)
}
function openSocial(url: string, label: string) {
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: `已复制${label}链接，请前往${label}打开`, icon: 'none' }),
  })
}
function slotDate(value: string) { return value.slice(5).replace('-', '.') }
function slotTime(slot: Availability) { return [slot.start_time?.slice(0, 5), slot.end_time?.slice(0, 5)].filter(Boolean).join('-') }
function slotPlace(slot: Availability) { return [slot.city || profile.value?.city || '地点可议', slot.location].filter(Boolean).join(' · ') }
async function openInquiry() {
  if (readAuth()?.id === id.value) return editListing()
  if (inquiryBusy.value) return
  inquiryBusy.value = true
  try {
    await requireLogin()
    let access = await apiRequest<ServicePurchase & { owner?: boolean }>(`/lc/provider-listings/${encoded(id.value)}/contact-access`)
    if (!access.paid) {
      const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: '永久解锁联系方式',
          content: `支付 9 元后立即查看 ${profile.value?.display_name || '这位委托师'} 当前审核通过的业务联系方式。同一账号只支付一次。`,
          confirmText: '支付 9 元',
          success: result => resolve(result.confirm),
          fail: () => resolve(false),
        })
      })
      if (!confirmed) return
      access = await requestServicePayment('provider_contact', id.value)
    }
    if (!access.contact_available || !access.business_contact) {
      uni.showModal({
        title: '暂未开放联系',
        content: '这位委托师已暂停显示联系方式。你的永久解锁资格不会失效。',
        showCancel: false,
      })
      return
    }
    const contact = access.business_contact
    uni.showModal({
      title: `${profile.value?.display_name || '委托师'}的联系方式`,
      content: contact,
      cancelText: '问题反馈',
      confirmText: '复制',
      success: result => {
        if (result.confirm) uni.setClipboardData({ data: contact })
        else if (result.cancel) uni.navigateTo({ url: `/pages/feedback/index?category=invalid_contact&purchaseId=${encoded(access.id)}` })
      },
    })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    inquiryBusy.value = false
  }
}
onLoad(options => { id.value = String(options?.id || ''); void load() })
onShareAppMessage(() => ({ title: `${profile.value?.display_name || '用户'}｜剧幕录主页`, path: `/pages/profile/detail?id=${encoded(id.value)}` }))
onShareTimeline(() => timelineSharePayload(`${profile.value?.display_name || '用户'}｜剧幕录主页`, `id=${encoded(id.value)}`, profile.value?.avatar))
</script>

<template>
  <view class="page">
    <MiniNavBar title="用户主页" fallback="/pages/index/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !profile" @retry="load" />
    <template v-if="profile">
      <view class="hero surface">
        <image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill" @tap="previewAvatar" />
        <view v-else class="avatar placeholder">{{ profile.display_name.slice(0, 1) }}</view>
        <view class="name-row"><text class="name">{{ profile.display_name }}</text><ReportFlag target-type="profile" :target-id="profile.id" :title="`${profile.display_name}的主页`" :own="readAuth()?.id === profile.id" /></view>
        <text class="city">{{ profile.city || '城市未设置' }}</text>
        <view v-if="profile.identity_roles?.length" class="chip-row roles"><text v-for="role in profile.identity_roles" :key="role" class="chip">{{ roleText[role] || role }}</text></view>
        <view v-if="socialEntries.length" class="social-row" aria-label="社交主页">
          <button
            v-for="item in socialEntries"
            :key="item.platform"
            :class="['social-link', `social-link--${item.platform}`]"
            :aria-label="`${item.label}主页，点击复制链接`"
            @tap="openSocial(item.url, item.label)"
          >{{ item.glyph }}</button>
        </view>
      </view>
      <view v-if="profile.bio || profile.tags?.length" class="section surface">
        <text class="section__title">个人简介</text>
        <text v-if="profile.bio" class="bio">{{ profile.bio }}</text>
        <view v-if="profile.tags?.length" class="chip-row"><text v-for="tag in profile.tags" :key="tag" class="chip">{{ tag }}</text></view>
      </view>
      <view v-if="availableSlots.length" class="section availability-section surface">
        <view class="section-heading"><text class="section__title">近期可约</text><text>{{ availableSlots.length }} 天</text></view>
        <scroll-view class="availability" scroll-x :show-scrollbar="false">
          <view v-for="slot in visibleSlots" :key="slot.id" class="availability__slot">
            <strong>{{ slotDate(slot.date) }}</strong>
            <text v-if="slotTime(slot)">{{ slotTime(slot) }}</text>
            <text>{{ slotPlace(slot) }}</text>
          </view>
          <view v-if="availableSlots.length > visibleSlots.length" class="availability__slot availability__more">
            <strong>+{{ availableSlots.length - visibleSlots.length }}</strong>
            <text>更多日期</text>
          </view>
        </scroll-view>
      </view>
      <view v-if="profile.provider_listing" class="provider-listing surface">
        <image :src="profile.provider_listing.poster_url" mode="aspectFill" @tap="previewListing" />
        <view class="provider-listing__body">
          <view class="provider-listing__head"><text>委托条</text><view class="provider-listing__head-actions"><text>{{ profile.provider_listing.is_active ? '可联系' : '已下架' }}</text><ReportFlag target-type="provider_listing" :target-id="profile.id" :title="`${profile.display_name}的委托条`" :own="readAuth()?.id === profile.id" /></view></view>
          <text v-if="profile.provider_listing.headline" class="provider-listing__headline">{{ profile.provider_listing.headline }}</text>
          <text class="provider-listing__meta">{{ [profile.provider_listing.height_cm ? `${profile.provider_listing.height_cm}cm` : '', profile.provider_listing.weight_kg ? `${profile.provider_listing.weight_kg}kg` : ''].filter(Boolean).join(' · ') || '身高体重未填写' }}</text>
          <view v-if="profile.provider_listing.role_types?.length" class="chip-row provider-listing__roles"><text v-for="role in profile.provider_listing.role_types" :key="role" class="chip">{{ role }}</text></view>
          <text v-if="profile.provider_listing.description" class="provider-listing__description">{{ profile.provider_listing.description }}</text>
          <button class="primary-button inquiry" :loading="inquiryBusy" @tap="openInquiry">{{ readAuth()?.id === profile.id ? '编辑我的委托条' : '查看联系方式' }}</button>
        </view>
      </view>
      <text v-if="profile.services?.length" class="section-title">提供的服务</text>
      <view v-for="service in profile.services" :key="service.id" class="service surface"><view><strong>{{ service.service_type || '服务' }}</strong><text>{{ service.description || '暂无说明' }}</text></view><view class="service-actions"><text v-if="service.price" class="price">¥{{ service.price }}</text><ReportFlag target-type="service" :target-id="service.id" :title="`${profile.display_name}的服务`" :own="readAuth()?.id === profile.id" /></view></view>
      <text v-if="profile.portfolio?.length" class="section-title">作品</text>
      <view v-if="profile.portfolio?.length" class="portfolio"><view v-for="item in profile.portfolio" :key="item.id" class="portfolio__item"><image :src="item.image_url" mode="aspectFill" @tap="previewPortfolio(item.image_url)" /><ReportFlag target-type="portfolio_image" :target-id="item.id" target-sub-id="image:0" :title="`${profile.display_name}的作品图片`" :own="readAuth()?.id === profile.id" /></view></view>
    </template>

  </view>
</template>

<style scoped>
.hero { padding: 28rpx; text-align: center; }
.avatar { width: 190rpx; height: 190rpx; border-radius: 50%; background: #f2ece4; }
.avatar.placeholder { display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #9a651e; font-family: serif; font-size: 68rpx; font-weight: 900; }
.name, .city { display: block; }
.name-row { display: flex; align-items: center; justify-content: center; gap: 6rpx; margin-top: 14rpx; }
.name { font-family: serif; font-size: 42rpx; font-weight: 900; }
.city { margin-top: 7rpx; color: #64748b; font-size: 24rpx; }
.roles { justify-content: center; margin-top: 14rpx; }
.social-row { display: flex; justify-content: center; gap: 10rpx; margin-top: 12rpx; }
.social-link { display: flex; align-items: center; justify-content: center; width: 58rpx; min-width: 58rpx; height: 58rpx; margin: 0; padding: 0; border: 0; border-radius: 8rpx; color: #fff; font-size: 25rpx; font-weight: 900; line-height: 1; }
.social-link::after { display: none; }
.social-link--douyin { background: #151515; }
.social-link--xiaohongshu { background: #ff2442; }
.section { margin-top: 14rpx; padding: 20rpx; }
.section__title, .bio { display: block; }
.section__title { margin-bottom: 10rpx; font-size: 28rpx; font-weight: 850; }
.bio { margin-bottom: 12rpx; color: #475569; line-height: 1.65; white-space: pre-wrap; }
.availability-section { overflow: hidden; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.section-heading .section__title { margin-bottom: 10rpx; }
.section-heading > text:last-child { color: #7b8492; font-size: 21rpx; }
.availability { width: 100%; white-space: nowrap; }
.availability__slot { display: inline-flex; min-width: 164rpx; min-height: 104rpx; box-sizing: border-box; flex-direction: column; justify-content: center; margin-right: 10rpx; padding: 12rpx 14rpx; border: 1rpx solid #ead8ad; border-radius: 8rpx; background: #fff8e8; vertical-align: top; }
.availability__slot strong, .availability__slot text { display: block; }
.availability__slot strong { color: #8a5a19; font-size: 26rpx; }
.availability__slot text { max-width: 220rpx; margin-top: 4rpx; overflow: hidden; color: #64748b; font-size: 20rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.availability__more { align-items: center; min-width: 130rpx; border-color: #dce3ec; background: #f8fafc; text-align: center; }
.service { display: flex; justify-content: space-between; gap: 18rpx; margin-bottom: 12rpx; padding: 18rpx; }
.service strong, .service text { display: block; }
.service text { margin-top: 6rpx; color: #64748b; font-size: 23rpx; }
.price { color: #9a651e !important; font-size: 27rpx !important; font-weight: 900; }
.portfolio { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; }
.portfolio__item { position: relative; }
.portfolio image { width: 100%; height: 260rpx; border-radius: 8rpx; background: #f2ece4; }
.portfolio__item :deep(.report-flag) { position: absolute; right: 6rpx; bottom: 6rpx; background: rgba(255,255,255,.9); }
.provider-listing { margin-top: 14rpx; overflow: hidden; }
.provider-listing > image { width: 100%; aspect-ratio: 16 / 9; background: #f2ece4; }
.provider-listing__body { padding: 20rpx; }
.provider-listing__head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.provider-listing__head-actions, .service-actions { display: flex; align-items: center; gap: 6rpx; }
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
