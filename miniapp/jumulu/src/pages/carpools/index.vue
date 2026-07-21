<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Carpool, CarpoolApplication, Commission, CommissionApplication } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dateText } from '../../utils/format'

type HubTab = 'carpool' | 'commission'
type HubView = 'discover' | 'mine'

const CITY_KEY = 'jumulu:local:last-city'
const tab = ref<HubTab>('carpool')
const view = ref<HubView>('discover')
const carpools = ref<Carpool[]>([])
const commissions = ref<Commission[]>([])
const receivedCarpools = ref<CarpoolApplication[]>([])
const receivedCommissions = ref<CommissionApplication[]>([])
const sentCommissions = ref<CommissionApplication[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const applyTarget = ref<Commission | null>(null)
const applyLetter = ref('')
const applyContact = ref('')
const applyBusy = ref(false)

const authId = computed(() => readAuth()?.id || '')
const visibleCarpools = computed(() => carpools.value.filter(item => !item.is_expired && (city.value === '全部城市' || item.city === city.value) && (!query.value.trim() || [item.title, item.script_name, item.role_name, item.content].join(' ').toLocaleLowerCase('zh-CN').includes(query.value.trim().toLocaleLowerCase('zh-CN')))))
const visibleCommissions = computed(() => commissions.value.filter(item => !item.is_expired && (city.value === '全部城市' || item.city === city.value) && (!query.value.trim() || [item.title, item.content, item.script_name, item.desired_role].join(' ').toLocaleLowerCase('zh-CN').includes(query.value.trim().toLocaleLowerCase('zh-CN')))))

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!uni.getStorageSync(CITY_KEY) && readAuth()?.token) {
      const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
      if (follows.cities?.[0]) city.value = follows.cities[0]
    }
    const [carpoolItems, commissionItems] = await Promise.all([
      apiRequest<Carpool[]>('/lc/carpools'),
      apiRequest<Commission[]>('/lc/commissions'),
    ])
    carpools.value = carpoolItems
    commissions.value = commissionItems
    if (readAuth()?.token) {
      const [carpoolInbox, commissionInbox, commissionSent] = await Promise.all([
        apiRequest<CarpoolApplication[]>('/lc/carpools/applications/received'),
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/received'),
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/sent'),
      ])
      receivedCarpools.value = carpoolInbox
      receivedCommissions.value = commissionInbox
      sentCommissions.value = commissionSent
    } else {
      receivedCarpools.value = []
      receivedCommissions.value = []
      sentCommissions.value = []
    }
  } catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function selectCity(value: string) { city.value = value || '全部城市'; uni.setStorageSync(CITY_KEY, city.value) }
