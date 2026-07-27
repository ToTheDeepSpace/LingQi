<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { RoleRating, Script } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dateText } from '../../utils/format'
import { flattenRoles, roleKind } from '../../utils/roles'

type RatingPayload = {
  ratings: RoleRating[]
  summary: { avg: number | null; count: number }
  lane_summaries: { experience: { avg: number | null; count: number }; deep_spoiler: { avg: number | null; count: number } }
  has_experienced_role?: boolean
}
const id = ref('')
const scripts = ref<Script[]>([])
const payload = ref<RatingPayload | null>(null)
const loading = ref(false)
const error = ref('')
const activeLane = ref<'experience' | 'deep_spoiler'>('experience')
const revealed = ref(false)
const rating = ref(5)
const content = ref('')
const composerOpen = ref(false)
const submitting = ref(false)
const role = computed(() => flattenRoles(scripts.value).find(item => item.target_id === id.value) || null)
const laneRatings = computed(() => (payload.value?.ratings || []).filter(item => activeLane.value === 'deep_spoiler' ? item.review_lane === 'deep_spoiler' : item.review_lane !== 'deep_spoiler'))

async function load() {
  loading.value = true; error.value = ''
  try {
    const [scriptItems, ratings] = await Promise.all([
      apiRequest<Script[]>('/lc/scripts'),
      apiRequest<RatingPayload>(`/lc/entity-ratings?targetType=script_role&targetId=${encoded(id.value)}`),
    ])
    scripts.value = scriptItems; payload.value = ratings
  } catch (err) { error.value = err instanceof Error ? err.message : '角色评价加载失败' }
  finally { loading.value = false }
}
async function submit() {
  try {
    await requireLogin()
    if (!content.value.trim()) throw new Error('请写一句评分理由')
    submitting.value = true
    const result = await apiRequest<{ message?: string }>('/lc/entity-ratings', { method: 'POST', data: { targetType: 'script_role', targetId: id.value, rating: rating.value, content: content.value.trim(), reviewLane: activeLane.value } })
    content.value = ''
    composerOpen.value = false
    uni.showModal({ title: '评价已提交', content: result.message || '审核通过后会公开展示。', showCancel: false })
  } catch (err) {
    if ((err as Error).message === '发言前请先完成手机号或邮箱验证') uni.showModal({ title: '先完成账号验证', content: '评价前需要绑定手机号。', confirmText: '去绑定', success: result => { if (result.confirm) uni.navigateTo({ url: '/pages/mine/account' }) } })
    else if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally { submitting.value = false }
}
function openProfile(profileId?: string) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }
onLoad(options => { id.value = String(options?.id || ''); void load() })
onShareAppMessage(() => ({ title: role.value ? `${role.value.role_name}《${role.value.script_name}》角色点评` : '剧幕录角色点评', path: `/pages/roles/detail?id=${encoded(id.value)}` }))
</script>

