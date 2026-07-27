<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import DossierCreateSheet from '../../components/DossierCreateSheet.vue'
import DossierSearchPicker from '../../components/DossierSearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import type { Dossier, NewDossierDraft, RankingFile, Script } from '../../types'
import { apiRequest, encoded, requireLogin, uploadImageFile } from '../../utils/api'

type RankingType = 'red' | 'black' | 'white'
type SubjectType = 'creator' | 'dm' | 'store' | 'takeaway' | 'player'

const dms = ref<Dossier[]>([])
const stores = ref<Dossier[]>([])
const scripts = ref<Script[]>([])
const type = ref<RankingType>('red')
const subjectType = ref<SubjectType>('dm')
const subjectId = ref('')
const subjectNameInput = ref('')
const subjectCity = ref('')
const newSubject = ref<NewDossierDraft | null>(null)
const createOpen = ref(false)
const createInitialName = ref('')
const eventDate = ref('')
const eventScriptId = ref('')
const eventStoreId = ref('')
const eventLocation = ref('')
const content = ref('')
const showEventDetails = ref(false)
const displayFiles = ref<RankingFile[]>([])
const rulesAccepted = ref(false)
const loading = ref(true)
const uploading = ref(false)
const submitting = ref(false)
const initialSubjectId = ref('')
const initialSubjectType = ref<SubjectType | ''>('')

const typeOptions: Array<{ value: RankingType; label: string; note: string }> = [
  { value: 'red', label: '红榜', note: '值得推荐' },
  { value: 'white', label: '白榜', note: '趣闻与中性记录' },
  { value: 'black', label: '黑榜', note: '风险与负面体验' },
]
const subjectOptions: Array<{ value: SubjectType; label: string }> = [
  { value: 'dm', label: 'DM' }, { value: 'store', label: '店家' }, { value: 'creator', label: '委托人' },
  { value: 'takeaway', label: '外卖' }, { value: 'player', label: '玩家' },
]
const selectedSubject = computed(() => (subjectType.value === 'dm' ? dms.value : stores.value).find(item => item.id === subjectId.value))
const selectedScript = computed(() => scripts.value.find(item => item.id === eventScriptId.value))
const selectedEventStore = computed(() => stores.value.find(item => item.id === eventStoreId.value))
const isDossierSubject = computed(() => subjectType.value === 'dm' || subjectType.value === 'store')

function pickerId<T extends { id: string }>(event: { detail: { value: string } }, items: T[]) {
  return items[Number(event.detail.value)]?.id || ''
}

function applyInitialSelection() {
  if (!initialSubjectId.value || !initialSubjectType.value) return
  subjectType.value = initialSubjectType.value
  const items = subjectType.value === 'dm' ? dms.value : stores.value
  const item = items.find(row => row.id === initialSubjectId.value)
  if (!item) return
  subjectId.value = item.id
  subjectCity.value = item.city || ''
}

async function load() {
  try {
    const [dmItems, storeItems, scriptItems] = await Promise.all([
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'),
      apiRequest<Script[]>('/lc/scripts'),
    ])
    dms.value = dmItems
    stores.value = storeItems
    scripts.value = scriptItems
    applyInitialSelection()
  } catch (err) {
    uni.showToast({ title: (err as Error).message || '基础资料加载失败', icon: 'none' })
  } finally { loading.value = false }
}

function changeSubjectType(value: SubjectType) {
  subjectType.value = value
  subjectId.value = ''
  subjectNameInput.value = ''
  subjectCity.value = ''
  newSubject.value = null
}
function selectSubject(id: string) {
  subjectId.value = id
  newSubject.value = null
  const item = (subjectType.value === 'dm' ? dms.value : stores.value).find(row => row.id === id)
  if (item?.city) subjectCity.value = item.city
}
function startCreate(initialName = '') { createInitialName.value = initialName; createOpen.value = true }
function acceptDraft(draft: NewDossierDraft) {
  newSubject.value = draft
  subjectId.value = ''
  subjectCity.value = draft.city
}

