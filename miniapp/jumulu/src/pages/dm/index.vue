<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import DossierCreateSheet from '../../components/DossierCreateSheet.vue'
import DossierCard from '../../components/DossierCard.vue'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Dossier } from '../../types'
import { apiRequest, encoded, requireLogin } from '../../utils/api'
import { sortDossiers, type DossierSortMode } from '../../utils/dossierSort'

const CITY_KEY = 'jumulu:dm:last-city'
const SORT_KEY = 'jumulu:dm:sort-mode'
const CHANTO_SORT_KEY = 'jumulu:dm:chanto-first'
const SORT_OPTIONS: Array<{ value: DossierSortMode; label: string }> = [
  { value: 'comprehensive', label: '综合排序' },
  { value: 'rating', label: '评分最高' },
  { value: 'verified', label: '已认证优先' },
  { value: 'photo', label: '有照片优先' },
  { value: 'newest', label: '最新收录' },
]
const items = ref<Dossier[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const storedSort = String(uni.getStorageSync(SORT_KEY) || 'comprehensive') as DossierSortMode
const sortMode = ref<DossierSortMode>(SORT_OPTIONS.some(option => option.value === storedSort) ? storedSort : 'comprehensive')
const chantoFirst = ref(uni.getStorageSync(CHANTO_SORT_KEY) === true)
const createOpen = ref(false)
const createInitialName = ref('')
const PAGE_SIZE = 20
const displayLimit = ref(PAGE_SIZE)
const sortLabel = computed(() => SORT_OPTIONS.find(option => option.value === sortMode.value)?.label || '综合排序')

const visibleItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  const filtered = items.value.filter(item => {
    if (city.value !== '全部城市' && item.city !== city.value) return false
    if (!keyword) return true
    const text = [item.dm_name, item.city, item.workplace, item.bio, item.note, ...(item.tags || []), ...(item.rating_tags || []), ...(item.common_scripts || []).map(script => script.name)].join(' ').toLocaleLowerCase('zh-CN')
    return text.includes(keyword)
  })
  return sortDossiers(filtered, sortMode.value, chantoFirst.value)
})
const displayedItems = computed(() => visibleItems.value.slice(0, displayLimit.value))

watch([query, city, sortMode, chantoFirst], () => { displayLimit.value = PAGE_SIZE })

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

function changeSort(event: { detail: { value: string | number } }) {
  const index = Number(event.detail.value)
  const selected = SORT_OPTIONS[index]?.value || 'comprehensive'
  sortMode.value = selected
  uni.setStorageSync(SORT_KEY, selected)
}

function toggleChanto() {
  chantoFirst.value = !chantoFirst.value
  uni.setStorageSync(CHANTO_SORT_KEY, chantoFirst.value)
}

function open(item: Dossier) { uni.navigateTo({ url: `/pages/dm/detail?id=${encoded(item.id)}` }) }
function rate() { void requireLogin().then(() => uni.navigateTo({ url: '/pages/dm/rate' })).catch(() => undefined) }
function create(initialName = '') {
  void requireLogin().then(() => { createInitialName.value = initialName; createOpen.value = true }).catch(() => undefined)
}
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
      <view class="sort-tools">
        <picker mode="selector" :range="SORT_OPTIONS" range-key="label" :value="SORT_OPTIONS.findIndex(option => option.value === sortMode)" @change="changeSort">
          <view class="sort-control"><text>{{ sortLabel }}</text><text class="sort-control__arrow">⌄</text></view>
        </picker>
        <button class="chanto-switch" :class="{ active: chantoFirst }" @tap="toggleChanto">
          <text class="chanto-switch__dot" />
          <text>缠头优先</text>
        </button>
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
.sort-tools { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12rpx; }
.sort-control, .chanto-switch { height: 68rpx; box-sizing: border-box; border: 1rpx solid #dce1e7; border-radius: 8rpx; background: #fff; color: #475569; font-size: 23rpx; font-weight: 750; }
.sort-control { display: flex; align-items: center; justify-content: space-between; padding: 0 20rpx; }
.sort-control__arrow { color: #94a3b8; font-size: 26rpx; }
.chanto-switch { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin: 0; padding: 0 18rpx; line-height: 1; }
.chanto-switch::after { border: 0; }
.chanto-switch.active { border-color: #d6b983; background: #fff8eb; color: #8a5417; }
.chanto-switch__dot { width: 22rpx; height: 22rpx; border-radius: 50%; background: #cbd5e1; }
.chanto-switch.active .chanto-switch__dot { background: #a66a1f; box-shadow: inset 0 0 0 5rpx #fff8eb; }
.result-count { display: flex; justify-content: space-between; margin: 4rpx 4rpx 14rpx; color: #7b8492; font-size: 22rpx; }
.empty { margin-bottom: 14rpx; padding: 34rpx 22rpx; color: #7b8492; text-align: center; }
.empty text { display: block; font-size: 25rpx; }
.empty button { width: 360rpx; margin: 20rpx auto 0; }
.load-more { width: 100%; margin: 4rpx 0 18rpx; }
@media (max-width: 360px) { .filter { grid-template-columns: 1fr; } }
</style>
