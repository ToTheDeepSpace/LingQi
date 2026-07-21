<script setup lang="ts">
import { ref, watch } from 'vue'
import CitySearchPicker from './CitySearchPicker.vue'
import type { NewDossierDraft } from '../types'
import { apiRequest, checkMiniContent, requireLogin, uploadImageFile } from '../utils/api'

const props = withDefaults(defineProps<{
  open: boolean
  entityType: 'dm' | 'store'
  initialName?: string
  mode?: 'submit' | 'draft'
}>(), { initialName: '', mode: 'submit' })

const emit = defineEmits<{
  close: []
  created: [draft: NewDossierDraft, result?: { id?: string; status?: string }]
}>()

const name = ref('')
const city = ref('')
const workplace = ref('')
const employmentStatus = ref<'unknown' | 'freelance'>('unknown')
const note = ref('')
const tags = ref('')
const photoUrl = ref('')
const uploading = ref(false)
const submitting = ref(false)

watch(() => props.open, value => {
  if (!value) return
  name.value = props.initialName || ''
  city.value = String(uni.getStorageSync(props.entityType === 'dm' ? 'jumulu:dm:last-city' : 'jumulu:store:last-city') || '')
  if (city.value === '全部城市') city.value = ''
  workplace.value = ''
  employmentStatus.value = 'unknown'
  note.value = ''
  tags.value = ''
  photoUrl.value = ''
})

function draftValue(): NewDossierDraft {
  return {
    entityType: props.entityType,
    name: name.value.trim(),
    city: city.value.trim(),
    workplace: employmentStatus.value === 'freelance' ? '' : workplace.value.trim(),
    employmentStatus: employmentStatus.value,
    photoUrl: photoUrl.value,
    note: note.value.trim(),
    tags: tags.value.split(/[，,、/\n]/).map(value => value.trim()).filter(Boolean).slice(0, 10),
  }
}

async function choosePhoto() {
  try {
    await requireLogin()
    const picked = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
    })
    const path = picked.tempFilePaths[0]
    if (!path) return
    uploading.value = true
    photoUrl.value = await uploadImageFile(path, props.entityType === 'dm' ? 'dm-dossier' : 'store-dossier')
    uni.showToast({ title: '照片已上传', icon: 'success' })
  } catch (err) {
    if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message || '照片上传失败', icon: 'none' })
  } finally { uploading.value = false }
}

async function submit() {
  try {
    await requireLogin()
    const draft = draftValue()
    if (!draft.name) throw new Error(`请填写${props.entityType === 'dm' ? 'DM' : '店家'}名称`)
    if (!draft.city) throw new Error('请选择城市')
    if (props.entityType === 'store' && !draft.workplace) throw new Error('请填写店家地址、商圈或常驻位置')
    submitting.value = true
    await checkMiniContent([draft.name, draft.city, draft.workplace, draft.note, ...draft.tags].join(' '), props.entityType === 'dm' ? 'dm_dossier_submit' : 'store_dossier_submit')
    if (props.mode === 'draft') {
      emit('created', draft)
      emit('close')
      return
    }
    const result = await apiRequest<{ id?: string; status?: string }>('/lc/dm-dossiers', {
      method: 'POST',
      data: {
        entityType: draft.entityType,
        dmName: draft.name,
        city: draft.city,
        workplace: draft.workplace,
        employmentStatus: draft.employmentStatus,
        photoUrl: draft.photoUrl,
        photoFiles: draft.photoUrl ? [{ name: `${draft.name}照片`, url: draft.photoUrl, type: 'image/jpeg' }] : [],
        note: draft.note,
        tags: draft.tags,
      },
    })
    emit('created', draft, result)
    emit('close')
  } catch (err) {
    const message = (err as Error).message
    if (message === '发言前请先完成手机号或邮箱验证') {
      uni.showModal({ title: '先完成账号验证', content: '建档前需要绑定手机号。', confirmText: '去绑定', success: result => { if (result.confirm) uni.navigateTo({ url: '/pages/mine/account' }) } })
    } else if (message !== '请先登录') uni.showToast({ title: message, icon: 'none' })
  } finally { submitting.value = false }
}
</script>

