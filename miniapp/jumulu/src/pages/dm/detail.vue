<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { DossierDetail } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dossierAffiliationLabel, dossierClaimLabel } from '../../utils/dossierPresentation'
import { dateText, ratingText } from '../../utils/format'
import { shareImage, sharePath, timelineSharePayload } from '../../utils/share'

const id = ref('')
const data = ref<DossierDetail | null>(null)
const loading = ref(false)
const error = ref('')
const selectedPhoto = ref(0)
const focusRatingId = ref('')
const photos = computed(() => {
  const dossier = data.value?.dossier
  if (!dossier) return []
  if (dossier.photo_files?.length) return dossier.photo_files
  return dossier.photo_url ? [{ url: dossier.photo_url, focus_x: dossier.photo_focus_x, focus_y: dossier.photo_focus_y }] : []
})
const activePhoto = computed(() => photos.value[Math.min(selectedPhoto.value, photos.value.length - 1)] || null)
const age = computed(() => data.value?.dossier.birth_year ? new Date().getFullYear() - Number(data.value.dossier.birth_year) : null)
const tags = computed(() => Array.from(new Set([...(data.value?.dossier.tags || []), ...(data.value?.dossier.rating_tags || [])])))
const claimLabel = computed(() => dossierClaimLabel(data.value?.dossier.claim_status))
const affiliationLabel = computed(() => data.value ? dossierAffiliationLabel(data.value.dossier) : '')

