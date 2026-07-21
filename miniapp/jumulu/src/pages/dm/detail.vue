<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { DossierDetail } from '../../types'
import { apiRequest, encoded } from '../../utils/api'
import { dateText, ratingText } from '../../utils/format'

const id = ref('')
const data = ref<DossierDetail | null>(null)
const loading = ref(false)
const error = ref('')
const selectedPhoto = ref(0)
const photos = computed(() => {
  const dossier = data.value?.dossier
  if (!dossier) return []
  if (dossier.photo_files?.length) return dossier.photo_files
  return dossier.photo_url ? [{ url: dossier.photo_url, focus_x: dossier.photo_focus_x, focus_y: dossier.photo_focus_y }] : []
})
const activePhoto = computed(() => photos.value[Math.min(selectedPhoto.value, photos.value.length - 1)] || null)
const age = computed(() => data.value?.dossier.birth_year ? new Date().getFullYear() - Number(data.value.dossier.birth_year) : null)
const tags = computed(() => Array.from(new Set([...(data.value?.dossier.tags || []), ...(data.value?.dossier.rating_tags || [])])))

async function load() {
  if (!id.value) return
  loading.value = true; error.value = ''
  try { data.value = await apiRequest<DossierDetail>(`/lc/dm-dossiers/${encoded(id.value)}`) }
  catch (err) { error.value = err instanceof Error ? err.message : 'DM档案加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function preview(index = selectedPhoto.value) { if (photos.value.length) uni.previewImage({ current: index, urls: photos.value.map(photo => photo.url) }) }
function goRate() { uni.navigateTo({ url: `/pages/dm/rate?dmId=${encoded(id.value)}` }) }
function goStore() { const storeId = data.value?.dossier.affiliation?.store_dossier_id; if (storeId) uni.navigateTo({ url: `/pages/stores/detail?id=${encoded(storeId)}` }) }
function goRanking() {
  const dossier = data.value?.dossier
  if (!dossier) return
  uni.navigateTo({ url: `/pages/rankings/create?subjectType=dm&subjectDossierId=${encoded(dossier.id)}&subjectName=${encoded(dossier.dm_name)}&subjectCity=${encoded(dossier.city)}` })
}
function openProfile(profileId?: string | null) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }

onLoad(options => { id.value = String(options?.id || ''); void load() })
onPullDownRefresh(load)
onShareAppMessage(() => ({ title: `${data.value?.dossier.dm_name || 'DM'}｜剧幕录档案`, path: `/pages/dm/detail?id=${encoded(id.value)}` }))
</script>

<template>
  <view class="page detail-page">
    <MiniNavBar title="DM 档案" fallback="/pages/dm/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !data" @retry="load" />
    <template v-if="data">
      <view class="hero surface">
        <image v-if="activePhoto" class="hero__image" :src="activePhoto.url" mode="aspectFill" :style="{ objectPosition: `${activePhoto.focus_x ?? 50}% ${activePhoto.focus_y ?? 25}%` }" @tap="preview()" />
        <view v-else class="hero__avatar">{{ data.dossier.dm_name.slice(0, 1) }}</view>
        <scroll-view v-if="photos.length > 1" class="thumbs" scroll-x :show-scrollbar="false">
          <image v-for="(photo, index) in photos" :key="photo.url" class="thumb" :class="{ active: selectedPhoto === index }" :src="photo.url" mode="aspectFill" @tap="selectedPhoto = index" />
        </scroll-view>
        <view class="hero__info">
          <text class="hero__name">{{ data.dossier.dm_name }}</text>
          <text class="hero__meta">{{ data.dossier.city || '城市待补充' }}</text>
          <text v-if="data.dossier.affiliation?.store_name" class="hero__store" @tap="goStore">{{ data.dossier.affiliation.store_name }} ›</text>
          <text v-else class="hero__meta">{{ data.dossier.employment_status === 'freelance' ? '自由 DM' : data.dossier.workplace || '任职资料待补充' }}</text>
          <view class="score-row">
            <text class="score">{{ ratingText(data.summary.avg) }}</text>
            <text class="score-meta">{{ data.summary.player_count }} 位玩家 · {{ data.summary.review_count }} 次体验</text>
          </view>
          <view class="page-actions hero-actions">
            <button class="primary-button" @tap="goRate">给 TA 评分</button>
            <button class="secondary-button" @tap="goRanking">发布红黑榜</button>
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
      <view v-for="rating in data.ratings" :key="rating.id" class="review surface">
        <view class="review__head"><text class="review__author" :class="{ link: rating.profile_id }" @tap="openProfile(rating.profile_id)">{{ rating.profile_name || '用户' }}</text><text class="review__score">{{ rating.rating }} 星</text></view>
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
.hero__image, .hero__avatar { width: 100%; height: 500rpx; background: #f2ece4; }
.hero__avatar { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 110rpx; font-weight: 900; }
.thumbs { width: 100%; padding: 10rpx 14rpx; white-space: nowrap; }
.thumb { width: 92rpx; height: 92rpx; margin-right: 10rpx; border: 4rpx solid transparent; border-radius: 8rpx; }
.thumb.active { border-color: #b9781f; }
.hero__info { padding: 22rpx; }
.hero__name, .hero__meta, .hero__store { display: block; }
.hero__name { color: #1f2937; font-family: serif; font-size: 46rpx; font-weight: 900; }
.hero__meta, .hero__store { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.hero__store { color: #275389; font-weight: 750; }
.score-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 18rpx; }
.score { color: #9a651e; font-size: 44rpx; font-weight: 900; }
.score-meta { color: #7b8492; font-size: 22rpx; }
.hero-actions { margin-top: 18rpx; }
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
.review__meta, .review__content { display: block; margin-top: 10rpx; }
.review__meta { color: #7b8492; font-size: 22rpx; }
.review__content { color: #374151; font-size: 26rpx; line-height: 1.68; white-space: pre-wrap; }
.response { margin-top: 14rpx; padding: 14rpx; border-left: 5rpx solid #b9781f; background: #fff8e8; }
.response strong, .response text { display: block; }
.response text { margin-top: 7rpx; color: #475569; font-size: 24rpx; line-height: 1.55; }
.empty-reviews { padding: 40rpx; color: #64748b; text-align: center; }
</style>