async function chooseImages() {
  try {
    await requireLogin()
    const remaining = 6 - displayFiles.value.length
    if (remaining <= 0) throw new Error('正文配图最多 6 张')
    const picked = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({ count: remaining, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
    })
    uploading.value = true
    for (const path of picked.tempFilePaths) {
      const url = await uploadImageFile(path, 'ranking-display')
      displayFiles.value.push({ name: `口碑配图${displayFiles.value.length + 1}`, url, type: 'image/jpeg' })
    }
  } catch (err) {
    if ((err as Error).message !== '请先登录' && (err as Error).message !== 'chooseImage:fail cancel') {
      uni.showToast({ title: (err as Error).message || '图片上传失败', icon: 'none' })
    }
  } finally { uploading.value = false }
}
function previewImage(index: number) { uni.previewImage({ current: index, urls: displayFiles.value.map(file => file.url) }) }
function removeImage(index: number) { displayFiles.value.splice(index, 1) }

async function submit() {
  try {
    await requireLogin()
    const name = isDossierSubject.value ? (selectedSubject.value?.dm_name || newSubject.value?.name || '') : subjectNameInput.value.trim()
    const city = selectedSubject.value?.city || newSubject.value?.city || subjectCity.value
    if (!name) throw new Error(isDossierSubject.value ? `请选择或新建${subjectType.value === 'dm' ? ' DM' : '店家'}档案` : '请填写对象名称')
    if (!content.value.trim()) throw new Error('请填写具体事件或体验')
    if (!rulesAccepted.value) throw new Error('请先确认发布规则')
    submitting.value = true
    const result = await apiRequest<{ id?: string; message?: string }>('/lc/rankings', {
      method: 'POST',
      data: {
        type: type.value,
        subjectType: subjectType.value,
        subjectName: name,
        subjectCity: city,
        subjectDossierId: selectedSubject.value?.id || null,
        newSubject: newSubject.value ? {
          name: newSubject.value.name,
          workplace: newSubject.value.workplace,
          employmentStatus: newSubject.value.employmentStatus,
          employerStoreId: null,
        } : null,
        eventDate: eventDate.value || null,
        eventScriptId: selectedScript.value?.id || null,
        eventScriptName: selectedScript.value?.name || null,
        eventStoreDossierId: selectedEventStore.value?.id || null,
        eventStoreName: selectedEventStore.value?.dm_name || eventLocation.value.trim() || null,
        content: content.value.trim(),
        initialAmount: 0,
        displayFiles: displayFiles.value,
      },
    })
    uni.showModal({ title: '红黑榜已提交', content: result.message || '内容会进入后台审核，审核通过后公开。', showCancel: false, success: () => uni.switchTab({ url: '/pages/rankings/index' }) })
  } catch (err) {
    const message = (err as Error).message
    if (message === '发言前请先完成手机号或邮箱验证') {
      uni.showModal({ title: '先完成账号验证', content: '发布前需要绑定手机号。', confirmText: '去绑定', success: result => { if (result.confirm) uni.navigateTo({ url: '/pages/mine/account' }) } })
    } else if (message !== '请先登录') uni.showToast({ title: message, icon: 'none' })
  } finally { submitting.value = false }
}

