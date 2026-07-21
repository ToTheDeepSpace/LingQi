<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Carpool } from '../../types'
import { apiRequest, encoded, requireLogin } from '../../utils/api'
import { dateText } from '../../utils/format'

const CITY_KEY = 'jumulu:carpool:last-city'
const items = ref<Carpool[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const cities = computed(() => ['全部城市', ...Array.from(new Set(items.value.map(item => item.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'))])
const visible = computed(() => items.value.filter(item => !item.is_expired && (city.value === '全部城市' || item.city === city.value) && (!query.value.trim() || [item.title, item.script_name, item.role_name, item.content].join(' ').toLocaleLowerCase('zh-CN').includes(query.value.trim().toLocaleLowerCase('zh-CN')))))

async function load() {
  loading.value = true; error.value = ''
  try { items.value = await apiRequest<Carpool[]>('/lc/carpools') }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function selectCity(event: { detail: { value: string } }) { city.value = cities.value[Number(event.detail.value)] || '全部城市'; uni.setStorageSync(CITY_KEY, city.value) }
async function showContact(item: Carpool) {
  try {
    await requireLogin()
    const contact = await apiRequest<{ leader_contact: string; contact_note?: string }> (`/lc/carpools/${encoded(item.id)}/contact`)
    uni.showModal({ title: '联系车头', content: [contact.leader_contact, contact.contact_note].filter(Boolean).join('\n') || '车头暂未填写联系方式', confirmText: '复制', success: result => { if (result.confirm && contact.leader_contact) uni.setClipboardData({ data: contact.leader_contact }) } })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}
onShow(() => { if (!items.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="同城拼车" title="找角色，找搭子" description="按日期、城市、剧本和角色寻找正在招募的车。" />
    <view class="filter surface">
      <picker :range="cities" :value="Math.max(0, cities.indexOf(city))" @change="selectCity"><view class="picker-field">{{ city }}</view></picker>
      <input v-model="query" class="input" placeholder="搜索剧本或角色" />
    </view>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="暂时没有符合条件的拼车" @retry="load" />
    <view v-for="item in visible" :key="item.id" class="carpool surface">
      <view class="carpool__top"><text class="carpool__title">{{ item.script_name || item.title }}</text><text class="carpool__date">{{ dateText(item.event_date) }}</text></view>
      <text class="carpool__meta">{{ item.city }}<template v-if="item.start_time"> · {{ item.start_time }}</template> · 已上 {{ item.joined_count || 0 }}/{{ item.needed_count || '?' }}</text>
      <text v-if="item.role_name" class="carpool__roles">缺：{{ item.role_name }}</text>
      <text v-if="item.content" class="carpool__content">{{ item.content }}</text>
      <view v-if="item.subsidy_note" class="chip-row"><text class="chip">{{ item.subsidy_note }}</text></view>
      <button class="secondary-button contact" @tap="showContact(item)">联系车头</button>
    </view>
  </view>
</template>

<style scoped>
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; margin: 14rpx 0; padding: 12rpx; }
.carpool { margin-bottom: 14rpx; padding: 20rpx; }
.carpool__top { display: flex; justify-content: space-between; gap: 14rpx; }
.carpool__title { color: #27364a; font-size: 30rpx; font-weight: 850; }
.carpool__date { color: #9a651e; font-size: 23rpx; }
.carpool__meta, .carpool__roles, .carpool__content { display: block; margin-top: 10rpx; }
.carpool__meta { color: #64748b; font-size: 23rpx; }
.carpool__roles { color: #275389; font-size: 25rpx; font-weight: 700; }
.carpool__content { color: #475569; font-size: 24rpx; line-height: 1.6; }
.contact { width: 100%; margin-top: 16rpx; }
</style>
