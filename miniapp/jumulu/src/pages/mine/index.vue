<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import type { AuthSession } from '../../types'
import { readAuth } from '../../utils/api'
import { loginWithWechat, logout, refreshCurrentUser } from '../../utils/auth'

const auth = ref<AuthSession | null>(readAuth())
const nickname = ref('')
const loading = ref(false)
const error = ref('')

async function refresh() {
  loading.value = true; error.value = ''
  try { auth.value = await refreshCurrentUser({ silent: false }) }
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
function copyAdmin() { uni.setClipboardData({ data: 'https://jumulu.jusichen.com/admin', success: () => uni.showToast({ title: '后台地址已复制', icon: 'success' }) }) }

onShow(() => { auth.value = readAuth(); if (auth.value?.token) void refresh() })
onPullDownRefresh(refresh)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="个人中心" :title="auth ? auth.display_name : '微信登录剧幕录'" :description="auth ? '管理自己的发布、评价、评论和审核进度。' : '首次登录需要填写公开昵称，登录后与网站使用同一个账号。'" />
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
      <view v-if="!auth.phone_verified_at && !auth.email_verified_at" class="verify surface" @tap="go('/pages/mine/account')"><view><strong>完成手机号验证</strong><text>验证后才可评价、评论、投票和举报</text></view><text>›</text></view>
      <view class="menu surface">
        <view class="menu__item" @tap="go('/pages/mine/content')"><view><strong>我的内容</strong><text>发布、评价、评论、举报与审核状态</text></view><text>›</text></view>
        <view class="menu__item" @tap="go(`/pages/profile/detail?id=${auth.id}`)"><view><strong>公开主页</strong><text>查看别人眼中的个人资料</text></view><text>›</text></view>
        <view class="menu__item" @tap="go('/pages/mine/account')"><view><strong>账号设置</strong><text>手机号、登录状态与隐私说明</text></view><text>›</text></view>
      </view>
      <view v-if="auth.role === 'admin'" class="admin surface"><view><strong>平台管理后台</strong><text>审核、账号治理和证据处理继续在网站完成。</text></view><button class="secondary-button" @tap="copyAdmin">复制网站后台地址</button></view>
      <button class="secondary-button logout" @tap="signOut">退出登录</button>
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
.avatar { width: 94rpx; height: 94rpx; flex: 0 0 94rpx; border-radius: 50%; background: #f2ece4; }
.avatar.placeholder { display: flex; align-items: center; justify-content: center; color: #9a651e; font-family: serif; font-size: 38rpx; font-weight: 900; }
.account__name, .account__meta { display: block; }
.account__name { font-size: 31rpx; font-weight: 850; }
.account__meta { margin-top: 7rpx; color: #64748b; font-size: 22rpx; }
.verify, .menu__item { display: flex; justify-content: space-between; align-items: center; gap: 14rpx; }
.verify { margin-top: 14rpx; padding: 18rpx; border-color: #e6bc77; background: #fff8e8; }
.verify strong, .verify text, .menu__item strong, .menu__item text, .admin strong, .admin text { display: block; }
.verify strong { color: #8b5919; }
.verify text, .menu__item text, .admin text { margin-top: 5rpx; color: #7b8492; font-size: 22rpx; line-height: 1.45; }
.menu { padding-top: 0; padding-bottom: 0; }
.menu__item { padding: 22rpx 0; border-bottom: 1rpx solid #eceff2; }
.menu__item:last-child { border-bottom: 0; }
.menu__item strong { color: #27364a; font-size: 27rpx; }
.admin button { width: 100%; margin-top: 14rpx; }
.logout { width: 100%; margin-top: 18rpx; }
</style>
