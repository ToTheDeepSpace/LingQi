<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MiniNavBar from '../../components/MiniNavBar.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Dossier, PublicProfile, Ranking, Script } from '../../types'
import { apiRequest, encoded, readAuth } from '../../utils/api'
import { RANKING_TYPE_TEXT, compactText, dateText, ratingText } from '../../utils/format'

type HomeLink = {
  id: string
  kind: string
  title: string
  meta: string
  image?: string | null
  icon: string
  path: string
  date?: string
  score?: string
}

const tabPages = new Set([
  '/pages/index/index',
  '/pages/rankings/index',
  '/pages/commissions/index',
  '/pages/carpools/index',
  '/pages/mine/index',
])

type EncyclopediaCategory = 'experience' | 'scripts' | 'people' | 'venues'

const categories: Array<{ key: EncyclopediaCategory; label: string; icon: string }> = [
  { key: 'experience', label: '体验', icon: '/static/icons/ui-sparkles.png' },
  { key: 'scripts', label: '剧本', icon: '/static/icons/ui-book-2.png' },
  { key: 'people', label: '人物', icon: '/static/icons/ui-user.png' },
  { key: 'venues', label: '场馆', icon: '/static/icons/ui-building-store.png' },
]

const dmItems = ref<Dossier[]>([])
const storeItems = ref<Dossier[]>([])
const rankings = ref<Ranking[]>([])
const profiles = ref<PublicProfile[]>([])
const scripts = ref<Script[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const activeCategory = ref<EncyclopediaCategory | ''>('')

const activeCategoryMeta = computed(() => ({
  experience: { title: '体验', note: '公开口碑与体验记录', action: '查看口碑', path: '/pages/rankings/index' },
  scripts: { title: '剧本', note: '先选剧本，再看已有角色评分', action: '', path: '' },
  people: { title: '人物', note: 'DM 与公开人物档案', action: '新建档案', path: '/pages/dm/index' },
  venues: { title: '场馆', note: '店家与沉浸式娱乐场馆', action: '新建档案', path: '/pages/stores/index' },
}[activeCategory.value || 'scripts']))

const categorySearchPlaceholders: Record<EncyclopediaCategory, string> = {
  experience: '搜索对象、标题或剧本',
  scripts: '搜索剧本、角色或发行',
  people: '搜索人物、城市、店家或标签',
  venues: '搜索场馆、城市或标签',
}
const searchPlaceholder = computed(() => activeCategory.value ? categorySearchPlaceholders[activeCategory.value] : '搜索剧本、人物、场馆、体验')

function dossierImage(item: Dossier) {
  return item.photo_url || item.photo_files?.[0]?.url || null
}

function dossierMeta(item: Dossier) {
  const place = item.entity_type === 'store' ? item.city : item.workplace || item.city
  const rating = item.rating_summary?.review_count
    ? `${ratingText(item.rating_summary.avg)} 分 · ${item.rating_summary.review_count} 条体验`
    : '等待第一条体验记录'
  return [place, rating].filter(Boolean).join(' · ')
}

function shortDate(value?: string | null) {
  const date = dateText(value)
  return date ? date.slice(5).replace('-', '.') : ''
}

function dossierLink(item: Dossier): HomeLink {
  const store = item.entity_type === 'store'
  return {
    id: `${store ? 'store' : 'dm'}:${item.id}`,
    kind: store ? '场馆' : '人物',
    title: item.dm_name,
    meta: dossierMeta(item),
    image: dossierImage(item),
    icon: store ? '/static/icons/ui-building-store.png' : '/static/icons/ui-user.png',
    path: `${store ? '/pages/stores/detail' : '/pages/dm/detail'}?id=${encoded(item.id)}`,
    date: shortDate(item.created_at),
  }
}

function scriptRatedRoleCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].filter(role => Number(role.rating_count || 0) > 0).length
}

function scriptRatingCount(script: Script) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])].reduce((sum, role) => sum + Number(role.rating_count || 0), 0)
}

