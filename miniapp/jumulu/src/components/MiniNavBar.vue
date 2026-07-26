<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  home?: boolean
  back?: boolean
  inlineBack?: boolean
  fallback?: string
}>(), { subtitle: '', home: false, back: true, inlineBack: false, fallback: '/pages/index/index' })

const emit = defineEmits<{ back: [] }>()

const statusBarHeight = ref(20)
const barHeight = ref(44)
const rightReserve = ref(96)
const unreadCount = ref(Math.max(0, Number(uni.getStorageSync('jumulu:notifications:unread') || 0)))
const showMessageEntry = ref(true)
const showBack = ref(props.back)
const tabPages = new Set(['pages/index/index', 'pages/rankings/index', 'pages/commissions/index', 'pages/carpools/index', 'pages/mine/index'])
const navStyle = computed(() => `padding-top:${statusBarHeight.value}px`)
const innerStyle = computed(() => `height:${barHeight.value}px;padding-right:${rightReserve.value}px`)
const actionRightStyle = computed(() => `right:${rightReserve.value}px`)
const contentReserve = computed(() => rightReserve.value + (showMessageEntry.value ? 46 : 0))
const titleStyle = computed(() => `right:${contentReserve.value}px;left:${contentReserve.value}px`)
const brandStyle = computed(() => `right:${contentReserve.value}px`)
const unreadLabel = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value))

function updateUnread(value: unknown) {
  unreadCount.value = Math.max(0, Number(value || 0))
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentRoute = pages[pages.length - 1]?.route || ''
  showMessageEntry.value = currentRoute !== 'pages/mine/account-status'
  showBack.value = props.back && !tabPages.has(currentRoute)
  const windowInfo = uni.getWindowInfo()
  statusBarHeight.value = Number(windowInfo.statusBarHeight || 20)
  try {
    const capsule = uni.getMenuButtonBoundingClientRect?.()
    if (capsule?.height) {
      const verticalGap = Math.max(4, capsule.top - statusBarHeight.value)
      barHeight.value = capsule.height + verticalGap * 2
      rightReserve.value = Math.max(88, Number(windowInfo.windowWidth || 375) - capsule.left + 8)
    }
  } catch { /* use stable fallback dimensions */ }
  uni.$on('jumulu:notification-count', updateUnread)
})

onUnmounted(() => uni.$off('jumulu:notification-count', updateUnread))

function openNotifications() {
  uni.navigateTo({ url: '/pages/mine/account-status' })
}

function goBack() {
  if (props.inlineBack) {
    emit('back')
    return
  }
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  if (tabPages.has(props.fallback.replace(/^\//, ''))) uni.switchTab({ url: props.fallback })
  else uni.reLaunch({ url: props.fallback })
}
</script>

<template>
  <view class="mini-nav" :style="navStyle">
    <view class="mini-nav__inner" :style="innerStyle">
      <button v-if="showBack" class="mini-nav__back" aria-label="返回" @tap="goBack">
        <text class="mini-nav__chevron">‹</text><text class="mini-nav__back-label">返回</text>
      </button>
      <view v-else class="mini-nav__back-spacer" />
      <view v-if="home" class="mini-nav__brand" :style="brandStyle">
        <text class="mini-nav__brand-name">{{ title }}</text>
        <text v-if="subtitle" class="mini-nav__brand-subtitle">{{ subtitle }}</text>
      </view>
      <text v-else class="mini-nav__title" :style="titleStyle">{{ title }}</text>
      <button v-if="showMessageEntry" class="mini-nav__message" :style="actionRightStyle" aria-label="消息通知" @tap="openNotifications">
        <image src="/static/icons/message-star.png" mode="aspectFit" />
        <text v-if="unreadCount > 0" class="mini-nav__badge">{{ unreadLabel }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.mini-nav { position: sticky; z-index: 700; top: 0; margin: 0 -24rpx; border-bottom: 1rpx solid #e8e4dc; background: rgba(255, 253, 248, 0.98); }
.mini-nav__inner { position: relative; display: flex; align-items: center; min-height: 44px; padding-left: 12rpx; }
.mini-nav__back, .mini-nav__back-spacer { width: 124rpx; height: 68rpx; flex: 0 0 124rpx; margin: 0; padding: 0; }
.mini-nav__back { display: flex; align-items: center; border: 0; background: transparent; color: #275389; font-size: 26rpx; line-height: 68rpx; }
.mini-nav__chevron { margin-right: 4rpx; font-size: 46rpx; font-weight: 400; line-height: 1; }
.mini-nav__back-label { font-size: 25rpx; font-weight: 750; }
.mini-nav__title { position: absolute; overflow: hidden; color: #202938; font-size: 28rpx; font-weight: 850; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.mini-nav__brand { position: absolute; left: 24rpx; display: flex; align-items: baseline; min-width: 0; gap: 12rpx; overflow: hidden; }
.mini-nav__brand-name { flex: 0 0 auto; color: #172033; font-family: serif; font-size: 38rpx; font-weight: 900; line-height: 1; }
.mini-nav__brand-subtitle { min-width: 0; overflow: hidden; color: #596579; font-size: 21rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.mini-nav__message { position: absolute; top: 50%; display: flex; width: 34px; height: 32px; align-items: center; justify-content: center; margin: 0 4px 0 0; padding: 0; transform: translateY(-50%); border: 1rpx solid #d8dee8; border-radius: 8px; background: #fff; line-height: 32px; }
.mini-nav__message image { width: 18px; height: 18px; }
.mini-nav__badge { position: absolute; top: -5px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; border: 1px solid #fff; border-radius: 9px; background: #c83939; color: #fff; font-size: 9px; font-weight: 850; line-height: 15px; text-align: center; }
</style>
