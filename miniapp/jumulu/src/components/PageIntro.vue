<script setup lang="ts">
import MiniNavBar from './MiniNavBar.vue'

defineProps<{ eyebrow?: string; title: string; navTitle?: string; description?: string; fallback?: string }>()
</script>

<template>
  <MiniNavBar :title="navTitle || title" :fallback="fallback" />
  <view v-if="$slots.default" class="intro-actions"><slot /></view>
</template>

<style scoped>
.intro-actions { padding: 16rpx 0 8rpx; }
</style>
