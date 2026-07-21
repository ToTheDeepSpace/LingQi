<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description?: string }>()
</script>

<template>
  <view class="intro">
    <text v-if="eyebrow" class="intro__eyebrow">{{ eyebrow }}</text>
    <text class="intro__title">{{ title }}</text>
    <text v-if="description" class="intro__description">{{ description }}</text>
    <slot />
  </view>
</template>

<style scoped>
.intro {
  padding: 24rpx;
  border: 1rpx solid #eadfce;
  border-radius: 14rpx;
  background: #ffffff;
}
.intro__eyebrow { display: block; color: #9a651e; font-size: 22rpx; font-weight: 800; }
.intro__title { display: block; margin-top: 6rpx; color: #1f2937; font-family: serif; font-size: 40rpx; line-height: 1.25; font-weight: 800; }
.intro__description { display: block; margin-top: 10rpx; color: #64748b; font-size: 25rpx; line-height: 1.6; }
</style>
