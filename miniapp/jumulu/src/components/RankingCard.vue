<script setup lang="ts">
import type { Ranking } from '../types'
import { compactText, dateText, RANKING_TYPE_TEXT } from '../utils/format'

defineProps<{ item: Ranking }>()
defineEmits<{ open: [item: Ranking] }>()
</script>

<template>
  <view class="ranking surface" :class="`ranking--${item.type}`" @tap="$emit('open', item)">
    <view class="ranking__top">
      <text class="ranking__type">{{ RANKING_TYPE_TEXT[item.type] }}</text>
      <text class="ranking__city">{{ item.subject_city || '城市待补充' }}</text>
    </view>
    <text class="ranking__subject">{{ item.subject_name }}</text>
    <text class="ranking__content">{{ compactText(item.content, 130) }}</text>
    <image v-if="item.display_files?.[0]?.url" class="ranking__image" :src="item.display_files[0].url" mode="aspectFill" />
    <view class="ranking__bottom">
      <text>{{ item.author_name || '用户' }} · {{ dateText(item.last_activity_at || item.created_at) }}</text>
      <text>同意 {{ item.agree_count ?? item.likes ?? 0 }} · 反对 {{ item.oppose_count ?? item.dislikes ?? 0 }} · 欢乐 {{ item.joys || 0 }}</text>
    </view>
  </view>
</template>

<style scoped>
.ranking { position: relative; margin-bottom: 14rpx; padding: 20rpx 20rpx 18rpx 24rpx; overflow: hidden; }
.ranking::before { position: absolute; inset: 0 auto 0 0; width: 6rpx; background: #b9781f; content: ''; }
.ranking--black::before { background: #26303f; }
.ranking--white::before { background: #b7bec8; }
.ranking__top { display: flex; justify-content: space-between; align-items: center; }
.ranking__type { color: #9a651e; font-size: 23rpx; font-weight: 900; }
.ranking--black .ranking__type { color: #26303f; }
.ranking--white .ranking__type { color: #64748b; }
.ranking__city { color: #94a3b8; font-size: 22rpx; }
.ranking__subject { display: block; margin-top: 10rpx; color: #1f2937; font-size: 31rpx; font-weight: 850; }
.ranking__content { display: block; margin-top: 12rpx; color: #374151; font-size: 26rpx; line-height: 1.65; }
.ranking__image { width: 100%; height: 260rpx; margin-top: 14rpx; border-radius: 10rpx; background: #f3f4f6; }
.ranking__bottom { display: flex; justify-content: space-between; gap: 14rpx; margin-top: 16rpx; color: #7b8492; font-size: 21rpx; line-height: 1.4; }
</style>
