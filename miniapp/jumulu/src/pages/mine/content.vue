<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import { apiRequest, encoded, readAuth } from '../../utils/api'
import { dateText, statusText } from '../../utils/format'

type ManagedItem = { id: string; kind: string; title: string; content?: string; status?: string; created_at?: string; ranking_id?: string; target_title?: string; reject_reason?: string | null }
type ContentPayload = { rankings: ManagedItem[]; carpools: ManagedItem[]; ratings: ManagedItem[]; comments: ManagedItem[]; reports: ManagedItem[]; dossier_edits: ManagedItem[] }
const data = ref<ContentPayload | null>(null)
const loading = ref(false)
const error = ref('')
const tab = ref<'posts' | 'ratings' | 'comments' | 'reports'>('posts')
const postItems = computed<ManagedItem[]>(() => [
  ...(data.value?.rankings || []),
  ...(data.value?.carpools || []),
  ...(data.value?.dossier_edits || []),
])
const visibleItems = computed<ManagedItem[]>(() => tab.value === 'posts' ? postItems.value : tab.value === 'ratings' ? data.value?.ratings || [] : tab.value === 'comments' ? data.value?.comments || [] : data.value?.reports || [])
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
  const isComment = item.kind === 'comment'
  const isDossierEdit = item.kind === 'dossier_edit'
  const message = isRanking ? '确定撤回或下架这条口碑吗？' : isCarpool ? '确定关闭这条拼车吗？' : isComment ? '确定删除这条评论吗？' : '确定撤回这次档案修改吗？'
  uni.showModal({ title: '确认操作', content: message, success: async result => {
    if (!result.confirm) return
    try {
      if (isRanking) await apiRequest(`/lc/rankings/${encoded(item.id)}/withdraw`, { method: 'PUT' })
      if (isCarpool) await apiRequest(`/lc/carpools/${encoded(item.id)}/close`, { method: 'PUT' })
      if (isComment) await apiRequest(`/lc/rankings/${encoded(item.ranking_id)}/comments/${encoded(item.id)}`, { method: 'DELETE' })
      if (isDossierEdit) await apiRequest(`/lc/dossier-edits/${encoded(item.id)}`, { method: 'DELETE' })
      uni.showToast({ title: '操作成功', icon: 'success' }); void load()
    } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  } })
}
onShow(load)
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <MiniNavBar title="我的内容" fallback="/pages/mine/index" />
    <view class="tabs page-tools">
      <text :class="{ active: tab === 'posts' }" @tap="tab = 'posts'">发布</text>
      <text :class="{ active: tab === 'ratings' }" @tap="tab = 'ratings'">评价</text>
      <text :class="{ active: tab === 'comments' }" @tap="tab = 'comments'">评论</text>
      <text :class="{ active: tab === 'reports' }" @tap="tab = 'reports'">举报</text>
    </view>
    <StatePanel :loading="loading" :error="error" :empty="false" @retry="load" />
    <template v-if="data && !loading">
      <view v-for="item in visibleItems" :key="`${item.kind}-${item.id}`" class="item surface">
        <view class="item__head"><text class="item__title">{{ item.title || item.target_title || '内容记录' }}</text><text class="status">{{ statusText(item.status) }}</text></view>
        <text v-if="item.content" class="item__content">{{ item.content }}</text>
        <text class="item__date">{{ dateText(item.created_at) }}</text>
        <text v-if="item.reject_reason" class="reject">原因：{{ item.reject_reason }}</text>
        <button v-if="['ranking','carpool','comment','dossier_edit'].includes(item.kind) && !['withdrawn','closed','deleted_by_author'].includes(item.status || '')" class="secondary-button" @tap="action(item)">{{ item.kind === 'carpool' ? '关闭' : item.kind === 'comment' ? '删除' : '撤回' }}</button>
      </view>
      <view v-if="visibleItems.length === 0" class="empty">这里还没有记录。</view>
    </template>
  </view>
</template>

<style scoped>
.tabs { display: flex; padding: 8rpx; }
.tabs text { flex: 1; padding: 16rpx 4rpx; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 24rpx; font-weight: 800; }
.tabs text.active { background: #f3e4c9; color: #8b5919; }
.item { margin-top: 12rpx; padding: 18rpx; }
.item__head { display: flex; justify-content: space-between; gap: 14rpx; }
.item__title { color: #27364a; font-weight: 850; }
.status { flex: 0 0 auto; color: #9a651e; font-size: 22rpx; }
.item__content, .item__date, .reject { display: block; margin-top: 10rpx; }
.item__content { color: #475569; font-size: 24rpx; line-height: 1.55; }
.item__date { color: #94a3b8; font-size: 21rpx; }
.reject { color: #b42318; font-size: 22rpx; }
.item button { width: 100%; margin-top: 12rpx; }
.empty { margin-top: 12rpx; padding: 40rpx; color: #64748b; text-align: center; }
</style>
