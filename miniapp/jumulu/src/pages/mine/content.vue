<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad(() => {
  uni.redirectTo({ url: '/pages/mine/account-status?tab=submissions' })
})
</script>

<template>
  <view class="page redirect-state">正在打开消息中心...</view>
</template>

<style scoped>
.redirect-state { padding-top: 80rpx; color: #7b8492; font-size: 23rpx; text-align: center; }
</style>
