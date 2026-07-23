<script setup lang="ts">
import { computed } from 'vue'
import type { Dossier } from '../types'
import { compactText, ratingText } from '../utils/format'

const props = defineProps<{ item: Dossier; kind?: 'dm' | 'store' }>()
defineEmits<{ open: [item: Dossier] }>()

const tags = computed(() => Array.from(new Set([...(props.item.tags || []), ...(props.item.rating_tags || [])])).slice(0, 3))
const focus = computed(() => `${props.item.photo_focus_x ?? 50}% ${props.item.photo_focus_y ?? 25}%`)
const summary = computed(() => props.item.rating_summary)
const subtitle = computed(() => [props.item.city, props.item.affiliation?.store_name || props.item.workplace].filter(Boolean).join(' · '))
</script>

<template>
  <view class="card" @tap="$emit('open', item)">
    <image v-if="item.photo_url" class="card__image" :src="item.photo_url" mode="aspectFill" :style="{ objectPosition: focus }" />
    <view v-else class="card__avatar">{{ item.dm_name.slice(0, 1) }}</view>
    <view class="card__body">
      <view class="card__top">
        <text class="card__name">{{ item.dm_name }}</text>
        <text class="card__score">{{ ratingText(summary?.avg) }}</text>
      </view>
      <text class="card__meta">{{ subtitle || (kind === 'store' ? '店家资料待补充' : 'DM资料待补充') }}</text>
      <text v-if="item.bio || item.note" class="card__summary">{{ compactText(item.bio || item.note, 54) }}</text>
      <view v-if="tags.length" class="chip-row card__tags">
        <text v-for="tag in tags" :key="tag" class="chip">{{ tag }}</text>
      </view>
      <text class="card__count">{{ summary?.player_count || 0 }} 位玩家 · {{ summary?.review_count || 0 }} 次体验</text>
    </view>
  </view>
</template>

<style scoped>
.card { display: flex; gap: 18rpx; min-height: 156rpx; padding: 18rpx 4rpx; border-bottom: 1rpx solid #eceff2; }
.card__image, .card__avatar { width: 124rpx; height: 142rpx; flex: 0 0 124rpx; border-radius: 8rpx; background: #f2ece4; }
.card__avatar { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 52rpx; font-weight: 800; }
.card__body { flex: 1; min-width: 0; }
.card__top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.card__name { overflow: hidden; color: #1f2937; font-size: 30rpx; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.card__score { color: #9a651e; font-size: 29rpx; font-weight: 900; }
.card__meta, .card__summary, .card__count { display: block; }
.card__meta { margin-top: 6rpx; overflow: hidden; color: #64748b; font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }
.card__summary { display: -webkit-box; overflow: hidden; margin-top: 8rpx; color: #475569; font-size: 22rpx; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.card__tags { margin-top: 8rpx; }
.card__count { margin-top: 8rpx; color: #94a3b8; font-size: 20rpx; }
</style>
