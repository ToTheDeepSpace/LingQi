<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Script } from '../../types'
import { apiRequest, encoded } from '../../utils/api'
import { flattenRoles, roleKind } from '../../utils/roles'
import { pageSharePayload, timelineSharePayload } from '../../utils/share'

const scripts = ref<Script[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const pendingScriptName = ref('')
const activeView = ref<'rated' | 'scripts'>('rated')

function ratedRoleCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].filter(role => Number(role.rating_count || 0) > 0).length
}

function roleRatingCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].reduce((sum, role) => sum + Number(role.rating_count || 0), 0)
}

const ratedRoles = computed(() => flattenRoles(scripts.value)
  .filter(role => Number(role.rating_count || 0) > 0)
  .sort((left, right) => Number(right.rating_count || 0) - Number(left.rating_count || 0)
    || Number(right.rating_avg || 0) - Number(left.rating_avg || 0)
    || `${left.script_name}${left.role_name}`.localeCompare(`${right.script_name}${right.role_name}`, 'zh-CN')))

const visibleRoles = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return ratedRoles.value.filter(role => !keyword || [
    role.script_name,
    role.role_name,
    roleKind(role),
    role.gender,
    ...(role.tags || []),
  ].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
})

const visibleScripts = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return scripts.value
    .filter(script => !keyword || [script.name, ...(script.player_roles || []).map(role => role.role_name), ...(script.actor_roles || []).map(role => role.role_name)]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(keyword))
    .sort((left, right) => ratedRoleCount(right) - ratedRoleCount(left) || roleRatingCount(right) - roleRatingCount(left) || left.name.localeCompare(right.name, 'zh-CN'))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    scripts.value = await apiRequest<Script[]>('/lc/scripts')
    if (pendingScriptName.value) {
      const matched = scripts.value.find(item => item.name === pendingScriptName.value)
      if (matched) {
        pendingScriptName.value = ''
        openScript(matched.id)
      }
    }
  } catch (err) { error.value = err instanceof Error ? err.message : '剧本资料加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function openScript(id: string) { uni.navigateTo({ url: `/pages/roles/script-detail?id=${encoded(id)}` }) }
function openRole(id?: string) {
  if (id) uni.navigateTo({ url: `/pages/roles/detail?id=${encoded(id)}` })
}

onLoad(options => { pendingScriptName.value = String(options?.script || '') })
onShow(() => { if (!scripts.value.length) void load() })
onPullDownRefresh(load)
onShareAppMessage(() => pageSharePayload('来剧幕录看剧本角色点评', '/pages/roles/index'))
onShareTimeline(() => timelineSharePayload('来剧幕录看剧本角色点评'))
</script>

<template>
  <view class="page scripts-page">
    <PageIntro eyebrow="沉浸式娱乐角色口碑" title="角色点评" description="先看真实评价，再决定要不要为一个角色留下自己的体验。" fallback="/pages/index/index" />
    <view class="view-tabs">
      <view :class="{ active: activeView === 'rated' }" @tap="activeView = 'rated'">已有点评 <text>{{ ratedRoles.length }}</text></view>
      <view :class="{ active: activeView === 'scripts' }" @tap="activeView = 'scripts'">全部剧本 <text>{{ scripts.length }}</text></view>
    </view>
    <view class="search-box"><image src="/static/icons/ui-search.png" mode="aspectFit" /><input v-model="query" :placeholder="activeView === 'rated' ? '搜索角色、剧本或标签' : '搜索剧本或角色'" /></view>
    <view class="section-head">
      <text>{{ activeView === 'rated' ? '公开角色点评' : '按剧本查找角色' }}</text>
      <text>{{ activeView === 'rated' ? `${visibleRoles.length} 个角色` : `${visibleScripts.length} 个剧本` }}</text>
    </view>
    <StatePanel
      :loading="loading"
      :error="error"
      :empty="!loading && !error && (activeView === 'rated' ? !visibleRoles.length : !visibleScripts.length)"
      :empty-text="activeView === 'rated' ? '没有找到相符的已评分角色' : '没有找到相符的剧本'"
      @retry="load"
    />
    <view v-if="!loading && !error && activeView === 'rated'" class="role-list">
      <view v-for="role in visibleRoles" :key="role.target_id" class="role-row" @tap="openRole(role.target_id)">
        <view class="role-row__copy">
          <text class="role-row__kind">{{ roleKind(role) }}<template v-if="role.gender"> · {{ role.gender }}</template></text>
          <text class="role-row__name">{{ role.role_name }}</text>
          <text class="role-row__script">《{{ role.script_name }}》</text>
        </view>
        <view class="role-row__score">
          <view><strong>{{ Number(role.rating_avg || 0).toFixed(1) }}</strong><text>★</text></view>
          <text>{{ role.rating_count || 0 }} 人评分</text>
        </view>
        <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
      </view>
      <button class="text-action" @tap="activeView = 'scripts'">没有找到？按剧本查找全部角色</button>
    </view>
    <view v-if="!loading && !error && activeView === 'scripts'" class="script-list">
      <view v-for="script in visibleScripts" :key="script.id" class="script-row" @tap="openScript(script.id)">
        <view class="script-row__mark">{{ script.name.slice(0, 1) }}</view>
        <view class="script-row__copy">
          <text class="script-row__title">{{ script.name }}</text>
          <text class="script-row__meta">{{ (script.player_roles?.length || 0) + (script.actor_roles?.length || 0) }} 个角色<template v-if="ratedRoleCount(script)"> · {{ ratedRoleCount(script) }} 个已有评价 · {{ roleRatingCount(script) }} 条</template></text>
        </view>
        <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.view-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 14rpx; border: 1rpx solid #e2d9cb; border-radius: 8rpx; background: #fff; }
.view-tabs view { position: relative; min-height: 72rpx; color: #667282; font-size: 24rpx; font-weight: 800; line-height: 72rpx; text-align: center; }
.view-tabs view.active { color: #8b5919; }
.view-tabs view.active::after { position: absolute; right: 24%; bottom: -1rpx; left: 24%; height: 4rpx; background: #a66a1f; content: ''; }
.view-tabs text { margin-left: 5rpx; color: #929aa6; font-size: 19rpx; }
.search-box { display: flex; align-items: center; height: 78rpx; padding: 0 20rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; }
.search-box image { width: 31rpx; height: 31rpx; margin-right: 12rpx; }
.search-box input { min-width: 0; flex: 1; font-size: 25rpx; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-top: 24rpx; padding-bottom: 10rpx; border-bottom: 1rpx solid #eceff2; }
.section-head text:first-child { color: #27364a; font-size: 29rpx; font-weight: 850; }
.section-head text:last-child { color: #8a93a2; font-size: 20rpx; }
.role-list, .script-list { border-bottom: 1rpx solid #eceff2; }
.role-row { display: flex; align-items: center; min-height: 132rpx; gap: 14rpx; border-bottom: 1rpx solid #eceff2; }
.role-row:last-of-type { border-bottom: 0; }
.role-row__copy { min-width: 0; flex: 1; }
.role-row__kind, .role-row__name, .role-row__script { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-row__kind { color: #727e8d; font-size: 19rpx; font-weight: 800; }
.role-row__name { margin-top: 6rpx; color: #27364a; font-family: serif; font-size: 31rpx; font-weight: 900; }
.role-row__script { margin-top: 5rpx; color: #275389; font-size: 21rpx; font-weight: 750; }
.role-row__score { flex: 0 0 auto; min-width: 104rpx; text-align: right; }
.role-row__score view { display: flex; align-items: baseline; justify-content: flex-end; gap: 4rpx; }
.role-row__score strong { color: #27364a; font-size: 31rpx; line-height: 1; }
.role-row__score view text { color: #a66a1f; font-size: 21rpx; }
.role-row__score > text { display: block; margin-top: 7rpx; color: #8a93a2; font-size: 18rpx; }
.text-action { height: 74rpx; margin: 8rpx auto 0; padding: 0 12rpx; border: 0; background: transparent; color: #275389; font-size: 21rpx; font-weight: 800; line-height: 74rpx; }
.script-row { display: flex; align-items: center; min-height: 112rpx; gap: 16rpx; border-bottom: 1rpx solid #eceff2; }
.script-row:last-child { border-bottom: 0; }
.script-row__mark { display: flex; align-items: center; justify-content: center; width: 72rpx; height: 82rpx; flex: 0 0 72rpx; border-radius: 7rpx; background: #f1ece3; color: #8b5919; font-family: serif; font-size: 31rpx; font-weight: 900; }
.script-row__copy { min-width: 0; flex: 1; }
.script-row__title, .script-row__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.script-row__title { color: #27364a; font-size: 27rpx; font-weight: 850; }
.script-row__meta { margin-top: 7rpx; color: #6c7888; font-size: 21rpx; }
.chevron { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; }
</style>