function openProfile(id?: string) { if (id) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(id)}` }) }
function create() { void requireLogin().then(() => uni.navigateTo({ url: tab.value === 'carpool' ? '/pages/carpools/create' : '/pages/commissions/create' })).catch(() => undefined) }

async function applyCarpool(item: Carpool) {
  try {
    await requireLogin()
    if (item.poster_id === authId.value) return
    const result = await uni.showModal({ title: '申请上车', editable: true, placeholderText: '说明想玩的角色和同行情况', confirmText: '提交申请' })
    if (!result.confirm || !String(result.content || '').trim()) return
    await apiRequest(`/lc/carpools/${encoded(item.id)}/applications`, { method: 'POST', data: { message: String(result.content).trim(), roleName: item.role_name || '' } })
    uni.showToast({ title: '申请已发送', icon: 'success' })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}

async function showCarpoolContact(item: Carpool) {
  try {
    await requireLogin()
    const contact = await apiRequest<{ leader_contact: string; contact_note?: string }>(`/lc/carpools/${encoded(item.id)}/contact`)
    uni.showModal({ title: '联系车头', content: [contact.leader_contact, contact.contact_note].filter(Boolean).join('\n') || '车头暂未填写联系方式', confirmText: '复制', success: result => { if (result.confirm && contact.leader_contact) uni.setClipboardData({ data: contact.leader_contact }) } })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}

function openCommissionApply(item: Commission) {
  void requireLogin().then(() => {
    if (item.poster_id === authId.value) return
    applyTarget.value = item
    applyLetter.value = ''
    applyContact.value = ''
  }).catch(() => undefined)
}
function closeCommissionApply() { if (!applyBusy.value) applyTarget.value = null }
async function submitCommissionApply() {
  if (!applyTarget.value || !applyLetter.value.trim() || !applyContact.value.trim()) return uni.showToast({ title: '请填写申请内容和联系方式', icon: 'none' })
  applyBusy.value = true
  try {
    await apiRequest(`/lc/commissions/${encoded(applyTarget.value.id)}/applications`, { method: 'POST', data: { letter: applyLetter.value.trim(), privateContact: applyContact.value.trim() } })
    uni.showToast({ title: '申请已发送', icon: 'success' })
    applyTarget.value = null
    await load()
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { applyBusy.value = false }
}

async function decideCommission(item: CommissionApplication, decision: 'accepted' | 'rejected') {
  try {
    const result = await apiRequest<{ contacts?: { poster: string; applicant: string } | null }>(`/lc/commissions/applications/${encoded(item.id)}/decision`, { method: 'PUT', data: { decision } })
    if (decision === 'accepted' && result.contacts) showContacts(result.contacts)
    await load()
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}
async function decideCarpool(item: CarpoolApplication, decision: 'accept' | 'reject') {
  try { await apiRequest(`/lc/carpools/applications/${encoded(item.id)}/${decision}`, { method: 'PUT' }); await load() }
  catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}
function showContacts(contacts: { poster: string; applicant: string }) {
  const text = `委托人：${contacts.poster || '未填写'}\n申请人：${contacts.applicant || '未填写'}`
  uni.showModal({ title: '双方联系方式', content: text, confirmText: '复制全部', success: result => { if (result.confirm) uni.setClipboardData({ data: text }) } })
}

onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="同城协作" nav-title="同城" title="拼车与委托" description="同一个城市里找车、找角色，也发布或承接明确需求。" />
    <view class="hub-tabs page-tools">
      <button :class="{ active: tab === 'carpool' }" @tap="tab = 'carpool'">拼车</button>
      <button :class="{ active: tab === 'commission' }" @tap="tab = 'commission'">委托</button>
      <button class="create" @tap="create">发布</button>
    </view>
    <view class="view-tabs">
      <button :class="{ active: view === 'discover' }" @tap="view = 'discover'">发现</button>
      <button :class="{ active: view === 'mine' }" @tap="view = 'mine'">我的申请与处理</button>
    </view>

    <template v-if="view === 'discover'">
      <view class="filter page-tools">
        <CitySearchPicker :value="city" @change="selectCity" />
        <input v-model="query" class="input" :placeholder="tab === 'carpool' ? '搜索剧本或角色' : '搜索委托或角色'" />
      </view>
      <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !(tab === 'carpool' ? visibleCarpools.length : visibleCommissions.length)" :empty-text="tab === 'carpool' ? '暂时没有符合条件的拼车' : '暂时没有符合条件的委托'" @retry="load" />

      <template v-if="tab === 'carpool'">
        <view v-for="item in visibleCarpools" :key="item.id" class="listing surface">
          <view class="listing__top"><text class="listing__title">{{ item.script_name || item.title }}</text><text class="listing__date">{{ dateText(item.event_date) }}</text></view>
          <text class="listing__meta">{{ item.city }}<template v-if="item.start_time"> · {{ item.start_time }}</template> · 已上 {{ item.joined_count || 0 }}/{{ item.needed_count || '?' }}</text>
          <text v-if="item.poster_name" class="poster" @tap="openProfile(item.poster_id)">车头 {{ item.poster_name }}</text>
          <text v-if="item.role_name" class="listing__roles">缺：{{ item.role_name }}</text>
          <text v-if="item.content" class="listing__content">{{ item.content }}</text>
          <view class="action-row"><button class="secondary-button" @tap="showCarpoolContact(item)">联系方式</button><button v-if="item.poster_id !== authId" class="primary-button" @tap="applyCarpool(item)">申请上车</button></view>
        </view>
      </template>
      <template v-else>
        <view v-for="item in visibleCommissions" :key="item.id" class="listing surface">
          <view class="listing__top"><text class="listing__title">{{ item.title }}</text><text v-if="item.needed_date" class="listing__date">{{ dateText(item.needed_date) }}</text></view>
          <text class="listing__meta">{{ [item.city, item.script_name, item.desired_role, item.budget].filter(Boolean).join(' · ') || '需求细节见正文' }}</text>
          <text v-if="item.poster_name" class="poster" @tap="openProfile(item.poster_id)">委托人 {{ item.poster_name }}</text>
          <text class="listing__content clamp">{{ item.content }}</text>
          <button v-if="item.poster_id !== authId" class="primary-button full-button" @tap="openCommissionApply(item)">申请承接</button>
        </view>
      </template>
    </template>

    <template v-else>
      <StatePanel v-if="!readAuth()?.token" :empty="true" empty-text="登录后查看自己发出的申请和收到的申请" />
      <template v-else-if="tab === 'carpool'">
        <text class="section-title">收到的上车申请</text>
        <view v-for="item in receivedCarpools" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.carpool?.title || '拼车申请' }} · {{ item.applicant_name }}</text><text class="inbox__body">{{ item.message || '未填写说明' }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decideCarpool(item, 'reject')">拒绝</button><button class="primary-button" @tap="decideCarpool(item, 'accept')">同意上车</button></view><text v-else class="status">{{ item.status === 'accepted' ? '已同意' : '已拒绝' }}</text>
        </view>
      </template>
      <template v-else>
        <text class="section-title">收到的承接申请</text>
        <view v-for="item in receivedCommissions" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.commission?.title || '委托申请' }} · {{ item.applicant_name }}</text><text class="inbox__body">{{ item.letter }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decideCommission(item, 'rejected')">拒绝</button><button class="primary-button" @tap="decideCommission(item, 'accepted')">同意并交换联系</button></view><button v-else-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showContacts(item.contacts)">查看双方联系方式</button><text v-else class="status">已拒绝</text>
        </view>
        <text class="section-title">我发出的申请</text>
        <view v-for="item in sentCommissions" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.commission?.title || '委托申请' }}</text><text class="status">{{ item.status === 'submitted' ? '等待委托人处理' : item.status === 'accepted' ? '已同意' : '已拒绝' }}</text>
          <button v-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showContacts(item.contacts)">查看双方联系方式</button>
        </view>
      </template>
    </template>

    <view v-if="applyTarget" class="sheet-mask" @tap="closeCommissionApply"><view class="sheet" @tap.stop>
      <text class="sheet__title">申请承接「{{ applyTarget.title }}」</text>
      <text class="field-label">申请内容 *</text><textarea v-model="applyLetter" class="textarea" maxlength="1200" placeholder="说明你能提供什么、时间是否合适" />
      <text class="field-label">通过后交换的联系方式 *</text><input v-model="applyContact" class="input" maxlength="300" placeholder="微信号或手机号" />
      <text class="privacy">提交后管理员可查看申请内容，但看不到这里填写的联系方式；委托人同意后双方立即可见。</text>
      <view class="action-row"><button class="secondary-button" @tap="closeCommissionApply">取消</button><button class="primary-button" :loading="applyBusy" @tap="submitCommissionApply">发送申请</button></view>
    </view></view>
  </view>
</template>

<style scoped>
.hub-tabs { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8rpx; }
.hub-tabs button, .view-tabs button { min-height: 64rpx; margin: 0; border: 0; border-radius: 8rpx; background: #f4f5f7; color: #64748b; font-size: 24rpx; line-height: 64rpx; }
.hub-tabs button.active, .view-tabs button.active { background: #fff1d5; color: #8b5919; font-weight: 850; }
.hub-tabs .create { padding: 0 24rpx; background: #b9781f; color: #fff; font-weight: 850; }
.view-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin: 0 0 14rpx; }
.filter { display: grid; grid-template-columns: 210rpx 1fr; gap: 12rpx; }
.listing, .inbox { margin-bottom: 14rpx; padding: 20rpx; }
.listing__top { display: flex; justify-content: space-between; gap: 14rpx; }
.listing__title, .inbox__title { color: #27364a; font-size: 29rpx; font-weight: 850; }
.listing__date { flex: 0 0 auto; color: #9a651e; font-size: 23rpx; }
.listing__meta, .listing__roles, .listing__content, .poster, .inbox__body, .status { display: block; margin-top: 9rpx; }
.listing__meta, .status { color: #64748b; font-size: 23rpx; }
.poster { color: #275389; font-size: 23rpx; font-weight: 750; }
.listing__roles { color: #275389; font-size: 25rpx; font-weight: 700; }
.listing__content, .inbox__body { color: #475569; font-size: 24rpx; line-height: 1.6; }
.clamp { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.action-row { margin-top: 16rpx; }
.full-button { width: 100%; margin-top: 16rpx; }
.sheet-mask { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: flex-end; background: rgba(31,41,55,.55); }
.sheet { width: 100%; padding: 28rpx 24rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 14rpx 14rpx 0 0; background: #fffdf8; }
.sheet__title { display: block; color: #1f2937; font-size: 31rpx; font-weight: 900; }
.privacy { display: block; margin: 12rpx 0; color: #64748b; font-size: 22rpx; line-height: 1.55; }
</style>
