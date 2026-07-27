<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import { apiRequest, uploadPrivateEvidence } from '../../utils/api'
import { dateText } from '../../utils/format'

type FeedbackCategory = 'bug' | 'dossier_correction' | 'invalid_contact' | 'payment_refund' | 'report_abuse' | 'other'
type FeedbackItem = {
  id: string
  category: FeedbackCategory
  subject: string
  content: string
  status: string
  evidence_files?: Array<{ id: string; name: string }>
  payment_purchase_id?: string | null
  admin_reply?: string | null
  replied_at?: string | null
  created_at?: string | null
}

const category = ref<FeedbackCategory>('bug')
const content = ref('')
const paymentPurchaseId = ref('')
const evidencePaths = ref<string[]>([])
const items = ref<FeedbackItem[]>([])
const loading = ref(true)
const uploading = ref(false)
const submitting = ref(false)
const error = ref('')

const categories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'bug', label: '功能故障' },
  { value: 'dossier_correction', label: '档案纠错' },
  { value: 'invalid_contact', label: '联系无效' },
  { value: 'payment_refund', label: '支付退款' },
  { value: 'report_abuse', label: '举报滥用' },
  { value: 'other', label: '其他问题' },
]
const categoryLabel = computed(() => categories.find(item => item.value === category.value)?.label || '问题反馈')

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await apiRequest<FeedbackItem[]>('/lc/site-messages/mine')
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '反馈记录加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function addEvidence() {
  if (evidencePaths.value.length >= 3 || uploading.value) return
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
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    if (message && !message.includes('cancel')) uni.showToast({ title: message, icon: 'none' })
  } finally {
    uploading.value = false
  }
}

