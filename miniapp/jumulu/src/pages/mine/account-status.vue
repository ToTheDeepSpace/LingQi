<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { AccountStatus } from '../../types'
import { apiRequest, encoded, readAuth } from '../../utils/api'

type Notice = {
  id: string
  title: string
  content: string
  read_at?: string | null
  created_at: string
  action_url?: string | null
  related_type?: string | null
  related_id?: string | null
}

type SubmissionState = 'pending' | 'approved' | 'action' | 'closed'
type SubmissionItem = {
  id: string
  kind: string
  group: string
  type_label: string
  title: string
  content: string
  status: string
  state: SubmissionState
  created_at: string
  updated_at?: string | null
  reject_reason?: string | null
  thumbnail_url?: string | null
  action_url?: string | null
  related_type?: string | null
  related_id?: string | null
  metadata?: Record<string, string | number | boolean | null>
}
type SubmissionPayload = {
  items: SubmissionItem[]
  summary: { total: number; pending: number; approved: number; action_required: number; closed: number }
}

const emptySubmissions = (): SubmissionPayload => ({
  items: [],
  summary: { total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 },
})
const ACCOUNT_LIST_BATCH = 20

const status = ref<AccountStatus | null>(null)
const notices = ref<Notice[]>([])
const submissions = ref<SubmissionPayload>(emptySubmissions())
const activeTab = ref<'notices' | 'submissions'>('notices')
const stateFilter = ref<'all' | SubmissionState>('all')
const noticeLimit = ref(ACCOUNT_LIST_BATCH)
const submissionLimit = ref(ACCOUNT_LIST_BATCH)
const showAccountDetail = ref(false)
const content = ref('')
const evidenceText = ref('')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const unreadCount = computed(() => notices.value.filter(item => !item.read_at).length)
const visibleSubmissions = computed(() => stateFilter.value === 'all'
  ? submissions.value.items
  : submissions.value.items.filter(item => item.state === stateFilter.value))
const displayedNotices = computed(() => notices.value.slice(0, noticeLimit.value))
const displayedSubmissions = computed(() => visibleSubmissions.value.slice(0, submissionLimit.value))

watch([activeTab, stateFilter], () => {
  if (activeTab.value === 'notices') noticeLimit.value = ACCOUNT_LIST_BATCH
  else submissionLimit.value = ACCOUNT_LIST_BATCH
})

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function appealLabel(value?: string) {
  if (value === 'pending') return '处理中'
  if (value === 'needs_info') return '待补充'
  if (value === 'approved') return '已通过'
  if (value === 'rejected') return '维持限制'
  return '未提交'
}

function submissionStatusLabel(item: SubmissionItem) {
  const labels: Record<string, string> = {
    pending: '审核中',
    pending_owner: '待本人确认',
    submitted: '已提交',
    processing: '处理中',
    approved: '已公开',
    resolved: '已处理',
    replied: '已回复',
    on_sale: '已上架',
    paid: '已支付',
    rejected: '需修改',
    needs_submission: '待补交',
    needs_info: '待补充',
    withdrawn: '已撤回',
    closed: '已关闭',
    hidden: '已隐藏',
    deleted_by_author: '已删除',
    cancelled: '已取消',
    off_sale: '已下架',
    suspended: '已暂停',
  }
  return labels[item.status] || (item.state === 'approved' ? '已完成' : item.state === 'action' ? '需处理' : item.state === 'pending' ? '处理中' : '已结束')
}

function updateUnreadStorage() {
  const unread = unreadCount.value
  uni.setStorageSync('jumulu:notifications:unread', unread)
  uni.$emit('jumulu:notification-count', unread)
}

async function load() {
  if (!readAuth()?.token) {
    status.value = null
    notices.value = []
    submissions.value = emptySubmissions()
    error.value = '请先登录'
    uni.stopPullDownRefresh()
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [nextStatus, nextNotices, nextSubmissions] = await Promise.all([
      apiRequest<AccountStatus>('/lc/account/status'),
      apiRequest<Notice[]>('/lc/account/notifications'),
      apiRequest<SubmissionPayload>('/lc/account/submissions'),
    ])
    status.value = nextStatus
    notices.value = nextNotices
    submissions.value = nextSubmissions || emptySubmissions()
    noticeLimit.value = ACCOUNT_LIST_BATCH
    submissionLimit.value = ACCOUNT_LIST_BATCH
    updateUnreadStorage()
    if (nextStatus.appeal?.status === 'needs_info') {
      content.value = nextStatus.appeal.content || ''
      evidenceText.value = (nextStatus.appeal.evidence_urls || []).join('\n')
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '消息中心加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitAppeal() {
  if (content.value.trim().length < 10 || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    const evidenceUrls = evidenceText.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 6)
    await apiRequest('/lc/account/appeals', {
      method: 'POST',
      data: { content: content.value.trim(), evidenceUrls },
    })
    content.value = ''
    evidenceText.value = ''
    uni.showToast({ title: '申诉已提交', icon: 'success' })
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '申诉提交失败'
  } finally {
    submitting.value = false
  }
}

async function markAllRead() {
  if (unreadCount.value === 0) return
  try {
    await apiRequest('/lc/account/notifications/read-all', { method: 'PUT' })
    const readAt = new Date().toISOString()
    notices.value.forEach(item => { item.read_at ||= readAt })
    updateUnreadStorage()
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message || '操作失败', icon: 'none' })
  }
}

