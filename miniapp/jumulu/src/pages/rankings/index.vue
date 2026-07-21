<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import RankingCard from '../../components/RankingCard.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Ranking } from '../../types'
import { apiRequest, encoded } from '../../utils/api'

const CITY_KEY = 'jumulu:ranking:last-city'
const items = ref<Ranking[]>([])
const loading = ref(false)
const error = ref('')
const type = ref<'all' | 'red' | 'black' | 'white'>('all')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const query = ref('')
const typeOptions: Array<{ v: 'all' | 'red' | 'black' | 'white'; l: string }> = [{ v: 'all', l: '全部' }, { v: 'red', l: '红榜' }, { v: 'black', l: '黑榜' }, { v: 'white', l: '白榜' }]
const cities = computed(() => ['全部城市', ...Array.from(new Set(items.value.map(item => item.subject_city).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'zh-CN'))])
const visible = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return items.value.filter(item => (type.value === 'all' || item.type === type.value) && (city.value === '全部城市' || item.subject_city === city.value) && (!keyword || [item.subject_name, item.content, item.event_script_name, item.event_store_name].join(' ').toLocaleLowerCase('zh-CN').includes(keyword)))
})

async function load() {
  loading.value = true; error.value = ''
  try { items.value = await apiRequest<Ranking[]>('/lc/rankings?sort=latest') }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function selectCity(event: { detail: { value: string } }) { city.value = cities.value[Number(event.detail.value)] || '全部城市'; uni.setStorageSync(CITY_KEY, city.value) }
function selectType(value: 'all' | 'red' | 'black' | 'white') { type.value = value }
function openRanking(id: string) { uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(id)}` }) }
onShow(() => { if (!items.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="口碑事件" title="红黑榜" description="红榜记录好体验，黑榜记录风险，白榜收纳趣闻和中性故事。" />
    <view class="type-tabs surface">
      <text v-for="option in typeOptions" :key="option.v" class="type-tab" :class="{ active: type === option.v }" @tap="selectType(option.v)">{{ option.l }}</text>
    </view>
    <view class="filter surface">
      <picker :range="cities" :value="Math.max(0, cities.indexOf(city))" @change="selectCity"><view class="picker-field">{{ city }}</view></picker>
      <input v-model="query" class="input" placeholder="搜索对象、剧本或正文" />
    </view>
    <view class="responsibility">互联网不是法外之地。发布者对事实、证据、隐私打码和言论后果负责。</view>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="当前筛选下没有口碑事件" @retry="load" />
    <RankingCard v-for="item in visible" :key="item.id" :item="item" @open="openRanking(item.id)" />
  </view>
</template>

<style scoped>
.type-tabs { display: flex; margin-top: 14rpx; padding: 8rpx; }
.type-tab { flex: 1; padding: 16rpx 8rpx; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 25rpx; font-weight: 800; }
.type-tab.active { background: #f3e4c9; color: #8b5919; }
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; margin: 12rpx 0; padding: 12rpx; }
.responsibility { margin: 0 2rpx 14rpx; color: #7f1d1d; font-size: 22rpx; line-height: 1.5; }
</style>
