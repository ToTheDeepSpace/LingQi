<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import type { Dossier, Script } from '../../types'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'
import { currentDate } from '../../utils/format'

const dms = ref<Dossier[]>([])
const stores = ref<Dossier[]>([])
const scripts = ref<Script[]>([])
const dmId = ref('')
const storeId = ref('')
const scriptId = ref('')
const rating = ref(5)
const playedOn = ref(currentDate())
const replayNumber = ref(1)
const content = ref('')
const tags = ref('')
const loading = ref(true)
const submitting = ref(false)
const formStartedAt = Date.now()
const selectedDm = computed(() => dms.value.find(item => item.id === dmId.value))
const selectedStore = computed(() => stores.value.find(item => item.id === storeId.value))
const selectedScript = computed(() => scripts.value.find(item => item.id === scriptId.value))

async function load(initialDmId = '') {
  try {
    const [dmItems, storeItems, scriptItems] = await Promise.all([
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'),
      apiRequest<Script[]>('/lc/scripts'),
    ])
    dms.value = dmItems; stores.value = storeItems; scripts.value = scriptItems
    dmId.value = initialDmId && dmItems.some(item => item.id === initialDmId) ? initialDmId : dmItems[0]?.id || ''
    storeId.value = storeItems[0]?.id || ''
    scriptId.value = scriptItems[0]?.id || ''
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { loading.value = false }
}

function pickValue<T extends { id: string }>(event: { detail: { value: string } }, list: T[]) { return list[Number(event.detail.value)]?.id || '' }
async function submit() {
  try {
    await requireLogin()
    if (!selectedDm.value) throw new Error('请选择 DM')
    if (!selectedStore.value) throw new Error('请选择本次体验店家')
    if (!selectedScript.value) throw new Error('请选择本次体验剧本')
    if (content.value.trim().length < 12) throw new Error('请至少写 12 个字说明体验')
    submitting.value = true
    await checkMiniContent(`${selectedDm.value.dm_name} ${content.value} ${tags.value}`, 'dm_rating')
    const result = await apiRequest<{ message?: string }>('/lc/dm-ratings', {
      method: 'POST',
      data: {
        dmId: selectedDm.value.id,
        storeDossierId: selectedStore.value.id,
        storeName: selectedStore.value.dm_name,
        scriptId: selectedScript.value.id,
        scriptName: selectedScript.value.name,
        playedOn: playedOn.value,
        replayNumber: replayNumber.value,
        rating: rating.value,
        content: content.value.trim(),
        tags: tags.value.split(/[，,、\n]/).map(tag => tag.trim()).filter(Boolean),
        formStartedAt,
      },
    })
    uni.showModal({ title: '评分已提交', content: result.message || '审核通过后会公开并计入综合分。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) {
    if ((err as Error).message === '发言前请先完成手机号或邮箱验证') {
      uni.showModal({ title: '先完成账号验证', content: '评价前需要绑定手机号。', confirmText: '去绑定', success: result => { if (result.confirm) uni.navigateTo({ url: '/pages/mine/account' }) } })
    } else if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally { submitting.value = false }
}
onLoad(options => { void load(String(options?.dmId || '')) })
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="体验记录" title="评价 DM" description="每一场体验都单独记录，同一玩家不会重复增加综合分权重。" />
    <view v-if="loading" class="surface loading">正在加载...</view>
    <view v-else class="form surface">
      <text class="field-label">DM</text>
      <picker :range="dms" range-key="dm_name" :value="Math.max(0, dms.findIndex(item => item.id === dmId))" @change="dmId = pickValue($event, dms)"><view class="picker-field">{{ selectedDm?.dm_name || '请选择' }}</view></picker>
      <text class="field-label">店家</text>
      <picker :range="stores" range-key="dm_name" :value="Math.max(0, stores.findIndex(item => item.id === storeId))" @change="storeId = pickValue($event, stores)"><view class="picker-field">{{ selectedStore?.dm_name || '请选择' }}</view></picker>
      <text class="field-label">剧本</text>
      <picker :range="scripts" range-key="name" :value="Math.max(0, scripts.findIndex(item => item.id === scriptId))" @change="scriptId = pickValue($event, scripts)"><view class="picker-field">{{ selectedScript?.name || '请选择' }}</view></picker>
      <view class="two-columns">
        <view><text class="field-label">体验日期</text><picker mode="date" :value="playedOn" :end="currentDate()" @change="playedOn = $event.detail.value"><view class="picker-field">{{ playedOn }}</view></picker></view>
        <view><text class="field-label">第几刷</text><input v-model.number="replayNumber" class="input" type="number" /></view>
      </view>
      <text class="field-label">综合评分</text>
      <view class="stars"><text v-for="star in 5" :key="star" :class="{ active: rating >= star }" @tap="rating = star">★</text></view>
      <text class="field-label">体验内容</text>
      <textarea v-model="content" class="textarea" maxlength="2400" placeholder="至少 12 个字，写清楚具体剧本、过程和感受。" />
      <text class="field-label">标签（选填）</text>
      <input v-model="tags" class="input" placeholder="用逗号分隔，例如：控场稳、演绎细腻" />
      <button class="primary-button submit" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button>
    </view>
  </view>
</template>

<style scoped>
.loading, .form { margin-top: 14rpx; padding: 22rpx; }
.loading { color: #64748b; text-align: center; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.stars { display: flex; justify-content: space-between; padding: 14rpx 22rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; }
.stars text { color: #d5d9df; font-size: 54rpx; }
.stars text.active { color: #c88b31; }
.submit { width: 100%; margin-top: 22rpx; }
</style>
