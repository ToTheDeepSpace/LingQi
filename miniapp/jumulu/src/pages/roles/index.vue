<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Script } from '../../types'
import { apiRequest, encoded } from '../../utils/api'

const scripts = ref<Script[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const pendingScriptName = ref('')

function ratedRoleCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].filter(role => Number(role.rating_count || 0) > 0).length
}

function roleRatingCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].reduce((sum, role) => sum + Number(role.rating_count || 0), 0)
}

const visible = computed(() => {
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

onLoad(options => { pendingScriptName.value = String(options?.script || '') })
onShow(() => { if (!scripts.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page scripts-page">
    <PageIntro eyebrow="沉浸式娱乐百科" title="剧本" description="先选择剧本，再查看其中已有评价的角色。" fallback="/pages/index/index" />
    <view class="search-box"><image src="/static/icons/ui-search.png" mode="aspectFit" /><input v-model="query" placeholder="搜索剧本、角色或发行" /></view>
    <view class="section-head"><text>近期有评价</text><text>{{ visible.length }} 个剧本</text></view>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="没有找到相符的剧本" @retry="load" />
    <view v-if="!loading && !error" class="script-list">
      <view v-for="script in visible" :key="script.id" class="script-row" @tap="openScript(script.id)">
        <view class="script-row__mark">{{ script.name.slice(0, 1) }}</view>
        <view class="script-row__copy">
          <text class="script-row__title">{{ script.name }}</text>
          <text class="script-row__meta">{{ (script.player_roles?.length || 0) + (script.actor_roles?.length || 0) }} 个已收录角色</text>
          <text class="script-row__rating">{{ ratedRoleCount(script) ? `${ratedRoleCount(script)} 个角色已有评价 · ${roleRatingCount(script)} 条` : '等待第一条角色评价' }}</text>
        </view>
        <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.search-box { display: flex; align-items: center; height: 78rpx; padding: 0 20rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; }
.search-box image { width: 31rpx; height: 31rpx; margin-right: 12rpx; }
.search-box input { min-width: 0; flex: 1; font-size: 25rpx; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-top: 28rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid #eceff2; }
.section-head text:first-child { color: #27364a; font-size: 29rpx; font-weight: 850; }
.section-head text:last-child { color: #8a93a2; font-size: 20rpx; }
.script-list { border-bottom: 1rpx solid #eceff2; }
.script-row { display: flex; align-items: center; min-height: 136rpx; gap: 18rpx; border-bottom: 1rpx solid #eceff2; }
.script-row:last-child { border-bottom: 0; }
.script-row__mark { display: flex; align-items: center; justify-content: center; width: 88rpx; height: 104rpx; flex: 0 0 88rpx; border-radius: 7rpx; background: #f1ece3; color: #8b5919; font-family: serif; font-size: 36rpx; font-weight: 900; }
.script-row__copy { min-width: 0; flex: 1; }
.script-row__title, .script-row__meta, .script-row__rating { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.script-row__title { color: #27364a; font-size: 29rpx; font-weight: 850; }
.script-row__meta { margin-top: 7rpx; color: #6c7888; font-size: 21rpx; }
.script-row__rating { margin-top: 6rpx; color: #9a651e; font-size: 21rpx; }
.chevron { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; }
</style>