<template>
  <view class="page">
    <MiniNavBar title="角色点评" fallback="/pages/roles/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !role" @retry="load" />
    <template v-if="role && payload">
      <view class="hero surface">
        <text class="hero__kind">{{ roleKind(role) }}<template v-if="role.gender"> · {{ role.gender }}</template></text>
        <text class="hero__name">{{ role.role_name }}</text>
        <text class="hero__script">《{{ role.script_name }}》</text>
        <view class="hero__score"><strong>{{ payload.summary.avg ? Number(payload.summary.avg).toFixed(1) : '暂无评分' }}</strong><text>{{ payload.summary.count }} 条评价</text></view>
      </view>
      <view class="lanes surface">
        <view class="lane" :class="{ active: activeLane === 'experience' }" @tap="activeLane = 'experience'"><strong>无剧透体验</strong><text>{{ payload.lane_summaries.experience.count }} 条</text></view>
        <view class="lane" :class="{ active: activeLane === 'deep_spoiler' }" @tap="activeLane = 'deep_spoiler'"><strong>剧透深评</strong><text>{{ payload.lane_summaries.deep_spoiler.count }} 条</text></view>
      </view>
      <view v-if="activeLane === 'deep_spoiler' && !payload.has_experienced_role && !revealed" class="spoiler surface">
        <text>这一栏包含角色内核和关键剧情。</text>
        <button class="secondary-button" @tap="revealed = true">仍要查看</button>
      </view>
      <template v-else>
        <view v-if="!laneRatings.length" class="surface empty">这一栏还没有公开评价。</view>
        <view v-for="item in laneRatings" :key="item.id" class="review surface">
          <view class="review__head"><text :class="{ link: item.profile_id }" @tap="openProfile(item.profile_id)">{{ item.profile_name || '用户' }}</text><view class="review__actions"><strong>{{ item.rating }} 分</strong><ReportFlag target-type="role_rating" :target-id="item.id" :title="`${role.role_name}的角色点评`" :own="item.profile_id === readAuth()?.id" /></view></view>
          <text class="review__content">{{ item.content }}</text>
          <text class="review__date">{{ dateText(item.created_at) }}</text>
        </view>
      </template>
      <button v-if="!composerOpen" class="secondary-button write-review" @tap="composerOpen = true">
        写{{ activeLane === 'deep_spoiler' ? '剧透深评' : '无剧透体验' }}
      </button>
      <view v-else class="composer surface">
        <text class="composer__title">写{{ activeLane === 'deep_spoiler' ? '剧透深评' : '无剧透体验' }}</text>
        <view class="stars"><text v-for="star in 5" :key="star" :class="{ active: rating >= star }" @tap="rating = star">★</text></view>
        <textarea v-model="content" class="textarea" maxlength="1200" :placeholder="activeLane === 'deep_spoiler' ? '可讨论角色内核、关键剧情和深度体验。' : '不要写关键剧情，只谈体验和角色感受。'" />
        <view class="composer__actions">
          <button class="secondary-button" :disabled="submitting" @tap="composerOpen = false">取消</button>
          <button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.hero { padding: 24rpx; }
.hero__kind, .hero__name, .hero__script { display: block; }
.hero__kind { color: #9a651e; font-size: 23rpx; font-weight: 850; }
.hero__name { margin-top: 8rpx; font-family: serif; font-size: 46rpx; font-weight: 900; }
.hero__script { margin-top: 6rpx; color: #64748b; font-size: 26rpx; }
.hero__score { display: flex; align-items: baseline; gap: 12rpx; margin-top: 18rpx; }
.hero__score strong { color: #9a651e; font-size: 36rpx; }
.hero__score text { color: #7b8492; font-size: 22rpx; }
.lanes { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-top: 14rpx; padding: 8rpx; }
.lane { padding: 16rpx 8rpx; border-radius: 8rpx; text-align: center; }
.lane strong, .lane text { display: block; }
.lane strong { font-size: 25rpx; }
.lane text { margin-top: 4rpx; color: #7b8492; font-size: 21rpx; }
.lane.active { background: #f3e4c9; color: #8b5919; }
.spoiler, .empty, .composer { margin-top: 14rpx; padding: 22rpx; }
.spoiler { color: #64748b; text-align: center; }
.spoiler button { width: 100%; margin-top: 14rpx; }
.empty { color: #64748b; text-align: center; }
.review { margin-top: 12rpx; padding: 18rpx; }
.review__head { display: flex; justify-content: space-between; font-weight: 850; }
.review__actions { display: flex; align-items: center; gap: 6rpx; }
.review__head strong { color: #9a651e; }
.link { color: #275389; }
.review__content, .review__date { display: block; margin-top: 10rpx; }
.review__content { color: #374151; line-height: 1.65; white-space: pre-wrap; }
.review__date { color: #94a3b8; font-size: 21rpx; }
.write-review { width: 100%; margin-top: 16rpx; color: #275389; }
.composer__title { display: block; margin-bottom: 12rpx; font-size: 28rpx; font-weight: 850; }
.stars { display: flex; justify-content: space-between; padding: 10rpx 20rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; }
.stars text { color: #d5d9df; font-size: 48rpx; }
.stars text.active { color: #c88b31; }
.composer textarea { margin-top: 12rpx; }
.composer__actions { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); gap: 12rpx; margin-top: 14rpx; }
.composer__actions button { width: 100%; margin: 0; }
</style>