onLoad(options => {
  const requestedType = String(options?.subjectType || '')
  if (requestedType === 'dm' || requestedType === 'store') initialSubjectType.value = requestedType
  initialSubjectId.value = String(options?.subjectDossierId || '')
  if (options?.subjectName) subjectNameInput.value = String(options.subjectName)
  if (options?.subjectCity) subjectCity.value = String(options.subjectCity)
  void load()
})
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="口碑事件" title="发布红黑榜" description="免费发布，黑榜需人工审核；请写清事实并为公开图片做好隐私打码。" fallback="/pages/rankings/index" />
    <view v-if="loading" class="loading">正在加载档案和剧本资料...</view>
    <view v-else class="form-surface">
      <text class="field-label first-label">榜单类型 *</text>
      <view class="type-tabs">
        <view v-for="option in typeOptions" :key="option.value" class="type-option" :class="[`type-option--${option.value}`, { active: type === option.value }]" @tap="type = option.value">
          <strong>{{ option.label }}</strong><text>{{ option.note }}</text>
        </view>
      </view>

      <text class="field-label">对象类型 *</text>
      <view class="subject-tabs">
        <button v-for="option in subjectOptions" :key="option.value" :class="{ active: subjectType === option.value }" @tap="changeSubjectType(option.value)">{{ option.label }}</button>
      </view>

      <template v-if="isDossierSubject">
        <text class="field-label">{{ subjectType === 'dm' ? 'DM' : '店家' }}档案 *</text>
        <DossierSearchPicker :kind="subjectType === 'dm' ? 'dm' : 'store'" :items="subjectType === 'dm' ? dms : stores" :value="subjectId" :draft-label="newSubject?.name" :placeholder="`搜索并选择${subjectType === 'dm' ? ' DM' : '店家'}`" @select="selectSubject" @create="startCreate" />
      </template>
      <template v-else>
        <text class="field-label">对象名称 *</text>
        <input v-model="subjectNameInput" class="input" maxlength="80" placeholder="填写公开称呼" />
      </template>

      <text class="field-label">所在城市（选填）</text>
      <CitySearchPicker :value="subjectCity || '补充城市'" :allow-all="false" @change="subjectCity = $event" />

      <text class="field-label">具体内容 *</text>
      <textarea v-model="content" class="textarea" maxlength="2400" placeholder="写下具体事件或真实体验；时间、地点可以之后再补。" />

      <view class="optional-toggle" @tap="showEventDetails = !showEventDetails">
        <view><strong>补充事件信息</strong><text>{{ eventDate || selectedScript?.name || selectedEventStore?.dm_name || eventLocation || '日期、剧本、发生店家' }}</text></view>
        <text class="optional-toggle__arrow">{{ showEventDetails ? '收起' : '补充' }} ›</text>
      </view>
      <view v-if="showEventDetails" class="event-panel">
        <view class="two-columns">
          <view><text class="field-label compact-label">日期</text><picker mode="date" :value="eventDate" @change="eventDate = $event.detail.value"><view class="picker-field">{{ eventDate || '选择日期' }}</view></picker></view>
          <view><text class="field-label compact-label">剧本</text><picker :range="scripts" range-key="name" :value="Math.max(0, scripts.findIndex(item => item.id === eventScriptId))" @change="eventScriptId = pickerId($event, scripts)"><view class="picker-field">{{ selectedScript?.name || '选择剧本' }}</view></picker></view>
        </view>
        <text class="field-label">发生店家（选填）</text>
        <DossierSearchPicker kind="store" :items="stores" :value="eventStoreId" :allow-create="false" placeholder="搜索并选择店家" @select="eventStoreId = $event" />
        <input v-if="!eventStoreId" v-model="eventLocation" class="input location-input" maxlength="100" placeholder="或填写其他场地（选填）" />
      </view>

      <view class="image-title"><text class="field-label">公开配图（选填，最多 6 张）</text><text>{{ displayFiles.length }}/6</text></view>
      <view v-if="displayFiles.length" class="image-grid">
        <view v-for="(file, index) in displayFiles" :key="file.url" class="image-item">
          <image :src="file.url" mode="aspectFill" @tap="previewImage(index)" />
          <button aria-label="移除图片" @tap="removeImage(index)">×</button>
        </view>
      </view>
      <button v-if="displayFiles.length < 6" class="secondary-button upload-button" :loading="uploading" :disabled="uploading" @tap="chooseImages">{{ uploading ? '上传中' : '选择公开配图' }}</button>

      <checkbox-group class="rules" @change="rulesAccepted = $event.detail.value.includes('accepted')">
        <label><checkbox value="accepted" color="#275389" /> <text>我确认内容来自真实体验，不公开他人隐私，并愿意对事实与言论负责。</text></label>
      </checkbox-group>
      <text class="evidence-note">首发无需提交私密证据；出现异议或审核需要时，可在网站补充材料。</text>
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting || uploading" @tap="submit">提交审核</button></view>
    </view>
    <DossierCreateSheet :open="createOpen" :entity-type="subjectType === 'store' ? 'store' : 'dm'" :initial-name="createInitialName" mode="draft" @close="createOpen = false" @created="acceptDraft" />
  </view>
