<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import DossierCard from '../../components/DossierCard.vue'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Dossier } from '../../types'
import { apiRequest, encoded } from '../../utils/api'

const CITY_KEY = 'jumulu:store:last-city'
const items = ref<Dossier[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const visible = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return items.value.filter(item => (city.value === '全部城市' || item.city === city.value) && (!keyword || [item.dm_name, item.city, item.workplace, item.note, ...(item.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword)))
})

async function load() {
  loading.value = true; error.value = ''
  try { items.value = await apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store') }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function selectCity(value: string) { city.value = value || '全部城市'; uni.setStorageSync(CITY_KEY, city.value) }
function openRate() { uni.navigateTo({ url: '/pages/stores/rate' }) }
function openStore(id: string) { uni.navigateTo({ url: `/pages/stores/detail?id=${encoded(id)}` }) }
onShow(() => { if (!items.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="城市店铺" title="店家档案" description="查环境、服务和玩家到店体验。" />
    <view class="filter surface">
      <CitySearchPicker :value="city" @change="selectCity" />
      <input v-model="query" class="input" placeholder="搜索店名、城市或地址" />
    </view>
    <button class="primary-button rate" @tap="openRate">评价店家</button>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="没有找到符合条件的店家" @retry="load" />
    <DossierCard v-for="item in visible" :key="item.id" :item="item" kind="store" @open="openStore(item.id)" />
  </view>
</template>

<style scoped>
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; margin-top: 14rpx; padding: 12rpx; }
.rate { width: 100%; margin: 12rpx 0 14rpx; }
</style>
