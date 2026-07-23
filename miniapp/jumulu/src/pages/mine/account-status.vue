<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import type { AccountStatus } from '../../types'
import { apiRequest, readAuth } from '../../utils/api'

type Notice = {
  id: string
  title: string
  content: string
  read_at?: string | null
  created_at: string
  action_url?: string | null
}

const status = ref<AccountStatus | null>(null)
const notices = ref<Notice[]>([])
const content = ref('')
const evidenceText = ref('')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

function formatDate(value?: string | null) {
  if (!value) return '长期有效'
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

async function load() {
  if (!readAuth()?.token) {
    status.value = null; notices.value = []; error.value = '请先登录'
    uni.stopPullDownRefresh()
    return
  }
  loading.value = true; error.value = ''
  try {
    const [nextStatus, nextNotices] = await Promise.all([
      apiRequest<AccountStatus>('/lc/account/status'),
      apiRequest<Notice[]>('/lc/account/notifications'),
    ])
    status.value = nextStatus
    notices.value = nextNotices
    const unread = nextNotices.filter(item => !item.read_at).length
    uni.setStorageSync('jumulu:notifications:unread', unread)
    uni.$emit('jumulu:notification-count', unread)
    if (nextStatus.appeal?.status === 'needs_info') {
      content.value = nextStatus.appeal.content || ''
      evidenceText.value = (nextStatus.appeal.evidence_urls || []).join('\n')
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '账号状态加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitAppeal() {
  if (content.value.trim().length < 10 || submitting.value) return
  submitting.value = true; error.value = ''
  try {
    const evidenceUrls = evidenceText.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 6)
    await apiRequest('/lc/account/appeals', {
      method: 'POST',
      data: { content: content.value.trim(), evidenceUrls },
    })
    content.value = ''; evidenceText.value = ''
    uni.showToast({ title: '申诉已提交', icon: 'success' })
    await load()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '申诉提交失败'
  } finally { submitting.value = false }
}

async function markRead(item: Notice) {
  if (!item.read_at) {
    try {
      await apiRequest(`/lc/account/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' })
      item.read_at = new Date().toISOString()
      const unread = notices.value.filter(notice => !notice.read_at).length
      uni.setStorageSync('jumulu:notifications:unread', unread)
      uni.$emit('jumulu:notification-count', unread)
    } catch { /* 下次进入时仍会显示未读 */ }
  }
  if (item.action_url?.startsWith('/commissions')) {
    uni.setStorageSync('jumulu:commissions:open-view', 'mine')
    uni.switchTab({ url: '/pages/commissions/index' })
  }
}

onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="站内消息" nav-title="消息通知" title="消息通知" description="委托申请、处理结果、账号状态和管理员回复都在这里留痕。" />
    <view v-if="loading" class="surface state-card"><text class="muted">正在读取账号状态...</text></view>
    <view v-if="error" class="surface error-card"><text>{{ error }}</text></view>

    <view v-if="status && status.state !== 'merged'" class="surface state-card" :class="{ restricted: status.state === 'restricted' }">
      <view class="state-head">
        <view>
          <text class="eyebrow">{{ status.state === 'restricted' ? '当前受限' : '状态正常' }}</text>
          <text class="state-title">{{ status.restriction?.scope === 'account' ? '账号功能限制' : status.restriction ? '发布功能限制' : '账号可以正常使用' }}</text>
        </view>
        <text v-if="status.restriction" class="state-tag">{{ status.restriction.ends_at ? '限时' : '长期' }}</text>
      </view>
      <view v-if="status.restriction" class="state-detail">
        <text><strong>原因：</strong>{{ status.restriction.reason }}</text>
        <text><strong>开始：</strong>{{ formatDate(status.restriction.starts_at) }}</text>
        <text><strong>结束：</strong>{{ formatDate(status.restriction.ends_at) }}</text>
      </view>
    </view>

    <view v-if="status?.state === 'restricted'" class="surface appeal-card">
      <view class="section-head"><text class="section-title compact">账号申诉</text><text v-if="status.appeal" class="muted small">{{ appealLabel(status.appeal.status) }}</text></view>
      <view v-if="status.appeal?.admin_reply" class="reply"><strong>管理员回复：</strong>{{ status.appeal.admin_reply }}</view>
      <template v-if="!status.appeal || status.appeal.status === 'needs_info' || ['approved', 'rejected', 'withdrawn'].includes(status.appeal.status)">
        <text class="field-label">申诉说明</text>
        <textarea v-model="content" class="textarea" maxlength="2000" placeholder="说明具体情况、相关时间和希望如何处理，至少 10 个字。" />
        <text class="field-label">补充材料链接（可选）</text>
        <textarea v-model="evidenceText" class="textarea evidence" placeholder="每行一个链接，最多 6 个" />
        <button class="primary-button submit" :loading="submitting" :disabled="submitting || content.trim().length < 10" @tap="submitAppeal">{{ status.appeal?.status === 'needs_info' ? '补充并重新提交' : '提交申诉' }}</button>
      </template>
      <text v-else-if="status.appeal?.status === 'pending'" class="muted pending">申诉正在处理中，不需要重复提交。</text>
    </view>

    <view class="surface notices">
      <text class="section-title compact">全部通知</text>
      <text v-if="notices.length === 0" class="muted empty">暂无站内通知。</text>
      <view v-for="item in notices" :key="item.id" class="notice" @tap="markRead(item)">
        <view class="notice-title"><strong>{{ item.title }}</strong><text v-if="!item.read_at">未读</text></view>
        <text class="notice-content">{{ item.content }}</text>
        <text class="notice-time">{{ formatDate(item.created_at) }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.state-card, .appeal-card, .notices, .error-card { margin-top: 14rpx; padding: 20rpx; }
.error-card { border-color: #efc9c5; background: #fff6f5; color: #a53232; }
.state-card.restricted { border-color: #e6bc77; background: #fffaf2; }
.state-head, .section-head, .notice-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 14rpx; }
.eyebrow, .state-title { display: block; }
.eyebrow { color: #166534; font-size: 21rpx; font-weight: 850; }
.restricted .eyebrow { color: #8b5919; }
.state-title { margin-top: 6rpx; color: #1f2937; font-size: 30rpx; font-weight: 900; }
.state-tag { padding: 7rpx 12rpx; border-radius: 8rpx; background: #fff4e6; color: #8b5919; font-size: 21rpx; font-weight: 850; }
.state-detail { display: grid; gap: 8rpx; margin-top: 18rpx; color: #667085; font-size: 23rpx; line-height: 1.6; }
.section-title.compact { margin: 0; font-size: 28rpx; }
.small { font-size: 22rpx; }
.reply { margin-top: 16rpx; padding: 16rpx; border-radius: 8rpx; background: #eff6ff; color: #275389; font-size: 23rpx; line-height: 1.65; }
.textarea { min-height: 190rpx; }
.textarea.evidence { min-height: 120rpx; }
.submit { width: 100%; margin-top: 18rpx; }
.pending, .empty { display: block; margin-top: 16rpx; font-size: 23rpx; line-height: 1.6; }
.notices { padding-top: 20rpx; padding-bottom: 4rpx; }
.notice { padding: 20rpx 0; border-top: 1rpx solid #eceff2; }
.notice:first-of-type { margin-top: 14rpx; }
.notice-title strong { color: #27364a; font-size: 25rpx; }
.notice-title text { color: #9a651e; font-size: 20rpx; font-weight: 850; }
.notice-content, .notice-time { display: block; }
.notice-content { margin-top: 8rpx; color: #64748b; font-size: 22rpx; line-height: 1.65; }
.notice-time { margin-top: 7rpx; color: #98a2b3; font-size: 20rpx; }
</style>
