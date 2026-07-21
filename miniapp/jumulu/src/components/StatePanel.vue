<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <view v-if="loading || error || empty" class="state surface">
    <text v-if="loading" class="state__text">加载中...</text>
    <template v-else-if="error">
      <text class="state__text danger">{{ error }}</text>
      <button class="state__retry" @tap="$emit('retry')">重新加载</button>
    </template>
    <text v-else class="state__text">{{ emptyText || '暂时没有内容' }}</text>
  </view>
</template>

<style scoped>
.state.surface { margin-top: 14rpx; padding: 38rpx 24rpx; border: 0; background: transparent; text-align: center; }
.state__text { display: block; color: #64748b; line-height: 1.55; }
.state__retry { width: 220rpx; margin: 16rpx auto 0; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #334155; font-size: 24rpx; }
</style>
