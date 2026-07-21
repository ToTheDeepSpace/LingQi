<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Script } from '../../types'
import { apiRequest, encoded } from '../../utils/api'
import { flattenRoles, roleKind } from '../../utils/roles'

const scripts = ref<Script[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const roles = computed(() => flattenRoles(scripts.value))
const visible = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  return roles.value.filter(role => !keyword || [role.role_name, role.script_name, roleKind(role), ...(role.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
})
async function load() {
  loading.value = true; error.value = ''
  try { scripts.value = await apiRequest<Script[]>('/lc/scripts') }
  catch (err) { error.value = err instanceof Error ? err.message : '角色资料加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}
function openRole(id: string) { uni.navigateTo({ url: `/pages/roles/detail?id=${encoded(id)}` }) }
onShow(() => { if (!scripts.value.length) void load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="剧本与角色" title="角色点评" description="无剧透栏记录体验，剧透栏讨论角色内核和深度感受。" />
    <view class="page-tools"><input v-model="query" class="input" placeholder="搜索角色、剧本或类型" /></view>
    <text v-if="!loading && !error" class="count">{{ visible.length }} 个角色</text>
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !visible.length" empty-text="没有找到符合条件的角色" @retry="load" />
    <view v-for="role in visible" :key="role.target_id" class="role surface" @tap="openRole(role.target_id)">
      <view class="role__main"><text class="role__name">{{ role.role_name }}</text><text class="role__script">《{{ role.script_name }}》 · {{ roleKind(role) }}<template v-if="role.gender"> · {{ role.gender }}</template></text></view>
      <view class="role__score"><strong>{{ role.rating_avg ? Number(role.rating_avg).toFixed(1) : '暂无' }}</strong><text>{{ role.rating_count || 0 }} 条</text></view>
    </view>
  </view>
</template>

<style scoped>
.count { display: block; margin: 12rpx 4rpx; color: #7b8492; font-size: 22rpx; }
.role { display: flex; justify-content: space-between; align-items: center; gap: 18rpx; margin-bottom: 12rpx; padding: 18rpx 20rpx; }
.role__main { min-width: 0; }
.role__name, .role__script, .role__score text { display: block; }
.role__name { color: #27364a; font-size: 29rpx; font-weight: 850; }
.role__script { margin-top: 7rpx; color: #64748b; font-size: 22rpx; }
.role__score { flex: 0 0 auto; text-align: right; }
.role__score strong { color: #9a651e; font-size: 30rpx; }
.role__score text { margin-top: 4rpx; color: #94a3b8; font-size: 20rpx; }
</style>
