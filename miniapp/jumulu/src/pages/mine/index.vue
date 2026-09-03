<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import DailyCheckinView from '../../components/DailyCheckinView.vue'
import PageIntro from '../../components/PageIntro.vue'
import type { AccountStatus, AuthSession } from '../../types'
import { apiRequest, readAuth } from '../../utils/api'
import { hasCurrentLegalConsent, loginWithWechat, logout, refreshCurrentUser } from '../../utils/auth'
import { inviteSharePayload } from '../../utils/share'

type PublicationSummary = {
  total: number
  pending: number
  approved: number
  action_required: number
  closed: number
}

const auth = ref<AuthSession | null>(readAuth())
const setupNickname = ref('')
const loading = ref(false)
const setupSubmitting = ref(false)
const setupPending = ref(false)
const error = ref('')
const accountStatus = ref<AccountStatus | null>(null)
const publicationSummary = ref<PublicationSummary>({ total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 })
const showCheckin = ref(false)
const checkinView = ref<InstanceType<typeof DailyCheckinView> | null>(null)
const legalAccepted = ref(hasCurrentLegalConsent())
const checkinPreview = ref(false)

async function refresh() {
  loading.value = true; error.value = ''
  try {
    const [nextAccountStatus, content] = await Promise.all([
      apiRequest<AccountStatus>('/lc/account/status'),
      apiRequest<{ summary?: PublicationSummary; items?: Array<{ kind?: string; status?: string }> }>('/lc/account/submissions'),
    ])
    accountStatus.value = nextAccountStatus
    publicationSummary.value = content.summary || { total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 }
    setupPending.value = Boolean(content.items?.some(item => item.kind === 'profile_update' && item.status === 'pending'))
    if (accountStatus.value.state === 'merged') {
      logout(); auth.value = null
      uni.showModal({ title: '账号已合并', content: accountStatus.value.message || '请重新登录原网站账号。', showCancel: false })
      return
    }
    if (accountStatus.value.restriction?.scope !== 'account') auth.value = await refreshCurrentUser({ silent: false })
  }
  catch (err) { error.value = err instanceof Error ? err.message : '账号加载失败'; auth.value = readAuth() }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
async function login() {
  error.value = ''
  if (!legalAccepted.value) {
    error.value = '请先阅读并同意用户协议和隐私政策'
    return
  }
  try {
    loading.value = true
    auth.value = await loginWithWechat({ legalAccepted: true })
    uni.showToast({ title: '登录成功', icon: 'success' })
    await refresh()
  }
  catch (err) { error.value = err instanceof Error ? err.message : '微信登录失败' }
  finally { loading.value = false }
}
function handleLoginTap() {
  // #ifndef MP-WEIXIN
  void login()
  // #endif
}
function handleWechatPrivacyAuthorization(event: { detail?: { errMsg?: string } }) {
  if (!legalAccepted.value) {
    error.value = '请先阅读并同意用户协议和隐私政策'
    return
  }
  const errMsg = String(event.detail?.errMsg || '')
  if (errMsg && !/ok$/i.test(errMsg)) {
    error.value = '请先同意微信隐私保护指引'
    return
  }
  void login()
}
async function submitInitialProfile() {
  const displayName = setupNickname.value.trim()
  if (displayName.length < 2) return uni.showToast({ title: '昵称至少 2 个字', icon: 'none' })
  if (!auth.value?.id) return
  try {
    setupSubmitting.value = true
    await apiRequest(`/lc/creators/${auth.value.id}`, {
      method: 'PUT',
      data: { display_name: displayName },
    })
    setupPending.value = true
    setupNickname.value = ''
    uni.showModal({
      title: '昵称已提交',
      content: '审核通过后会成为你的公开昵称。等待期间可以继续浏览和完善关注城市。',
      showCancel: false,
    })
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally {
    setupSubmitting.value = false
  }
}
function signOut() { logout(); auth.value = null }
function go(url: string) { uni.navigateTo({ url }) }
function openCheckin() { showCheckin.value = true }
function copyAdmin() { uni.setClipboardData({ data: 'https://jumulu.jusichen.com/admin', success: () => uni.showToast({ title: '后台地址已复制', icon: 'success' }) }) }
function openLegal(type: 'terms' | 'privacy') { uni.navigateTo({ url: `/pages/legal/document?type=${type}` }) }
function updateLegalAccepted(event: { detail: { value: string[] } }) {
  legalAccepted.value = event.detail.value.includes('accepted')
  if (legalAccepted.value) error.value = ''
}
function unreadLabel() {
  const count = Math.max(0, Number(accountStatus.value?.unread_count || 0))
  return count > 99 ? '99+' : String(count)
}
function pendingPublicationCount() {
  return publicationSummary.value.pending + publicationSummary.value.action_required
}

async function pullRefresh() {
  if (showCheckin.value) {
    await checkinView.value?.load()
    uni.stopPullDownRefresh()
    return
  }
  await refresh()
}

onLoad((options) => {
  // #ifdef H5
  if (import.meta.env.DEV && options?.preview === 'checkin') {
    checkinPreview.value = true
    auth.value = { id: 'preview-user', token: 'preview', display_name: '预览用户' }
    showCheckin.value = true
  }
  // #endif
})
onShow(() => {
  if (checkinPreview.value) return
  auth.value = readAuth()
  if (auth.value?.token) void refresh()
})
onPullDownRefresh(pullRefresh)
onShareAppMessage(() => inviteSharePayload())
</script>

<template>
  <view class="page">
    <DailyCheckinView v-if="auth && showCheckin" ref="checkinView" :preview="checkinPreview" @back="showCheckin = false" />
    <template v-else>
    <PageIntro nav-title="我的" :title="auth ? auth.display_name : '微信登录剧幕录'" />
    <view v-if="!auth" class="login surface">
      <view class="login-mark">幕</view>
      <text class="login-title">微信一键登录</text>
      <text class="hint">先进入剧幕录浏览内容，再设置公开昵称、关注城市和个人主页。</text>
      <text v-if="error" class="error">{{ error }}</text>
      <checkbox-group class="legal-consent" @change="updateLegalAccepted">
        <label class="legal-consent__label">
          <checkbox value="accepted" color="#275389" :checked="legalAccepted" />
          <text>我已阅读并同意</text>
        </label>
        <view class="legal-consent__links">
          <text @tap.stop="openLegal('terms')">《用户协议》</text>
          <text @tap.stop="openLegal('privacy')">《隐私政策》</text>
        </view>
      </checkbox-group>
      <button
        class="primary-button login-button"
        open-type="agreePrivacyAuthorization"
        :loading="loading"
        :disabled="loading || !legalAccepted"
        @tap="handleLoginTap"
        @agreeprivacyauthorization="handleWechatPrivacyAuthorization"
      >微信一键登录</button>
    </view>
    <template v-else>
      <view class="account surface">
        <image v-if="auth.avatar" class="avatar" :src="auth.avatar" mode="aspectFill" />
        <view v-else class="avatar placeholder">{{ auth.profile_setup_completed === false ? '幕' : auth.display_name.slice(0, 1) }}</view>
        <view class="account__main"><text class="account__name">{{ auth.profile_setup_completed === false ? '待设置公开昵称' : auth.display_name }}</text><text class="account__meta">{{ auth.city || '城市未设置' }} · {{ auth.phone_verified_at || auth.email_verified_at ? '账号已验证' : '仅浏览' }}</text></view>
      </view>
      <view v-if="auth.profile_setup_completed === false" class="setup surface">
        <template v-if="setupPending">
          <view class="setup-status"><view class="setup-status__mark">✓</view><view><strong>公开昵称审核中</strong><text>审核通过前可以正常浏览，公开发布暂不可用。</text></view></view>
        </template>
        <template v-else>
          <view class="setup-heading"><strong>先设置公开昵称</strong><text>昵称不是登录账号，审核通过后显示在主页和发布内容中。</text></view>
          <view class="setup-row">
            <input v-model="setupNickname" class="input" maxlength="30" placeholder="2 至 30 个字符" />
            <button class="primary-button setup-button" :loading="setupSubmitting" :disabled="setupSubmitting || setupNickname.trim().length < 2" @tap="submitInitialProfile">提交</button>
          </view>
        </template>
      </view>
      <view class="quick-grid">
        <view class="quick-entry" @tap="go('/pages/mine/account-status')">
          <view class="quick-entry__icon">
            <image src="/static/icons/message-star.png" mode="aspectFit" />
            <text v-if="Number(accountStatus?.unread_count || 0) > 0" class="quick-entry__badge">{{ unreadLabel() }}</text>
          </view>
          <view class="quick-entry__copy">
            <strong>消息中心</strong>
            <text v-if="Number(accountStatus?.unread_count || 0) > 0 && pendingPublicationCount() > 0">{{ unreadLabel() }} 条未读 · {{ pendingPublicationCount() }} 项待处理</text>
            <text v-else-if="Number(accountStatus?.unread_count || 0) > 0">{{ unreadLabel() }} 条未读消息</text>
            <text v-else-if="pendingPublicationCount() > 0">{{ pendingPublicationCount() }} 项提交待处理</text>
            <text v-else>通知、审核结果和全部提交</text>
          </view>
          <image class="quick-entry__chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
        </view>
      </view>
      <view class="checkin-entry" @tap="openCheckin">
        <view><strong>每日签到</strong><text>领取赠送榜金，支持喜欢的角色和 DM</text></view>
        <view class="checkin-entry__action"><text>签到</text><image src="/static/icons/ui-chevron-right.png" mode="aspectFit" /></view>
      </view>
      <view v-if="accountStatus?.state === 'restricted'" class="restriction surface" @tap="go('/pages/mine/account-status')">
        <view>
          <strong>{{ accountStatus.restriction?.scope === 'account' ? '账号功能受限' : '当前限制发布' }}</strong>
          <text>{{ accountStatus.restriction?.reason || '查看限制原因和申诉进度' }}</text>
        </view>
        <text>›</text>
      </view>
      <view v-if="!auth.phone_verified_at && !auth.email_verified_at" class="verify surface" @tap="go('/pages/mine/account')"><view><strong>完成手机号验证</strong><text>验证后才可评价、评论、投票和举报</text></view><text>›</text></view>
      <view class="menu surface">
        <view class="menu__item" @tap="go(`/pages/profile/detail?id=${auth.id}`)"><view><strong>公开主页</strong><text>查看别人眼中的个人资料</text></view><text>›</text></view>
        <view class="menu__item" @tap="go('/pages/follows/index')"><view><strong>关注设置</strong><text>修改关注城市和店家</text></view><text>›</text></view>
        <view class="menu__item" @tap="go('/pages/mine/account')"><view><strong>账号设置</strong><text>手机号、登录状态与隐私说明</text></view><text>›</text></view>
        <view class="menu__item" @tap="go('/pages/feedback/index')"><view><strong>问题反馈</strong><text>功能故障、资料纠错、联系方式和支付问题</text></view><text>›</text></view>
      </view>
      <view v-if="auth.role === 'admin'" class="admin surface"><view><strong>平台管理后台</strong><text>审核、账号治理和证据处理继续在网站完成。</text></view><button class="secondary-button" @tap="copyAdmin">复制网站后台地址</button></view>
      <button class="secondary-button" @tap="go('/pages/stores/manage')">店家认证与名额</button>
      <button class="secondary-button logout" @tap="signOut">退出登录</button>
    </template>
    </template>
  </view>
</template>

<style scoped>
.login, .account, .menu, .admin, .setup { margin-top: 14rpx; padding: 20rpx; }
.login { padding: 34rpx 26rpx 28rpx; text-align: center; }
.login-mark { display: flex; width: 74rpx; height: 74rpx; align-items: center; justify-content: center; margin: 0 auto; border-radius: 8rpx; background: #edf3fb; color: #275389; font-family: serif; font-size: 34rpx; font-weight: 900; }
.login-title { display: block; margin-top: 16rpx; color: #1f2937; font-size: 30rpx; font-weight: 850; }
.hint, .error { display: block; margin-top: 12rpx; font-size: 22rpx; line-height: 1.5; }
.hint { color: #7b8492; text-align: center; }
.error { color: #b42318; }
.legal-consent { display: flex; align-items: center; justify-content: center; gap: 8rpx; margin-top: 18rpx; color: #64748b; font-size: 21rpx; line-height: 1.5; }
.legal-consent__label, .legal-consent__links { display: flex; align-items: center; }
.legal-consent__label checkbox { transform: scale(.72); transform-origin: center; }
.legal-consent__links text { color: #8b5919; font-weight: 750; }
.login-button { width: 100%; margin-top: 14rpx; }
.setup { border-color: #d7e3f1; background: #f7faff; }
.setup-heading strong, .setup-heading text, .setup-status strong, .setup-status text { display: block; }
.setup-heading strong, .setup-status strong { color: #27364a; font-size: 27rpx; }
.setup-heading text, .setup-status text { margin-top: 5rpx; color: #64748b; font-size: 21rpx; line-height: 1.45; }
.setup-row { display: grid; grid-template-columns: minmax(0, 1fr) 132rpx; gap: 10rpx; margin-top: 14rpx; }
.setup-button { width: 100%; padding: 0 8rpx; }
.setup-status { display: flex; align-items: center; gap: 14rpx; }
.setup-status__mark { display: flex; width: 52rpx; height: 52rpx; flex: 0 0 52rpx; align-items: center; justify-content: center; border-radius: 50%; background: #e8f4ed; color: #23734d; font-size: 26rpx; font-weight: 900; }
.account { display: flex; align-items: center; gap: 16rpx; }
.quick-grid { display: grid; gap: 2rpx; margin: 14rpx 0; overflow: hidden; border-radius: 12rpx; background: #e8ebef; }
.quick-entry { display: flex; min-height: 104rpx; align-items: center; gap: 16rpx; padding: 18rpx 20rpx; background: #fff; }
.quick-entry__icon { position: relative; display: flex; width: 62rpx; height: 62rpx; flex: 0 0 62rpx; align-items: center; justify-content: center; border-radius: 12rpx; background: #edf3fb; }
.quick-entry__icon image { width: 36rpx; height: 36rpx; }
.quick-entry__badge { position: absolute; top: -9rpx; right: -11rpx; min-width: 30rpx; height: 30rpx; padding: 0 7rpx; border: 3rpx solid #fff; border-radius: 15rpx; background: #c83939; color: #fff; font-size: 18rpx; font-weight: 850; line-height: 27rpx; text-align: center; }
.quick-entry__copy { min-width: 0; flex: 1; }
.quick-entry__copy strong, .quick-entry__copy text { display: block; }
.quick-entry__copy strong { color: #1f2937; font-size: 27rpx; }
.quick-entry__copy text { margin-top: 5rpx; overflow: hidden; color: #7b8492; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.quick-entry__chevron { width: 26rpx; height: 26rpx; flex: 0 0 26rpx; }
.checkin-entry { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 14rpx; padding: 20rpx 4rpx; border-top: 1rpx solid #e7e1d8; border-bottom: 1rpx solid #e7e1d8; }
.checkin-entry strong, .checkin-entry > view > text { display: block; }
.checkin-entry strong { color: #27364a; font-size: 28rpx; }
.checkin-entry > view > text { margin-top: 6rpx; color: #748093; font-size: 21rpx; }
.checkin-entry__action { display: flex; align-items: center; gap: 5rpx; color: #9a651e; font-size: 23rpx; font-weight: 800; }
.checkin-entry__action text { margin: 0; color: #9a651e; }
.checkin-entry__action image { width: 24rpx; height: 24rpx; }
.avatar { width: 94rpx; height: 94rpx; flex: 0 0 94rpx; border-radius: 50%; background: #f2ece4; }
.avatar.placeholder { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 38rpx; font-weight: 900; }
.account__name, .account__meta { display: block; }
.account__name { font-size: 31rpx; font-weight: 850; }
.account__meta { margin-top: 7rpx; color: #64748b; font-size: 22rpx; }
.verify, .restriction, .menu__item { display: flex; justify-content: space-between; align-items: center; gap: 14rpx; }
.verify { margin-top: 14rpx; padding: 18rpx; border-color: #e6bc77; background: #fff8e8; }
.verify strong, .verify text, .menu__item strong, .menu__item text, .admin strong, .admin text { display: block; }
.restriction { margin-top: 14rpx; padding: 18rpx; border-color: #e6bc77; background: #fff4e6; }
.restriction strong, .restriction text { display: block; }
.restriction strong { color: #8b5919; }
.restriction text { margin-top: 5rpx; color: #7b5a31; font-size: 22rpx; line-height: 1.45; }
.verify strong { color: #8b5919; }
.verify text, .menu__item text, .admin text { margin-top: 5rpx; color: #7b8492; font-size: 22rpx; line-height: 1.45; }
.menu { padding-top: 0; padding-bottom: 0; }
.menu__item { padding: 22rpx 0; border-bottom: 1rpx solid #eceff2; }
.menu__item:last-child { border-bottom: 0; }
.menu__item strong { color: #27364a; font-size: 27rpx; }
.admin button { width: 100%; margin-top: 14rpx; }
.logout { width: 100%; margin-top: 18rpx; }
</style>
