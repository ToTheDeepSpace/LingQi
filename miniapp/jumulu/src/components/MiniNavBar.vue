<script setup lang="ts">
import { computed, ref } from 'vue'
import { onMounted } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  back?: boolean
  fallback?: string
}>(), { back: true, fallback: '/pages/index/index' })

const statusBarHeight = ref(20)
const barHeight = ref(44)
const rightReserve = ref(96)
const tabPages = new Set(['/pages/index/index', '/pages/dm/index', '/pages/rankings/index', '/pages/carpools/index', '/pages/mine/index'])
const navStyle = computed(() => `padding-top:${statusBarHeight.value}px`)
const innerStyle = computed(() => `height:${barHeight.value}px;padding-right:${rightReserve.value}px`)
const titleStyle = computed(() => `right:${rightReserve.value}px;left:${rightReserve.value}px`)

onMounted(() => {
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
})

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  if (tabPages.has(props.fallback)) uni.switchTab({ url: props.fallback })
  else uni.reLaunch({ url: props.fallback })
}
</script>

<template>
  <view class="mini-nav" :style="navStyle">
    <view class="mini-nav__inner" :style="innerStyle">
      <button v-if="back" class="mini-nav__back" aria-label="返回" @tap="goBack">
        <text class="mini-nav__chevron">‹</text><text class="mini-nav__back-label">返回</text>
      </button>
      <view v-else class="mini-nav__back-spacer" />
      <text class="mini-nav__title" :style="titleStyle">{{ title }}</text>
    </view>
  </view>
</template>

<style scoped>
.mini-nav { position: sticky; z-index: 700; top: 0; margin: 0 -24rpx; border-bottom: 1rpx solid #eee5d8; background: rgba(255, 253, 248, 0.98); }
.mini-nav__inner { position: relative; display: flex; align-items: center; min-height: 44px; padding-left: 12rpx; }
.mini-nav__back, .mini-nav__back-spacer { width: 124rpx; height: 68rpx; flex: 0 0 124rpx; margin: 0; padding: 0; }
.mini-nav__back { display: flex; align-items: center; border: 0; background: transparent; color: #275389; font-size: 26rpx; line-height: 68rpx; }
.mini-nav__chevron { margin-right: 4rpx; font-size: 46rpx; font-weight: 400; line-height: 1; }
.mini-nav__back-label { font-size: 25rpx; font-weight: 750; }
.mini-nav__title { position: absolute; overflow: hidden; color: #202938; font-size: 28rpx; font-weight: 850; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
</style>