function scriptLink(script: Script): HomeLink {
  const rated = scriptRatedRoleCount(script)
  return {
    id: `script:${script.id}`,
    kind: '剧本',
    title: script.name,
    meta: rated
      ? `${rated} 个角色已有评价 · ${scriptRatingCount(script)} 条`
      : `${(script.player_roles?.length || 0) + (script.actor_roles?.length || 0)} 个已收录角色 · 等待第一条评价`,
    icon: '/static/icons/ui-book-2.png',
    path: `/pages/roles/script-detail?id=${encoded(script.id)}`,
  }
}

const featured = computed<HomeLink | null>(() => {
  const event = rankings.value.find(item => item.display_files?.[0]?.url)
  if (event) {
    return {
      id: `ranking:${event.id}`,
      kind: `${RANKING_TYPE_TEXT[event.type]} · ${event.subject_city || '城市待补'}`,
      title: event.subject_name,
      meta: compactText(event.content, 58),
      image: event.display_files?.[0]?.url,
      icon: '/static/icons/ui-sparkles.png',
      path: `/pages/rankings/detail?id=${encoded(event.id)}`,
      score: `同意 ${event.agree_count ?? event.likes ?? 0} · 欢乐 ${event.joys || 0}`,
    }
  }
  const dm = dmItems.value.find(item => dossierImage(item))
  if (!dm) return null
  return {
    ...dossierLink(dm),
    kind: `DM · ${dm.city || '城市待补'}`,
    meta: compactText(dm.bio || dm.note || dossierMeta(dm), 58),
    score: dm.rating_summary?.review_count
      ? `${ratingText(dm.rating_summary.avg)} 分 · ${dm.rating_summary.review_count} 人评价`
      : '新收录档案',
  }
})

const recentItems = computed<HomeLink[]>(() => {
  const dossiers = [...dmItems.value, ...storeItems.value]
    .filter(item => !featured.value || `${item.entity_type === 'store' ? 'store' : 'dm'}:${item.id}` !== featured.value.id)
    .map(dossierLink)
  const people: HomeLink[] = profiles.value.map(item => ({
    id: `profile:${item.id}`,
    kind: '用户主页',
    title: item.display_name,
    meta: [item.city, compactText(item.bio, 28)].filter(Boolean).join(' · ') || '公开个人主页',
    image: item.avatar,
    icon: '/static/icons/ui-user.png',
    path: `/pages/profile/detail?id=${encoded(item.id)}`,
  }))
  return [...dossiers, ...people].slice(0, 4)
})

const incompleteItems = computed<HomeLink[]>(() => {
  const result: HomeLink[] = []
  for (const script of scripts.value) {
    if ((script.player_roles?.length || 0) + (script.actor_roles?.length || 0) > 0) continue
    result.push({
      id: `script:${script.id}`,
      kind: '剧本',
      title: script.name,
      meta: '角色资料待补充',
      icon: '/static/icons/ui-book-2.png',
      path: `/pages/roles/script-detail?id=${encoded(script.id)}`,
    })
  }
  for (const item of dmItems.value) {
    const missing = !item.bio ? '人物简介待补充' : !item.common_scripts?.length ? '常开剧本待补充' : !dossierImage(item) ? '档案图片待补充' : ''
    if (missing) result.push({ ...dossierLink(item), meta: missing })
  }
  for (const item of storeItems.value) {
    const missing = !item.note && !item.bio ? '场馆介绍待补充' : !dossierImage(item) ? '场馆图片待补充' : ''
    if (missing) result.push({ ...dossierLink(item), meta: missing })
  }
  return result.slice(0, 4)
})