async function submit() {
  if (content.value.trim().length < 4) return uni.showToast({ title: '请至少说明 4 个字', icon: 'none' })
  submitting.value = true
  try {
    const result = await apiRequest<{ id: string }>('/lc/site-messages', {
      method: 'POST',
      data: {
        category: category.value,
        subject: categoryLabel.value,
        content: content.value.trim(),
        paymentPurchaseId: paymentPurchaseId.value || null,
      },
    })
    let evidenceWarning = ''
    uploading.value = true
    try {
      for (const filePath of evidencePaths.value) await uploadPrivateEvidence(filePath, 'feedback', result.id)
    } catch (reason) {
      evidenceWarning = `反馈文字已提交，但部分图片上传失败：${(reason as Error).message}`
    }
    content.value = ''
    evidencePaths.value = []
    paymentPurchaseId.value = ''
    if (evidenceWarning) uni.showModal({ title: '反馈已提交', content: evidenceWarning, showCancel: false })
    else uni.showToast({ title: '反馈已提交', icon: 'success' })
    await load()
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function preview(current: string, urls: string[]) {
  uni.previewImage({ current, urls })
}

onLoad(options => {
  const requested = String(options?.category || '')
  if (categories.some(item => item.value === requested)) category.value = requested as FeedbackCategory
  paymentPurchaseId.value = String(options?.purchaseId || '')
  void load()
})
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="帮助与治理" nav-title="问题反馈" title="问题反馈" description="功能故障、资料纠错、无效联系方式和支付问题都可以在这里提交，管理员回复后会进入消息通知。" fallback="/pages/mine/index" />
    <view class="form-surface">
      <text class="field-label">问题类型</text>
      <view class="category-grid">
        <text v-for="option in categories" :key="option.value" :class="{ active: category === option.value }" @tap="category = option.value">{{ option.label }}</text>
      </view>
      <view v-if="paymentPurchaseId" class="order-link"><strong>已关联本次付费记录</strong><text>{{ paymentPurchaseId }}</text></view>
      <text class="field-label">问题说明 *</text>
      <textarea v-model="content" class="textarea" maxlength="2000" placeholder="说明发生了什么、出现在哪个页面，以及你希望平台如何处理。" />
      <view class="evidence-head"><text class="field-label">图片（选填，最多 3 张）</text><text v-if="evidencePaths.length < 3" @tap="addEvidence">添加图片</text></view>
      <view v-if="evidencePaths.length" class="evidence-grid">
        <view v-for="(url, index) in evidencePaths" :key="url">
          <image :src="url" mode="aspectFill" @tap="preview(url, evidencePaths)" />
          <button aria-label="移除图片" @tap="evidencePaths.splice(index, 1)">×</button>
        </view>
      </view>
      <text class="privacy">请勿上传未遮挡的身份证、手机号、住址、聊天对象或其他与处理问题无关的隐私。</text>
      <view class="sticky-submit"><button class="primary-button submit" :loading="submitting" :disabled="submitting || uploading" @tap="submit">提交反馈</button></view>
    </view>

    <text class="section-title">我的反馈</text>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && items.length === 0" empty-text="还没有提交过反馈" @retry="load" />
    <view v-for="item in items" :key="item.id" class="feedback surface">
      <view class="feedback__head"><strong>{{ item.subject }}</strong><text>{{ item.status === 'resolved' ? '已回复' : item.status === 'rejected' ? '已关闭' : '处理中' }}</text></view>
      <text class="feedback__content">{{ item.content }}</text>
      <text v-if="item.evidence_files?.length" class="private-evidence-note">已附 {{ item.evidence_files.length }} 张私密图片，仅本人和管理员可见</text>
      <view v-if="item.admin_reply" class="reply"><strong>管理员回复</strong><text>{{ item.admin_reply }}</text></view>
      <text class="feedback__date">{{ dateText(item.created_at) }}</text>
    </view>
  </view>
</template>

<style scoped>
.category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; }
.category-grid text { padding: 15rpx 6rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 21rpx; }
.category-grid text.active { border-color: #c68a36; background: #fff4df; color: #8b5919; font-weight: 800; }
.order-link { margin-top: 14rpx; padding: 14rpx; border-radius: 8rpx; background: #eef4fb; }
.order-link strong, .order-link text { display: block; }
.order-link strong { color: #275389; font-size: 23rpx; }
.order-link text { margin-top: 4rpx; overflow: hidden; color: #64748b; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.evidence-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.evidence-head > text:last-child { color: #9a651e; font-size: 22rpx; font-weight: 800; }
.evidence-grid, .feedback__images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; }
.evidence-grid view { position: relative; }
.evidence-grid image, .feedback__images image { width: 100%; height: 180rpx; border-radius: 8rpx; background: #f2ece4; }
.evidence-grid button { position: absolute; top: 5rpx; right: 5rpx; width: 42rpx; min-height: 42rpx; margin: 0; padding: 0; border: 0; border-radius: 50%; background: rgba(31,41,55,.78); color: #fff; font-size: 28rpx; line-height: 42rpx; }
.evidence-grid button::after { border: 0; }
.privacy { display: block; margin-top: 12rpx; color: #64748b; font-size: 21rpx; line-height: 1.55; }
.submit { width: 100%; }
.feedback { margin-bottom: 12rpx; padding: 18rpx; }
.feedback__head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.feedback__head strong { color: #27364a; font-size: 25rpx; }
.feedback__head text { color: #9a651e; font-size: 20rpx; }
.feedback__content, .feedback__date { display: block; margin-top: 10rpx; }
.feedback__content { color: #475569; font-size: 23rpx; line-height: 1.65; white-space: pre-wrap; }
.feedback__images { margin-top: 12rpx; }
.feedback__images image { height: 150rpx; }
.reply { margin-top: 12rpx; padding: 13rpx; border-left: 5rpx solid #b9781f; background: #fff8e8; }
.reply strong, .reply text { display: block; }
.reply strong { color: #8b5919; font-size: 21rpx; }
.reply text { margin-top: 5rpx; color: #475569; font-size: 22rpx; line-height: 1.55; }
.feedback__date { color: #98a2b3; font-size: 19rpx; }
.private-evidence-note { display: block; margin-top: 10rpx; color: #64748b; font-size: 20rpx; }
</style>