function switchMainTab(url: string) {
  uni.switchTab({ url })
}

function openSubmission(item: SubmissionItem) {
  const dossierId = String(item.metadata?.dossier_id || item.related_id || '')
  const dossierKind = ['dm_rating', 'store_rating', 'dm_dossier', 'store_dossier', 'dossier_edit', 'dossier_claim'].includes(item.kind)
  if (item.kind === 'ranking' && item.related_id) return uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(item.related_id)}` })
  if (dossierKind && dossierId) {
    const store = item.kind.startsWith('store_') || item.metadata?.entity_type === 'store'
    return uni.navigateTo({ url: `${store ? '/pages/stores/detail' : '/pages/dm/detail'}?id=${encoded(dossierId)}` })
  }
  if (item.kind === 'role_rating' && item.metadata?.target_id) {
    return uni.navigateTo({ url: `/pages/roles/detail?id=${encoded(String(item.metadata.target_id))}` })
  }
  if (['script_rating', 'script_contribution'].includes(item.kind)) return uni.navigateTo({ url: '/pages/roles/index' })
  if (item.kind === 'provider_listing') return uni.navigateTo({ url: '/pages/commissions/provider-edit' })
  if (item.kind === 'commission') {
    uni.setStorageSync('jumulu:commissions:open-view', 'mine')
    return switchMainTab('/pages/commissions/index')
  }
  if (item.kind === 'carpool') return switchMainTab('/pages/carpools/index')
  if (['feedback', 'report'].includes(item.kind)) return uni.navigateTo({ url: '/pages/feedback/index' })
  if (['certification', 'profile_update', 'service_create', 'portfolio_create', 'availability_create', 'tag_create'].includes(item.kind)) {
    return uni.navigateTo({ url: '/pages/mine/account' })
  }
  uni.showToast({ title: '这条记录暂时只能在网页版查看', icon: 'none' })
}

function canManageSubmission(item: SubmissionItem) {
  if (['withdrawn', 'closed', 'deleted_by_author', 'cancelled'].includes(item.status)) return false
  if (item.kind === 'comment') return Boolean(item.metadata?.ranking_id)
  return ['ranking', 'carpool', 'commission', 'dossier_edit'].includes(item.kind)
}

function manageSubmissionLabel(item: SubmissionItem) {
  if (item.kind === 'carpool' || item.kind === 'commission') return '关闭'
  if (item.kind === 'comment') return '删除'
  return '撤回'
}

function manageSubmission(item: SubmissionItem) {
  const message = item.kind === 'ranking'
    ? '确定申请撤回或下架这条红黑榜吗？'
    : item.kind === 'carpool'
      ? '确定关闭这条拼车吗？'
      : item.kind === 'commission'
        ? '确定关闭这条委托需求吗？'
        : item.kind === 'comment'
          ? '确定删除这条评论吗？'
          : '确定撤回这次档案修改吗？'
  uni.showModal({
    title: '确认操作',
    content: message,
    success: async result => {
      if (!result.confirm) return
      try {
        if (item.kind === 'ranking') await apiRequest(`/lc/rankings/${encoded(item.id)}/withdraw`, { method: 'PUT' })
        if (item.kind === 'carpool') await apiRequest(`/lc/carpools/${encoded(item.id)}/close`, { method: 'PUT' })
        if (item.kind === 'commission') await apiRequest(`/lc/commissions/${encoded(item.id)}/close`, { method: 'PUT' })
        if (item.kind === 'comment') await apiRequest(`/lc/rankings/${encoded(String(item.metadata?.ranking_id || ''))}/comments/${encoded(item.id)}`, { method: 'DELETE' })
        if (item.kind === 'dossier_edit') await apiRequest(`/lc/dossier-edits/${encoded(item.id)}`, { method: 'DELETE' })
        uni.showToast({ title: '操作成功', icon: 'success' })
        await load()
      } catch (reason) {
        uni.showToast({ title: (reason as Error).message || '操作失败', icon: 'none' })
      }
    },
  })
}

async function markRead(item: Notice) {
  if (!item.read_at) {
    try {
      await apiRequest(`/lc/account/notifications/${encoded(item.id)}/read`, { method: 'PUT' })
      item.read_at = new Date().toISOString()
      updateUnreadStorage()
    } catch { /* 下次进入时仍会显示未读 */ }
  }
  if (item.action_url?.startsWith('/commissions') || item.related_type === 'commission') {
    uni.setStorageSync('jumulu:commissions:open-view', 'mine')
    return switchMainTab('/pages/commissions/index')
  }
  if (item.action_url === '/contact' || item.related_type === 'site_message') {
    return uni.navigateTo({ url: '/pages/feedback/index' })
  }
}

onLoad((options) => {
  if (options?.tab === 'submissions') activeTab.value = 'submissions'
})
onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <MiniNavBar title="消息中心" fallback="/pages/mine/index" />
    <StatePanel :loading="loading" :error="error" :empty="false" @retry="load" />

    <view v-if="status && status.state !== 'merged'" class="status-strip" :class="{ restricted: status.state === 'restricted' }">
      <view class="status-dot" />
      <strong>{{ status.state === 'restricted' ? '账号当前受限' : '账号状态正常' }}</strong>
      <text>{{ status.restriction?.reason || '可以正常浏览、评价和提交内容' }}</text>
      <button v-if="status.state === 'restricted'" @tap="showAccountDetail = !showAccountDetail">{{ showAccountDetail ? '收起' : '查看' }}</button>
    </view>

    <view v-if="status?.state === 'restricted' && showAccountDetail" class="account-detail">
      <view class="detail-grid">
        <view><text>限制范围</text><strong>{{ status.restriction?.scope === 'account' ? '账号全部功能' : '内容发布功能' }}</strong></view>
        <view><text>结束时间</text><strong>{{ formatDate(status.restriction?.ends_at) || '长期有效' }}</strong></view>
        <view v-if="status.appeal"><text>申诉进度</text><strong>{{ appealLabel(status.appeal.status) }}</strong></view>
      </view>
      <view v-if="status.appeal?.admin_reply" class="reply"><strong>管理员回复：</strong>{{ status.appeal.admin_reply }}</view>
      <template v-if="!status.appeal || status.appeal.status === 'needs_info' || ['approved', 'rejected', 'withdrawn'].includes(status.appeal.status)">
        <text class="field-label">申诉说明</text>
        <textarea v-model="content" class="textarea" maxlength="2000" placeholder="说明具体情况、相关时间和希望如何处理，至少 10 个字。" />
        <text class="field-label">补充材料链接（可选）</text>
        <textarea v-model="evidenceText" class="textarea evidence" placeholder="每行一个链接，最多 6 个" />
        <button class="primary-button submit" :loading="submitting" :disabled="submitting || content.trim().length < 10" @tap="submitAppeal">
          {{ status.appeal?.status === 'needs_info' ? '补充并重新提交' : '提交申诉' }}
        </button>
      </template>
      <text v-else-if="status.appeal?.status === 'pending'" class="pending">申诉正在处理中，不需要重复提交。</text>
    </view>

    <view v-if="status?.state !== 'merged'" class="workspace">
      <view class="tabs">
        <text :class="{ active: activeTab === 'notices' }" @tap="activeTab = 'notices'">通知<text v-if="unreadCount > 0" class="count">{{ unreadCount }}</text></text>
        <text :class="{ active: activeTab === 'submissions' }" @tap="activeTab = 'submissions'">我的提交<text class="count">{{ submissions.summary.total }}</text></text>
        <button v-if="activeTab === 'notices' && unreadCount > 0" @tap="markAllRead">全部已读</button>
      </view>

      <template v-if="activeTab === 'notices'">
        <view v-if="notices.length === 0" class="empty">暂无站内通知。</view>
        <view v-for="item in displayedNotices" :key="item.id" class="notice" :class="{ unread: !item.read_at }" @tap="markRead(item)">
          <view class="notice-dot" />
          <view class="notice-copy">
            <strong>{{ item.title }}</strong>
            <text>{{ item.content }}</text>
            <text class="time">{{ formatDate(item.created_at) }}</text>
          </view>
        </view>
        <button v-if="displayedNotices.length < notices.length" class="load-more" @tap="noticeLimit += ACCOUNT_LIST_BATCH">
          继续加载 {{ Math.min(ACCOUNT_LIST_BATCH, notices.length - displayedNotices.length) }} 条
          <text>已显示 {{ displayedNotices.length }} / {{ notices.length }}</text>
        </button>
      </template>

      <template v-else>
        <scroll-view class="filters" scroll-x :show-scrollbar="false">
          <view class="filters-inner">
            <text :class="{ active: stateFilter === 'all' }" @tap="stateFilter = 'all'">全部 {{ submissions.summary.total }}</text>
            <text :class="{ active: stateFilter === 'pending' }" @tap="stateFilter = 'pending'">审核中 {{ submissions.summary.pending }}</text>
            <text :class="{ active: stateFilter === 'action' }" @tap="stateFilter = 'action'">需处理 {{ submissions.summary.action_required }}</text>
            <text :class="{ active: stateFilter === 'approved' }" @tap="stateFilter = 'approved'">已公开 {{ submissions.summary.approved }}</text>
          </view>
        </scroll-view>
        <view v-if="visibleSubmissions.length === 0" class="empty">这里还没有符合条件的提交记录。</view>
        <view v-for="item in displayedSubmissions" :key="`${item.kind}-${item.id}`" class="submission" @tap="openSubmission(item)">
          <image class="submission-image" :src="item.thumbnail_url || '/static/icons/message-star.png'" mode="aspectFill" />
          <view class="submission-copy">
            <view class="submission-meta"><text>{{ item.type_label }}</text><text>{{ formatDate(item.updated_at || item.created_at) }}</text></view>
            <strong>{{ item.title }}</strong>
            <text v-if="item.content" class="submission-content">{{ item.content }}</text>
            <text v-if="item.reject_reason" class="reject">处理意见：{{ item.reject_reason }}</text>
          </view>
          <view class="submission-side">
            <text class="submission-state" :class="`state-${item.state}`">{{ submissionStatusLabel(item) }}</text>
            <button v-if="canManageSubmission(item)" @tap.stop="manageSubmission(item)">{{ manageSubmissionLabel(item) }}</button>
            <image v-else src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
          </view>
        </view>
        <button v-if="displayedSubmissions.length < visibleSubmissions.length" class="load-more" @tap="submissionLimit += ACCOUNT_LIST_BATCH">
          继续加载 {{ Math.min(ACCOUNT_LIST_BATCH, visibleSubmissions.length - displayedSubmissions.length) }} 条
          <text>已显示 {{ displayedSubmissions.length }} / {{ visibleSubmissions.length }}</text>
        </button>
      </template>
    </view>
  </view>
</template>

<style scoped>
.status-strip { display: flex; min-height: 76rpx; align-items: center; gap: 12rpx; margin-top: 14rpx; padding: 12rpx 16rpx; border: 1rpx solid #dfe7df; border-radius: 10rpx; background: #f7fbf8; color: #64706a; font-size: 22rpx; }
.status-strip.restricted { border-color: #ead3ae; background: #fff9ef; color: #7b6240; }
.status-dot { width: 14rpx; height: 14rpx; flex: 0 0 14rpx; border-radius: 50%; background: #3f8b5e; }
.restricted .status-dot { background: #b9781f; }
.status-strip strong { flex: 0 0 auto; color: #227346; font-size: 23rpx; }
.status-strip.restricted strong { color: #8b5919; }
.status-strip > text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-strip button { flex: 0 0 auto; margin: 0; padding: 0; border: 0; background: transparent; color: #2d568f; font-size: 21rpx; font-weight: 850; line-height: 1.4; }
.account-detail { margin-top: 12rpx; padding: 20rpx; border-radius: 10rpx; background: #fff; }
.detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.detail-grid text, .detail-grid strong { display: block; }
.detail-grid text { color: #8a93a0; font-size: 20rpx; }
.detail-grid strong { margin-top: 5rpx; color: #27364a; font-size: 22rpx; }
.reply { margin-top: 16rpx; padding: 14rpx; border-left: 5rpx solid #2d568f; background: #edf3fb; color: #275389; font-size: 22rpx; line-height: 1.6; }
.textarea { min-height: 160rpx; }
.textarea.evidence { min-height: 96rpx; }
.submit { width: 100%; margin-top: 16rpx; }
.pending { display: block; margin-top: 16rpx; color: #64748b; font-size: 22rpx; }
.workspace { overflow: hidden; margin-top: 14rpx; border-radius: 12rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(31, 41, 55, 0.05); }
.tabs { display: flex; height: 92rpx; align-items: stretch; gap: 34rpx; padding: 0 20rpx; border-bottom: 1rpx solid #e9e3da; }
.tabs > text { position: relative; display: flex; align-items: center; gap: 8rpx; color: #6f7887; font-size: 25rpx; font-weight: 800; }
.tabs > text.active { color: #1f2937; }
.tabs > text.active::after { position: absolute; right: 0; bottom: -1rpx; left: 0; height: 5rpx; background: #a66b1f; content: ""; }
.count { display: inline-flex; min-width: 34rpx; height: 34rpx; align-items: center; justify-content: center; border-radius: 17rpx; background: #eef0f3; padding: 0 9rpx; color: #64748b; font-size: 19rpx; }
.tabs button { margin: 0 0 0 auto; padding: 0; border: 0; background: transparent; color: #2d568f; font-size: 21rpx; font-weight: 850; line-height: 92rpx; }
.notice { display: grid; grid-template-columns: 12rpx minmax(0, 1fr); gap: 14rpx; padding: 22rpx 20rpx; border-bottom: 1rpx solid #eee9e2; }
.notice.unread { background: #fbfcfe; }
.notice-dot { width: 12rpx; height: 12rpx; margin-top: 8rpx; border-radius: 50%; background: transparent; }
.notice.unread .notice-dot { background: #b9781f; }
.notice-copy strong, .notice-copy text { display: block; }
.notice-copy strong { color: #27364a; font-size: 25rpx; }
.notice-copy > text { margin-top: 7rpx; color: #64748b; font-size: 22rpx; line-height: 1.6; }
.notice-copy .time { color: #98a2b3; font-size: 20rpx; }
.filters { border-bottom: 1rpx solid #ece7df; background: #fcfbf8; white-space: nowrap; }
.filters-inner { display: inline-flex; gap: 10rpx; padding: 14rpx 18rpx; }
.filters text { display: inline-flex; min-height: 54rpx; align-items: center; border: 1rpx solid transparent; border-radius: 8rpx; color: #6f7887; padding: 0 17rpx; font-size: 21rpx; font-weight: 750; }
.filters text.active { border-color: #d7dde6; background: #fff; color: #2d568f; }
.submission { display: grid; grid-template-columns: 92rpx minmax(0, 1fr) 58rpx; align-items: center; gap: 15rpx; padding: 20rpx; border-bottom: 1rpx solid #eee9e2; }
.submission-image { width: 92rpx; height: 92rpx; border: 1rpx solid #ece7df; border-radius: 10rpx; background: #f6f3ed; }
.submission-copy { min-width: 0; }
.submission-meta { display: flex; align-items: center; gap: 10rpx; overflow: hidden; }
.submission-meta text:first-child { flex: 0 0 auto; color: #a66b1f; font-size: 19rpx; font-weight: 900; }
.submission-meta text:last-child { overflow: hidden; color: #98a2b3; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.submission-copy > strong { display: block; margin-top: 5rpx; overflow: hidden; color: #27364a; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.submission-content { display: -webkit-box; margin-top: 7rpx; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: #667085; font-size: 21rpx; line-height: 1.5; }
.reject { display: block; margin-top: 7rpx; color: #b64238; font-size: 21rpx; line-height: 1.5; }
.submission-side { display: flex; height: 100%; flex-direction: column; align-items: flex-end; justify-content: space-between; }
.submission-side image { width: 28rpx; height: 28rpx; }
.submission-side button { margin: 0; padding: 0; border: 0; background: transparent; color: #2d568f; font-size: 19rpx; font-weight: 850; line-height: 1.4; }
.submission-state { padding: 5rpx 8rpx; border-radius: 6rpx; background: #eef0f3; color: #667085; font-size: 18rpx; font-weight: 850; white-space: nowrap; }
.submission-state.state-pending { background: #fff4df; color: #8b5919; }
.submission-state.state-approved { background: #edf8f1; color: #227346; }
.submission-state.state-action { background: #fff0ee; color: #b64238; }
.empty { padding: 70rpx 20rpx; color: #8a93a0; font-size: 22rpx; text-align: center; }
.load-more { display: flex; width: 100%; min-height: 82rpx; align-items: center; justify-content: center; gap: 12rpx; margin: 0; border-top: 1rpx solid #eee9e2; border-radius: 0; background: #fff; color: #2d568f; font-size: 23rpx; font-weight: 850; line-height: 82rpx; }
.load-more text { color: #8a93a0; font-size: 20rpx; font-weight: 650; }
</style>
