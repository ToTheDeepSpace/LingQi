<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import { apiRequest, encoded } from '../../utils/api'

type Profile = { id: string; display_name: string; avatar?: string | null; avatar_focus_x?: number | null; avatar_focus_y?: number | null; city?: string | null; bio?: string | null; tags?: string[]; identity_roles?: string[]; services?: Array<{ id: string; service_type?: string; price?: number; description?: string }>; portfolio?: Array<{ id: string; image_url: string; caption?: string }> }
const id = ref('')
const profile = ref<Profile | null>(null)
const loading = ref(false)
const error = ref('')
const roleText: Record<string, string> = { player: '玩家', dm: 'DM', shop: '店家', store: '店家', creator: '服务者', photographer: '摄影师', makeup: '妆造师', costume: '服装商', prop: '道具师' }
async function load() {
  loading.value = true; error.value = ''
  try { profile.value = await apiRequest<Profile>(`/lc/creators/${encoded(id.value)}`) }
  catch (err) { error.value = err instanceof Error ? err.message : '用户主页加载失败' }
  finally { loading.value = false }
}
function previewAvatar() { if (profile.value?.avatar) uni.previewImage({ urls: [profile.value.avatar] }) }
function previewPortfolio(current: string) { uni.previewImage({ current, urls: (profile.value?.portfolio || []).map(item => item.image_url) }) }
onLoad(options => { id.value = String(options?.id || ''); void load() })
onShareAppMessage(() => ({ title: `${profile.value?.display_name || '用户'}｜剧幕录主页`, path: `/pages/profile/detail?id=${encoded(id.value)}` }))
</script>

<template>
  <view class="page">
    <MiniNavBar title="用户主页" fallback="/pages/index/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !profile" @retry="load" />
    <template v-if="profile">
      <view class="hero surface">
        <image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill" @tap="previewAvatar" />
        <view v-else class="avatar placeholder">{{ profile.display_name.slice(0, 1) }}</view>
        <text class="name">{{ profile.display_name }}</text>
        <text class="city">{{ profile.city || '城市未设置' }}</text>
        <view v-if="profile.identity_roles?.length" class="chip-row roles"><text v-for="role in profile.identity_roles" :key="role" class="chip">{{ roleText[role] || role }}</text></view>
      </view>
      <view v-if="profile.bio || profile.tags?.length" class="section surface">
        <text class="section__title">个人简介</text>
        <text v-if="profile.bio" class="bio">{{ profile.bio }}</text>
        <view v-if="profile.tags?.length" class="chip-row"><text v-for="tag in profile.tags" :key="tag" class="chip">{{ tag }}</text></view>
      </view>
      <text v-if="profile.services?.length" class="section-title">提供的服务</text>
      <view v-for="service in profile.services" :key="service.id" class="service surface"><view><strong>{{ service.service_type || '服务' }}</strong><text>{{ service.description || '暂无说明' }}</text></view><text v-if="service.price" class="price">¥{{ service.price }}</text></view>
      <text v-if="profile.portfolio?.length" class="section-title">作品</text>
      <view v-if="profile.portfolio?.length" class="portfolio"><image v-for="item in profile.portfolio" :key="item.id" :src="item.image_url" mode="aspectFill" @tap="previewPortfolio(item.image_url)" /></view>
    </template>
  </view>
</template>

<style scoped>
.hero { padding: 28rpx; text-align: center; }
.avatar { width: 190rpx; height: 190rpx; border-radius: 50%; background: #f2ece4; }
.avatar.placeholder { display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #9a651e; font-family: serif; font-size: 68rpx; font-weight: 900; }
.name, .city { display: block; }
.name { margin-top: 14rpx; font-family: serif; font-size: 42rpx; font-weight: 900; }
.city { margin-top: 7rpx; color: #64748b; font-size: 24rpx; }
.roles { justify-content: center; margin-top: 14rpx; }
.section { margin-top: 14rpx; padding: 20rpx; }
.section__title, .bio { display: block; }
.section__title { margin-bottom: 10rpx; font-size: 28rpx; font-weight: 850; }
.bio { margin-bottom: 12rpx; color: #475569; line-height: 1.65; white-space: pre-wrap; }
.service { display: flex; justify-content: space-between; gap: 18rpx; margin-bottom: 12rpx; padding: 18rpx; }
.service strong, .service text { display: block; }
.service text { margin-top: 6rpx; color: #64748b; font-size: 23rpx; }
.price { color: #9a651e !important; font-size: 27rpx !important; font-weight: 900; }
.portfolio { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; }
.portfolio image { width: 100%; height: 260rpx; border-radius: 8rpx; background: #f2ece4; }
</style>
