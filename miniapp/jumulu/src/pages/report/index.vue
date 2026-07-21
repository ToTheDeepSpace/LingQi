<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'

const targetType = ref('')
const targetId = ref('')
const title = ref('')
const reason = ref('事实不实')
const description = ref('')
const submitting = ref(false)
const reasons = ['事实不实', '侵犯隐私', '侮辱攻击', '诈骗风险', '违法违规', '其他问题']

onLoad(options => {
  targetType.value = String(options?.targetType || '')
  targetId.value = String(options?.targetId || '')
  title.value = decodeURIComponent(String(options?.title || '相关内容'))
})

async function submit() {
  try {
    await requireLogin()
    if (!description.value.trim()) throw new Error('请说明具体问题，便于管理员复核')
    submitting.value = true
    await checkMiniContent(`${reason.value} ${description.value}`, 'report')
    await apiRequest('/lc/reports', { method: 'POST', data: { targetType: targetType.value, targetId: targetId.value, reason: reason.value, description: description.value.trim() } })
    uni.showModal({ title: '举报已提交', content: '管理员会在网站后台复核。举报不是自动删帖，紧急隐私风险会优先处理。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="内容治理" title="提交举报" :description="`举报对象：${title}`" />
    <view class="form-surface">
      <text class="field-label">举报原因</text>
      <view class="reason-grid">
        <text v-for="option in reasons" :key="option" class="reason" :class="{ active: reason === option }" @tap="reason = option">{{ option }}</text>
      </view>
      <text class="field-label">具体说明</text>
      <textarea v-model="description" class="textarea" maxlength="800" placeholder="写明具体位置、问题和希望平台核查的事实。" />
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting" @tap="submit">提交举报</button></view>
    </view>
  </view>
</template>

<style scoped>
.reason-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10rpx; }
.reason { padding: 16rpx 8rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 23rpx; }
.reason.active { border-color: #c68a36; background: #fff4df; color: #8b5919; font-weight: 800; }
.submit { width: 100%; margin: 0; }
</style>
