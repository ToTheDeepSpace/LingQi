<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import DossierCreateSheet from '../../components/DossierCreateSheet.vue'
import DossierSearchPicker from '../../components/DossierSearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import ScriptSearchPicker from '../../components/ScriptSearchPicker.vue'
import type { Dossier, NewDossierDraft, Script } from '../../types'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'
import { currentDate } from '../../utils/format'

const stores = ref<Dossier[]>([])
const scripts = ref<Script[]>([])
const storeId = ref('')
const newStore = ref<NewDossierDraft | null>(null)
const createOpen = ref(false)
const createInitialName = ref('')
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
const storeName = computed(() => selectedStore.value?.dm_name || newStore.value?.name || '')

async function load(initialStoreId = '') {
  try {
    const [storeItems, scriptItems] = await Promise.all([apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'), apiRequest<Script[]>('/lc/scripts')])
    stores.value = storeItems; scripts.value = scriptItems
    storeId.value = initialStoreId && storeItems.some(item => item.id === initialStoreId) ? initialStoreId : ''
    scriptId.value = ''
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { loading.value = false }
}
function selectStore(id: string) { storeId.value = id; newStore.value = null }
function create(initialName = '') { createInitialName.value = initialName; createOpen.value = true }
function acceptDraft(draft: NewDossierDraft) { newStore.value = draft; storeId.value = '' }
async function submit() {
  try {
    await requireLogin()
    if (!selectedStore.value && !newStore.value) throw new Error('请选择店家，或者新建一个档案')
    if (!selectedScript.value) throw new Error('请选择剧本')
    if (content.value.trim().length < 12) throw new Error('请至少写 12 个字说明到店体验')
    submitting.value = true
    await checkMiniContent(`${storeName.value} ${content.value} ${tags.value}`, 'store_rating')
    const result = await apiRequest<{ message?: string }>('/lc/store-ratings', {
      method: 'POST',
      data: {
        storeDossierId: selectedStore.value?.id,
        newStore: newStore.value ? {
          storeName: newStore.value.name,
          city: newStore.value.city,
          workplace: newStore.value.workplace,
          photoUrl: newStore.value.photoUrl,
          note: newStore.value.note,
          tags: newStore.value.tags,
        } : undefined,
        scriptId: selectedScript.value.id,
        scriptName: selectedScript.value.name,
        visitedOn: visitedOn.value,
        rating: rating.value,
        content: content.value.trim(),
        tags: tags.value.split(/[，,、\n]/).map(tag => tag.trim()).filter(Boolean),
        formStartedAt,
      },
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
    <PageIntro eyebrow="到店体验" title="评价店家" description="记录环境、服务、组织和实际开本体验。" fallback="/pages/stores/index" />
    <view v-if="loading" class="loading">正在加载...</view>
    <view v-else class="form-surface">
      <text class="field-label">店家</text>
      <DossierSearchPicker kind="store" :items="stores" :value="storeId" :draft-label="newStore?.name" placeholder="搜索并选择店家" @select="selectStore" @create="create" />
      <text class="field-label">体验剧本</text>
      <ScriptSearchPicker :items="scripts" :value="scriptId" placeholder="搜索并选择体验剧本" @select="scriptId = $event" />
      <text class="field-label">到店日期</text>
      <picker mode="date" :value="visitedOn" :end="currentDate()" @change="visitedOn = $event.detail.value"><view class="picker-field">{{ visitedOn }}</view></picker>
      <text class="field-label">综合评分</text>
      <view class="stars"><text v-for="star in 5" :key="star" :class="{ active: rating >= star }" @tap="rating = star">★</text></view>
      <text class="field-label">到店体验</text>
      <textarea v-model="content" class="textarea" maxlength="2400" placeholder="至少 12 个字，写清楚环境、服务或开本体验。" />
      <text class="field-label">标签（选填）</text>
      <input v-model="tags" class="input" placeholder="用逗号分隔，例如：环境干净、服务主动" />
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button></view>
    </view>
    <DossierCreateSheet :open="createOpen" entity-type="store" :initial-name="createInitialName" mode="draft" @close="createOpen = false" @created="acceptDraft" />
  </view>
</template>

<style scoped>
.loading { padding: 38rpx 0; color: #64748b; text-align: center; }
.stars { display: flex; justify-content: space-between; padding: 14rpx 22rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; }
.stars text { color: #d5d9df; font-size: 54rpx; }
.stars text.active { color: #c88b31; }
.submit { width: 100%; margin: 0; }
</style>
