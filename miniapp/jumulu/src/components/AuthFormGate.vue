<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { readAuth, requireLogin } from '../utils/api'

withDefaults(defineProps<{
  message?: string
}>(), {
  message: '登录后才能继续填写',
})

const authenticated = ref(Boolean(readAuth()?.token))
let redirectTimer: ReturnType<typeof setTimeout> | null = null

function syncAuth() {
  authenticated.value = Boolean(readAuth()?.token)
  if (authenticated.value && redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

onMounted(() => {
  uni.$on('jumulu:auth-changed', syncAuth)
  if (!authenticated.value) {
    redirectTimer = setTimeout(() => {
      redirectTimer = null
      void requireLogin().catch(() => undefined)
    }, 80)
  }
})

onUnmounted(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
  uni.$off('jumulu:auth-changed', syncAuth)
})

function goLogin() {
  void requireLogin().catch(() => undefined)
}
</script>

<template>
  <slot v-if="authenticated" />
  <view v-else class="auth-form-gate">
    <text>{{ message }}</text>
    <button class="primary-button" @tap="goLogin">去登录</button>
  </view>
</template>

<style scoped>
.auth-form-gate { display: grid; gap: 18rpx; margin-top: 24rpx; padding: 32rpx 24rpx; border: 1rpx solid #e2e5e9; border-radius: 8rpx; background: #fff; color: #475569; text-align: center; }
.auth-form-gate button { width: 100%; margin: 0; }
</style>