const searchResults = computed<HomeLink[]>(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!keyword) return []
  const dossierResults = [...dmItems.value, ...storeItems.value]
    .filter(item => [item.dm_name, item.city, item.workplace, item.bio, item.note, ...(item.tags || []), ...(item.common_scripts || []).map(script => script.name)]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(keyword))
    .map(dossierLink)
  const scriptResults: HomeLink[] = scripts.value
    .filter(item => item.name.toLocaleLowerCase('zh-CN').includes(keyword))
    .map(scriptLink)
  const profileResults: HomeLink[] = profiles.value
    .filter(item => [item.display_name, item.city, item.bio, ...(item.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
    .map(item => ({
      id: `profile:${item.id}`,
      kind: '用户主页',
      title: item.display_name,
      meta: item.city || '公开个人主页',
      image: item.avatar,
      icon: '/static/icons/ui-user.png',
      path: `/pages/profile/detail?id=${encoded(item.id)}`,
    }))
  const rankingResults: HomeLink[] = rankings.value
    .filter(item => [item.subject_name, item.content, item.event_script_name, item.event_store_name].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
    .map(item => ({
      id: `ranking:${item.id}`,
      kind: RANKING_TYPE_TEXT[item.type],
      title: item.subject_name,
      meta: compactText(item.content, 38),
      image: item.display_files?.[0]?.url,
      icon: '/static/icons/ui-sparkles.png',
      path: `/pages/rankings/detail?id=${encoded(item.id)}`,
    }))
  return [...dossierResults, ...scriptResults, ...profileResults, ...rankingResults].slice(0, 12)
})

const categoryItems = computed<HomeLink[]>(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  if (activeCategory.value === 'scripts') {
    return scripts.value
      .filter(item => !keyword || [item.name, ...(item.player_roles || []).map(role => role.role_name), ...(item.actor_roles || []).map(role => role.role_name)]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(keyword))
      .sort((left, right) => scriptRatedRoleCount(right) - scriptRatedRoleCount(left) || scriptRatingCount(right) - scriptRatingCount(left) || left.name.localeCompare(right.name, 'zh-CN'))
      .map(scriptLink)
  }
  if (activeCategory.value === 'experience') {
    return rankings.value
      .filter(item => !keyword || [item.subject_name, item.content, item.event_script_name, item.event_store_name].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
      .map(item => ({
        id: `ranking:${item.id}`,
        kind: RANKING_TYPE_TEXT[item.type],
        title: item.subject_name,
        meta: [item.subject_city, item.event_script_name ? `《${item.event_script_name}》` : '', compactText(item.content, 34)].filter(Boolean).join(' · '),
        image: item.display_files?.[0]?.url,
        icon: '/static/icons/ui-sparkles.png',
        path: `/pages/rankings/detail?id=${encoded(item.id)}`,
      }))
  }
  if (activeCategory.value === 'people') {
    const dossiers = dmItems.value
      .filter(item => !keyword || [item.dm_name, item.city, item.workplace, item.bio, item.note, ...(item.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
      .map(dossierLink)
    const publicPeople = profiles.value
      .filter(item => !keyword || [item.display_name, item.city, item.bio, ...(item.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
      .map(item => ({
        id: `profile:${item.id}`,
        kind: '用户主页',
        title: item.display_name,
        meta: [item.city, compactText(item.bio, 34)].filter(Boolean).join(' · ') || '公开个人主页',
        image: item.avatar,
        icon: '/static/icons/ui-user.png',
        path: `/pages/profile/detail?id=${encoded(item.id)}`,
      }))
    return [...dossiers, ...publicPeople]
  }
  if (activeCategory.value === 'venues') {
    return storeItems.value
      .filter(item => !keyword || [item.dm_name, item.city, item.bio, item.note, ...(item.tags || [])].join(' ').toLocaleLowerCase('zh-CN').includes(keyword))
      .map(dossierLink)
  }
  return []
})

async function load() {
  loading.value = true
  error.value = ''
  let followedCities: string[] = []
  try {
    if (readAuth()?.token) {
      const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
      followedCities = follows.cities || []
    }
  } catch { /* 首页仍可使用公开数据 */ }
  const cityQuery = followedCities.length ? `&cities=${encoded(followedCities.join(','))}` : ''
  const requests = await Promise.allSettled([
    apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=dm'),
    apiRequest<Dossier[]>('/lc/dm-dossiers?entityType=store'),
    apiRequest<Ranking[]>(`/lc/rankings?sort=latest${cityQuery}`),
    apiRequest<{ items: PublicProfile[] }>(`/lc/creators?limit=8${cityQuery}`),
    apiRequest<Script[]>('/lc/scripts'),
  ])
  const fulfilled = requests.filter(item => item.status === 'fulfilled').length
  if (requests[0].status === 'fulfilled') dmItems.value = requests[0].value
  if (requests[1].status === 'fulfilled') storeItems.value = requests[1].value
  if (requests[2].status === 'fulfilled') rankings.value = requests[2].value
  if (requests[3].status === 'fulfilled') profiles.value = requests[3].value.items || []
  if (requests[4].status === 'fulfilled') scripts.value = requests[4].value
  if (!fulfilled) error.value = '百科内容暂时没有加载出来'
  loading.value = false
}

function go(path: string) {
  if (tabPages.has(path)) uni.switchTab({ url: path })
  else uni.navigateTo({ url: path })
}

function selectCategory(category: EncyclopediaCategory) {
  activeCategory.value = category
  query.value = ''
  uni.setStorageSync('jumulu:encyclopedia:category', category)
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

function leaveCategory() {
  activeCategory.value = ''
  query.value = ''
  uni.removeStorageSync('jumulu:encyclopedia:category')
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

onMounted(() => {
  const stored = String(uni.getStorageSync('jumulu:encyclopedia:category') || '')
  if (categories.some(item => item.key === stored)) activeCategory.value = stored as EncyclopediaCategory
  void load()
})
</script>

<template>
  <view class="page home">
    <MiniNavBar title="剧幕录" subtitle="沉浸式娱乐百科" home :back="false" />

    <view class="search-box">
      <image class="search-box__icon" src="/static/icons/ui-search.png" mode="aspectFit" />
      <input v-model="query" class="search-box__input" confirm-type="search" :placeholder="searchPlaceholder" />
      <text v-if="query" class="search-box__clear" @tap="query = ''">清除</text>
    </view>

    <view class="category-nav">
      <view v-for="item in categories" :key="item.label" class="category-nav__item" :class="{ active: activeCategory === item.key }" @tap="selectCategory(item.key)">
        <image class="category-nav__icon" :src="item.icon" mode="aspectFit" />
        <text class="category-nav__label">{{ item.label }}</text>
      </view>
    </view>

    <StatePanel v-if="loading || error" :loading="loading" :error="error" @retry="load" />

    <template v-if="!loading && !error && activeCategory">
      <view class="category-head">
        <view class="category-head__copy" @tap="leaveCategory"><text class="category-head__back">‹ 百科</text><text class="category-head__title">{{ activeCategoryMeta.title }}</text><text class="category-head__note">{{ activeCategoryMeta.note }}</text></view>
        <text v-if="activeCategoryMeta.action" class="section-more" @tap="go(activeCategoryMeta.path)">{{ activeCategoryMeta.action }}</text>
      </view>
      <view v-if="categoryItems.length" class="row-list category-list">
        <view v-for="item in categoryItems" :key="item.id" class="content-row" @tap="go(item.path)">
          <image class="content-row__image" :src="item.image || item.icon" :mode="item.image ? 'aspectFill' : 'aspectFit'" />
          <view class="content-row__copy">
            <view class="content-row__title-line"><text class="content-row__title">{{ item.title }}</text><text class="content-row__kind">{{ item.kind }}</text></view>
            <text class="content-row__meta">{{ item.meta }}</text>
          </view>
          <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
        </view>
      </view>
      <view v-else class="search-empty"><text class="search-empty__title">没有找到符合条件的{{ activeCategoryMeta.title }}</text><text class="search-empty__meta">可以更换关键词后再试</text></view>
    </template>

    <template v-else-if="!loading && !error && query.trim()">
      <view class="section-head search-head">
        <text class="section-title">搜索结果</text>
        <text class="section-note">{{ searchResults.length }} 条</text>
      </view>
      <view v-if="searchResults.length" class="row-list">
        <view v-for="item in searchResults" :key="item.id" class="content-row" @tap="go(item.path)">
          <image class="content-row__image" :src="item.image || item.icon" :mode="item.image ? 'aspectFill' : 'aspectFit'" />
          <view class="content-row__copy">
            <view class="content-row__title-line"><text class="content-row__title">{{ item.title }}</text><text class="content-row__kind">{{ item.kind }}</text></view>
            <text class="content-row__meta">{{ item.meta }}</text>
          </view>
          <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
        </view>
      </view>
      <view v-else class="search-empty">
        <text class="search-empty__title">暂时没有找到“{{ query.trim() }}”</text>
        <text class="search-empty__meta">可以换个名称、城市、标签或剧本再试</text>
      </view>
    </template>

    <template v-else-if="!loading && !error">
      <view v-if="featured" class="section-block featured-section">
        <view class="section-head">
          <text class="section-title">编辑推荐</text>
          <text class="section-more" @tap="go('/pages/rankings/index')">查看口碑</text>
        </view>
        <view class="featured" @tap="go(featured.path)">
          <image class="featured__image" :src="featured.image || featured.icon" mode="aspectFill" />
          <view class="featured__copy">
            <text class="featured__kind">{{ featured.kind }}</text>
            <text class="featured__title">{{ featured.title }}</text>
            <text v-if="featured.score" class="featured__score">{{ featured.score }}</text>
            <text class="featured__meta">{{ featured.meta }}</text>
            <text class="featured__action">查看详情</text>
          </view>
        </view>
      </view>

      <view v-if="recentItems.length" class="section-block">
        <view class="section-head">
          <text class="section-title">本周新收录</text>
          <text class="section-note">持续更新</text>
        </view>
        <view class="row-list">
          <view v-for="item in recentItems" :key="item.id" class="content-row" @tap="go(item.path)">
            <image class="content-row__image" :src="item.image || item.icon" :mode="item.image ? 'aspectFill' : 'aspectFit'" />
            <view class="content-row__copy">
              <view class="content-row__title-line"><text class="content-row__title">{{ item.title }}</text><text class="content-row__kind">{{ item.kind }}</text></view>
              <text class="content-row__meta">{{ item.meta }}</text>
            </view>
            <text v-if="item.date" class="content-row__date">{{ item.date }}</text>
            <image v-else class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
          </view>
        </view>
      </view>

      <view v-if="incompleteItems.length" class="section-block community-section">
        <view class="section-head">
          <view><text class="section-title">等待大家完善</text><text class="section-subtitle">社区共建的资料会标注来源并进入审核</text></view>
          <text class="section-more" @tap="go('/pages/dm/index')">参与共建</text>
        </view>
        <view class="community-list">
          <view v-for="item in incompleteItems" :key="item.id" class="community-row" @tap="go(item.path)">
            <image class="community-row__icon" :src="item.icon" mode="aspectFit" />
            <view class="community-row__copy"><text class="community-row__title">{{ item.kind }} {{ item.title }}</text><text class="community-row__meta">{{ item.meta }}</text></view>
            <image class="chevron" src="/static/icons/ui-chevron-right.png" mode="aspectFit" />
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.home { padding-bottom: calc(34rpx + env(safe-area-inset-bottom)); }
.search-box { display: flex; align-items: center; height: 82rpx; margin: 22rpx 0 4rpx; padding: 0 22rpx; border: 1rpx solid #d8dde4; border-radius: 10rpx; background: #fff; }
.search-box__icon { width: 34rpx; height: 34rpx; flex: 0 0 34rpx; margin-right: 14rpx; }
.search-box__input { min-width: 0; height: 78rpx; flex: 1; color: #1f2937; font-size: 27rpx; }
.search-box__clear { flex: 0 0 auto; margin-left: 12rpx; color: #9a651e; font-size: 22rpx; font-weight: 750; }
.category-nav { display: grid; grid-template-columns: repeat(4, 1fr); margin: 8rpx 0 0; padding: 22rpx 0 24rpx; border-bottom: 1rpx solid #e5e7eb; }
.category-nav__item { display: flex; align-items: center; justify-content: center; flex-direction: column; min-height: 86rpx; }
.category-nav__item.active { background: #fff8e9; }
.category-nav__icon { width: 43rpx; height: 43rpx; }
.category-nav__label { margin-top: 10rpx; color: #27364a; font-size: 24rpx; font-weight: 750; }
.section-block { padding: 26rpx 0 4rpx; border-bottom: 1rpx solid #e5e7eb; }
.featured-section { padding-top: 26rpx; }
.community-section { border-bottom: 0; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-bottom: 16rpx; }
.section-title { margin: 0; font-size: 31rpx; font-weight: 850; }
.section-more { flex: 0 0 auto; color: #9a651e; font-size: 23rpx; font-weight: 750; }
.section-note { flex: 0 0 auto; color: #8a93a2; font-size: 21rpx; }
.section-subtitle { display: block; margin-top: 4rpx; color: #8a93a2; font-size: 20rpx; line-height: 1.4; }
.featured { display: grid; grid-template-columns: 242rpx minmax(0, 1fr); gap: 22rpx; padding: 2rpx 0 26rpx; }
.featured__image { width: 242rpx; height: 282rpx; border-radius: 8rpx; background: #f1f3f5; }
.featured__copy { display: flex; align-items: flex-start; min-width: 0; flex-direction: column; padding-top: 2rpx; }
.featured__kind { color: #8b5919; font-size: 21rpx; font-weight: 800; }
.featured__title { display: -webkit-box; overflow: hidden; margin-top: 10rpx; color: #172033; font-family: serif; font-size: 38rpx; font-weight: 900; line-height: 1.25; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.featured__score { margin-top: 12rpx; color: #9a651e; font-size: 24rpx; font-weight: 800; }
.featured__meta { display: -webkit-box; overflow: hidden; margin-top: 12rpx; color: #64748b; font-size: 23rpx; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.featured__action { margin-top: auto; color: #9a651e; font-size: 22rpx; font-weight: 800; }
.row-list { border-top: 1rpx solid #eceff2; }
.content-row { display: flex; align-items: center; min-height: 124rpx; gap: 16rpx; padding: 15rpx 0; border-bottom: 1rpx solid #eceff2; }
.content-row:last-child { border-bottom: 0; }
.content-row__image { width: 124rpx; height: 92rpx; flex: 0 0 124rpx; padding: 0; border-radius: 7rpx; background: #f4f5f7; }
.content-row__image[mode='aspectFit'] { padding: 22rpx; }
.content-row__copy { min-width: 0; flex: 1; }
.content-row__title-line { display: flex; align-items: center; min-width: 0; gap: 10rpx; }
.content-row__title { min-width: 0; overflow: hidden; color: #27364a; font-size: 27rpx; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.content-row__kind { flex: 0 0 auto; padding: 3rpx 7rpx; border-radius: 5rpx; background: #f4f5f7; color: #7b8492; font-size: 18rpx; }
.content-row__meta { display: -webkit-box; overflow: hidden; margin-top: 7rpx; color: #748093; font-size: 21rpx; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.content-row__date { max-width: 110rpx; flex: 0 0 auto; color: #9aa2af; font-size: 19rpx; text-align: right; }
.chevron { width: 24rpx; height: 24rpx; flex: 0 0 24rpx; }
.community-list { border-top: 1rpx solid #eceff2; }
.community-row { display: flex; align-items: center; min-height: 96rpx; gap: 14rpx; border-bottom: 1rpx solid #eceff2; }
.community-row:last-child { border-bottom: 0; }
.community-row__icon { width: 36rpx; height: 36rpx; flex: 0 0 36rpx; padding: 5rpx; border-radius: 6rpx; background: #f5f2ed; }
.community-row__copy { min-width: 0; flex: 1; }
.community-row__title, .community-row__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.community-row__title { color: #27364a; font-size: 25rpx; font-weight: 800; }
.community-row__meta { margin-top: 5rpx; color: #8a93a2; font-size: 20rpx; }
.search-head { margin-top: 28rpx; }
.category-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18rpx; padding: 24rpx 0 16rpx; }
.category-head__copy { min-width: 0; }
.category-head__back, .category-head__title, .category-head__note { display: block; }
.category-head__back { color: #275389; font-size: 21rpx; font-weight: 750; }
.category-head__title { margin-top: 5rpx; color: #172033; font-family: serif; font-size: 38rpx; font-weight: 900; }
.category-head__note { margin-top: 4rpx; color: #7c8795; font-size: 21rpx; }
.category-list { border-top: 1rpx solid #eceff2; }
.search-empty { padding: 72rpx 22rpx; border-top: 1rpx solid #eceff2; text-align: center; }
.search-empty__title, .search-empty__meta { display: block; }
.search-empty__title { color: #27364a; font-size: 27rpx; font-weight: 800; }
.search-empty__meta { margin-top: 10rpx; color: #8a93a2; font-size: 22rpx; }
</style>
