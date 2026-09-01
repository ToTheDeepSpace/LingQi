<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Script, ScriptRole } from '../../types'
import { apiRequest, encoded } from '../../utils/api'
import { roleKind } from '../../utils/roles'
import { timelineSharePayload } from '../../utils/share'

const scriptId = ref('')
const scripts = ref<Script[]>([])
const loading = ref(false)
const error = ref('')
const activeGroup = ref<'player' | 'actor'>('player')
const rolePickerOpen = ref(false)
const roleQuery = ref('')

const script = computed(() => scripts.value.find(item => item.id === scriptId.value) || null)
const playerRoles = computed(() => script.value?.player_roles || [])
const actorRoles = computed(() => script.value?.actor_roles || [])
const currentRoles = computed(() => activeGroup.value === 'player' ? playerRoles.value : actorRoles.value)
const ratedRoles = computed(() => currentRoles.value
  .filter(role => Number(role.rating_count || 0) > 0)
  .sort((left, right) => Number(right.rating_count || 0) - Number(left.rating_count || 0) || Number(right.rating_avg || 0) - Number(left.rating_avg || 0)))
const allRoleMatches = computed(() => {
  const keyword = roleQuery.value.trim().toLocaleLowerCase('zh-CN')
  return [...playerRoles.value, ...actorRoles.value].filter(role => !keyword || [role.role_name, roleKind(role), role.gender, ...(role.tags || [])]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(keyword))
})
const ratedCount = computed(() => [...playerRoles.value, ...actorRoles.value].filter(role => Number(role.rating_count || 0) > 0).length)
const durationText = computed(() => {
  if (!script.value) return ''
  if (script.value.min_duration_hours && script.value.max_duration_hours && script.value.min_duration_hours !== script.value.max_duration_hours) {
    return `${script.value.min_duration_hours}-${script.value.max_duration_hours} 小时`
  }
  if (script.value.duration_minutes) return `${Math.round(script.value.duration_minutes / 60)} 小时`
  if (script.value.min_duration_hours) return `${script.value.min_duration_hours} 小时`
  return ''
})