<template>
  <view v-if="open" class="create-mask" @tap="$emit('close')">
    <view class="create-sheet" @tap.stop>
      <view class="create-sheet__head">
        <view>
          <text class="create-sheet__eyebrow">社区提供</text>
          <text class="create-sheet__title">新建{{ entityType === 'dm' ? ' DM' : '店家' }}档案</text>
        </view>
        <button class="create-sheet__close" aria-label="关闭" @tap="$emit('close')">×</button>
      </view>
      <scroll-view class="create-sheet__body" scroll-y enhanced>
        <text class="create-note">{{ mode === 'draft' ? '档案会与本次评价一起提交审核。' : '提交后进入网站后台审核，审核通过后公开展示。' }}无需提交证据。</text>
        <text class="field-label">{{ entityType === 'dm' ? 'DM 名称' : '店家名称' }} *</text>
        <input v-model="name" class="input" maxlength="80" :placeholder="entityType === 'dm' ? '填写常用艺名或公开称呼' : '填写完整店名'" />
        <text class="field-label">城市 *</text>
        <CitySearchPicker :value="city || '请选择城市'" :allow-all="false" @change="city = $event" />
        <template v-if="entityType === 'dm'">
          <text class="field-label">任职信息（选填）</text>
          <view class="employment-tabs">
            <button class="employment-button" :class="{ active: employmentStatus === 'unknown' }" @tap="employmentStatus = 'unknown'">暂不确定</button>
            <button class="employment-button" :class="{ active: employmentStatus === 'freelance' }" @tap="employmentStatus = 'freelance'; workplace = ''">自由 DM</button>
          </view>
          <input v-if="employmentStatus === 'unknown'" v-model="workplace" class="input" maxlength="160" placeholder="可填写店名或工作地点，也可以留空" />
        </template>
        <template v-else>
          <text class="field-label">地址、商圈或常驻位置 *</text>
          <input v-model="workplace" class="input" maxlength="160" placeholder="例如：朝阳区三里屯 / XX 商场 3 层" />
        </template>
        <text class="field-label">照片（选填）</text>
        <view class="photo-row">
          <image v-if="photoUrl" class="photo-preview" :src="photoUrl" mode="aspectFill" />
          <button class="secondary-button photo-button" :loading="uploading" :disabled="uploading" @tap="choosePhoto">{{ photoUrl ? '更换照片' : '上传照片' }}</button>
          <button v-if="photoUrl" class="photo-remove" aria-label="移除照片" @tap="photoUrl = ''">×</button>
        </view>
        <text class="field-label">补充说明（选填）</text>
        <textarea v-model="note" class="textarea compact-textarea" maxlength="600" :placeholder="entityType === 'dm' ? '可补充常开剧本、风格或公开经历' : '可补充环境、主营类型或公开介绍'" />
        <text class="field-label">标签（选填）</text>
        <input v-model="tags" class="input" maxlength="180" placeholder="用逗号分隔" />
      </scroll-view>
      <view class="create-sheet__footer">
        <button class="secondary-button footer-button" @tap="$emit('close')">取消</button>
        <button class="primary-button footer-button" :loading="submitting" :disabled="submitting || uploading" @tap="submit">{{ mode === 'draft' ? '选用新档案' : '提交审核' }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.create-mask { position: fixed; z-index: 950; inset: 0; display: flex; align-items: flex-end; background: rgba(15, 23, 42, 0.48); }
.create-sheet { display: flex; flex-direction: column; width: 100%; max-height: 90vh; border-radius: 16rpx 16rpx 0 0; background: #fffdf8; }
.create-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 24rpx 24rpx 16rpx; border-bottom: 1rpx solid #eadfce; }
.create-sheet__eyebrow, .create-sheet__title { display: block; }
.create-sheet__eyebrow { color: #9a651e; font-size: 21rpx; font-weight: 850; }
.create-sheet__title { margin-top: 4rpx; color: #1f2937; font-size: 31rpx; font-weight: 900; }
.create-sheet__close { width: 64rpx; height: 64rpx; margin: 0; padding: 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 40rpx; line-height: 58rpx; }
.create-sheet__body { min-height: 0; flex: 1; padding: 0 24rpx 24rpx; }
.create-note { display: block; margin-top: 18rpx; padding: 14rpx 16rpx; border-left: 5rpx solid #c88b31; background: #fff6e7; color: #72501f; font-size: 22rpx; line-height: 1.55; }
.employment-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 10rpx; }
.employment-button { min-height: 66rpx; margin: 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #475569; font-size: 24rpx; line-height: 66rpx; }
.employment-button.active { border-color: #c88b31; background: #fff5df; color: #8b5919; font-weight: 850; }
.photo-row { display: flex; align-items: center; gap: 12rpx; }
.photo-preview { width: 92rpx; height: 92rpx; flex: 0 0 auto; border-radius: 8rpx; background: #f2ece4; }
.photo-button { min-height: 66rpx; margin: 0; line-height: 66rpx; }
.photo-remove { width: 58rpx; height: 58rpx; margin: 0 0 0 auto; padding: 0; border: 1rpx solid #e3c8c4; border-radius: 8rpx; background: #fff; color: #a53232; font-size: 34rpx; line-height: 54rpx; }
.compact-textarea { min-height: 150rpx; }
.create-sheet__footer { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12rpx; padding: 16rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #eadfce; background: #fffdf8; }
.footer-button { width: 100%; margin: 0; }
</style>
