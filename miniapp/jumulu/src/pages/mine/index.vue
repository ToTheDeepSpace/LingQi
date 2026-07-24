<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import DailyCheckinView from '../../components/DailyCheckinView.vue'
import PageIntro from '../../components/PageIntro.vue'
import type { AccountStatus, AuthSession } from '../../types'
import { apiRequest, readAuth } from '../../utils/api'
import { loginWithWechat, logout, refreshCurrentUser } from '../../utils/auth'

type PublicationSummary = {
  total: number
  pending: number
  approved: number
  action_required: number
  closed: number
}

const auth = ref<AuthSession | null>(readAuth())
const nickname = ref('')
const loading = ref(false)
const error = ref('')
const accountStatus = ref<AccountStatus | null>(null)
const publicationSummary = ref<PublicationSummary>({ total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 })
const showCheckin = ref(false)
const checkinView = ref<InstanceType<typeof DailyCheckinView> | null>(null)

async function refresh() {
  loading.value = true; error.value = ''
  try {
    const [nextAccountStatus, content] = await Promise.all([
      apiRequest<AccountStatus>('/lc/account/status'),
      apiRequest<{ summary?: PublicationSummary }>('/lc/account/submissions'),
    ])
    accountStatus.value = nextAccountStatus
    publicationSummary.value = content.summary || { total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 }
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
  try { loading.value = true; auth.value = await loginWithWechat(nickname.value); nickname.value = ''; uni.showToast({ title: '登录成功', icon: 'success' }) }
  catch (err) { error.value = err instanceof Error ? err.message : '微信登录失败' }
  finally { loading.value = false }
}
function signOut() { logout(); auth.value = null }
function go(url: string) { uni.navigateTo({ url }) }
function openCheckin() { showCheckin.value = true }
function copyAdmin() { uni.setClipboardData({ data: 'https://jumulu.jusichen.com/admin', success: () => uni.showToast({ title: '后台地址已复制', icon: 'success' }) }) }
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

onShow(() => { auth.value = readAuth(); if (auth.value?.token) void refresh() })
onPullDownRefresh(pullRefresh)
</script>

<template>
  <view class="page">
    <DailyCheckinView v-if="auth && showCheckin" ref="checkinView" @back="showCheckin = false" />
    <template v-else>
    <PageIntro nav-title="我的" :title="auth ? auth.display_name : '微信登录剧幕录'" />
    <view v-if="!auth" class="login surface">
      <text class="field-label">公开昵称</text>
      <input v-model="nickname" class="input" maxlength="40" placeholder="例如：泡泡" />
      <text class="hint">昵称会显示在公开主页和你发布的内容中，可以后续治理，但不做发布前审核。</text>
      <text v-if="error" class="error">{{ error }}</text>
      <button class="primary-button login-button" :loading="loading" :disabled="loading || !nickname.trim()" @tap="login">微信登录</button>
    </view>
    <template v-else>
      <view class="account surface">
        <image v-if="auth.avatar" class="avatar" :src="auth.avatar" mode="aspectFill" />
        <view v-else class="avatar placeholder">{{ auth.display_name.slice(0, 1) }}</view>
        <view class="account__main"><text class="account__name">{{ auth.display_name }}</text><text class="account__meta">{{ auth.city || '城市未设置' }} · {{ auth.phone_verified_at || auth.email_verified_at ? '账号已验证' : '仅浏览' }}</text></view>
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
        <view><strong>每日签到</strong><text>领取助力金币，给喜欢的角色和 DM 打榜</text></view>
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
      <button class="secondary-button logout" @tap="signOut">退出登录</button>
    </template>
    </template>
  </view>
</template>

<style scoped>
.login, .account, .menu, .admin { margin-top: 14rpx; padding: 20rpx; }
.hint, .error { display: block; margin-top: 12rpx; font-size: 22rpx; line-height: 1.5; }
.hint { color: #7b8492; }
.error { color: #b42318; }
.login-button { width: 100%; margin-top: 18rpx; }
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
