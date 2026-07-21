<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Dossier } from '../types'

const props = defineProps<{
  items: Dossier[]
  value?: string
  draftLabel?: string
  kind: 'dm' | 'store'
  placeholder?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  create: [initialName: string]
}>()

const open = ref(false)
const query = ref('')
const label = computed(() => {
  if (props.draftLabel) return `${props.draftLabel}（待提交）`
  return props.items.find(item => item.id === props.value)?.dm_name || props.placeholder || `请选择${props.kind === 'dm' ? ' DM' : '店家'}`
})
const results = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!keyword) return props.items
  return props.items.filter(item => [item.dm_name, item.city, item.workplace, ...(item.tags || [])]
    .join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
})
const entityLabel = computed(() => props.kind === 'dm' ? 'DM' : '店家')

function show() { query.value = ''; open.value = true }
function close() { open.value = false; query.value = '' }
function choose(id: string) { emit('select', id); close() }
function create() { const name = query.value.trim(); close(); emit('create', name) }
</script>

<template>
  <view class="dossier-trigger picker-field" @tap="show">
    <text class="dossier-trigger__label" :class="{ muted: !value && !draftLabel }">{{ label }}</text>
    <text class="dossier-trigger__arrow">⌄</text>
  </view>

  <view v-if="open" class="dossier-mask" @tap="close">
    <view class="dossier-sheet" @tap.stop>
      <view class="dossier-sheet__head">
        <view>
          <text class="dossier-sheet__title">选择{{ entityLabel }}</text>
          <text class="dossier-sheet__current">可按名称、城市或店家信息搜索</text>
        </view>
        <button class="dossier-sheet__close" aria-label="关闭" @tap="close">×</button>
      </view>
      <view class="dossier-search">
        <text class="dossier-search__icon">⌕</text>
        <input v-model="query" class="dossier-search__input" focus confirm-type="search" :placeholder="`搜索${entityLabel}`" />
        <text v-if="query" class="dossier-search__clear" @tap="query = ''">清除</text>
      </view>
      <scroll-view class="dossier-results" scroll-y enhanced show-scrollbar>
        <view v-for="item in results" :key="item.id" class="dossier-option" :class="{ selected: value === item.id && !draftLabel }" @tap="choose(item.id)">
          <view class="dossier-option__copy">
            <text class="dossier-option__name">{{ item.dm_name }}</text>
            <text class="dossier-option__meta">{{ [item.city, item.workplace].filter(Boolean).join(' · ') || '资料待补充' }}</text>
          </view>
          <text v-if="value === item.id && !draftLabel" class="dossier-option__check">已选</text>
        </view>
        <view v-if="!results.length" class="dossier-empty">
          <text>没有找到“{{ query.trim() }}”</text>
          <button class="dossier-create primary-button" @tap="create">新建这个{{ entityLabel }}</button>
        </view>
      </scroll-view>
      <button v-if="results.length" class="dossier-create-link" @tap="create">＋ 新建{{ query.trim() ? `“${query.trim()}”` : '' }}{{ entityLabel }}档案</button>
    </view>
  </view>
</template>

<style scoped>
.dossier-trigger { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; }
.dossier-trigger__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dossier-trigger__arrow { flex: 0 0 auto; color: #7b8492; font-size: 28rpx; }
.dossier-mask { position: fixed; z-index: 900; inset: 0; display: flex; align-items: flex-end; background: rgba(15, 23, 42, 0.44); }
.dossier-sheet { width: 100%; max-height: 78vh; padding: 24rpx 24rpx calc(20rpx + env(safe-area-inset-bottom)); border-radius: 16rpx 16rpx 0 0; background: #fffdf8; }
.dossier-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.dossier-sheet__title, .dossier-sheet__current { display: block; }
.dossier-sheet__title { color: #1f2937; font-size: 31rpx; font-weight: 850; }
.dossier-sheet__current { margin-top: 5rpx; color: #7b8492; font-size: 22rpx; }
.dossier-sheet__close { width: 64rpx; height: 64rpx; margin: 0; padding: 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 40rpx; line-height: 58rpx; }
.dossier-search { display: flex; align-items: center; height: 76rpx; margin-top: 20rpx; padding: 0 20rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; background: #fff; }
.dossier-search__icon { margin-right: 12rpx; color: #7b8492; font-size: 30rpx; }
.dossier-search__input { min-width: 0; flex: 1; height: 72rpx; color: #1f2937; font-size: 27rpx; }
.dossier-search__clear { padding-left: 14rpx; color: #275389; font-size: 23rpx; }
.dossier-results { height: min(760rpx, 50vh); margin-top: 14rpx; border-top: 1rpx solid #eadfce; }
.dossier-option { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 88rpx; padding: 13rpx 14rpx; border-bottom: 1rpx solid #eceff2; }
.dossier-option.selected { background: #fff5df; }
.dossier-option__copy { min-width: 0; }
.dossier-option__name, .dossier-option__meta { display: block; }
.dossier-option__name { color: #27364a; font-size: 27rpx; font-weight: 800; }
.dossier-option__meta { margin-top: 4rpx; overflow: hidden; color: #7b8492; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.dossier-option__check { flex: 0 0 auto; color: #9a651e; font-size: 22rpx; font-weight: 800; }
.dossier-empty { padding: 70rpx 20rpx; color: #7b8492; text-align: center; font-size: 25rpx; }
.dossier-create { width: 300rpx; margin: 24rpx auto 0; }
.dossier-create-link { width: 100%; min-height: 68rpx; margin-top: 12rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #275389; font-size: 24rpx; font-weight: 800; line-height: 68rpx; }
</style>
