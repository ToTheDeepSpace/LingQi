<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Script } from '../types'

const props = defineProps<{ items: Script[]; value?: string; placeholder?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const open = ref(false)
const query = ref('')
const selected = computed(() => props.items.find(item => item.id === props.value))
const results = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!keyword) return props.items
  return props.items.filter(item => [item.name, ...(item.player_roles || []).map(role => role.role_name), ...(item.actor_roles || []).map(role => role.role_name)]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(keyword))
})

function show() { query.value = ''; open.value = true }
function close() { open.value = false; query.value = '' }
function choose(id: string) { emit('select', id); close() }
</script>

<template>
  <view class="script-trigger picker-field" @tap="show">
    <text :class="{ muted: !selected }">{{ selected?.name || placeholder || '搜索并选择剧本' }}</text>
    <image src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
  </view>
  <view v-if="open" class="script-mask" @tap="close">
    <view class="script-sheet" @tap.stop>
      <view class="script-sheet__head"><view><text class="script-sheet__title">选择剧本</text><text class="script-sheet__note">可搜索剧本名或角色名</text></view><button aria-label="关闭" @tap="close">×</button></view>
      <view class="script-search"><image src="/static/icons/ui-search.png" mode="aspectFit" /><input v-model="query" focus confirm-type="search" placeholder="搜索剧本或角色" /><text v-if="query" @tap="query = ''">清除</text></view>
      <scroll-view class="script-results" scroll-y>
        <view v-for="item in results" :key="item.id" class="script-option" :class="{ selected: value === item.id }" @tap="choose(item.id)">
          <view><text class="script-option__name">{{ item.name }}</text><text class="script-option__meta">{{ (item.player_roles?.length || 0) + (item.actor_roles?.length || 0) }} 个角色</text></view>
          <text v-if="value === item.id" class="script-option__status">已选</text>
        </view>
        <view v-if="!results.length" class="script-empty">没有找到相符的剧本</view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.script-trigger { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.script-trigger text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.script-trigger image { width: 24rpx; height: 24rpx; transform: rotate(90deg); }
.script-mask { position: fixed; z-index: 950; inset: 0; display: flex; align-items: flex-end; background: rgba(15,23,42,.46); }
.script-sheet { width: 100%; max-height: 78vh; padding: 24rpx 24rpx calc(22rpx + env(safe-area-inset-bottom)); border-radius: 14rpx 14rpx 0 0; background: #fffdf8; }
.script-sheet__head { display: flex; align-items: center; justify-content: space-between; }
.script-sheet__title, .script-sheet__note { display: block; }
.script-sheet__title { color: #27364a; font-size: 30rpx; font-weight: 850; }
.script-sheet__note { margin-top: 5rpx; color: #7b8492; font-size: 21rpx; }
.script-sheet__head button { width: 62rpx; height: 62rpx; margin: 0; padding: 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 38rpx; line-height: 58rpx; }
.script-search { display: flex; align-items: center; height: 76rpx; margin-top: 18rpx; padding: 0 18rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; }
.script-search image { width: 31rpx; height: 31rpx; margin-right: 12rpx; }
.script-search input { min-width: 0; flex: 1; font-size: 25rpx; }
.script-search text { color: #275389; font-size: 21rpx; }
.script-results { height: min(760rpx, 52vh); margin-top: 10rpx; border-top: 1rpx solid #eceff2; }
.script-option { display: flex; align-items: center; justify-content: space-between; min-height: 94rpx; padding: 10rpx 8rpx; border-bottom: 1rpx solid #eceff2; }
.script-option.selected { background: #fff8e8; }
.script-option__name, .script-option__meta { display: block; }
.script-option__name { color: #27364a; font-size: 26rpx; font-weight: 800; }
.script-option__meta { margin-top: 5rpx; color: #7b8492; font-size: 20rpx; }
.script-option__status { color: #9a651e; font-size: 21rpx; font-weight: 800; }
.script-empty { padding: 54rpx 0; color: #8a93a2; font-size: 23rpx; text-align: center; }
</style>
