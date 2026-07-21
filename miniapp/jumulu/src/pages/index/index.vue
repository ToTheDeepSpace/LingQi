<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DossierCard from '../../components/DossierCard.vue'
import MiniNavBar from '../../components/MiniNavBar.vue'
import RankingCard from '../../components/RankingCard.vue'
import type { Dossier, PublicProfile, Ranking } from '../../types'
import { apiRequest, encoded, readAuth } from '../../utils/api'

const dmItems = ref<Dossier[]>([])
const rankings = ref<Ranking[]>([])
const profiles = ref<PublicProfile[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    let followedCities: string[] = []
    if (readAuth()?.token) {
      const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
      followedCities = follows.cities || []
    }
    const cityQuery = followedCities.length ? `&cities=${encoded(followedCities.join(','))}` : ''
    const [dm, events, people] = await Promise.all([
      apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
      apiRequest<Ranking[]>(`/lc/rankings?sort=latest${cityQuery}`),
      apiRequest<{ items: PublicProfile[] }>(`/lc/creators?limit=6${cityQuery}`),
    ])
    dmItems.value = dm.filter(item => item.photo_url).slice(0, 4)
    rankings.value = events.slice(0, 3)
    profiles.value = (people.items || []).slice(0, 6)
  } finally {
    loading.value = false
  }
})

function go(path: string, tab = false) {
  if (tab) uni.switchTab({ url: path })
  else uni.navigateTo({ url: path })
}
</script>

<template>
  <view class="page home">
    <MiniNavBar title="剧幕录" :back="false" />
    <view class="brand">
      <text class="brand__name">剧幕录</text>
      <text class="brand__line">幕前有演绎，幕后有记录。</text>
      <text class="brand__description">查 DM、看店家、记角色体验，也记录值得被看见的口碑事件。</text>
    </view>

    <view class="entry-grid">
      <view class="entry surface" @tap="go('/pages/stores/index')">
        <text class="entry__title">店家档案</text>
        <text class="entry__meta">查城市店家和到店评价</text>
      </view>
      <view class="entry surface" @tap="go('/pages/roles/index')">
        <text class="entry__title">角色点评</text>
        <text class="entry__meta">无剧透体验与剧透深评</text>
      </view>
    </view>

    <view class="section-head">
      <text class="section-title">最近完善主页的人</text>
    </view>
    <scroll-view v-if="profiles.length" class="people" scroll-x :show-scrollbar="false">
      <view class="people__track">
        <view v-for="person in profiles" :key="person.id" class="person surface" @tap="go(`/pages/profile/detail?id=${encoded(person.id)}`)">
          <image v-if="person.avatar" class="person__avatar" :src="person.avatar" mode="aspectFill" />
          <view v-else class="person__avatar person__placeholder">{{ person.display_name.slice(0, 1) }}</view>
          <text class="person__name">{{ person.display_name }}</text>
          <text class="person__meta">{{ person.city || '城市待补' }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="section-head">
      <text class="section-title">最近收录的 DM</text>
      <text class="section-more" @tap="go('/pages/dm/index', true)">查看全部</text>
    </view>
    <view v-if="loading" class="surface loading">加载中...</view>
    <DossierCard v-for="item in dmItems" :key="item.id" :item="item" @open="go(`/pages/dm/detail?id=${encoded(item.id)}`)" />

    <view class="section-head">
      <text class="section-title">近期口碑事件</text>
      <text class="section-more" @tap="go('/pages/rankings/index', true)">查看全部</text>
    </view>
    <RankingCard v-for="item in rankings" :key="item.id" :item="item" @open="go(`/pages/rankings/detail?id=${encoded(item.id)}`)" />
  </view>
</template>

<style scoped>
.brand { padding: 30rpx 4rpx 24rpx; border-bottom: 1rpx solid #eee5d8; }
.brand__name { display: block; color: #1f2937; font-family: serif; font-size: 52rpx; font-weight: 900; }
.brand__line { display: block; margin-top: 8rpx; color: #9a651e; font-size: 27rpx; font-weight: 800; }
.brand__description { display: block; margin-top: 12rpx; color: #64748b; font-size: 25rpx; line-height: 1.65; }
.entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.entry { min-height: 142rpx; padding: 20rpx; }
.entry__title, .entry__meta { display: block; }
.entry__title { color: #27364a; font-size: 28rpx; font-weight: 850; }
.entry__meta { margin-top: 8rpx; color: #748093; font-size: 22rpx; line-height: 1.45; }
.section-head { display: flex; align-items: center; justify-content: space-between; }
.section-more { color: #9a651e; font-size: 24rpx; font-weight: 700; }
.loading { padding: 30rpx; color: #64748b; text-align: center; }
.people { width: calc(100% + 24rpx); margin-right: -24rpx; }
.people__track { display: flex; gap: 12rpx; padding-right: 24rpx; }
.person { width: 178rpx; flex: 0 0 178rpx; padding: 14rpx; }
.person__avatar { width: 68rpx; height: 68rpx; border-radius: 50%; background: #f2ece4; }
.person__placeholder { display: flex; align-items: center; justify-content: center; color: #9a651e; font-weight: 900; }
.person__name, .person__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person__name { margin-top: 10rpx; color: #27364a; font-size: 24rpx; font-weight: 850; }
.person__meta { margin-top: 4rpx; color: #748093; font-size: 20rpx; }
</style>
