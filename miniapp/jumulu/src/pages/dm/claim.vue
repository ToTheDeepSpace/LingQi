<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, decoded, encoded, requestServicePayment, submitDossierClaim } from '../../utils/api'

type EntityType = 'dm' | 'store'
type ClaimState = {
  claim: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    reject_reason?: string | null
    claim_note?: string | null
    proof_type?: string | null
  } | null
  payment: { paid: boolean; amount_yuan: string }
}

const id = ref('')
const name = ref('')
const entityType = ref<EntityType>('dm')
const state = ref<ClaimState | null>(null)
const proofType = ref('')
const claimNote = ref('')
const proofFilePath = ref('')
const paying = ref(false)
const submitting = ref(false)
const loading = ref(true)
const error = ref('')

const options = computed(() => entityType.value === 'store'
  ? [
      { value: 'business_license', label: '营业执照' },
      { value: 'store_backend', label: '店铺后台' },
      { value: 'other_store_proof', label: '其他经营证明' },
    ]
  : [
      { value: 'social_account', label: '本人社交账号' },
      { value: 'employment_proof', label: '任职证明' },
      { value: 'other_dm_proof', label: '其他身份证明' },
    ])

async function load() {
  loading.value = true
  error.value = ''
  try {
    state.value = await apiRequest<ClaimState>(`/lc/dm-dossiers/${encoded(id.value)}/my-claim`)
    if (state.value.claim?.status === 'rejected') {
      claimNote.value = state.value.claim.claim_note || ''
      proofType.value = state.value.claim.proof_type || options.value[0].value
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '认领状态加载失败'
  } finally {
    loading.value = false
  }
}

async function chooseProof() {
  try {
    const result = await new Promise<UniApp.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
      uni.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
    })
    proofFilePath.value = result.tempFiles?.[0]?.tempFilePath || ''
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    if (message && !message.includes('cancel')) uni.showToast({ title: message, icon: 'none' })
  }
}

async function pay() {
  if (paying.value) return
  paying.value = true
  try {
    await requestServicePayment('dossier_claim', id.value)
    state.value = { ...(state.value || { claim: null, payment: { paid: false, amount_yuan: '8.88' } }), payment: { paid: true, amount_yuan: '8.88' } }
    uni.showToast({ title: '支付成功', icon: 'success' })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    paying.value = false
  }
}

async function submit() {
  if (!state.value?.payment.paid) return void pay()
  if (!proofType.value) return uni.showToast({ title: '请选择证明类型', icon: 'none' })
  if (claimNote.value.trim().length < 6) return uni.showToast({ title: '请至少填写 6 个字', icon: 'none' })
  if (!proofFilePath.value) return uni.showToast({ title: '请上传一张证明截图', icon: 'none' })
  submitting.value = true
  try {
    await submitDossierClaim({
      dossierId: id.value,
      proofType: proofType.value,
      claimNote: claimNote.value.trim(),
      proofFilePath: proofFilePath.value,
    })
    uni.showModal({
      title: '认领申请已提交',
      content: '管理员会核验材料。审核通过后，这份档案会绑定到你的账号。',
      showCancel: false,
      success: () => uni.navigateBack(),
    })
  } catch (reason) {
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad(optionsValue => {
  id.value = String(optionsValue?.id || '')
  name.value = decoded(optionsValue?.name || '相关档案')
  entityType.value = optionsValue?.entityType === 'store' ? 'store' : 'dm'
  proofType.value = options.value[0].value
  void load()
})
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="本人认证" nav-title="认领档案" :title="`认领「${name}」`" description="认领费 8.88 元用于资料真实性核验。认领成功后可以持续修改资料，修改免费但仍需审核。" />
    <view v-if="loading" class="surface loading">正在读取认领状态…</view>
    <view v-else class="form-surface">
      <view v-if="state?.claim?.status === 'pending'" class="status">这份认领申请正在审核，无需重复提交。</view>
      <view v-else-if="state?.claim?.status === 'rejected'" class="status rejected">上次申请未通过：{{ state.claim.reject_reason || '请补充更清楚的证明后重新提交' }}</view>
      <template v-if="state?.claim?.status !== 'pending'">
        <view class="fee-row">
          <view><strong>认领审核服务费</strong><text>{{ state?.payment.paid ? '已经支付，不会重复收费' : '支付后再提交证明材料' }}</text></view>
          <strong>{{ state?.payment.paid ? '已支付' : '¥8.88' }}</strong>
        </view>
        <text class="field-label">证明类型</text>
        <view class="proof-options">
          <text v-for="option in options" :key="option.value" :class="{ active: proofType === option.value }" @tap="proofType = option.value">{{ option.label }}</text>
        </view>
        <text class="field-label">关系说明 *</text>
        <textarea v-model="claimNote" class="textarea" maxlength="600" placeholder="说明你为什么是这份档案的本人或经营者，至少 6 个字。" />
        <text class="field-label">证明截图 *</text>
        <view class="proof-upload" @tap="chooseProof">
          <image v-if="proofFilePath" :src="proofFilePath" mode="aspectFill" />
          <text v-else>上传 1 张能够证明身份的截图</text>
        </view>
        <text class="privacy">材料仅供管理员核验，不会公开。请遮住身份证号、手机号、聊天对象等无关信息。</text>
        <text v-if="error" class="form-error">{{ error }}</text>
        <view class="sticky-submit">
          <button class="primary-button submit" :loading="paying || submitting" :disabled="paying || submitting" @tap="submit">
            {{ state?.payment.paid ? '提交认领审核' : '支付 8.88 元' }}
          </button>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.loading { margin-top: 14rpx; padding: 36rpx; color: #64748b; text-align: center; }
.status { margin-bottom: 16rpx; padding: 16rpx; border-radius: 8rpx; background: #fff6e4; color: #8b5919; font-size: 23rpx; line-height: 1.55; }
.status.rejected { background: #fff1f0; color: #a53232; }
.fee-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 16rpx; border: 1rpx solid #e7c88c; border-radius: 8rpx; background: #fff8e8; }
.fee-row strong, .fee-row text { display: block; }
.fee-row > strong { color: #9a651e; font-size: 29rpx; }
.fee-row view strong { color: #27364a; font-size: 25rpx; }
.fee-row view text { margin-top: 5rpx; color: #735b39; font-size: 21rpx; }
.proof-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; }
.proof-options text { padding: 15rpx 8rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; color: #64748b; text-align: center; font-size: 21rpx; }
.proof-options text.active { border-color: #c68a36; background: #fff4df; color: #8b5919; font-weight: 800; }
.proof-upload { display: flex; align-items: center; justify-content: center; width: 100%; height: 260rpx; border: 1rpx dashed #d2a867; border-radius: 8rpx; background: #fffaf0; color: #8b5919; font-size: 23rpx; }
.proof-upload image { width: 100%; height: 100%; border-radius: 8rpx; }
.privacy { display: block; margin-top: 12rpx; color: #64748b; font-size: 21rpx; line-height: 1.55; }
.form-error { display: block; margin-top: 12rpx; color: #a53232; font-size: 22rpx; }
.submit { width: 100%; }
</style>
