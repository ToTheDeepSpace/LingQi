<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import DossierCreateSheet from '../../components/DossierCreateSheet.vue'
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
const createOpen = ref(false)
const createInitialName = ref('')
const PAGE_SIZE = 20
const displayLimit = ref(PAGE_SIZE)

const visibleItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return items.value.filter(item => {
    if (city.value !== '全部城市' && item.city !== city.value) return false
    if (!keyword) return true
    const text = [item.dm_name, item.city, item.workplace, item.bio, item.note, ...(item.tags || []), ...(item.rating_tags || []), ...(item.common_scripts || []).map(script => script.name)].join(' ').toLocaleLowerCase('zh-CN')
    return text.includes(keyword)
  }).sort((a, b) => Number(Boolean(b.photo_url)) - Number(Boolean(a.photo_url)))
})
const displayedItems = computed(() => visibleItems.value.slice(0, displayLimit.value))

watch([query, city], () => { displayLimit.value = PAGE_SIZE })

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
function create(initialName = '') { createInitialName.value = initialName; createOpen.value = true }
function created() {
  uni.showModal({ title: '档案已提交', content: '这份资料已标注为社区提供，后台审核通过后会出现在 DM 列表。', showCancel: false })
}
function loadMore() { displayLimit.value += PAGE_SIZE }

onShow(() => { if (!items.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="剧本杀 DM 评分" title="查 DM，评体验" description="按姓名、城市、店家、标签或常开剧本查找 DM。" />
    <view class="page-tools">
      <view class="filter">
        <CitySearchPicker :value="city" @change="selectCity" />
        <input v-model="query" class="input" placeholder="搜索名称、标签或常开剧本" />
      </view>
      <view class="page-actions">
        <button class="primary-button" @tap="rate">给 DM 评分</button>
        <button class="secondary-button" @tap="create(query.trim())">新建 DM 档案</button>
      </view>
    </view>
    <view v-if="!loading && !error" class="result-count">
      <text>{{ visibleItems.length }} 份公开档案</text>
      <text v-if="displayedItems.length < visibleItems.length">已显示 {{ displayedItems.length }}</text>
    </view>
    <StatePanel :loading="loading" :error="error" :empty="false" @retry="load" />
    <view v-if="!loading && !error && !visibleItems.length" class="empty">
      <text>没有找到符合条件的 DM</text>
      <button class="secondary-button" @tap="create(query.trim())">新建{{ query.trim() ? `“${query.trim()}”` : '' }}档案</button>
    </view>
    <DossierCard v-for="item in displayedItems" :key="item.id" :item="item" @open="open" />
    <button v-if="displayedItems.length < visibleItems.length" class="secondary-button load-more" @tap="loadMore">继续加载 {{ Math.min(PAGE_SIZE, visibleItems.length - displayedItems.length) }} 份</button>
    <DossierCreateSheet :open="createOpen" entity-type="dm" :initial-name="createInitialName" @close="createOpen = false" @created="created" />
  </view>
</template>

<style scoped>
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; }
.result-count { display: flex; justify-content: space-between; margin: 4rpx 4rpx 14rpx; color: #7b8492; font-size: 22rpx; }
.empty { margin-bottom: 14rpx; padding: 34rpx 22rpx; color: #7b8492; text-align: center; }
.empty text { display: block; font-size: 25rpx; }
.empty button { width: 360rpx; margin: 20rpx auto 0; }
.load-more { width: 100%; margin: 4rpx 0 18rpx; }
@media (max-width: 360px) { .filter { grid-template-columns: 1fr; } }
</style>