</template>

<style scoped>
.loading { padding: 48rpx 0; color: #64748b; text-align: center; }
.first-label { margin-top: 0; }
.type-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.type-option { padding: 15rpx 8rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; text-align: center; }
.type-option strong, .type-option text { display: block; }
.type-option strong { color: #27364a; font-size: 26rpx; }
.type-option text { margin-top: 4rpx; color: #7b8492; font-size: 19rpx; }
.type-option--red.active { border-color: #c47d75; background: #fff1ef; }
.type-option--red.active strong { color: #9a3412; }
.type-option--black.active { border-color: #26303f; background: #edf0f4; }
.type-option--white.active { border-color: #d9a857; background: #fff8e8; }
.type-option--white.active strong { color: #8a5a19; }
.subject-tabs { display: flex; flex-wrap: wrap; gap: 9rpx; }
.subject-tabs button { width: auto; min-width: 116rpx; min-height: 64rpx; margin: 0; padding: 0 18rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 23rpx; line-height: 64rpx; }
.subject-tabs button.active { border-color: #7d9bc2; background: #eef6ff; color: #275389; font-weight: 850; }
.section-label { display: block; margin-top: 30rpx; padding-top: 22rpx; border-top: 1rpx solid #eadfce; color: #27364a; font-size: 27rpx; font-weight: 850; }
.optional-toggle { display: flex; min-height: 78rpx; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 16rpx; padding: 0 4rpx; border-top: 1rpx solid #e7e1d8; border-bottom: 1rpx solid #e7e1d8; }
.optional-toggle view { min-width: 0; }
.optional-toggle strong, .optional-toggle view text { display: block; }
.optional-toggle strong { color: #27364a; font-size: 25rpx; }
.optional-toggle view text { margin-top: 3rpx; overflow: hidden; color: #7b8492; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.optional-toggle__arrow { flex: 0 0 auto; color: #275389; font-size: 22rpx; font-weight: 800; }
.event-panel { margin-top: 10rpx; padding: 0 12rpx 14rpx; border: 1rpx solid #dfe7f1; border-radius: 8rpx; background: #f8fbff; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.compact-label { margin-top: 14rpx; }
.location-input { margin-top: 10rpx; }
.image-title { display: flex; align-items: flex-end; justify-content: space-between; color: #7b8492; font-size: 22rpx; }
.image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.image-item { position: relative; aspect-ratio: 1; }
.image-item image { width: 100%; height: 100%; border-radius: 8rpx; background: #f2ece4; }
.image-item button { position: absolute; top: 7rpx; right: 7rpx; width: 46rpx; height: 46rpx; margin: 0; padding: 0; border-radius: 50%; background: rgba(31, 41, 55, 0.82); color: #fff; font-size: 30rpx; line-height: 42rpx; }
.upload-button { width: 100%; margin: 12rpx 0 0; }
.rules { margin-top: 26rpx; padding: 16rpx; border: 1rpx solid #eadfce; border-radius: 8rpx; background: #fffaf0; }
.rules label { display: flex; align-items: flex-start; gap: 8rpx; color: #475569; font-size: 23rpx; line-height: 1.55; }
.evidence-note { display: block; margin-top: 10rpx; color: #7b8492; font-size: 21rpx; line-height: 1.5; }
.submit { width: 100%; margin: 0; }
</style>
