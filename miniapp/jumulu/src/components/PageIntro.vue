<script setup lang="ts">
import MiniNavBar from './MiniNavBar.vue'

defineProps<{ eyebrow?: string; title: string; navTitle?: string; description?: string; fallback?: string }>()
</script>

<template>
  <MiniNavBar :title="navTitle || title" :fallback="fallback" />
  <view class="intro">
    <text v-if="eyebrow" class="intro__eyebrow">{{ eyebrow }}</text>
    <text v-if="description" class="intro__description">{{ description }}</text>
    <view v-if="$slots.default" class="intro__actions"><slot /></view>
  </view>
</template>

<style scoped>
.intro {
  padding: 24rpx 4rpx 18rpx;
}
.intro__eyebrow { display: block; color: #9a651e; font-size: 22rpx; font-weight: 800; }
.intro__description { display: block; margin-top: 6rpx; color: #64748b; font-size: 24rpx; line-height: 1.55; }
.intro__actions { margin-top: 16rpx; }
</style>
