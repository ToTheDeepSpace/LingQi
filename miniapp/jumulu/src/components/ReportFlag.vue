<script setup lang="ts">
import { encoded } from '../utils/api'

const props = withDefaults(defineProps<{
  targetType: string
  targetId: string
  title: string
  targetSubId?: string
  own?: boolean
}>(), {
  targetSubId: '',
  own: false,
})

function open() {
  if (props.own) return
  const sub = props.targetSubId ? `&targetSubId=${encoded(props.targetSubId)}` : ''
  uni.navigateTo({
    url: `/pages/report/index?targetType=${encoded(props.targetType)}&targetId=${encoded(props.targetId)}&title=${encoded(props.title)}${sub}`,
  })
}
</script>

<template>
  <button v-if="!own" class="report-flag" aria-label="举报这条内容" @tap.stop="open">⚑</button>
</template>

<style scoped>
.report-flag { display: flex; align-items: center; justify-content: center; width: 46rpx; min-width: 46rpx; height: 46rpx; min-height: 46rpx; margin: 0; padding: 0; border: 0; border-radius: 6rpx; background: transparent; color: #7b8492; font-size: 27rpx; line-height: 1; }
.report-flag::after { border: 0; }
</style>
