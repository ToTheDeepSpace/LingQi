<script setup lang="ts">
import { computed, ref } from 'vue'
import { CITY_OPTIONS } from '../../../../src/constants/cities'

const props = withDefaults(defineProps<{
  value: string
  allowAll?: boolean
}>(), {
  allowAll: true,
})

const emit = defineEmits<{
  change: [value: string]
}>()

const open = ref(false)
const query = ref('')

function normalize(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/(市|地区|盟|自治州|特别行政区)$/u, '')
}

const options = computed(() => {
  const raw = query.value.trim()
  const term = normalize(raw)
  if (!term) return CITY_OPTIONS
  return CITY_OPTIONS.filter(option => {
    const city = normalize(option.city)
    const group = normalize(option.group)
    return option.city.includes(raw) || option.group.includes(raw) || city.includes(term) || group.includes(term) || term.includes(city)
  })
})

function show() {
  query.value = ''
  open.value = true
}

function close() {
  open.value = false
  query.value = ''
}

function choose(value: string) {
  emit('change', value)
  close()
}
</script>

<template>
  <view class="city-trigger picker-field" @tap="show">
    <text class="city-trigger__label">{{ value || '全部城市' }}</text>
    <text class="city-trigger__arrow">⌄</text>
  </view>

  <view v-if="open" class="city-mask" @tap="close">
    <view class="city-sheet" @tap.stop>
      <view class="city-sheet__head">
        <view>
          <text class="city-sheet__title">选择城市</text>
          <text class="city-sheet__current">当前：{{ value || '全部城市' }}</text>
        </view>
        <button class="city-sheet__close" aria-label="关闭" @tap="close">×</button>
      </view>
      <view class="city-search">
        <text class="city-search__icon">⌕</text>
        <input v-model="query" class="city-search__input" focus confirm-type="search" placeholder="搜索城市或省份" />
        <text v-if="query" class="city-search__clear" @tap="query = ''">清除</text>
      </view>
      <scroll-view class="city-results" scroll-y enhanced show-scrollbar>
        <view v-if="allowAll" class="city-option" :class="{ selected: value === '全部城市' }" @tap="choose('全部城市')">
          <text class="city-option__name">全部城市</text>
          <text class="city-option__meta">不限制城市</text>
        </view>
        <view v-for="option in options" :key="`${option.group}-${option.city}`" class="city-option" :class="{ selected: value === option.city }" @tap="choose(option.city)">
          <text class="city-option__name">{{ option.city }}</text>
          <text class="city-option__meta">{{ option.group }}</text>
        </view>
        <view v-if="!options.length" class="city-empty">没有找到“{{ query.trim() }}”</view>
      </scroll-view>
      <view class="city-sheet__count">{{ query.trim() ? `找到 ${options.length} 个城市` : `完整城市库 · ${options.length} 个` }}</view>
    </view>
  </view>
</template>

<style scoped>
.city-trigger { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; }
.city-trigger__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city-trigger__arrow { flex: 0 0 auto; color: #7b8492; font-size: 28rpx; }
.city-mask { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: flex-end; background: rgba(15, 23, 42, 0.44); }
.city-sheet { width: 100%; max-height: 78vh; padding: 24rpx 24rpx calc(22rpx + env(safe-area-inset-bottom)); border-radius: 16rpx 16rpx 0 0; background: #fffdf8; }
.city-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.city-sheet__title, .city-sheet__current { display: block; }
.city-sheet__title { color: #1f2937; font-size: 31rpx; font-weight: 850; }
.city-sheet__current { margin-top: 5rpx; color: #7b8492; font-size: 22rpx; }
.city-sheet__close { width: 64rpx; height: 64rpx; margin: 0; padding: 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 40rpx; line-height: 58rpx; }
.city-search { display: flex; align-items: center; height: 76rpx; margin-top: 20rpx; padding: 0 20rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; background: #fff; }
.city-search__icon { flex: 0 0 auto; margin-right: 12rpx; color: #7b8492; font-size: 30rpx; }
.city-search__input { min-width: 0; flex: 1; height: 72rpx; color: #1f2937; font-size: 27rpx; }
.city-search__clear { flex: 0 0 auto; padding-left: 14rpx; color: #275389; font-size: 23rpx; }
.city-results { height: min(820rpx, 56vh); margin-top: 14rpx; border-top: 1rpx solid #eadfce; }
.city-option { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; min-height: 76rpx; padding: 12rpx 14rpx; border-bottom: 1rpx solid #eceff2; }
.city-option.selected { background: #fff5df; }
.city-option__name { color: #27364a; font-size: 27rpx; font-weight: 750; }
.city-option.selected .city-option__name { color: #8b5919; }
.city-option__meta { color: #7b8492; font-size: 21rpx; text-align: right; }
.city-empty { padding: 70rpx 20rpx; color: #7b8492; text-align: center; font-size: 25rpx; }
.city-sheet__count { padding-top: 12rpx; color: #7b8492; text-align: center; font-size: 21rpx; }
</style>
