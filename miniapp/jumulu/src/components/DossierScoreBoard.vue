<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Dossier } from '../types'
import { apiRequest, encoded } from '../utils/api'
import { ratingText } from '../utils/format'

const props = withDefaults(defineProps<{ city?: string }>(), { city: '全部城市' })
const kind = ref<'dm' | 'store'>('dm')
const items = ref<Dossier[]>([])
const loading = ref(true)
const error = ref('')
const ranked = computed(() => items.value.filter(item =>
  (item.entity_type || 'dm') === kind.value
  && (props.city === '全部城市' || item.city === props.city)
  && Number(item.rating_summary?.player_count || 0) > 0
  && item.rating_summary?.avg != null,
).sort((a, b) => Number(b.rating_summary?.avg) - Number(a.rating_summary?.avg)
  || Number(b.rating_summary?.player_count) - Number(a.rating_summary?.player_count)
  || a.id.localeCompare(b.id)).slice(0, 5))
async function load() {
  loading.value = true; error.value = ''
  try {
    const [dm, stores] = await Promise.all([
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'),
    ])
    items.value = [...dm, ...stores]
  } catch { error.value = '评分暂时未能加载，请重试' }
  finally { loading.value = false }
}
function open(item: Dossier) {
  uni.navigateTo({ url: `/pages/${kind.value === 'dm' ? 'dm' : 'stores'}/detail?id=${encoded(item.id)}` })
}
function all() { uni.navigateTo({ url: `/pages/${kind.value === 'dm' ? 'dm' : 'stores'}/index?sort=rating` }) }
onMounted(load)
</script>

<template>
  <view class="score-board">
    <view class="score-board__head"><text>店家与 DM 评分榜</text><button @tap="all">查看全部 ›</button></view>
    <view class="score-board__tabs">
      <button :class="{ selected: kind === 'dm' }" @tap="kind = 'dm'">DM 评分</button>
      <button :class="{ selected: kind === 'store' }" @tap="kind = 'store'">店家评分</button>
    </view>
    <text class="score-board__note">{{ city }} · 按评分排序，同分参考评价人数</text>
    <text v-if="loading" class="score-board__empty">正在加载真实评分…</text>
    <button v-else-if="error" class="score-board__empty" @tap="load">{{ error }}</button>
    <text v-else-if="!ranked.length" class="score-board__empty">还没有已审核的评分，不给未评价的档案凑分数。</text>
    <button v-for="(item, index) in ranked" :key="item.id" class="score-board__row" @tap="open(item)">
      <text class="score-board__rank">{{ index + 1 }}</text>
      <view class="score-board__person"><text>{{ item.dm_name }}</text><text>{{ item.city || '城市待补充' }} · {{ item.rating_summary?.player_count || 0 }} 人评价</text></view>
      <text class="score-board__value">{{ ratingText(item.rating_summary?.avg) }}<text> / 5</text></text>
    </button>
    <text class="score-board__note">分数来自已审核的社区体验；样本少时请结合评价原文判断。认证、付费和保证金不加分。</text>
  </view>
</template>

<style scoped>
.score-board { margin: 20rpx 0; padding: 20rpx; background: #fff; border: 1rpx solid #e8e4dc; border-radius: 12rpx; }
.score-board__head { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; font-size: 30rpx; font-weight: 750; }
.score-board button { min-height: 44px; margin: 0; padding: 0 10rpx; background: transparent; border: 0; line-height: 1.5; }
.score-board button::after { border: 0; }
.score-board__head button { color: #275389; font-size: 24rpx; }
.score-board__tabs { display: flex; gap: 12rpx; margin: 8rpx 0; }
.score-board__tabs button { flex: 1; border-radius: 8rpx; font-size: 28rpx; color: #475569; }
.score-board__tabs .selected { color: #275389; background: #eef3fa; font-weight: 750; }
.score-board__note { display: block; color: #64748b; font-size: 23rpx; line-height: 1.6; }
.score-board__empty { display: block; padding: 28rpx 0; color: #64748b; font-size: 25rpx; }
.score-board .score-board__row { display: flex; align-items: center; width: 100%; gap: 16rpx; padding: 18rpx 0; text-align: left; border-bottom: 1rpx solid #f0ede7; }
.score-board__rank { color: #9a651e; width: 32rpx; font-size: 30rpx; }
.score-board__person { flex: 1; min-width: 0; }
.score-board__person text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 28rpx; }
.score-board__person text + text { margin-top: 4rpx; color: #64748b; font-size: 23rpx; }
.score-board__value { color: #9a651e; font-size: 34rpx; font-weight: 750; }
.score-board__value text { font-size: 22rpx; font-weight: 400; }
</style>
