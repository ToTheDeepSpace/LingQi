<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import type { AuthSession } from '../../types'
import { apiRequest, readAuth, writeAuth } from '../../utils/api'

const auth = ref<AuthSession | null>(readAuth())
const phone = ref('')
const code = ref('')
const sending = ref(false)
const binding = ref(false)
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

async function sendCode() {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) return uni.showToast({ title: '请填写正确手机号', icon: 'none' })
  try {
    sending.value = true
    await apiRequest('/lc/auth/send-code', { method: 'POST', data: { phone: phone.value } })
    countdown.value = 60
    timer = setInterval(() => { countdown.value -= 1; if (countdown.value <= 0 && timer) { clearInterval(timer); timer = null } }, 1000)
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { sending.value = false }
}
async function bindPhone() {
  if (!/^\d{4,8}$/.test(code.value)) return uni.showToast({ title: '请填写短信验证码', icon: 'none' })
  try {
    binding.value = true
    const result = await apiRequest<AuthSession>('/lc/auth/bind-phone', { method: 'POST', data: { phone: phone.value, code: code.value } })
    const next = { ...(auth.value || {}), ...result } as AuthSession
    writeAuth(next); auth.value = next; uni.$emit('jumulu:auth-changed', next)
    uni.showModal({
      title: result.account_merged ? '账号已合并' : '手机号已验证',
      content: result.account_merged
        ? '已切换到原网站账号，原有昵称、资料、内容和榜金均已保留。临时微信账号的 30 榜金不会重复计入。'
        : '现在可以评价、评论、投票和举报，也可以在网站用手机号继续登录。',
      showCancel: false,
    })
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { binding.value = false }
}
onShow(() => { auth.value = readAuth() })
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="账号与安全" title="账号设置" description="小程序和网站使用同一个剧幕录账号。" fallback="/pages/mine/index" />
    <view class="status surface">
      <view><text>微信身份</text><strong>已绑定</strong></view>
      <view><text>手机号</text><strong>{{ auth?.phone_verified_at ? auth.phone : '未验证' }}</strong></view>
      <view><text>发言状态</text><strong>{{ auth?.phone_verified_at || auth?.email_verified_at ? '可发言' : '仅浏览' }}</strong></view>
    </view>
    <view v-if="!auth?.phone_verified_at" class="bind form-surface">
      <text class="bind__title">绑定手机号</text>
      <text class="bind__description">手机号只用于登录、安全治理和防止批量账号，不在公开主页展示。</text>
      <text class="field-label">手机号</text>
      <view class="code-row"><input v-model="phone" class="input" type="number" maxlength="11" placeholder="中国大陆手机号" /><button class="secondary-button" :disabled="sending || countdown > 0" @tap="sendCode">{{ countdown > 0 ? `${countdown}s` : '发验证码' }}</button></view>
      <text class="field-label">验证码</text>
      <input v-model="code" class="input" type="number" maxlength="8" placeholder="短信验证码" />
      <view class="sticky-submit"><button class="primary-button submit" :loading="binding" :disabled="binding" @tap="bindPhone">确认绑定</button></view>
    </view>
    <view class="privacy surface">
      <text class="privacy__title">隐私与账号说明</text>
      <text>公开昵称用于主页和发布内容；手机号、OpenID、内部账号 ID 不公开。内容提交会经过机器预检和人工审核，举报与处置会留存必要安全记录。</text>
    </view>
  </view>
</template>

<style scoped>
.status, .privacy { margin-top: 14rpx; padding: 20rpx; }
.bind { margin-top: 14rpx; }
.status { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8rpx; }
.status view { padding: 12rpx; border: 1rpx solid #e4e7eb; border-radius: 8rpx; text-align: center; }
.status text, .status strong { display: block; }
.status text { color: #7b8492; font-size: 20rpx; }
.status strong { margin-top: 6rpx; color: #27364a; font-size: 23rpx; }
.bind__title, .bind__description, .privacy__title, .privacy text { display: block; }
.bind__title, .privacy__title { font-size: 29rpx; font-weight: 850; }
.bind__description, .privacy text { margin-top: 8rpx; color: #64748b; font-size: 23rpx; line-height: 1.6; }
.code-row { display: grid; grid-template-columns: 1fr 220rpx; gap: 10rpx; }
.code-row button { padding: 0 8rpx; }
.submit { width: 100%; margin: 0; }
</style>
