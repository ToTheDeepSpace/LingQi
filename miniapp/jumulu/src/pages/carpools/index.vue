<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Carpool, CarpoolApplication } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dateText } from '../../utils/format'

type PageView = 'discover' | 'mine'

const CITY_KEY = 'jumulu:carpools:last-city'
const view = ref<PageView>('discover')
const carpools = ref<Carpool[]>([])
const received = ref<CarpoolApplication[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const authId = computed(() => readAuth()?.id || '')

const visibleItems = computed(() => carpools.value.filter(item =>
  !item.is_expired
  && (city.value === '全部城市' || item.city === city.value)
  && (!query.value.trim() || [item.title, item.script_name, item.role_name, item.content]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(query.value.trim().toLocaleLowerCase('zh-CN'))),
))

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!uni.getStorageSync(CITY_KEY) && readAuth()?.token) {
      const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
      if (follows.cities?.[0]) city.value = follows.cities[0]
    }
    carpools.value = await apiRequest<Carpool[]>('/lc/carpools')
    received.value = readAuth()?.token
      ? await apiRequest<CarpoolApplication[]>('/lc/carpools/applications/received')
      : []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function selectCity(value: string) {
  city.value = value || '全部城市'
  uni.setStorageSync(CITY_KEY, city.value)
}
function openProfile(id?: string) { if (id) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(id)}` }) }
function create() { void requireLogin().then(() => uni.navigateTo({ url: '/pages/carpools/create' })).catch(() => undefined) }

async function apply(item: Carpool) {
  try {
    await requireLogin()
    if (item.poster_id === authId.value) return
    const result = await uni.showModal({ title: '申请上车', editable: true, placeholderText: '说明想玩的角色和同行情况', confirmText: '提交申请' })
    if (!result.confirm || !String(result.content || '').trim()) return
    await apiRequest(`/lc/carpools/${encoded(item.id)}/applications`, { method: 'POST', data: { message: String(result.content).trim(), roleName: item.role_name || '' } })
    uni.showToast({ title: '申请已发送', icon: 'success' })
  } catch (err) {
    if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' })
  }
}

async function showContact(item: Carpool) {
  try {
    await requireLogin()
    const contact = await apiRequest<{ leader_contact: string; contact_note?: string }>(`/lc/carpools/${encoded(item.id)}/contact`)
    uni.showModal({
      title: '联系车头',
      content: [contact.leader_contact, contact.contact_note].filter(Boolean).join('\n') || '车头暂未填写联系方式',
      confirmText: '复制',
      success: result => { if (result.confirm && contact.leader_contact) uni.setClipboardData({ data: contact.leader_contact }) },
    })
  } catch (err) {
    if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' })
  }
}

async function decide(item: CarpoolApplication, decision: 'accept' | 'reject') {
  try {
    await apiRequest(`/lc/carpools/applications/${encoded(item.id)}/${decision}`, { method: 'PUT' })
    await load()
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  }
}

onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="同城拼车" nav-title="拼车" title="同城拼车" description="按当前城市找车、补位和联系车头。">
      <button class="primary-button intro-action" @tap="create">发布拼车</button>
    </PageIntro>
    <view class="view-tabs">
      <button :class="{ active: view === 'discover' }" @tap="view = 'discover'">找拼车</button>
      <button :class="{ active: view === 'mine' }" @tap="view = 'mine'">收到的申请</button>
    </view>

    <template v-if="view === 'discover'">
      <view class="filter page-tools">
        <CitySearchPicker :value="city" @change="selectCity" />
        <input v-model="query" class="input" placeholder="搜索剧本或角色" />
      </view>
      <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visibleItems.length" empty-text="暂时没有符合条件的拼车" @retry="load" />
      <view v-for="item in visibleItems" :key="item.id" class="listing surface">
        <view class="listing__top"><text class="listing__title">{{ item.script_name || item.title }}</text><view class="listing__top-actions"><text class="listing__date">{{ dateText(item.event_date) }}</text><ReportFlag target-type="carpool" :target-id="item.id" :title="item.title" :own="item.poster_id === authId" /></view></view>
        <text class="listing__meta">{{ item.city }}<template v-if="item.start_time"> · {{ item.start_time }}</template> · 已上 {{ item.joined_count || 0 }}/{{ item.needed_count || '?' }}</text>
        <text v-if="item.poster_name" class="poster" @tap="openProfile(item.poster_id)">车头 {{ item.poster_name }}</text>
        <text v-if="item.role_name" class="listing__roles">缺：{{ item.role_name }}</text>
        <text v-if="item.content" class="listing__content">{{ item.content }}</text>
        <view class="action-row"><button class="secondary-button" @tap="showContact(item)">联系方式</button><button v-if="item.poster_id !== authId" class="primary-button" @tap="apply(item)">申请上车</button></view>
      </view>
    </template>

    <template v-else>
      <StatePanel v-if="!readAuth()?.token" :empty="true" empty-text="登录后查看收到的上车申请" />
      <template v-else>
        <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !received.length" empty-text="暂时没有收到上车申请" @retry="load" />
        <view v-for="item in received" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.carpool?.title || '拼车申请' }} · {{ item.applicant_name }}</text>
          <text class="inbox__body">{{ item.message || '未填写说明' }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decide(item, 'reject')">拒绝</button><button class="primary-button" @tap="decide(item, 'accept')">同意上车</button></view>
          <text v-else class="status">{{ item.status === 'accepted' ? '已同意' : '已拒绝' }}</text>
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped>
.intro-action { width: 100%; }
.view-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin: 0 0 14rpx; }
.view-tabs button { min-height: 64rpx; margin: 0; border: 0; border-radius: 8rpx; background: #f4f5f7; color: #64748b; font-size: 24rpx; line-height: 64rpx; }
.view-tabs button.active { background: #fff1d5; color: #8b5919; font-weight: 850; }
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; }
.listing, .inbox { margin-bottom: 14rpx; padding: 20rpx; }
.listing__top { display: flex; justify-content: space-between; gap: 14rpx; }
.listing__top-actions { display: flex; align-items: center; gap: 4rpx; }
.listing__title, .inbox__title { color: #27364a; font-size: 29rpx; font-weight: 850; }
.listing__date { flex: 0 0 auto; color: #9a651e; font-size: 23rpx; }
.listing__meta, .listing__roles, .listing__content, .poster, .inbox__body, .status { display: block; margin-top: 9rpx; }
.listing__meta, .status { color: #64748b; font-size: 23rpx; }
.poster { color: #275389; font-size: 23rpx; font-weight: 750; }
.listing__roles { color: #275389; font-size: 25rpx; font-weight: 700; }
.listing__content, .inbox__body { color: #475569; font-size: 24rpx; line-height: 1.6; }
.action-row { margin-top: 16rpx; }
</style>
