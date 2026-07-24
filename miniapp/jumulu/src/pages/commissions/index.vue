<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Commission, CommissionApplication, ProviderInquiry, ProviderListing } from '../../types'
import { apiRequest, encoded, readAuth, requestServicePayment, requireLogin, type ServicePurchase } from '../../utils/api'
import { dateText } from '../../utils/format'

type PageView = 'demands' | 'providers' | 'mine'
type DiscoverScope = 'local' | 'expedition'

const CITY_KEY = 'jumulu:commissions:last-city'
const VIEW_KEY = 'jumulu:commissions:open-view'
const view = ref<PageView>('demands')
const commissions = ref<Commission[]>([])
const providerListings = ref<ProviderListing[]>([])
const received = ref<CommissionApplication[]>([])
const sent = ref<CommissionApplication[]>([])
const providerReceived = ref<ProviderInquiry[]>([])
const providerSent = ref<ProviderInquiry[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const dateStart = ref('')
const dateEnd = ref('')
const discoverScope = ref<DiscoverScope>('local')
const city = ref(String(uni.getStorageSync(CITY_KEY) || '全部城市'))
const applyTarget = ref<Commission | null>(null)
const applyLetter = ref('')
const applyContact = ref('')
const applyBusy = ref(false)
const contactBusyId = ref('')
const authId = computed(() => readAuth()?.id || '')

const visibleItems = computed(() => commissions.value.filter(item =>
  !item.is_expired
  && (discoverScope.value === 'local' || item.accept_expedition)
  && (!dateStart.value || Boolean(item.needed_date) && String(item.needed_end_date || item.needed_date) >= dateStart.value)
  && (!dateEnd.value || Boolean(item.needed_date) && String(item.needed_date) <= dateEnd.value)
  && (!query.value.trim() || [item.title, item.content, item.script_name, item.desired_role]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(query.value.trim().toLocaleLowerCase('zh-CN'))),
))
const visibleProviders = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!needle) return providerListings.value
  return providerListings.value.filter(item => [
    item.profile?.display_name,
    item.headline,
    item.description,
    ...(item.role_types || []),
  ].join(' ').toLocaleLowerCase('zh-CN').includes(needle))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!uni.getStorageSync(CITY_KEY) && readAuth()?.token) {
      const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
      if (follows.cities?.[0]) {
        city.value = follows.cities[0]
        uni.setStorageSync(CITY_KEY, city.value)
      }
    }
    const cityQuery = city.value === '全部城市' ? '' : `?city=${encoded(city.value)}`
    const listingQuery = city.value === '全部城市' ? '' : `?city=${encoded(city.value)}`
    const [items, listings] = await Promise.all([
      apiRequest<Commission[]>(`/lc/commissions${cityQuery}`),
      apiRequest<ProviderListing[]>(`/lc/provider-listings${listingQuery}`),
    ])
    commissions.value = items
    providerListings.value = listings
    if (readAuth()?.token) {
      const [receivedItems, sentItems, receivedProviderItems, sentProviderItems] = await Promise.all([
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/received'),
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/sent'),
        apiRequest<ProviderInquiry[]>('/lc/provider-inquiries/received'),
        apiRequest<ProviderInquiry[]>('/lc/provider-inquiries/sent'),
      ])
      received.value = receivedItems
      sent.value = sentItems
      providerReceived.value = receivedProviderItems
      providerSent.value = sentProviderItems
    } else {
      received.value = []
      sent.value = []
      providerReceived.value = []
      providerSent.value = []
    }
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
  void load()
}
function setStartDate(value: string) {
  dateStart.value = value
  if (dateEnd.value && dateEnd.value < value) dateEnd.value = value
}
function openProfile(id?: string) { if (id) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(id)}` }) }
function create() { void requireLogin().then(() => uni.navigateTo({ url: '/pages/commissions/create' })).catch(() => undefined) }
function editProviderListing() { void requireLogin().then(() => uni.navigateTo({ url: '/pages/commissions/provider-edit' })).catch(() => undefined) }
function openApply(item: Commission) {
  void requireLogin().then(() => {
    if (item.poster_id === authId.value) return
    applyTarget.value = item
    applyLetter.value = ''
    applyContact.value = ''
  }).catch(() => undefined)
}
function closeApply() { if (!applyBusy.value) applyTarget.value = null }

async function submitApply() {
  if (!applyTarget.value || !applyLetter.value.trim() || !applyContact.value.trim()) {
    return uni.showToast({ title: '请填写申请内容和联系方式', icon: 'none' })
  }
  applyBusy.value = true
  try {
    await apiRequest(`/lc/commissions/${encoded(applyTarget.value.id)}/applications`, {
      method: 'POST',
      data: { letter: applyLetter.value.trim(), privateContact: applyContact.value.trim() },
    })
    uni.showToast({ title: '申请已发送', icon: 'success' })
    applyTarget.value = null
    await load()
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally {
    applyBusy.value = false
  }
}

async function decide(item: CommissionApplication, decision: 'accepted' | 'rejected') {
  try {
    const result = await apiRequest<{ contacts?: { poster: string; applicant: string } | null }>(`/lc/commissions/applications/${encoded(item.id)}/decision`, { method: 'PUT', data: { decision } })
    if (decision === 'accepted' && result.contacts) showContacts(result.contacts)
    await load()
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  }
}

function showContacts(contacts: { poster: string; applicant: string }) {
  const text = `委托人：${contacts.poster || '未填写'}\n申请人：${contacts.applicant || '未填写'}`
  uni.showModal({ title: '双方联系方式', content: text, confirmText: '复制全部', success: result => { if (result.confirm) uni.setClipboardData({ data: text }) } })
}

async function openInquiry(item: ProviderListing) {
  if (item.profile_id === authId.value) return editProviderListing()
  if (contactBusyId.value) return
  contactBusyId.value = item.profile_id
  try {
    await requireLogin()
    let access = await apiRequest<ServicePurchase & { owner?: boolean }>(`/lc/provider-listings/${encoded(item.profile_id)}/contact-access`)
    if (!access.paid) {
      const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: '永久解锁联系方式',
          content: `支付 8.88 元后立即查看 ${item.profile?.display_name || '这位委托师'} 当前审核通过的业务联系方式。同一账号联系同一位委托师只需支付一次。`,
          confirmText: '支付 8.88 元',
          success: result => resolve(result.confirm),
          fail: () => resolve(false),
        })
      })
      if (!confirmed) return
      access = await requestServicePayment('provider_contact', item.profile_id)
    }
    if (!access.contact_available || !access.business_contact) {
      uni.showModal({
        title: '暂未开放联系',
        content: '这位委托师已暂停显示联系方式。你的永久解锁资格不会失效，恢复开放后无需再次支付。',
        showCancel: false,
      })
      return
    }
    const contact = access.business_contact
    uni.showModal({
      title: `${item.profile?.display_name || '委托师'}的联系方式`,
      content: contact,
      cancelText: '问题反馈',
      confirmText: '复制',
      success: result => {
        if (result.confirm) uni.setClipboardData({ data: contact })
        else if (result.cancel) uni.navigateTo({ url: `/pages/feedback/index?category=invalid_contact&purchaseId=${encoded(access.id)}` })
      },
    })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    contactBusyId.value = ''
  }
}

function showProviderContacts(contacts: { requester: string; provider: string }) {
  const text = `咨询人：${contacts.requester || '未填写'}\n委托师：${contacts.provider || '未填写'}`
  uni.showModal({ title: '双方联系方式', content: text, confirmText: '复制全部', success: result => { if (result.confirm) uni.setClipboardData({ data: text }) } })
}

async function decideProviderInquiry(item: ProviderInquiry, decision: 'accepted' | 'rejected', privateContact = '') {
  try {
    const result = await apiRequest<ProviderInquiry>(`/lc/provider-inquiries/${encoded(item.id)}/decision`, {
      method: 'PUT',
      data: { decision, privateContact: privateContact || undefined },
    })
    if (decision === 'accepted' && result.contacts) showProviderContacts(result.contacts)
    uni.$emit('jumulu:refresh-notifications')
    await load()
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  }
}

function acceptProviderInquiry(item: ProviderInquiry) {
  uni.showModal({
    title: '同意并交换联系方式',
    content: '填写你的微信号、手机号或其他联系方式。提交后双方立即可见。',
    editable: true,
    placeholderText: '你的联系方式',
    confirmText: '同意',
    success: result => {
      if (!result.confirm) return
      const contact = String(result.content || '').trim()
      if (!contact) return uni.showToast({ title: '请填写联系方式', icon: 'none' })
      void decideProviderInquiry(item, 'accepted', contact)
    },
  })
}

onShow(() => {
  const requestedView = String(uni.getStorageSync(VIEW_KEY) || '')
  if (requestedView === 'mine' || requestedView === 'providers' || requestedView === 'demands') {
    view.value = requestedView
    uni.removeStorageSync(VIEW_KEY)
  }
  void load()
})
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="委托撮合" nav-title="委托" title="委托" description="发需求或找委托师；同一账号联系同一位委托师只支付一次，永久解锁其审核通过的业务联系方式。" fallback="/pages/index/index">
      <view class="intro-actions">
        <button class="primary-button" @tap="create">发布需求</button>
        <button class="secondary-button" @tap="editProviderListing">我的委托条</button>
      </view>
    </PageIntro>
    <view class="view-tabs">
      <button :class="{ active: view === 'demands' }" @tap="view = 'demands'">委托需求</button>
      <button :class="{ active: view === 'providers' }" @tap="view = 'providers'">找委托师</button>
      <button :class="{ active: view === 'mine' }" @tap="view = 'mine'">消息处理</button>
    </view>

    <template v-if="view === 'demands'">
      <view class="filter page-tools">
        <view class="filter__row"><view class="filter__city"><CitySearchPicker :value="city" @change="selectCity" /></view><picker mode="date" :value="dateStart" @change="setStartDate($event.detail.value)"><view class="picker-field">{{ dateStart || '开始日期' }}</view></picker><picker mode="date" :value="dateEnd" :start="dateStart || undefined" @change="dateEnd = $event.detail.value"><view class="picker-field">{{ dateEnd || '结束日期' }}</view></picker></view>
        <view class="filter__search"><input v-model="query" class="input" placeholder="搜索剧本或角色" /><text v-if="dateStart || dateEnd" @tap="dateStart = ''; dateEnd = ''">清除日期</text></view>
      </view>
      <view class="scope-tabs"><view :class="{ active: discoverScope === 'local' }" @tap="discoverScope = 'local'">本地需求</view><view :class="{ active: discoverScope === 'expedition' }" @tap="discoverScope = 'expedition'">接受远征</view></view>

      <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visibleItems.length" empty-text="当前城市暂时没有公开委托" @retry="load" />
      <view class="listing-list">
      <view v-for="item in visibleItems" :key="item.id" class="listing">
        <view class="listing__top"><text class="listing__title">{{ item.title }}</text><ReportFlag target-type="commission" :target-id="item.id" :title="item.title" :own="item.poster_id === authId" /></view>
        <view class="chips"><text v-if="item.city" class="chip">{{ item.city }}</text><text v-if="item.accept_expedition" class="chip expedition">接受远征</text></view>
        <text class="listing__meta">{{ [item.needed_date ? `${dateText(item.needed_date)}${item.needed_end_date && item.needed_end_date !== item.needed_date ? ` 至 ${dateText(item.needed_end_date)}` : ''}` : '', item.script_name, item.desired_role, item.budget].filter(Boolean).join(' · ') || '需求细节见正文' }}</text>
        <text v-if="item.poster_name" class="poster" @tap="openProfile(item.poster_id)">委托人 {{ item.poster_name }}</text>
        <text class="listing__content clamp">{{ item.content }}</text>
        <button v-if="item.poster_id !== authId" class="apply-button" @tap="openApply(item)">申请承接</button>
      </view>
      </view>
    </template>

    <template v-else-if="view === 'providers'">
      <view class="provider-tools page-tools">
        <CitySearchPicker :value="city" @change="selectCity" />
        <input v-model="query" class="input" placeholder="搜索姓名、角色类型或简介" />
      </view>
      <StatePanel
        :loading="loading"
        :error="error"
        :empty="!loading && !error && !visibleProviders.length"
        empty-text="当前范围暂时没有公开委托条"
        @retry="load"
      />
      <view class="provider-list">
        <view
          v-for="item in visibleProviders"
          :key="item.profile_id"
          class="provider-row"
          @tap="openProfile(item.profile_id)"
        >
          <image class="provider-row__poster" :src="item.poster_url" mode="aspectFill" />
          <view class="provider-row__body">
            <view class="provider-row__head">
              <text class="provider-row__name">{{ item.profile?.display_name || '委托师' }}</text>
              <view class="provider-row__head-actions"><text v-if="item.profile?.city" class="provider-row__city">{{ item.profile.city }}</text><ReportFlag target-type="provider_listing" :target-id="item.profile_id" :title="`${item.profile?.display_name || '委托师'}的委托条`" :own="item.profile_id === authId" /></view>
            </view>
            <text v-if="item.headline" class="provider-row__headline">{{ item.headline }}</text>
            <text class="provider-row__meta">{{ [item.height_cm ? `${item.height_cm}cm` : '', item.weight_kg ? `${item.weight_kg}kg` : '', item.profile?.commission_match === 'expedition' && city !== '全部城市' ? `可远征到${city}` : ''].filter(Boolean).join(' · ') || '资料待补充' }}</text>
            <view v-if="item.role_types?.length" class="provider-row__roles"><text v-for="role in item.role_types.slice(0, 3)" :key="role">{{ role }}</text></view>
            <button class="inquiry-button" :loading="contactBusyId === item.profile_id" @tap.stop="openInquiry(item)">{{ item.profile_id === authId ? '编辑委托条' : '查看联系方式' }}</button>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <StatePanel v-if="!readAuth()?.token" :empty="true" empty-text="登录后查看自己发出的申请和收到的申请" />
      <template v-else>
        <text class="section-title">委托条收到的咨询</text>
        <text v-if="providerReceived.length === 0" class="empty-line">暂无咨询</text>
        <view v-for="item in providerReceived" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.requester_name }}</text>
          <text class="inbox__body">{{ item.message }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decideProviderInquiry(item, 'rejected')">拒绝</button><button class="primary-button" @tap="acceptProviderInquiry(item)">同意并交换联系</button></view>
          <button v-else-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showProviderContacts(item.contacts)">查看双方联系方式</button>
          <text v-else class="status">已拒绝</text>
        </view>

        <text class="section-title">我发出的委托咨询</text>
        <text v-if="providerSent.length === 0" class="empty-line">暂无咨询</text>
        <view v-for="item in providerSent" :key="item.id" class="inbox surface" @tap="openProfile(item.provider_id)">
          <text class="inbox__title">{{ item.provider?.display_name || '委托师' }}</text>
          <text class="inbox__body">{{ item.message }}</text>
          <text class="status">{{ item.status === 'submitted' ? '等待对方处理' : item.status === 'accepted' ? '已同意' : '已拒绝' }}</text>
          <button v-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap.stop="showProviderContacts(item.contacts)">查看双方联系方式</button>
        </view>

        <text class="section-title">收到的承接申请</text>
        <text v-if="received.length === 0" class="empty-line">暂无申请</text>
        <view v-for="item in received" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.commission?.title || '委托申请' }} · {{ item.applicant_name }}</text>
          <text class="inbox__body">{{ item.letter }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decide(item, 'rejected')">拒绝</button><button class="primary-button" @tap="decide(item, 'accepted')">同意并交换联系</button></view>
          <button v-else-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showContacts(item.contacts)">查看双方联系方式</button>
          <text v-else class="status">已拒绝</text>
        </view>
        <text class="section-title">我发出的申请</text>
        <text v-if="sent.length === 0" class="empty-line">暂无申请</text>
        <view v-for="item in sent" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.commission?.title || '委托申请' }}</text>
          <text class="status">{{ item.status === 'submitted' ? '等待委托人处理' : item.status === 'accepted' ? '已同意' : '已拒绝' }}</text>
          <button v-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showContacts(item.contacts)">查看双方联系方式</button>
        </view>
      </template>
    </template>

    <view v-if="applyTarget" class="sheet-mask" @tap="closeApply"><view class="sheet" @tap.stop>
      <text class="sheet__title">申请承接「{{ applyTarget.title }}」</text>
      <text class="field-label">申请内容 *</text><textarea v-model="applyLetter" class="textarea" maxlength="1200" placeholder="说明你能提供什么、时间是否合适" />
      <text class="field-label">通过后交换的联系方式 *</text><input v-model="applyContact" class="input" maxlength="300" placeholder="微信号或手机号" />
      <text class="privacy">提交后管理员可查看申请内容，但看不到这里填写的联系方式；委托人同意后双方立即可见。</text>
      <view class="action-row"><button class="secondary-button" @tap="closeApply">取消</button><button class="primary-button" :loading="applyBusy" @tap="submitApply">发送申请</button></view>
    </view></view>

  </view>
</template>

<style scoped>
.intro-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; }
.intro-actions button { width: 100%; min-height: 66rpx; margin: 0; font-size: 23rpx; line-height: 66rpx; }
.view-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin: 0 0 14rpx; }
.view-tabs button { min-height: 64rpx; margin: 0; border: 0; border-radius: 8rpx; background: #f4f5f7; color: #64748b; font-size: 24rpx; line-height: 64rpx; }
.view-tabs button.active { background: #fff1d5; color: #8b5919; font-weight: 850; }
.filter { display: grid; gap: 10rpx; }
.filter__row { display: grid; grid-template-columns: 190rpx 1fr 1fr; gap: 10rpx; }
.filter__city { min-width: 0; }
.filter__search { position: relative; }
.filter__search .input { padding-right: 130rpx; }
.filter__search text { position: absolute; right: 16rpx; top: 0; height: 76rpx; color: #9a651e; font-size: 20rpx; line-height: 76rpx; }
.scope-tabs { display: grid; grid-template-columns: 1fr 1fr; margin: 10rpx 0 20rpx; border: 1rpx solid #e4dac9; border-radius: 8rpx; }
.scope-tabs view { min-height: 68rpx; color: #64748b; font-size: 23rpx; font-weight: 750; line-height: 68rpx; text-align: center; }
.scope-tabs view.active { background: #fff6e4; color: #8b5919; }
.provider-tools { display: grid; grid-template-columns: 220rpx 1fr; gap: 10rpx; }
.provider-list { border-top: 1rpx solid #eceff2; }
.provider-row { display: grid; grid-template-columns: 190rpx 1fr; gap: 18rpx; padding: 22rpx 4rpx; border-bottom: 1rpx solid #eceff2; }
.provider-row__poster { width: 190rpx; height: 250rpx; border-radius: 8rpx; background: #f2ece4; }
.provider-row__body { min-width: 0; }
.provider-row__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.provider-row__head-actions { display: flex; align-items: center; gap: 4rpx; }
.provider-row__name { overflow: hidden; color: #27364a; font-size: 29rpx; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.provider-row__city { flex: 0 0 auto; color: #64748b; font-size: 21rpx; }
.provider-row__headline, .provider-row__meta { display: block; margin-top: 8rpx; }
.provider-row__headline { color: #475569; font-size: 24rpx; line-height: 1.5; }
.provider-row__meta { color: #64748b; font-size: 21rpx; }
.provider-row__roles { display: flex; flex-wrap: wrap; gap: 7rpx; margin-top: 10rpx; }
.provider-row__roles text { padding: 5rpx 9rpx; border-radius: 6rpx; background: #eef4fb; color: #275389; font-size: 19rpx; }
.inquiry-button { width: auto; min-height: 54rpx; margin: 12rpx 0 0; padding: 0 18rpx; border: 1rpx solid #cda25e; border-radius: 7rpx; background: #fff; color: #8b5919; font-size: 21rpx; font-weight: 850; line-height: 54rpx; }
.listing-list { border-top: 1rpx solid #eceff2; }
.listing { position: relative; padding: 22rpx 4rpx; border-bottom: 1rpx solid #eceff2; }
.inbox { margin-bottom: 14rpx; padding: 20rpx; }
.listing__top { display: flex; justify-content: space-between; gap: 14rpx; }
.listing__top image { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; margin-top: 6rpx; }
.listing__title, .inbox__title { color: #27364a; font-size: 29rpx; font-weight: 850; }
.chips { display: flex; gap: 8rpx; margin-top: 10rpx; }
.chip { padding: 5rpx 10rpx; border-radius: 8rpx; background: #f4f5f7; color: #64748b; font-size: 21rpx; }
.chip.expedition { background: #fff1d5; color: #8b5919; }
.listing__meta, .listing__content, .poster, .inbox__body, .status { display: block; margin-top: 9rpx; }
.listing__meta, .status { color: #64748b; font-size: 23rpx; }
.poster { color: #275389; font-size: 23rpx; font-weight: 750; }
.listing__content, .inbox__body { color: #475569; font-size: 24rpx; line-height: 1.6; }
.clamp { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.action-row { margin-top: 16rpx; }
.full-button { width: 100%; margin-top: 16rpx; }
.apply-button { min-height: 58rpx; margin: 14rpx 0 0; padding: 0 20rpx; border: 1rpx solid #cda25e; border-radius: 7rpx; background: #fff; color: #8b5919; font-size: 22rpx; font-weight: 800; line-height: 58rpx; }
.sheet-mask { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: flex-end; background: rgba(31,41,55,.55); }
.sheet { width: 100%; padding: 28rpx 24rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 14rpx 14rpx 0 0; background: #fffdf8; }
.sheet__title { display: block; color: #1f2937; font-size: 31rpx; font-weight: 900; }
.privacy { display: block; margin: 12rpx 0; color: #64748b; font-size: 22rpx; line-height: 1.55; }
.empty-line { display: block; margin: -6rpx 0 18rpx; color: #98a2b3; font-size: 22rpx; }
@media (max-width: 360px) {
  .filter__row { grid-template-columns: 1fr 1fr; }
  .filter__city { grid-column: 1 / -1; }
  .provider-tools { grid-template-columns: 1fr; }
}
</style>
