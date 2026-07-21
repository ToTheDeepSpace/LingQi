<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { DossierRating, RatingSummary, Ranking } from '../../types'
import { apiRequest, encoded } from '../../utils/api'
import { dateText, ratingText } from '../../utils/format'

type StoreDetail = {
  dossier: { id: string; name: string; city?: string | null; address?: string | null; photo_url?: string | null; photo_focus_x?: number | null; photo_focus_y?: number | null; note?: string | null; tags?: string[] }
  summary: RatingSummary
  ratings: DossierRating[]
  reputation_events?: Ranking[]
}
const id = ref('')
const data = ref<StoreDetail | null>(null)
const loading = ref(false)
const error = ref('')
async function load() {
  if (!id.value) return
  loading.value = true; error.value = ''
  try { data.value = await apiRequest<StoreDetail>(`/lc/store-dossiers/${encoded(id.value)}`) }
  catch (err) { error.value = err instanceof Error ? err.message : '店家档案加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function previewPhoto() { if (data.value?.dossier.photo_url) uni.previewImage({ urls: [data.value.dossier.photo_url] }) }
function openRate() { uni.navigateTo({ url: `/pages/stores/rate?storeId=${encoded(id.value)}` }) }
function openRanking(rankingId: string) { uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(rankingId)}` }) }
function createRanking() {
  const dossier = data.value?.dossier
  if (!dossier) return
  uni.navigateTo({ url: `/pages/rankings/create?subjectType=store&subjectDossierId=${encoded(dossier.id)}&subjectName=${encoded(dossier.name)}&subjectCity=${encoded(dossier.city)}` })
}
function openProfile(profileId?: string | null) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }
onLoad(options => { id.value = String(options?.id || ''); void load() })
onPullDownRefresh(load)
onShareAppMessage(() => ({ title: `${data.value?.dossier.name || '店家'}｜剧幕录档案`, path: `/pages/stores/detail?id=${encoded(id.value)}` }))
</script>

<template>
  <view class="page">
    <MiniNavBar title="店家详情" fallback="/pages/stores/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !data" @retry="load" />
    <template v-if="data">
      <view class="hero surface">
        <image v-if="data.dossier.photo_url" class="hero__image" :src="data.dossier.photo_url" mode="aspectFill" @tap="previewPhoto" />
        <view v-else class="hero__avatar">{{ data.dossier.name.slice(0, 1) }}</view>
        <view class="hero__body">
          <text class="hero__name">{{ data.dossier.name }}</text>
          <text class="hero__meta">{{ data.dossier.city || '城市待补充' }}<template v-if="data.dossier.address"> · {{ data.dossier.address }}</template></text>
          <view class="score-row"><text class="score">{{ ratingText(data.summary.avg) }}</text><text class="score-meta">{{ data.summary.player_count }} 位玩家 · {{ data.summary.review_count }} 次到店</text></view>
          <view class="page-actions hero-actions">
            <button class="primary-button" @tap="openRate">评价这家店</button>
            <button class="secondary-button" @tap="createRanking">发布红黑榜</button>
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
      <view v-for="rating in data.ratings" :key="rating.id" class="review surface">
        <view class="review__head"><text :class="{ link: rating.profile_id }" @tap="openProfile(rating.profile_id)">{{ rating.profile_name || '用户' }}</text><strong>{{ rating.rating }} 星</strong></view>
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
.hero__image, .hero__avatar { width: 100%; height: 430rpx; background: #f2ece4; }
.hero__avatar { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 96rpx; font-weight: 900; }
.hero__body { padding: 22rpx; }
.hero__name, .hero__meta { display: block; }
.hero__name { font-family: serif; font-size: 42rpx; font-weight: 900; }
.hero__meta { margin-top: 8rpx; color: #64748b; font-size: 24rpx; line-height: 1.5; }
.score-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 16rpx; }
.score { color: #9a651e; font-size: 42rpx; font-weight: 900; }
.score-meta { color: #7b8492; font-size: 22rpx; }
.hero-actions { margin-top: 16rpx; }
.section { margin-top: 14rpx; padding: 20rpx; }
.section__title, .section__content { display: block; }
.section__title { margin-bottom: 10rpx; font-size: 28rpx; font-weight: 850; }
.section__content { margin-bottom: 12rpx; color: #475569; line-height: 1.65; white-space: pre-wrap; }
.review, .event { margin-bottom: 14rpx; padding: 20rpx; }
.review__head { display: flex; justify-content: space-between; font-weight: 850; }
.review__head strong { color: #9a651e; }
.link { color: #275389; }
.review__meta, .review__content { display: block; margin-top: 10rpx; }
.review__meta { color: #7b8492; font-size: 22rpx; }
.review__content, .event__content { color: #374151; line-height: 1.65; white-space: pre-wrap; }
.event__type { display: block; margin-bottom: 8rpx; color: #9a651e; font-weight: 850; }
.empty { padding: 40rpx; color: #64748b; text-align: center; }
</style>