async function load() {
  loading.value = true
  error.value = ''
  try { scripts.value = await apiRequest<Script[]>('/lc/scripts') }
  catch (err) { error.value = err instanceof Error ? err.message : '剧本资料加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function openRole(role: ScriptRole) {
  if (!role.target_id) return
  rolePickerOpen.value = false
  uni.navigateTo({ url: `/pages/roles/detail?id=${encoded(role.target_id)}` })
}

function openPicker() {
  roleQuery.value = ''
  rolePickerOpen.value = true
}

onLoad(options => { scriptId.value = String(options?.id || ''); void load() })
onPullDownRefresh(load)
onShareAppMessage(() => ({ title: script.value ? `《${script.value.name}》角色评分` : '剧幕录剧本角色评分', path: `/pages/roles/script-detail?id=${encoded(scriptId.value)}` }))
onShareTimeline(() => timelineSharePayload(script.value ? `《${script.value.name}》角色评分` : '剧幕录剧本角色评分', `id=${encoded(scriptId.value)}`))
</script>

<template>
  <view class="page script-detail">
    <MiniNavBar title="剧本详情" fallback="/pages/index/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !script" empty-text="没有找到这个剧本" @retry="load" />

    <template v-if="script && !loading && !error">
      <view class="script-head">
        <text class="script-head__eyebrow">沉浸式娱乐剧本</text>
        <text class="script-head__title">{{ script.name }}</text>
        <text class="script-head__meta">{{ [durationText, `${playerRoles.length} 个玩家角色`, `${actorRoles.length} 个演绎角色`].filter(Boolean).join(' · ') }}</text>
        <text class="script-head__summary">已有 <strong>{{ ratedCount }}</strong> 个角色获得评价</text>
      </view>

      <view class="role-tabs">
        <view :class="{ active: activeGroup === 'player' }" @tap="activeGroup = 'player'">玩家角色 <text>{{ playerRoles.length }}</text></view>
        <view :class="{ active: activeGroup === 'actor' }" @tap="activeGroup = 'actor'">演绎角色 <text>{{ actorRoles.length }}</text></view>
      </view>

      <view class="section-head"><text class="section-head__title">已有角色评分</text><text class="section-head__count">{{ ratedRoles.length }} 个</text></view>
      <view v-if="ratedRoles.length" class="role-list">
        <view v-for="role in ratedRoles" :key="role.target_id" class="rated-role" @tap="openRole(role)">
          <view class="rated-role__copy">
            <view class="rated-role__title-line"><text class="rated-role__name">{{ role.role_name }}</text><text v-if="role.gender" class="rated-role__gender">{{ role.gender }}</text></view>
            <text class="rated-role__kind">{{ roleKind(role) }}</text>
          </view>
          <view class="rated-role__score"><strong>{{ Number(role.rating_avg || 0).toFixed(1) }}</strong><text>{{ role.rating_count || 0 }} 条评价</text></view>
          <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
        </view>
      </view>
      <view v-else class="empty-rated">这个分类还没有公开评分，提交第一条评价后会显示在这里。</view>

      <button class="secondary-button rate-other" @tap="openPicker">评价其他角色</button>
      <text class="lane-note">评价分为无剧透体验和剧透内核，每位玩家每个角色各可发布一条。</text>
    </template>

    <view v-if="rolePickerOpen" class="picker-mask" @tap="rolePickerOpen = false">
      <view class="picker-sheet" @tap.stop>
        <view class="picker-sheet__head"><text>选择要评价的角色</text><button @tap="rolePickerOpen = false">关闭</button></view>
        <view class="picker-search"><image src="/static/icons/ui-search.png" mode="aspectFit" /><input v-model="roleQuery" placeholder="搜索角色名称或类型" /></view>
        <scroll-view class="picker-results" scroll-y>
          <view v-for="role in allRoleMatches" :key="role.target_id" class="picker-role" @tap="openRole(role)">
            <view><text class="picker-role__name">{{ role.role_name }}</text><text class="picker-role__meta">{{ roleKind(role) }}<template v-if="role.gender"> · {{ role.gender }}</template></text></view>
            <text class="picker-role__status">{{ role.rating_count ? `${role.rating_count} 条` : '去评价' }}</text>
          </view>
          <view v-if="!allRoleMatches.length" class="picker-empty">没有找到匹配的角色</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.script-head { padding: 32rpx 4rpx 26rpx; border-bottom: 1rpx solid #e7e1d8; }
.script-head__eyebrow, .script-head__title, .script-head__meta, .script-head__summary { display: block; }
.script-head__eyebrow { color: #9a651e; font-size: 21rpx; font-weight: 800; }
.script-head__title { margin-top: 10rpx; color: #172033; font-family: serif; font-size: 48rpx; font-weight: 900; line-height: 1.2; }
.script-head__meta { margin-top: 12rpx; color: #657383; font-size: 23rpx; line-height: 1.5; }
.script-head__summary { margin-top: 18rpx; color: #526170; font-size: 24rpx; }
.script-head__summary strong { color: #9a651e; font-size: 29rpx; }
.role-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-top: 22rpx; border: 1rpx solid #e2d9cb; border-radius: 8rpx; }
.role-tabs view { position: relative; min-height: 76rpx; color: #667282; font-size: 25rpx; font-weight: 750; line-height: 76rpx; text-align: center; }
.role-tabs view.active { color: #8b5919; }
.role-tabs view.active::after { position: absolute; right: 20%; bottom: -1rpx; left: 20%; height: 4rpx; background: #a66a1f; content: ''; }
.role-tabs text { margin-left: 6rpx; color: #9098a5; font-size: 20rpx; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-top: 32rpx; padding-bottom: 10rpx; border-bottom: 1rpx solid #eceff2; }
.section-head__title { color: #27364a; font-size: 30rpx; font-weight: 850; }
.section-head__count { color: #8a93a2; font-size: 21rpx; }
.role-list { border-bottom: 1rpx solid #eceff2; }
.rated-role { display: flex; align-items: center; gap: 16rpx; min-height: 118rpx; border-bottom: 1rpx solid #eceff2; }
.rated-role:last-child { border-bottom: 0; }
.rated-role__copy { min-width: 0; flex: 1; }
.rated-role__title-line { display: flex; align-items: center; gap: 8rpx; }
.rated-role__name { overflow: hidden; color: #27364a; font-size: 29rpx; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.rated-role__gender { flex: 0 0 auto; padding: 3rpx 7rpx; border-radius: 5rpx; background: #f1f3f5; color: #687486; font-size: 18rpx; }
.rated-role__kind { display: block; margin-top: 7rpx; color: #7a8492; font-size: 21rpx; }
.rated-role__score { flex: 0 0 auto; text-align: right; }
.rated-role__score strong, .rated-role__score text { display: block; }
.rated-role__score strong { color: #9a651e; font-size: 32rpx; }
.rated-role__score text { margin-top: 4rpx; color: #8a93a2; font-size: 19rpx; }
.chevron { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; }
.empty-rated { padding: 50rpx 10rpx; border-bottom: 1rpx solid #eceff2; color: #7d8795; font-size: 22rpx; line-height: 1.55; text-align: center; }
.rate-other { width: 100%; margin-top: 24rpx; color: #8b5919; }
.lane-note { display: block; margin-top: 12rpx; color: #87909d; font-size: 20rpx; line-height: 1.5; text-align: center; }
.picker-mask { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: flex-end; background: rgba(31,41,55,.52); }
.picker-sheet { width: 100%; max-height: 76vh; padding: 24rpx 24rpx calc(26rpx + env(safe-area-inset-bottom)); border-radius: 14rpx 14rpx 0 0; background: #fffdf8; }
.picker-sheet__head { display: flex; align-items: center; justify-content: space-between; }
.picker-sheet__head > text { color: #27364a; font-size: 29rpx; font-weight: 850; }
.picker-sheet__head button { margin: 0; padding: 0 10rpx; border: 0; background: transparent; color: #275389; font-size: 23rpx; }
.picker-search { display: flex; align-items: center; height: 76rpx; margin-top: 18rpx; padding: 0 18rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; }
.picker-search image { width: 31rpx; height: 31rpx; margin-right: 12rpx; }
.picker-search input { min-width: 0; flex: 1; font-size: 25rpx; }
.picker-results { max-height: 52vh; margin-top: 8rpx; }
.picker-role { display: flex; align-items: center; justify-content: space-between; min-height: 96rpx; border-bottom: 1rpx solid #eceff2; }
.picker-role__name, .picker-role__meta { display: block; }
.picker-role__name { color: #27364a; font-size: 26rpx; font-weight: 800; }
.picker-role__meta { margin-top: 5rpx; color: #7c8795; font-size: 20rpx; }
.picker-role__status { color: #9a651e; font-size: 21rpx; }
.picker-empty { padding: 48rpx 0; color: #8a93a2; text-align: center; }
</style>