async function load() {
  if (!id.value) return
  loading.value = true; error.value = ''
  try {
    data.value = await apiRequest<DossierDetail>(`/lc/dm-dossiers/${encoded(id.value)}`)
    if (focusRatingId.value) {
      await nextTick()
      uni.pageScrollTo({ selector: `#dm-rating-${focusRatingId.value}`, duration: 260 })
    }
  }
  catch (err) { error.value = err instanceof Error ? err.message : 'DM档案加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function preview(index = selectedPhoto.value) { if (photos.value.length) uni.previewImage({ current: index, urls: photos.value.map(photo => photo.url) }) }
function goRate() { void requireLogin().then(() => uni.navigateTo({ url: `/pages/dm/rate?dmId=${encoded(id.value)}` })).catch(() => undefined) }
function goStore() { const storeId = data.value?.dossier.affiliation?.store_dossier_id; if (storeId) uni.navigateTo({ url: `/pages/stores/detail?id=${encoded(storeId)}` }) }
function goRanking() {
  const dossier = data.value?.dossier
  if (!dossier) return
  void requireLogin().then(() => uni.navigateTo({ url: `/pages/rankings/create?subjectType=dm&subjectDossierId=${encoded(dossier.id)}&subjectName=${encoded(dossier.dm_name)}&subjectCity=${encoded(dossier.city)}` })).catch(() => undefined)
}
function goClaim() {
  const dossier = data.value?.dossier
  if (!dossier) return
  void requireLogin().then(() => uni.navigateTo({ url: `/pages/dm/claim?id=${encoded(dossier.id)}&name=${encoded(dossier.dm_name)}&entityType=dm` })).catch(() => undefined)
}
function openProfile(profileId?: string | null) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }

onLoad(options => {
  id.value = String(options?.id || '')
  focusRatingId.value = String(options?.ratingId || '')
  void load()
})
onPullDownRefresh(load)
onShareAppMessage((options) => {
  const dataset = (options?.target as { dataset?: Record<string, string> } | undefined)?.dataset || {}
  const dossier = data.value?.dossier
  if (dataset.shareKind === 'dm-rating' && dataset.ratingId) {
    const rating = data.value?.ratings.find(item => item.id === dataset.ratingId)
    return {
      title: `${dossier?.dm_name || 'DM'}体验评价：${rating?.rating || 0} 星｜剧幕录`,
      path: sharePath(`/pages/dm/detail?id=${encoded(id.value)}&ratingId=${encoded(dataset.ratingId)}`),
      imageUrl: shareImage(activePhoto.value?.url),
    }
  }
  return {
    title: `${dossier?.dm_name || 'DM'}｜剧幕录档案`,
    path: sharePath(`/pages/dm/detail?id=${encoded(id.value)}`),
    imageUrl: shareImage(activePhoto.value?.url),
  }
})
onShareTimeline(() => timelineSharePayload(`${data.value?.dossier.dm_name || 'DM'}｜剧幕录档案`, `id=${encoded(id.value)}`, activePhoto.value?.url))
</script>

<template>
  <view class="page detail-page">
    <MiniNavBar title="DM 档案" fallback="/pages/dm/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !data" @retry="load" />
    <template v-if="data">
      <view class="hero surface" :class="{ 'hero--no-photo': !activePhoto }">
        <image v-if="activePhoto" class="hero__image" :src="activePhoto.url" mode="aspectFill" :style="{ objectPosition: `${activePhoto.focus_x ?? 50}% ${activePhoto.focus_y ?? 25}%` }" @tap="preview()" />
        <scroll-view v-if="photos.length > 1" class="thumbs" scroll-x :show-scrollbar="false">
          <image v-for="(photo, index) in photos" :key="photo.url" class="thumb" :class="{ active: selectedPhoto === index }" :src="photo.url" mode="aspectFill" @tap="selectedPhoto = index" />
        </scroll-view>
        <view v-if="activePhoto" class="media-report"><ReportFlag target-type="dossier_image" :target-id="data.dossier.id" :target-sub-id="`photo:${selectedPhoto}`" :title="`${data.dossier.dm_name}的第 ${selectedPhoto + 1} 张图片`" :own="data.dossier.claimed_by === readAuth()?.id" /></view>
        <view class="hero__info">
          <view class="hero__identity" :class="{ compact: !activePhoto }">
            <view v-if="!activePhoto" class="hero__avatar">{{ data.dossier.dm_name.slice(0, 1) }}</view>
            <view class="hero__identity-copy">
              <view class="status-row">
                <text class="status-badge" :class="{ verified: data.dossier.claim_status === 'approved' }">{{ claimLabel }}</text>
                <text class="affiliation-badge">{{ affiliationLabel }}</text>
              </view>
              <view class="hero__title-row"><text class="hero__name">{{ data.dossier.dm_name }}</text><view class="hero__title-actions"><button class="share-button" open-type="share">分享</button><ReportFlag target-type="dossier" :target-id="data.dossier.id" :title="`${data.dossier.dm_name}的 DM 档案`" :own="data.dossier.claimed_by === readAuth()?.id" /></view></view>
              <text class="hero__meta">{{ data.dossier.city || '城市待补充' }}</text>
              <text v-if="data.dossier.affiliation?.store_dossier_id" class="hero__store" @tap="goStore">查看任职店家 ›</text>
            </view>
          </view>
          <view class="score-row">
            <text class="score">{{ ratingText(data.summary.avg) }}</text>
            <text class="score-meta">{{ data.summary.player_count }} 位玩家 · {{ data.summary.review_count }} 次体验</text>
          </view>
          <view class="page-actions hero-actions">
            <button class="primary-button" @tap="goRate">给 TA 评分</button>
            <button class="secondary-button" @tap="goRanking">发布红黑榜</button>
            <button v-if="data.dossier.claim_status !== 'approved'" class="secondary-button claim-action" @tap="goClaim">本人认领</button>
          </view>
        </view>
      </view>

      <view v-if="data.dossier.bio || data.dossier.note" class="section surface">
        <text class="section__title">人物简介</text>
        <text class="section__content">{{ data.dossier.bio || data.dossier.note }}</text>
      </view>

      <view v-if="data.dossier.dm_started_month || age || data.dossier.height_cm || data.dossier.weight_kg || data.dossier.mbti || data.dossier.zodiac" class="section surface">
        <text class="section__title">身体与从业资料</text>
        <view class="facts">
          <view v-if="data.dossier.dm_started_month" class="fact"><text>入行时间</text><strong>{{ data.dossier.dm_started_month }}</strong></view>
          <view v-if="age" class="fact"><text>年龄</text><strong>{{ age }} 岁</strong></view>
          <view v-if="data.dossier.height_cm" class="fact"><text>身高</text><strong>{{ data.dossier.height_cm }} cm</strong></view>
          <view v-if="data.dossier.weight_kg" class="fact"><text>体重</text><strong>{{ data.dossier.weight_kg }} kg</strong></view>
          <view v-if="data.dossier.mbti" class="fact"><text>MBTI</text><strong>{{ data.dossier.mbti }}</strong></view>
          <view v-if="data.dossier.zodiac" class="fact"><text>星座</text><strong>{{ data.dossier.zodiac }}</strong></view>
        </view>
      </view>

      <view v-if="tags.length || data.dossier.common_scripts?.length" class="section surface">
        <text class="section__title">标签与常开剧本</text>
        <view class="chip-row">
          <text v-for="tag in tags" :key="tag" class="chip">{{ tag }}</text>
          <text v-for="script in data.dossier.common_scripts" :key="script.name" class="chip script">《{{ script.name }}》</text>
        </view>
      </view>

      <text class="section-title">玩家体验</text>
      <view v-if="!data.ratings.length" class="surface empty-reviews">还没有公开评分。</view>
      <view v-for="rating in data.ratings" :id="`dm-rating-${rating.id}`" :key="rating.id" class="review surface">
        <view class="review__head"><text class="review__author" :class="{ link: rating.profile_id }" @tap="openProfile(rating.profile_id)">{{ rating.profile_name || '用户' }}</text><view class="review__head-actions"><text class="review__score">{{ rating.rating }} 星</text><button class="review-share" open-type="share" data-share-kind="dm-rating" :data-rating-id="rating.id">分享</button><ReportFlag target-type="dm_rating" :target-id="rating.id" title="DM 体验评价" :own="rating.profile_id === readAuth()?.id" /></view></view>
        <text class="review__meta">《{{ rating.script_name }}》 · {{ rating.store_name }} · {{ dateText(rating.played_on) }}<template v-if="rating.replay_number"> · 第 {{ rating.replay_number }} 刷</template></text>
        <text class="review__content">{{ rating.content }}</text>
        <view v-if="rating.tags?.length" class="chip-row"><text v-for="tag in rating.tags" :key="tag" class="chip">{{ tag }}</text></view>
        <view v-if="rating.official_response?.content" class="response"><strong>{{ rating.official_response.author_name || 'DM回应' }}</strong><text>{{ rating.official_response.content }}</text></view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.hero { overflow: hidden; }
.hero__image { width: 100%; height: 500rpx; background: #f2ece4; }
.hero__identity.compact { display: grid; grid-template-columns: 112rpx minmax(0, 1fr); align-items: center; gap: 18rpx; }
.hero__identity-copy { min-width: 0; }
.hero__avatar { display: flex; width: 112rpx; height: 112rpx; align-items: center; justify-content: center; border: 1rpx solid #ead8ad; border-radius: 8rpx; background: #fff5df; color: #9a651e; font-family: serif; font-size: 46rpx; font-weight: 900; }
.thumbs { width: 100%; padding: 10rpx 14rpx; white-space: nowrap; }
.thumb { width: 92rpx; height: 92rpx; margin-right: 10rpx; border: 4rpx solid transparent; border-radius: 8rpx; }
.thumb.active { border-color: #b9781f; }
.media-report { display: flex; justify-content: flex-end; padding: 0 14rpx; }
.hero__info { padding: 22rpx; }
.status-row { display: flex; align-items: center; gap: 10rpx; margin-bottom: 13rpx; overflow: hidden; }
.status-badge, .affiliation-badge { min-width: 0; overflow: hidden; border: 1rpx solid #dce3ec; border-radius: 7rpx; padding: 7rpx 11rpx; color: #526174; font-size: 20rpx; font-weight: 800; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.status-badge { flex: 0 0 auto; }
.status-badge.verified { border-color: #ead8ad; background: #fff8e8; color: #8a5a19; }
.affiliation-badge { background: #f8fafc; }
.hero__title-row, .review__head-actions, .hero__title-actions { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; }
.hero__name, .hero__meta, .hero__store { display: block; }
.hero__name { color: #1f2937; font-family: serif; font-size: 46rpx; font-weight: 900; }
.hero__meta, .hero__store { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.hero__store { color: #275389; font-weight: 750; }
.share-button { width: auto; min-height: 50rpx; margin: 0; padding: 0 13rpx; border: 1rpx solid #d4dce7; border-radius: 7rpx; background: #fff; color: #275389; font-size: 20rpx; font-weight: 800; line-height: 48rpx; }
.score-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 18rpx; }
.score { color: #9a651e; font-size: 44rpx; font-weight: 900; }
.score-meta { color: #7b8492; font-size: 22rpx; }
.hero-actions { margin-top: 18rpx; }
.hero-actions .claim-action { width: auto; min-width: 160rpx; min-height: 60rpx; justify-self: start; padding: 0 18rpx; font-size: 23rpx; line-height: 60rpx; }
.section { margin-top: 14rpx; padding: 22rpx; }
.section__title, .section__content { display: block; }
.section__title { margin-bottom: 12rpx; color: #27364a; font-size: 28rpx; font-weight: 850; }
.section__content { color: #475569; font-size: 26rpx; line-height: 1.72; white-space: pre-wrap; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; }
.fact { padding: 14rpx; border: 1rpx solid #e4e7eb; border-radius: 8rpx; }
.fact text, .fact strong { display: block; }
.fact text { color: #7b8492; font-size: 21rpx; }
.fact strong { margin-top: 5rpx; color: #27364a; font-size: 25rpx; }
.chip.script { background: #fff5df; color: #8b5919; }
.review { margin-bottom: 14rpx; padding: 20rpx; }
.review__head { display: flex; justify-content: space-between; }
.review__author { color: #27364a; font-weight: 850; }
.review__author.link { color: #275389; }
.review__score { color: #9a651e; font-weight: 900; }
.review-share { width: auto; min-height: 46rpx; margin: 0; padding: 0 10rpx; border: 1rpx solid #d7dee7; border-radius: 7rpx; background: #fff; color: #526174; font-size: 19rpx; line-height: 44rpx; }
.review__meta, .review__content { display: block; margin-top: 10rpx; }
.review__meta { color: #7b8492; font-size: 22rpx; }
.review__content { color: #374151; font-size: 26rpx; line-height: 1.68; white-space: pre-wrap; }
.response { margin-top: 14rpx; padding: 14rpx; border-left: 5rpx solid #b9781f; background: #fff8e8; }
.response strong, .response text { display: block; }
.response text { margin-top: 7rpx; color: #475569; font-size: 24rpx; line-height: 1.55; }
.empty-reviews { padding: 40rpx; color: #64748b; text-align: center; }
</style>
