<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import { apiRequest, encoded, readAuth } from '../../utils/api'
import { dateText, statusText } from '../../utils/format'

type ManagedItem = { id: string; kind: string; title: string; content?: string; status?: string; created_at?: string; ranking_id?: string; target_title?: string; reject_reason?: string | null }
type PublicationSummary = { total: number; pending: number; approved: number; rejected: number; needs_submission: number }
type ContentPayload = {
  rankings: ManagedItem[]
  carpools: ManagedItem[]
  commissions: ManagedItem[]
  provider_listings: ManagedItem[]
  ratings: ManagedItem[]
  comments: ManagedItem[]
  reports: ManagedItem[]
  dossier_edits: ManagedItem[]
  summary: PublicationSummary
}
const data = ref<ContentPayload | null>(null)
const loading = ref(false)
const error = ref('')
const tab = ref<'posts' | 'ratings' | 'comments' | 'reports'>('posts')
const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all')
const postItems = computed<ManagedItem[]>(() => [
  ...(data.value?.provider_listings || []),
  ...(data.value?.commissions || []),
  ...(data.value?.rankings || []),
  ...(data.value?.carpools || []),
  ...(data.value?.dossier_edits || []),
].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || ''))))
const visibleItems = computed<ManagedItem[]>(() => {
  const items = tab.value === 'posts'
    ? postItems.value
    : tab.value === 'ratings'
      ? data.value?.ratings || []
      : tab.value === 'comments'
        ? data.value?.comments || []
        : data.value?.reports || []
  if (tab.value !== 'posts' || statusFilter.value === 'all') return items
  if (statusFilter.value === 'pending') {
    return items.filter(item => ['pending', 'pending_owner', 'needs_submission'].includes(item.status || ''))
  }
  return items.filter(item => item.status === statusFilter.value)
})
async function load() {
  if (!readAuth()?.token) { uni.switchTab({ url: '/pages/mine/index' }); return }
  loading.value = true; error.value = ''
  try { data.value = await apiRequest<ContentPayload>('/lc/miniapp/me/content') }
  catch (err) { error.value = err instanceof Error ? err.message : '内容加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
async function action(item: any) {
  const isRanking = item.kind === 'ranking'
  const isCarpool = item.kind === 'carpool'
  const isCommission = item.kind === 'commission'
  const isComment = item.kind === 'comment'
  const isDossierEdit = item.kind === 'dossier_edit'
  const message = isRanking ? '确定申请撤回或下架这条口碑吗？' : isCarpool ? '确定关闭这条拼车吗？' : isCommission ? '确定关闭这条委托需求吗？' : isComment ? '确定删除这条评论吗？' : '确定撤回这次档案修改吗？'
  uni.showModal({ title: '确认操作', content: message, success: async result => {
    if (!result.confirm) return
    try {
      if (isRanking) await apiRequest(`/lc/rankings/${encoded(item.id)}/withdraw`, { method: 'PUT' })
      if (isCarpool) await apiRequest(`/lc/carpools/${encoded(item.id)}/close`, { method: 'PUT' })
      if (isCommission) await apiRequest(`/lc/commissions/${encoded(item.id)}/close`, { method: 'PUT' })
      if (isComment) await apiRequest(`/lc/rankings/${encoded(item.ranking_id)}/comments/${encoded(item.id)}`, { method: 'DELETE' })
      if (isDossierEdit) await apiRequest(`/lc/dossier-edits/${encoded(item.id)}`, { method: 'DELETE' })
      uni.showToast({ title: '操作成功', icon: 'success' }); void load()
    } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  } })
}

function openItem(item: ManagedItem) {
  if (item.kind === 'provider_listing') return uni.navigateTo({ url: '/pages/commissions/provider-edit' })
  if (item.kind === 'ranking') return uni.navigateTo({ url: `/pages/rankings/detail?id=${encoded(item.id)}` })
  if (item.kind === 'commission') return uni.switchTab({ url: '/pages/commissions/index' })
  if (item.kind === 'carpool') return uni.switchTab({ url: '/pages/carpools/index' })
}

function canManage(item: ManagedItem) {
  return ['ranking', 'carpool', 'commission', 'comment', 'dossier_edit'].includes(item.kind)
    && !['withdrawn', 'closed', 'deleted_by_author'].includes(item.status || '')
}

function manageLabel(item: ManagedItem) {
  if (item.kind === 'carpool' || item.kind === 'commission') return '关闭'
  if (item.kind === 'comment') return '删除'
  return '申请撤回'
}

onShow(load)
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <MiniNavBar title="我的发布与审核" fallback="/pages/mine/index" />
    <view class="tabs">
      <text :class="{ active: tab === 'posts' }" @tap="tab = 'posts'">发布</text>
      <text :class="{ active: tab === 'ratings' }" @tap="tab = 'ratings'">评价</text>
      <text :class="{ active: tab === 'comments' }" @tap="tab = 'comments'">互动</text>
      <text :class="{ active: tab === 'reports' }" @tap="tab = 'reports'">举报</text>
    </view>
    <StatePanel :loading="loading" :error="error" :empty="false" @retry="load" />
    <template v-if="data && !loading">
      <view v-if="tab === 'posts'" class="summary">
        <view><strong>{{ data.summary?.pending || 0 }}</strong><text>审核中</text></view>
        <view><strong>{{ data.summary?.approved || 0 }}</strong><text>已公开</text></view>
        <view><strong>{{ (data.summary?.rejected || 0) + (data.summary?.needs_submission || 0) }}</strong><text>需处理</text></view>
      </view>
      <view v-if="tab === 'posts'" class="status-tabs">
        <text :class="{ active: statusFilter === 'all' }" @tap="statusFilter = 'all'">全部</text>
        <text :class="{ active: statusFilter === 'pending' }" @tap="statusFilter = 'pending'">待处理</text>
        <text :class="{ active: statusFilter === 'approved' }" @tap="statusFilter = 'approved'">已公开</text>
        <text :class="{ active: statusFilter === 'rejected' }" @tap="statusFilter = 'rejected'">未通过</text>
      </view>
      <view v-for="item in visibleItems" :key="`${item.kind}-${item.id}`" class="item" @tap="openItem(item)">
        <view class="item__head"><text class="item__title">{{ item.title || item.target_title || '内容记录' }}</text><text class="status">{{ statusText(item.status) }}</text></view>
        <text v-if="item.content" class="item__content">{{ item.content }}</text>
        <text class="item__date">{{ dateText(item.created_at) }}</text>
        <text v-if="item.reject_reason" class="reject">原因：{{ item.reject_reason }}</text>
        <button v-if="item.kind === 'provider_listing'" class="secondary-button" @tap.stop="openItem(item)">{{ item.status === 'needs_submission' ? '补交资料' : item.status === 'rejected' ? '修改后重交' : '查看委托条' }}</button>
        <button v-else-if="canManage(item)" class="secondary-button" @tap.stop="action(item)">{{ manageLabel(item) }}</button>
      </view>
      <view v-if="visibleItems.length === 0" class="empty">这里还没有记录。</view>
    </template>
  </view>
</template>

<style scoped>
.tabs { display: flex; margin: 0 -24rpx; padding: 0 24rpx; border-bottom: 1rpx solid #e5e7eb; background: #fff; }
.tabs text { flex: 1; padding: 22rpx 4rpx 18rpx; border-bottom: 4rpx solid transparent; color: #64748b; text-align: center; font-size: 24rpx; font-weight: 750; }
.tabs text.active { border-bottom-color: #a66b1f; color: #1f2937; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); margin: 20rpx 0 12rpx; padding: 20rpx 0; border-radius: 12rpx; background: #fff; }
.summary view { text-align: center; border-right: 1rpx solid #edf0f3; }
.summary view:last-child { border-right: 0; }
.summary strong, .summary text { display: block; }
.summary strong { color: #1f2937; font-size: 32rpx; }
.summary text { margin-top: 5rpx; color: #7b8492; font-size: 21rpx; }
.status-tabs { display: flex; gap: 12rpx; padding: 8rpx 0 4rpx; }
.status-tabs text { padding: 10rpx 20rpx; border-radius: 8rpx; background: #eef1f4; color: #64748b; font-size: 22rpx; font-weight: 700; }
.status-tabs text.active { background: #1f2937; color: #fff; }
.item { margin-top: 12rpx; padding: 22rpx; border-radius: 12rpx; background: #fff; }
.item__head { display: flex; justify-content: space-between; gap: 14rpx; }
.item__title { color: #27364a; font-weight: 850; }
.status { flex: 0 0 auto; padding: 4rpx 10rpx; border-radius: 6rpx; background: #fff5df; color: #8b5919; font-size: 21rpx; }
.item__content, .item__date, .reject { display: block; margin-top: 10rpx; }
.item__content { color: #475569; font-size: 24rpx; line-height: 1.55; }
.item__date { color: #94a3b8; font-size: 21rpx; }
.reject { color: #b42318; font-size: 22rpx; }
.item button { width: 100%; margin-top: 12rpx; }
.empty { margin-top: 12rpx; padding: 40rpx; color: #64748b; text-align: center; }
</style>
