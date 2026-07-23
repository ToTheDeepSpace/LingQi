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

const dms = ref<Dossier[]>([])
const stores = ref<Dossier[]>([])
const scripts = ref<Script[]>([])
const dmId = ref('')
const storeId = ref('')
const newDm = ref<NewDossierDraft | null>(null)
const newStore = ref<NewDossierDraft | null>(null)
const createOpen = ref(false)
const createKind = ref<'dm' | 'store'>('dm')
const createInitialName = ref('')
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
const dmName = computed(() => selectedDm.value?.dm_name || newDm.value?.name || '')
const storeName = computed(() => selectedStore.value?.dm_name || newStore.value?.name || '')

async function load(initialDmId = '') {
  try {
    const [dmItems, storeItems, scriptItems] = await Promise.all([
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'),
      apiRequest<Script[]>('/lc/scripts'),
    ])
    dms.value = dmItems; stores.value = storeItems; scripts.value = scriptItems
    dmId.value = initialDmId && dmItems.some(item => item.id === initialDmId) ? initialDmId : ''
    storeId.value = ''
    scriptId.value = ''
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { loading.value = false }
}

function selectDm(id: string) { dmId.value = id; newDm.value = null }
function selectStore(id: string) { storeId.value = id; newStore.value = null }
function create(kind: 'dm' | 'store', initialName = '') { createKind.value = kind; createInitialName.value = initialName; createOpen.value = true }
function acceptDraft(draft: NewDossierDraft) {
  if (draft.entityType === 'dm') { newDm.value = draft; dmId.value = '' }
  else { newStore.value = draft; storeId.value = '' }
}
async function submit() {
  try {
    await requireLogin()
    if (!selectedDm.value && !newDm.value) throw new Error('请选择 DM，或者新建一个档案')
    if (!selectedStore.value && !newStore.value) throw new Error('请选择本次体验店家，或者新建一个档案')
    if (!selectedScript.value) throw new Error('请选择本次体验剧本')
    if (content.value.trim().length < 12) throw new Error('请至少写 12 个字说明体验')
    submitting.value = true
    await checkMiniContent(`${dmName.value} ${storeName.value} ${content.value} ${tags.value}`, 'dm_rating')
    const result = await apiRequest<{ message?: string }>('/lc/dm-ratings', {
      method: 'POST',
      data: {
        dmId: selectedDm.value?.id,
        newDm: newDm.value ? {
          dmName: newDm.value.name,
          city: newDm.value.city,
          workplace: newDm.value.workplace,
          employmentStatus: newDm.value.employmentStatus,
          photoUrl: newDm.value.photoUrl,
          note: newDm.value.note,
          tags: newDm.value.tags,
        } : undefined,
        storeDossierId: selectedStore.value?.id,
        storeName: storeName.value,
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
    <PageIntro eyebrow="体验记录" title="评价 DM" description="每一场体验都单独记录，同一玩家不会重复增加综合分权重。" fallback="/pages/dm/index" />
    <view v-if="loading" class="loading">正在加载...</view>
    <view v-else class="form-surface">
      <text class="field-label">DM</text>
      <DossierSearchPicker kind="dm" :items="dms" :value="dmId" :draft-label="newDm?.name" placeholder="搜索并选择 DM" @select="selectDm" @create="create('dm', $event)" />
      <text class="field-label">店家</text>
      <DossierSearchPicker kind="store" :items="stores" :value="storeId" :draft-label="newStore?.name" placeholder="搜索并选择店家" @select="selectStore" @create="create('store', $event)" />
      <text class="field-label">剧本</text>
      <ScriptSearchPicker :items="scripts" :value="scriptId" placeholder="搜索并选择本次剧本" @select="scriptId = $event" />
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
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button></view>
    </view>
    <DossierCreateSheet :open="createOpen" :entity-type="createKind" :initial-name="createInitialName" mode="draft" @close="createOpen = false" @created="acceptDraft" />
  </view>
</template>

<style scoped>
.loading { padding: 38rpx 0; color: #64748b; text-align: center; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.stars { display: flex; justify-content: space-between; padding: 14rpx 22rpx; border: 1rpx solid #d9dde4; border-radius: 10rpx; }
.stars text { color: #d5d9df; font-size: 54rpx; }
.stars text.active { color: #c88b31; }
.submit { width: 100%; margin: 0; }
</style>
