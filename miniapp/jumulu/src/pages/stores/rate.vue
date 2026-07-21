<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import type { Dossier, Script } from '../../types'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'
import { currentDate } from '../../utils/format'

const stores = ref<Dossier[]>([])
const scripts = ref<Script[]>([])
const storeId = ref('')
const scriptId = ref('')
const rating = ref(5)
const visitedOn = ref(currentDate())
const content = ref('')
const tags = ref('')
const loading = ref(true)
const submitting = ref(false)
const formStartedAt = Date.now()
const selectedStore = computed(() => stores.value.find(item => item.id === storeId.value))
const selectedScript = computed(() => scripts.value.find(item => item.id === scriptId.value))

async function load(initialStoreId = '') {
  try {
    const [storeItems, scriptItems] = await Promise.all([apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'), apiRequest<Script[]>('/lc/scripts')])
    stores.value = storeItems; scripts.value = scriptItems
    storeId.value = initialStoreId && storeItems.some(item => item.id === initialStoreId) ? initialStoreId : storeItems[0]?.id || ''
    scriptId.value = scriptItems[0]?.id || ''
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { loading.value = false }
}
function pickValue<T extends { id: string }>(event: { detail: { value: string } }, list: T[]) { return list[Number(event.detail.value)]?.id || '' }
async function submit() {
  try {
    await requireLogin()
    if (!selectedStore.value || !selectedScript.value) throw new Error('请选择店家和剧本')
    if (content.value.trim().length < 12) throw new Error('请至少写 12 个字说明到店体验')
    submitting.value = true
    await checkMiniContent(`${selectedStore.value.dm_name} ${content.value} ${tags.value}`, 'store_rating')
    const result = await apiRequest<{ message?: string }>('/lc/store-ratings', {
      method: 'POST',
      data: { storeDossierId: selectedStore.value.id, scriptId: selectedScript.value.id, scriptName: selectedScript.value.name, visitedOn: visitedOn.value, rating: rating.value, content: content.value.trim(), tags: tags.value.split(/[，,、\n]/).map(tag => tag.trim()).filter(Boolean), formStartedAt },
    })
    uni.showModal({ title: '评价已提交', content: result.message || '审核通过后会公开并计入综合分。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) {
    if ((err as Error).message === '发言前请先完成手机号或邮箱验证') uni.showModal({ title: '先完成账号验证', content: '评价前需要绑定手机号。', confirmText: '去绑定', success: result => { if (result.confirm) uni.navigateTo({ url: '/pages/mine/account' }) } })
    else if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally { submitting.value = false }
}
onLoad(options => { void load(String(options?.storeId || '')) })
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="到店体验" title="评价店家" description="记录环境、服务、组织和实际开本体验。" />
    <view v-if="loading" class="surface loading">正在加载...</view>
    <view v-else class="form surface">
      <text class="field-label">店家</text>
      <picker :range="stores" range-key="dm_name" :value="Math.max(0, stores.findIndex(item => item.id === storeId))" @change="storeId = pickValue($event, stores)"><view class="picker-field">{{ selectedStore?.dm_name || '请选择' }}</view></picker>
      <text class="field-label">体验剧本</text>
      <picker :range="scripts" range-key="name" :value="Math.max(0, scripts.findIndex(item => item.id === scriptId))" @change="scriptId = pickValue($event, scripts)"><view class="picker-field">{{ selectedScript?.name || '请选择' }}</view></picker>
      <text class="field-label">到店日期</text>
      <picker mode="date" :value="visitedOn" :end="currentDate()" @change="visitedOn = $event.detail.value"><view class="picker-field">{{ visitedOn }}</view></picker>
      <text class="field-label">综合评分</text>
      <view class="stars"><text v-for="star in 5" :key="star" :class="{ active: rating >= star }" @tap="rating = star">★</text></view>
      <text class="field-label">到店体验</text>
      <textarea v-model="content" class="textarea" maxlength="2400" placeholder="至少 12 个字，写清楚环境、服务或开本体验。" />
      <text class="field-label">标签（选填）</text>
      <input v-model="tags" class="input" placeholder="用逗号分隔，例如：环境干净、服务主动" />
      <button class="primary-button submit" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button>
    </view>
  </view>
</template>

<style scoped>
.loading, .form { margin-top: 14rpx; padding: 22rpx; }
.loading { color: #64748b; text-align: center; }
.stars { display: flex; justify-content: space-between; padding: 14rpx 22rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; }
.stars text { color: #d5d9df; font-size: 54rpx; }
.stars text.active { color: #c88b31; }
.submit { width: 100%; margin-top: 22rpx; }
</style>
