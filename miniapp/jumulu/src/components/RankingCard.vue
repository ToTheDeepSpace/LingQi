<script setup lang="ts">
import type { Ranking } from '../types'
import { compactText, dateText, RANKING_TYPE_TEXT } from '../utils/format'

defineProps<{ item: Ranking }>()
defineEmits<{ open: [item: Ranking] }>()

function eventTitle(content: string) {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  const first = text.split(/[。！？!?；;]/)[0] || text
  return compactText(first, 34)
}

function eventSummary(content: string) {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  const index = text.search(/[。！？!?；;]/)
  return index >= 0 ? compactText(text.slice(index + 1).trim(), 64) : ''
}
</script>

<template>
  <view class="ranking" :class="`ranking--${item.type}`" @tap="$emit('open', item)">
    <view class="ranking__top">
      <view class="ranking__identity"><text class="ranking__type">{{ RANKING_TYPE_TEXT[item.type] }}</text><text class="ranking__subject">{{ item.subject_name }}</text></view>
      <text class="ranking__city">{{ item.subject_city || '城市待补充' }}</text>
    </view>
    <view class="ranking__body">
      <view class="ranking__copy"><text class="ranking__title">{{ eventTitle(item.content) }}</text><text v-if="eventSummary(item.content)" class="ranking__content">{{ eventSummary(item.content) }}</text></view>
      <image v-if="item.display_files?.[0]?.url" class="ranking__image" :src="item.display_files[0].url" mode="aspectFill" />
    </view>
    <text v-if="item.event_date && item.event_store_name" class="ranking__context">时间地点已补充</text>
    <view class="ranking__bottom">
      <text>{{ item.author_name || '用户' }} · {{ dateText(item.last_activity_at || item.created_at) }}</text>
      <text>同意 {{ item.agree_count ?? item.likes ?? 0 }} · 反对 {{ item.oppose_count ?? item.dislikes ?? 0 }} · 欢乐 {{ item.joys || 0 }}</text>
    </view>
  </view>
</template>

<style scoped>
.ranking { position: relative; padding: 20rpx 4rpx 18rpx 18rpx; border-bottom: 1rpx solid #eceff2; overflow: hidden; }
.ranking::before { position: absolute; inset: 0 auto 0 0; width: 6rpx; background: #b42318; content: ''; }
.ranking--black::before { background: #26303f; }
.ranking--white::before { background: #b7bec8; }
.ranking__top { display: flex; justify-content: space-between; align-items: center; }
.ranking__identity { display: flex; align-items: center; min-width: 0; gap: 10rpx; }
.ranking__type { color: #b42318; font-size: 23rpx; font-weight: 900; }
.ranking--black .ranking__type { color: #26303f; }
.ranking--white .ranking__type { color: #64748b; }
.ranking__city { color: #94a3b8; font-size: 22rpx; }
.ranking__subject { min-width: 0; overflow: hidden; color: #1f2937; font-size: 27rpx; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.ranking__body { display: flex; align-items: flex-start; gap: 14rpx; margin-top: 10rpx; }
.ranking__copy { min-width: 0; flex: 1; }
.ranking__title { display: -webkit-box; overflow: hidden; color: #1f2937; font-size: 28rpx; font-weight: 850; line-height: 1.42; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.ranking__content { display: -webkit-box; overflow: hidden; margin-top: 6rpx; color: #64748b; font-size: 23rpx; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.ranking__image { width: 132rpx; height: 100rpx; flex: 0 0 132rpx; border-radius: 8rpx; background: #f3f4f6; }
.ranking__context { display: inline-block; margin-top: 8rpx; padding: 4rpx 8rpx; border-radius: 6rpx; background: #eef4fb; color: #275389; font-size: 19rpx; font-weight: 800; }
.ranking__bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 5rpx 14rpx; margin-top: 10rpx; color: #7b8492; font-size: 20rpx; line-height: 1.4; }
</style>
