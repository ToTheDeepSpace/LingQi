<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AuthFormGate from '../../components/AuthFormGate.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, decoded, encoded, readAuth, requestServicePayment, submitDossierClaim } from '../../utils/api'

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
  store_code?: { store_name: string } | null
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
const storeCode = ref('')
const issuer = ref('')
const affiliationConfirmed = ref(false)
const truthConfirmed = ref(false)
const fee = computed(() => entityType.value === 'store' ? '90' : '9')
const codeMode = computed(() => entityType.value === 'dm' && Boolean(storeCode.value.trim() || state.value?.store_code))
const description = computed(() => entityType.value === 'store'
  ? '90元永久认证（暂行）。人工审核通过后赠送11个一次性DM认证码；每90元可加购11个。'
  : '本人认领9元，或使用店家认证码免付。均需人工审核；用码认证通过后自动绑定发码店家。')
function openAccount() { uni.navigateTo({ url: '/pages/mine/account' }) }

const options = computed(() => entityType.value === 'store'
  ? [
      { value: 'business_license', label: '营业执照' },
      { value: 'store_backend', label: '店铺后台' },
      { value: 'other', label: '其他经营证明' },
    ]
  : [
      { value: 'social_account', label: '本人社交账号' },
      { value: 'employment', label: '任职证明' },
      { value: 'other', label: '其他身份证明' },
    ])

async function load() {
  loading.value = true
  error.value = ''
  try {
    state.value = await apiRequest<ClaimState>(`/lc/dm-dossiers/${encoded(id.value)}/my-claim`)
    issuer.value = state.value.store_code?.store_name || ''
    if (state.value.claim?.status === 'rejected') {
      if (!claimNote.value) claimNote.value = state.value.claim.claim_note || ''
      if (!proofType.value) proofType.value = state.value.claim.proof_type || options.value[0].value
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

async function previewCode() {
  affiliationConfirmed.value = false
  try {
    const result = await apiRequest<{ store_name: string } | null>(`/lc/dm-dossiers/${encoded(id.value)}/store-code-preview`, { method: 'POST', data: { code: storeCode.value.trim() } })
    issuer.value = result?.store_name || ''
  } catch (reason) {
    issuer.value = ''
    uni.showToast({ title: (reason as Error).message, icon: 'none' })
  }
}

async function submit() {
  if (submitting.value || paying.value || !state.value) return
  if (!proofType.value) return uni.showToast({ title: '请选择证明类型', icon: 'none' })
  if (claimNote.value.trim().length < 6) return uni.showToast({ title: '请至少填写 6 个字', icon: 'none' })
  if (!proofFilePath.value) return uni.showToast({ title: '请上传一张证明截图', icon: 'none' })
  if (!truthConfirmed.value) return uni.showToast({ title: '请确认材料真实且有权提交', icon: 'none' })
  if (codeMode.value && (!issuer.value || !affiliationConfirmed.value)) return uni.showToast({ title: '请核验认证码并确认店家关系', icon: 'none' })
  submitting.value = true
  try {
    if (!codeMode.value && !state.value.payment.paid) {
      paying.value = true
      await requestServicePayment(entityType.value === 'store' ? 'store_certification' : 'dossier_claim', id.value)
      state.value.payment.paid = true
      paying.value = false
    }
    await submitDossierClaim({
      dossierId: id.value,
      proofType: proofType.value,
      claimNote: claimNote.value.trim(),
      proofFilePath: proofFilePath.value,
      storeCode: storeCode.value.trim(),
      useStoreCode: codeMode.value,
      storeAffiliationConfirmed: affiliationConfirmed.value,
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
    paying.value = false
  }
}

onLoad(optionsValue => {
  id.value = String(optionsValue?.id || '')
  name.value = decoded(optionsValue?.name || '相关档案')
  entityType.value = optionsValue?.entityType === 'store' ? 'store' : 'dm'
  proofType.value = options.value[0].value
})
onShow(() => { if (id.value && readAuth()?.token && !submitting.value) void load() })
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="人工认证" nav-title="认领档案" :title="`认领「${name}」`" :description="description" />
    <AuthFormGate message="登录后才能认领档案">
    <view v-if="loading" class="surface loading">正在读取认领状态…</view>
    <view v-else-if="error && !state" class="surface loading" @tap="load">{{ error }} · 点击重试</view>
    <view v-else class="form-surface">
      <view v-if="state?.claim?.status === 'pending'" class="status">这份认领申请正在审核，无需重复提交。</view>
      <view v-else-if="state?.claim?.status === 'rejected'" class="status rejected">上次申请未通过：{{ state.claim.reject_reason || '请补充更清楚的证明后重新提交' }}</view>
      <view v-if="state?.claim?.status === 'approved'" class="status">认证已通过。店家可在“我的 → 店家认证与名额”管理认证码。</view>
      <template v-if="state?.claim?.status !== 'pending' && state?.claim?.status !== 'approved'">
        <view class="fee-row">
          <view><strong>{{ entityType === 'store' ? '店家永久认证（含11码）' : '本人认领审核' }}</strong><text>{{ codeMode ? '用码免付9元，仍需人工审核' : state?.payment.paid ? '已经支付，补材料不重复收费' : '填好材料后支付并提交审核' }}</text></view>
          <strong>{{ codeMode ? '¥0' : state?.payment.paid ? '已支付' : '¥' + fee }}</strong>
        </view>
        <view v-if="entityType === 'dm' && !state?.payment.paid">
          <text class="field-label">店家认证码（选填）</text>
          <text v-if="state?.store_code" class="privacy">已预留认证码给本账号、本档案，补材料可直接重提。</text>
          <input v-else v-model="storeCode" class="code-input" maxlength="13" placeholder="JML-XXXX-XXXX" @input="issuer = ''; affiliationConfirmed = false" />
          <button v-if="codeMode" class="secondary-button" @tap="previewCode">核验发码店家</button>
          <view v-if="issuer" class="status">发码店家：{{ issuer }}
            <view @tap="affiliationConfirmed = !affiliationConfirmed">{{ affiliationConfirmed ? '☑' : '☐' }} 我同意审核通过后自动绑定该店家关系</view>
          </view>
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
        <view class="privacy" @tap="truthConfirmed = !truthConfirmed">{{ truthConfirmed ? '☑' : '☐' }} 我确认材料真实且有权提交，理解付款或用码不代表审核通过。</view>
        <text class="privacy" @tap="openAccount">店家认证及用码前请完成手机号验证</text>
        <text v-if="error" class="form-error">{{ error }}</text>
        <view class="sticky-submit">
          <button class="primary-button submit" :loading="paying || submitting" :disabled="paying || submitting" @tap="submit">
            {{ codeMode || state?.payment.paid ? '提交认领审核' : '支付 ' + fee + ' 元并提交审核' }}
          </button>
        </view>
      </template>
    </view>
    </AuthFormGate>
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
.code-input { margin: 12rpx 0; padding: 20rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; font-size: 28rpx; }
</style>
