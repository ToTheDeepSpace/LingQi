<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AuthFormGate from '../../components/AuthFormGate.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, decoded, requireLogin, uploadPrivateEvidence } from '../../utils/api'

const targetType = ref('')
const targetId = ref('')
const targetSubId = ref('')
const title = ref('')
const reason = ref('虚假信息')
const description = ref('')
const evidencePaths = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const reasons = ['侵犯隐私', '虚假信息', '辱骂攻击', '诈骗或导流', '色情或未成年人', '侵权或盗图', '其他问题']

onLoad(options => {
  targetType.value = String(options?.targetType || '')
  targetId.value = String(options?.targetId || '')
  targetSubId.value = String(options?.targetSubId || '')
  title.value = decoded(options?.title || '相关内容')
})

async function addEvidence() {
  if (uploading.value || evidencePaths.value.length >= 3) return
  try {
    const selected = await new Promise<string[]>((resolve, reject) => {
      uni.chooseMedia({
        count: 3 - evidencePaths.value.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: result => resolve((result.tempFiles || []).map(item => item.tempFilePath).filter(Boolean)),
        fail: reject,
      })
    })
    evidencePaths.value.push(...selected)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message && !message.includes('cancel')) uni.showToast({ title: message, icon: 'none' })
  } finally {
    uploading.value = false
  }
}

async function submit() {
  if (reason.value === '侵犯隐私' && description.value.trim().length < 10) {
    uni.showToast({ title: '请说明具体隐私项和出现位置，至少10个字', icon: 'none' })
    return
  }
  try {
    await requireLogin()
    submitting.value = true
    const result = await apiRequest<{ id: string }>('/lc/reports', {
      method: 'POST',
      data: {
        targetType: targetType.value,
        targetId: targetId.value,
        targetSubId: targetSubId.value || null,
        reason: reason.value,
        description: description.value.trim(),
      },
    })
    let evidenceWarning = ''
    uploading.value = true
    try {
      for (const filePath of evidencePaths.value) await uploadPrivateEvidence(filePath, 'report', result.id)
    } catch (reason) {
      evidenceWarning = `文字已经提交，但部分图片上传失败：${(reason as Error).message}`
    }
    uni.showModal({
      title: '举报已提交',
      content: evidenceWarning || '管理员会在网站后台复核。举报不是自动删帖，紧急隐私风险会优先处理。',
      showCancel: false,
      success: () => uni.navigateBack(),
    })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}

function previewEvidence(current: string) {
  uni.previewImage({ current, urls: evidencePaths.value })
}
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="内容治理" title="提交举报" :description="`举报对象：${title}`" />
    <AuthFormGate message="登录后才能提交举报">
    <view class="form-surface">
      <text class="field-label">举报原因</text>
      <view class="reason-grid">
        <text v-for="option in reasons" :key="option" class="reason" :class="{ active: reason === option }" @tap="reason = option">{{ option }}</text>
      </view>
      <text class="field-label">具体说明{{ reason === '侵犯隐私' ? '（必填）' : '（选填）' }}</text>
      <textarea
        v-model="description"
        class="textarea"
        maxlength="800"
        :placeholder="reason === '侵犯隐私'
          ? '请说明具体是哪项隐私，以及出现在页面、正文或哪张图片的什么位置。请勿重复粘贴敏感信息。'
          : '可以写明具体位置、问题和希望平台核查的事实。'"
      />
      <text v-if="reason === '侵犯隐私'" class="privacy-detail-tip">至少 10 个字。只写“侵犯隐私”无法帮助管理员定位问题。</text>
      <view class="evidence-head"><text class="field-label">证据图片（选填，最多 3 张）</text><text v-if="evidencePaths.length < 3" @tap="addEvidence">添加图片</text></view>
      <view v-if="evidencePaths.length" class="evidence-grid">
        <view v-for="(url, index) in evidencePaths" :key="url">
          <image :src="url" mode="aspectFill" @tap="previewEvidence(url)" />
          <button aria-label="移除图片" @tap="evidencePaths.splice(index, 1)">×</button>
        </view>
      </view>
      <text class="privacy">举报会进入管理员队列，不会因为单次举报自动删除内容。请勿上传未遮挡的身份证、手机号或无关聊天隐私。</text>
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting || uploading" @tap="submit">提交举报</button></view>
    </view>
    </AuthFormGate>
  </view>
</template>

<style scoped>
.reason-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10rpx; }
.reason { padding: 16rpx 8rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 23rpx; }
.reason.active { border-color: #c68a36; background: #fff4df; color: #8b5919; font-weight: 800; }
.evidence-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.evidence-head > text:last-child { color: #9a651e; font-size: 22rpx; font-weight: 800; }
.evidence-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; }
.evidence-grid view { position: relative; }
.evidence-grid image { width: 100%; height: 180rpx; border-radius: 8rpx; background: #f2ece4; }
.evidence-grid button { position: absolute; top: 5rpx; right: 5rpx; width: 42rpx; min-height: 42rpx; margin: 0; padding: 0; border: 0; border-radius: 50%; background: rgba(31,41,55,.78); color: #fff; font-size: 28rpx; line-height: 42rpx; }
.evidence-grid button::after { border: 0; }
.privacy { display: block; margin-top: 12rpx; color: #64748b; font-size: 21rpx; line-height: 1.55; }
.privacy-detail-tip { display: block; margin-top: -6rpx; color: #9a651e; font-size: 21rpx; line-height: 1.5; }
.submit { width: 100%; margin: 0; }
</style>
