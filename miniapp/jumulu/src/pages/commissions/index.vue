<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Commission, CommissionApplication, PublicProfile } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dateText } from '../../utils/format'

type PageView = 'discover' | 'mine'
type DiscoverScope = 'local' | 'expedition'

const CITY_KEY = 'jumulu:commissions:last-city'
const view = ref<PageView>('discover')
const commissions = ref<Commission[]>([])
const creators = ref<PublicProfile[]>([])
const received = ref<CommissionApplication[]>([])
const sent = ref<CommissionApplication[]>([])
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
    const [items, people] = await Promise.all([
      apiRequest<Commission[]>(`/lc/commissions${cityQuery}`),
      city.value === '全部城市'
        ? Promise.resolve({ items: [] as PublicProfile[] })
        : apiRequest<{ items: PublicProfile[] }>(`/lc/creators?city=${encoded(city.value)}&serviceOnly=true&limit=8`),
    ])
    commissions.value = items
    creators.value = people.items || []
    if (readAuth()?.token) {
      const [receivedItems, sentItems] = await Promise.all([
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/received'),
        apiRequest<CommissionApplication[]>('/lc/commissions/applications/sent'),
      ])
      received.value = receivedItems
      sent.value = sentItems
    } else {
      received.value = []
      sent.value = []
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

onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="委托需求" nav-title="委托" title="委托" description="默认查看本地需求，也能找到愿意远征到本地的委托师。" fallback="/pages/index/index">
      <button class="primary-button intro-action" @tap="create">发布委托</button>
    </PageIntro>
    <view class="view-tabs">
      <button :class="{ active: view === 'discover' }" @tap="view = 'discover'">找委托</button>
      <button :class="{ active: view === 'mine' }" @tap="view = 'mine'">申请与处理</button>
    </view>

    <template v-if="view === 'discover'">
      <view class="filter page-tools">
        <view class="filter__row"><view class="filter__city"><CitySearchPicker :value="city" @change="selectCity" /></view><picker mode="date" :value="dateStart" @change="setStartDate($event.detail.value)"><view class="picker-field">{{ dateStart || '开始日期' }}</view></picker><picker mode="date" :value="dateEnd" :start="dateStart || undefined" @change="dateEnd = $event.detail.value"><view class="picker-field">{{ dateEnd || '结束日期' }}</view></picker></view>
        <view class="filter__search"><input v-model="query" class="input" placeholder="搜索剧本或角色" /><text v-if="dateStart || dateEnd" @tap="dateStart = ''; dateEnd = ''">清除日期</text></view>
      </view>
      <view class="scope-tabs"><view :class="{ active: discoverScope === 'local' }" @tap="discoverScope = 'local'">本地需求</view><view :class="{ active: discoverScope === 'expedition' }" @tap="discoverScope = 'expedition'">接受远征</view></view>

      <template v-if="city !== '全部城市' && creators.length">
        <view class="section-head"><text class="section-title">可接{{ city }}委托的人</text><text class="section-note">本地与可远征</text></view>
        <scroll-view class="people" scroll-x :show-scrollbar="false">
          <view class="people__track">
            <view v-for="person in creators" :key="person.id" class="person surface" @tap="openProfile(person.id)">
              <image v-if="person.avatar" class="person__avatar" :src="person.avatar" mode="aspectFill" />
              <view v-else class="person__avatar person__placeholder">{{ person.display_name.slice(0, 1) }}</view>
              <text class="person__name">{{ person.display_name }}</text>
              <text class="person__match">{{ person.commission_match === 'local' ? '本地常驻' : `可远征到${city}` }}</text>
            </view>
          </view>
        </scroll-view>
      </template>

      <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visibleItems.length" empty-text="当前城市暂时没有公开委托" @retry="load" />
      <view class="listing-list">
      <view v-for="item in visibleItems" :key="item.id" class="listing">
        <view class="listing__top"><text class="listing__title">{{ item.title }}</text><image src="/static/icons/ui-chevron-right.png" mode="aspectFit" /></view>
        <view class="chips"><text v-if="item.city" class="chip">{{ item.city }}</text><text v-if="item.accept_expedition" class="chip expedition">接受远征</text></view>
        <text class="listing__meta">{{ [item.needed_date ? `${dateText(item.needed_date)}${item.needed_end_date && item.needed_end_date !== item.needed_date ? ` 至 ${dateText(item.needed_end_date)}` : ''}` : '', item.script_name, item.desired_role, item.budget].filter(Boolean).join(' · ') || '需求细节见正文' }}</text>
        <text v-if="item.poster_name" class="poster" @tap="openProfile(item.poster_id)">委托人 {{ item.poster_name }}</text>
        <text class="listing__content clamp">{{ item.content }}</text>
        <button v-if="item.poster_id !== authId" class="apply-button" @tap="openApply(item)">申请承接</button>
      </view>
      </view>
    </template>

    <template v-else>
      <StatePanel v-if="!readAuth()?.token" :empty="true" empty-text="登录后查看自己发出的申请和收到的申请" />
      <template v-else>
        <text class="section-title">收到的承接申请</text>
        <view v-for="item in received" :key="item.id" class="inbox surface">
          <text class="inbox__title">{{ item.commission?.title || '委托申请' }} · {{ item.applicant_name }}</text>
          <text class="inbox__body">{{ item.letter }}</text>
          <view v-if="item.status === 'submitted'" class="action-row"><button class="secondary-button" @tap="decide(item, 'rejected')">拒绝</button><button class="primary-button" @tap="decide(item, 'accepted')">同意并交换联系</button></view>
          <button v-else-if="item.status === 'accepted' && item.contacts" class="secondary-button full-button" @tap="showContacts(item.contacts)">查看双方联系方式</button>
          <text v-else class="status">已拒绝</text>
        </view>
        <text class="section-title">我发出的申请</text>
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
.intro-action { width: 100%; }
.view-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin: 0 0 14rpx; }
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
.section-head { display: flex; align-items: center; justify-content: space-between; margin-top: 22rpx; }
.section-note { color: #64748b; font-size: 22rpx; }
.people { width: calc(100% + 24rpx); margin: 12rpx -24rpx 18rpx 0; }
.people__track { display: flex; gap: 12rpx; padding-right: 24rpx; }
.person { width: 178rpx; flex: 0 0 178rpx; padding: 14rpx; }
.person__avatar { width: 68rpx; height: 68rpx; border-radius: 50%; background: #f2ece4; }
.person__placeholder { display: flex; align-items: center; justify-content: center; color: #9a651e; font-weight: 900; }
.person__name, .person__match { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person__name { margin-top: 10rpx; color: #27364a; font-size: 24rpx; font-weight: 850; }
.person__match { margin-top: 4rpx; color: #9a651e; font-size: 20rpx; }
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
@media (max-width: 360px) {
  .filter__row { grid-template-columns: 1fr 1fr; }
  .filter__city { grid-column: 1 / -1; }
}
</style>
