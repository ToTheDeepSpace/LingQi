<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import DossierCard from '../../components/DossierCard.vue'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Dossier } from '../../types'
import { apiRequest, encoded } from '../../utils/api'

const CITY_KEY = 'jumulu:dm:last-city'
const items = ref<Dossier[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))

const visibleItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return items.value.filter(item => {
    if (city.value !== '全部城市' && item.city !== city.value) return false
    if (!keyword) return true
    const text = [item.dm_name, item.city, item.workplace, item.bio, item.note, ...(item.tags || []), ...(item.rating_tags || []), ...(item.common_scripts || []).map(script => script.name)].join(' ').toLocaleLowerCase('zh-CN')
    return text.includes(keyword)
  }).sort((a, b) => Number(Boolean(b.photo_url)) - Number(Boolean(a.photo_url)))
})

async function load() {
  loading.value = true
  error.value = ''
  try { items.value = await apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm') }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function selectCity(value: string) {
  city.value = value || '全部城市'
  uni.setStorageSync(CITY_KEY, city.value)
}

function open(item: Dossier) { uni.navigateTo({ url: `/pages/dm/detail?id=${encoded(item.id)}` }) }
function rate() { uni.navigateTo({ url: '/pages/dm/rate' }) }

onShow(() => { if (!items.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="剧本杀 DM 评分" title="查 DM，评体验" description="按姓名、城市、店家、标签或常开剧本查找 DM。">
      <button class="primary-button intro-action" @tap="rate">给 DM 评分</button>
    </PageIntro>
    <view class="filter surface">
      <CitySearchPicker :value="city" @change="selectCity" />
      <input v-model="query" class="input" placeholder="搜索名称、标签或常开剧本" />
    </view>
    <text v-if="!loading && !error" class="result-count">{{ visibleItems.length }} 份公开档案</text>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visibleItems.length" empty-text="没有找到符合条件的 DM" @retry="load" />
    <DossierCard v-for="item in visibleItems" :key="item.id" :item="item" @open="open" />
  </view>
</template>

<style scoped>
.intro-action { width: 100%; margin-top: 18rpx; }
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; margin: 14rpx 0; padding: 12rpx; }
.result-count { display: block; margin: 4rpx 4rpx 14rpx; color: #7b8492; font-size: 22rpx; }
</style>
