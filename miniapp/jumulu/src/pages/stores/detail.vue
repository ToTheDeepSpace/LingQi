<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { DossierRating, RatingSummary, Ranking } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { storeClaimLabel } from '../../utils/dossierPresentation'
import { dateText, ratingText } from '../../utils/format'
import { shareImage, sharePath, timelineSharePayload } from '../../utils/share'

type StoreDm = {
  id: string
  dm_name: string
  city?: string | null
  photo_url?: string | null
  photo_focus_x?: number | null
  photo_focus_y?: number | null
  claim_status?: string
  rating_summary: RatingSummary
}

type StoreDetail = {
  dossier: { id: string; name: string; city?: string | null; address?: string | null; photo_url?: string | null; photo_focus_x?: number | null; photo_focus_y?: number | null; note?: string | null; tags?: string[]; claim_status?: string; claimed_by?: string | null }
  summary: RatingSummary
  ratings: DossierRating[]
  dms?: StoreDm[]
  reputation_events?: Ranking[]
}
const id = ref('')
const data = ref<StoreDetail | null>(null)
const loading = ref(false)
const error = ref('')
const following = ref(false)
const focusRatingId = ref('')
const focusRoster = ref(false)

async function scrollToRequestedContent() {
  await nextTick()
  if (focusRatingId.value) {
    uni.pageScrollTo({ selector: `#store-rating-${focusRatingId.value}`, duration: 260 })
  } else if (focusRoster.value) {
    uni.pageScrollTo({ selector: '#store-dm-roster', duration: 260 })
  }
}

