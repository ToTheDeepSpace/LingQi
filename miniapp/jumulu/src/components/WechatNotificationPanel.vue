<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { apiRequest, readAuth } from '../utils/api'

type Status = { available: boolean; state: string; latest?: { state: string; reason: string } | null }
type SubscriptionRequest = { id: string; template_id: string; expires_at: string }
const status = ref<Status | null>(null)
const request = ref<SubscriptionRequest | null>(null)
const pending = ref<{ requestId: string; result: string } | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const stateLabel = computed(() => ({
  none: '尚未订阅', accepted: '已记录订阅', rejected: '未允许提醒', off: '已暂停',
  exhausted: '需要再次订阅', unconfigured: '暂未配置完成',
}[status.value?.state || ''] || '读取状态中'))
const deliveryHint = computed(() => {
  if (status.value?.latest?.state === 'api_accepted') return '上一条已提交微信；是否展示请以微信端为准。'
  if (status.value?.latest?.state === 'unknown') return '上一条发送结果待核实，未自动重发，站内消息仍可查看。'
  if (status.value?.latest?.state === 'failed') return '上一条微信提醒未发出，站内消息仍可正常查看。'
  return ''
})

async function refresh() {
  if (loading.value || busy.value || !readAuth()?.token) return
  loading.value = true
  error.value = ''
  request.value = null
  try {
    status.value = await apiRequest<Status>('/lc/account/wechat-notifications')
    if (status.value.available && !pending.value) {
      request.value = await apiRequest<SubscriptionRequest>('/lc/account/wechat-notifications/requests', { method: 'POST' })
    }
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '微信提醒状态加载失败' }
  finally { loading.value = false }
}

async function saveResult() {
  if (!pending.value) return
  busy.value = true
  error.value = ''
  try {
    await apiRequest('/lc/account/wechat-notifications/confirm', { method: 'POST', data: pending.value })
    uni.showToast({ title: pending.value.result === 'accept' ? '本次订阅已记录' : '未订阅，不影响使用', icon: 'none' })
    pending.value = null
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '订阅结果保存失败，请重试'
    if (error.value.includes('重新订阅')) {
      pending.value = null
      request.value = null
    }
  } finally {
    busy.value = false
    if (!pending.value && !error.value) await refresh()
  }
}

function subscribe() {
  if (busy.value || loading.value) return
  if (pending.value) { void saveResult(); return }
  const prepared = request.value
  if (!prepared || new Date(prepared.expires_at).getTime() <= Date.now() + 5000) {
    void refresh()
    uni.showToast({ title: '正在刷新，请稍后再次点击', icon: 'none' })
    return
  }
  if (typeof uni.requestSubscribeMessage !== 'function') {
    error.value = '请在最新版微信小程序中订阅提醒'
    return
  }
  busy.value = true
  error.value = ''
  // Must be called synchronously from the user's tap. The request was prepared earlier.
  uni.requestSubscribeMessage({
    tmplIds: [prepared.template_id],
    success: result => {
      const choice = String((result as unknown as Record<string, unknown>)[prepared.template_id] || '')
      if (!['accept', 'reject', 'ban'].includes(choice)) {
        busy.value = false
        error.value = '微信未返回有效订阅结果，请稍后重试'
        return
      }
      pending.value = { requestId: prepared.id, result: choice }
      request.value = null
      void saveResult()
    },
    fail: result => {
      busy.value = false
      error.value = `微信订阅未完成（${result.errCode || result.errMsg || '未知错误'}）。可检查提醒设置后重试。`
    },
  })
}
async function pause() {
  if (busy.value) return
  busy.value = true
  try {
    await apiRequest('/lc/account/wechat-notifications/pause', { method: 'PUT' })
    pending.value = null
    status.value = { ...status.value!, state: 'off' }
    uni.showToast({ title: '已暂停后续微信提醒', icon: 'none' })
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '暂停失败' }
  finally { busy.value = false }
}
function openSettings() {
  uni.openSetting({ withSubscriptions: true, success: () => void refresh() })
}
onMounted(() => void refresh())
onShow(() => void refresh())
</script>

<template>
  <view class="wechat-reminder">
    <view class="reminder-heading"><strong>微信提醒</strong><text>{{ stateLabel }}</text></view>
    <text class="reminder-description">退出小程序，也可在微信「服务通知」查看新消息。一次订阅对应一条提醒，不是永久开启。</text>
    <text v-if="deliveryHint" class="reminder-description">{{ deliveryHint }}</text>
    <text v-if="error" class="reminder-error">{{ error }}</text>
    <view class="reminder-actions">
      <button v-if="status?.available" class="subscribe" :loading="busy" :disabled="busy || loading || (!request && !pending)" @tap="subscribe">{{ pending ? '重试保存订阅' : '接收下一条提醒' }}</button>
      <button v-if="status?.state === 'accepted' || pending" :disabled="busy" @tap="pause">暂停提醒</button>
      <button v-if="status?.state === 'rejected' || error" :disabled="busy" @tap="openSettings">提醒设置</button>
      <button v-if="error || !status?.available" :disabled="busy || loading" @tap="refresh">重新检查</button>
    </view>
  </view>
</template>

<style scoped>
.wechat-reminder { margin-top: 14rpx; padding: 22rpx; border: 1rpx solid #dfe7df; border-radius: 12rpx; background: #f7fbf8; }
.reminder-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.reminder-heading strong { color: #27364a; font-size: 27rpx; }
.reminder-heading text { color: #64706a; font-size: 21rpx; }
.reminder-description, .reminder-error { display: block; margin-top: 10rpx; color: #64706a; font-size: 22rpx; line-height: 1.6; }
.reminder-error { color: #b64238; }
.reminder-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16rpx; margin-top: 16rpx; }
.reminder-actions button { margin: 0; padding: 0 6rpx; border: 0; background: transparent; color: #2d568f; font-size: 23rpx; line-height: 68rpx; }
.reminder-actions .subscribe { padding: 0 24rpx; border-radius: 10rpx; background: #227346; color: #fff; }
.reminder-actions button[disabled] { opacity: .55; }
</style>
