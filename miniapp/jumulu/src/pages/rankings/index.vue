<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import RankingCard from '../../components/RankingCard.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Ranking } from '../../types'
import { apiRequest, encoded, readAuth } from '../../utils/api'

const CITY_KEY = 'jumulu:ranking:last-city'
const items = ref<Ranking[]>([])
const loading = ref(false)
const error = ref('')
const type = ref<'all' | 'red' | 'black' | 'white'>('all')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const query = ref('')
const authId = ref(readAuth()?.id || '')
const PAGE_SIZE = 12
const displayLimit = ref(PAGE_SIZE)
const typeOptions: Array<{ v: 'all' | 'red' | 'black' | 'white'; l: string }> = [{ v: 'all', l: '全部' }, { v: 'red', l: '红榜' }, { v: 'black', l: '黑榜' }, { v: 'white', l: '白榜' }]
const visible = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return items.value.filter(item => (type.value === 'all' || item.type === type.value) && (city.value === '全部城市' || item.subject_city === city.value) && (!keyword || [item.subject_name, item.content, item.event_script_name, item.event_store_name].join(' ').toLocaleLowerCase('zh-CN').includes(keyword)))
})
const displayedItems = computed(() => visible.value.slice(0, displayLimit.value))

watch([type, city, query], () => { displayLimit.value = PAGE_SIZE })

async function load() {
  loading.value = true; error.value = ''
  try { items.value = await apiRequest<Ranking[]>('/lc/rankings?sort=latest') }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function selectCity(value: string) { city.value = value || '全部城市'; uni.setStorageSync(CITY_KEY, city.value) }
function selectType(value: 'all' | 'red' | 'black' | 'white') { type.value = value }
function openRanking(id: string) { uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(id)}` }) }
function createRanking() { uni.navigateTo({ url: '/pages/rankings/create' }) }
function loadMore() { displayLimit.value += PAGE_SIZE }
function showRules() {
  uni.showModal({
    title: '发布须知',
    content: '互联网不是法外之地。请基于真实体验发布，对事实、证据、第三方隐私打码和言论后果负责。公开内容会进入平台审核，并保留举报和追溯机制。',
    showCancel: false,
    confirmText: '我知道了',
  })
}
onShow(() => { authId.value = readAuth()?.id || ''; void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="口碑事件" title="红黑榜" description="红榜记录好体验，黑榜记录风险，白榜收纳趣闻和中性故事。" />
    <view class="page-tools">
      <view class="type-tabs">
        <text v-for="option in typeOptions" :key="option.v" class="type-tab" :class="{ active: type === option.v }" @tap="selectType(option.v)">{{ option.l }}</text>
      </view>
      <view class="filter">
        <CitySearchPicker :value="city" @change="selectCity" />
        <input v-model="query" class="input" placeholder="搜索对象、剧本或正文" />
      </view>
      <button class="primary-button publish" @tap="createRanking">发布红黑榜</button>
    </view>
    <view v-if="!loading && !error" class="result-row">
      <text>共 {{ visible.length }} 条</text>
      <text class="rules-entry" @tap="showRules">ⓘ 发布须知</text>
    </view>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="当前筛选下没有口碑事件" @retry="load" />
    <RankingCard v-for="item in displayedItems" :key="item.id" :item="item" :viewer-id="authId" @open="openRanking(item.id)" />
    <button v-if="displayedItems.length < visible.length" class="secondary-button load-more" @tap="loadMore">继续加载 {{ Math.min(PAGE_SIZE, visible.length - displayedItems.length) }} 条</button>
  </view>
</template>

<style scoped>
.type-tabs { display: flex; margin: -4rpx -4rpx 10rpx; padding: 4rpx; }
.type-tab { flex: 1; padding: 16rpx 8rpx; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 25rpx; font-weight: 800; }
.type-tab.active { background: #f3e4c9; color: #8b5919; }
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; }
.publish { width: 100%; margin: 12rpx 0 0; }
.result-row { display: flex; align-items: center; justify-content: space-between; margin: 0 4rpx 14rpx; color: #7b8492; font-size: 22rpx; }
.rules-entry { color: #275389; font-weight: 750; }
.load-more { width: 100%; margin: 4rpx 0 18rpx; }
</style>