async function load() {
  if (!id.value) return
  loading.value = true; error.value = ''
  try {
    data.value = await apiRequest<StoreDetail>(`/lc/store-dossiers/${encoded(id.value)}`)
    if (readAuth()?.token) {
      const follows = await apiRequest<{ stores: Array<{ id: string }> }>('/lc/follows')
      following.value = (follows.stores || []).some(item => item.id === id.value)
    }
    void scrollToRequestedContent()
  }
  catch (err) { error.value = err instanceof Error ? err.message : '店家档案加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function previewPhoto() { if (data.value?.dossier.photo_url) uni.previewImage({ urls: [data.value.dossier.photo_url] }) }
function openRate() { void requireLogin().then(() => uni.navigateTo({ url: `/pages/stores/rate?storeId=${encoded(id.value)}` })).catch(() => undefined) }
function openRanking(rankingId: string) { uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(rankingId)}` }) }
function createRanking() {
  const dossier = data.value?.dossier
  if (!dossier) return
  void requireLogin().then(() => uni.navigateTo({ url: `/pages/rankings/create?subjectType=store&subjectDossierId=${encoded(dossier.id)}&subjectName=${encoded(dossier.name)}&subjectCity=${encoded(dossier.city)}` })).catch(() => undefined)
}
function openClaim() {
  const dossier = data.value?.dossier
  if (!dossier) return
  void requireLogin().then(() => uni.navigateTo({ url: `/pages/dm/claim?id=${encoded(dossier.id)}&name=${encoded(dossier.name)}&entityType=store` })).catch(() => undefined)
}
function openManage() { uni.navigateTo({ url: '/pages/stores/manage' }) }
function openProfile(profileId?: string | null) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }
function openDm(dmId: string) { uni.navigateTo({ url: `/pages/dm/detail?id=${encoded(dmId)}` }) }
async function toggleFollow() {
  try {
    await requireLogin()
    const result = await apiRequest<{ following: boolean }>(`/lc/follows/stores/${encoded(id.value)}`, { method: 'PUT', data: { following: !following.value } })
    following.value = result.following
    uni.showToast({ title: following.value ? '已关注' : '已取消', icon: 'success' })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}
onLoad(options => {
  id.value = String(options?.id || '')
  focusRatingId.value = String(options?.ratingId || '')
  focusRoster.value = options?.view === 'dms'
  void load()
})
onPullDownRefresh(load)
onShareAppMessage((options) => {
  const dataset = (options?.target as { dataset?: Record<string, string> } | undefined)?.dataset || {}
  const store = data.value?.dossier
  if (dataset.shareKind === 'store-rating' && dataset.ratingId) {
    const rating = data.value?.ratings.find(item => item.id === dataset.ratingId)
    return {
      title: `${store?.name || '店家'}到店评价：${rating?.rating || 0} 星｜剧幕录`,
      path: sharePath(`/pages/stores/detail?id=${encoded(id.value)}&ratingId=${encoded(dataset.ratingId)}`),
      imageUrl: shareImage(store?.photo_url),
    }
  }
  if (dataset.shareKind === 'store-dms') {
    return {
      title: `${store?.name || '这家店'}的 DM 阵容｜剧幕录`,
      path: sharePath(`/pages/stores/detail?id=${encoded(id.value)}&view=dms`),
      imageUrl: shareImage(store?.photo_url),
    }
  }
  return {
    title: `${store?.name || '店家'}｜剧幕录档案`,
    path: sharePath(`/pages/stores/detail?id=${encoded(id.value)}`),
    imageUrl: shareImage(store?.photo_url),
  }
})
onShareTimeline(() => timelineSharePayload(`${data.value?.dossier.name || '店家'}｜剧幕录档案`, `id=${encoded(id.value)}`, data.value?.dossier.photo_url))
</script>

<template>
  <view class="page">
    <MiniNavBar title="店家详情" fallback="/pages/stores/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !data" @retry="load" />
    <template v-if="data">
      <view class="hero surface">
        <image v-if="data.dossier.photo_url" class="hero__image" :src="data.dossier.photo_url" mode="aspectFill" @tap="previewPhoto" />
        <view v-if="data.dossier.photo_url" class="media-report"><ReportFlag target-type="dossier_image" :target-id="data.dossier.id" target-sub-id="photo:0" :title="`${data.dossier.name}的图片`" :own="data.dossier.claimed_by === readAuth()?.id" /></view>
        <view class="hero__body">
          <view class="identity-row">
            <view v-if="!data.dossier.photo_url" class="hero__avatar">{{ data.dossier.name.slice(0, 1) }}</view>
            <view class="identity-copy">
              <view class="name-row"><text class="hero__name">{{ data.dossier.name }}</text><view class="name-actions"><button class="follow-button" @tap="toggleFollow">{{ following ? '已关注' : '关注' }}</button><button class="share-button" open-type="share">分享</button><ReportFlag target-type="dossier" :target-id="data.dossier.id" :title="`${data.dossier.name}的店家档案`" :own="data.dossier.claimed_by === readAuth()?.id" /></view></view>
              <text class="claim-badge" :class="{ verified: data.dossier.claim_status === 'approved' }">{{ storeClaimLabel(data.dossier.claim_status) }}</text>
              <text class="hero__meta">{{ data.dossier.city || '城市待补充' }}<template v-if="data.dossier.address"> · {{ data.dossier.address }}</template></text>
            </view>
          </view>
          <view class="score-row"><text class="score">{{ ratingText(data.summary.avg) }}</text><text class="score-meta">{{ data.summary.player_count }} 位玩家 · {{ data.summary.review_count }} 次到店</text></view>
          <view class="page-actions hero-actions">
            <button class="primary-button" @tap="openRate">评价这家店</button>
            <button class="secondary-button" @tap="createRanking">发布红黑榜</button>
            <button v-if="data.dossier.claim_status !== 'approved'" class="secondary-button claim-action" @tap="openClaim">经营者认证 ¥90</button>
            <button v-if="data.dossier.claimed_by === readAuth()?.id && data.dossier.claim_status === 'approved'" class="secondary-button claim-action" @tap="openManage">认证码与名额</button>
          </view>
        </view>
      </view>
      <view id="store-dm-roster" class="roster-section">
        <view class="section-heading">
          <view><text class="section-heading__title">本店 DM</text><text class="section-heading__meta">{{ data.dms?.length || 0 }} 位已确认关联</text></view>
          <button class="share-section" open-type="share" data-share-kind="store-dms">分享阵容</button>
        </view>
        <view v-if="!data.dms?.length" class="surface empty roster-empty">还没有经店家确认的 DM 关联。</view>
        <view v-else class="dm-roster">
          <view v-for="dm in data.dms" :key="dm.id" class="dm-row" @tap="openDm(dm.id)">
            <image v-if="dm.photo_url" class="dm-row__avatar" :src="dm.photo_url" mode="aspectFill" :style="{ objectPosition: `${dm.photo_focus_x ?? 50}% ${dm.photo_focus_y ?? 25}%` }" />
            <view v-else class="dm-row__avatar placeholder">{{ dm.dm_name.slice(0, 1) }}</view>
            <view class="dm-row__copy">
              <strong>{{ dm.dm_name }}</strong>
              <text>{{ dm.city || data.dossier.city || '城市待补充' }} · {{ dm.claim_status === 'approved' ? '已认证' : '档案已收录' }}</text>
            </view>
            <view class="dm-row__score">
              <strong>{{ ratingText(dm.rating_summary.avg) }}</strong>
              <text>{{ dm.rating_summary.player_count }} 人评分</text>
            </view>
            <image class="dm-row__chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
          </view>
        </view>
      </view>
      <view v-if="data.dossier.note || data.dossier.tags?.length" class="section surface">
        <text class="section__title">店家资料</text>
        <text v-if="data.dossier.note" class="section__content">{{ data.dossier.note }}</text>
        <view v-if="data.dossier.tags?.length" class="chip-row"><text v-for="tag in data.dossier.tags" :key="tag" class="chip">{{ tag }}</text></view>
      </view>
      <text class="section-title">玩家到店评价</text>
      <view v-if="!data.ratings.length" class="surface empty">还没有公开的到店评价。</view>
      <view v-for="rating in data.ratings" :id="`store-rating-${rating.id}`" :key="rating.id" class="review surface">
        <view class="review__head"><text :class="{ link: rating.profile_id }" @tap="openProfile(rating.profile_id)">{{ rating.profile_name || '用户' }}</text><view class="review__head-actions"><strong>{{ rating.rating }} 星</strong><button class="review-share" open-type="share" data-share-kind="store-rating" :data-rating-id="rating.id">分享</button><ReportFlag target-type="store_rating" :target-id="rating.id" title="店家到店评价" :own="rating.profile_id === readAuth()?.id" /></view></view>
        <text class="review__meta">《{{ rating.script_name }}》 · {{ dateText(rating.visited_on) }}</text>
        <text class="review__content">{{ rating.content }}</text>
        <view v-if="rating.tags?.length" class="chip-row"><text v-for="tag in rating.tags" :key="tag" class="chip">{{ tag }}</text></view>
      </view>
      <text v-if="data.reputation_events?.length" class="section-title">关联口碑事件</text>
      <view v-for="event in data.reputation_events" :key="event.id" class="event surface" @tap="openRanking(event.id)">
        <text class="event__type">{{ event.type === 'red' ? '红榜' : event.type === 'black' ? '黑榜' : '白榜' }}</text>
        <text class="event__content">{{ event.content }}</text>
      </view>
    </template>
  </view>
</template>

<style scoped>
.hero { overflow: hidden; }
.hero__image { width: 100%; height: 430rpx; background: #f2ece4; }
.hero__avatar { display: flex; width: 112rpx; height: 112rpx; flex: 0 0 112rpx; align-items: center; justify-content: center; border-radius: 8rpx; background: #f2ece4; color: #9a651e; font-family: serif; font-size: 48rpx; font-weight: 900; }
.hero__body { padding: 22rpx; }
.media-report { display: flex; justify-content: flex-end; padding: 8rpx 14rpx 0; }
.identity-row { display: flex; align-items: center; gap: 16rpx; }
.identity-copy { min-width: 0; flex: 1; }
.hero__name, .hero__meta { display: block; }
.name-row { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.name-actions, .review__head-actions { display: flex; align-items: center; gap: 6rpx; }
.follow-button, .share-button { width: auto; min-height: 56rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #d9a857; border-radius: 8rpx; background: #fffaf0; color: #925f18; font-size: 22rpx; font-weight: 800; line-height: 56rpx; }
.share-button { border-color: #d4dce7; background: #fff; color: #275389; }
.hero__name { font-family: serif; font-size: 42rpx; font-weight: 900; }
.claim-badge { display: inline-flex; max-width: 100%; margin-top: 7rpx; overflow: hidden; border: 1rpx solid #dce3ec; border-radius: 7rpx; background: #f8fafc; padding: 6rpx 10rpx; color: #526174; font-size: 20rpx; font-weight: 800; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.claim-badge.verified { border-color: #ead8ad; background: #fff8e8; color: #8a5a19; }
.hero__meta { margin-top: 8rpx; color: #64748b; font-size: 24rpx; line-height: 1.5; }
.score-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 16rpx; }
.score { color: #9a651e; font-size: 42rpx; font-weight: 900; }
.score-meta { color: #7b8492; font-size: 22rpx; }
.hero-actions { margin-top: 16rpx; }
.hero-actions .claim-action { width: auto; min-width: 176rpx; min-height: 60rpx; justify-self: start; padding: 0 18rpx; font-size: 23rpx; line-height: 60rpx; }
.roster-section { margin-top: 20rpx; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16rpx; margin-bottom: 12rpx; }
.section-heading__title, .section-heading__meta { display: block; }
.section-heading__title { color: #27364a; font-size: 30rpx; font-weight: 850; }
.section-heading__meta { margin-top: 4rpx; color: #7b8492; font-size: 20rpx; }
.share-section { width: auto; min-height: 56rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #d4dce7; border-radius: 8rpx; background: #fff; color: #275389; font-size: 21rpx; font-weight: 800; line-height: 54rpx; }
.dm-roster { overflow: hidden; border: 1rpx solid #e3e6ea; border-radius: 10rpx; background: #fff; }
.dm-row { display: flex; min-height: 108rpx; align-items: center; gap: 14rpx; padding: 14rpx 16rpx; border-bottom: 1rpx solid #eceff2; }
.dm-row:last-child { border-bottom: 0; }
.dm-row__avatar { width: 74rpx; height: 74rpx; flex: 0 0 74rpx; border-radius: 8rpx; background: #f2ece4; }
.dm-row__avatar.placeholder { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 30rpx; font-weight: 900; }
.dm-row__copy { min-width: 0; flex: 1; }
.dm-row__copy strong, .dm-row__copy text, .dm-row__score strong, .dm-row__score text { display: block; }
.dm-row__copy strong { overflow: hidden; color: #27364a; font-size: 25rpx; text-overflow: ellipsis; white-space: nowrap; }
.dm-row__copy text, .dm-row__score text { margin-top: 5rpx; color: #7b8492; font-size: 19rpx; }
.dm-row__score { flex: 0 0 auto; text-align: right; }
.dm-row__score strong { color: #9a651e; font-size: 25rpx; }
.dm-row__chevron { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; }
.roster-empty { margin: 0; }
.section { margin-top: 14rpx; padding: 20rpx; }
.section__title, .section__content { display: block; }
.section__title { margin-bottom: 10rpx; font-size: 28rpx; font-weight: 850; }
.section__content { margin-bottom: 12rpx; color: #475569; line-height: 1.65; white-space: pre-wrap; }
.review, .event { margin-bottom: 14rpx; padding: 20rpx; }
.review__head { display: flex; justify-content: space-between; font-weight: 850; }
.review__head strong { color: #9a651e; }
.review-share { width: auto; min-height: 46rpx; margin: 0; padding: 0 10rpx; border: 1rpx solid #d7dee7; border-radius: 7rpx; background: #fff; color: #526174; font-size: 19rpx; line-height: 44rpx; }
.link { color: #275389; }
.review__meta, .review__content { display: block; margin-top: 10rpx; }
.review__meta { color: #7b8492; font-size: 22rpx; }
.review__content, .event__content { color: #374151; line-height: 1.65; white-space: pre-wrap; }
.event__type { display: block; margin-bottom: 8rpx; color: #9a651e; font-weight: 850; }
.empty { padding: 40rpx; color: #64748b; text-align: center; }
</style>
