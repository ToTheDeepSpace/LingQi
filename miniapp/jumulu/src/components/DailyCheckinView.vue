<script setup lang="ts">
import { computed, ref } from 'vue'
import MiniNavBar from './MiniNavBar.vue'
import StatePanel from './StatePanel.vue'
import type { DailyCheckinState } from '../types'
import { apiRequest } from '../utils/api'

const emit = defineEmits<{ back: [] }>()
const state = ref<DailyCheckinState | null>(null)
const loading = ref(false)
const error = ref('')
const claiming = ref(false)

const checkedDates = computed(() => new Set((state.value?.checkins || []).map(item => item.checkin_date)))
const week = computed(() => {
  const anchor = state.value?.today || new Date().toISOString().slice(0, 10)
  const date = new Date(`${anchor}T00:00:00.000Z`)
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(date)
    item.setUTCDate(item.getUTCDate() + index)
    const key = item.toISOString().slice(0, 10)
    return {
      key,
      date: `${item.getUTCMonth() + 1}/${item.getUTCDate()}`,
      weekday: weekdays[item.getUTCDay()],
      today: key === anchor,
      checked: checkedDates.value.has(key),
    }
  })
})

function shortTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

async function load() {
  loading.value = true
  error.value = ''
  try { state.value = await apiRequest<DailyCheckinState>('/lc/daily-checkin') }
  catch (err) { error.value = err instanceof Error ? err.message : '签到记录加载失败' }
  finally { loading.value = false }
}

async function claim() {
  if (claiming.value || state.value?.checked_in) return
  claiming.value = true
  try {
    const next = await apiRequest<DailyCheckinState>('/lc/daily-checkin', { method: 'POST' })
    state.value = next
    const reward = next.claim?.reward || 10
    const bonus = next.claim?.streak_bonus || 0
    uni.showToast({ title: bonus ? `签到 +${reward}，含连签奖励` : `签到 +${reward}`, icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally { claiming.value = false }
}

void load()
defineExpose({ load })
</script>

<template>
  <view class="checkin-view">
    <MiniNavBar title="每日签到" inline-back @back="emit('back')" />
    <StatePanel :loading="loading" :error="error" @retry="load" />

    <template v-if="state && !loading && !error">
      <view class="balance-block">
        <text class="balance-block__label">赠送榜金</text>
        <text class="balance-block__value">{{ state.bonus_balance }}</text>
        <text class="balance-block__note">赠送榜金仅用于站内功能，不可提现</text>
      </view>

      <view class="week-strip" aria-label="本周签到">
        <view v-for="day in week" :key="day.key" class="week-day" :class="{ today: day.today }">
          <text class="week-day__date">{{ day.date }}</text>
          <text class="week-day__name">{{ day.today ? '今天' : day.weekday }}</text>
          <view class="week-day__mark" :class="{ checked: day.checked }">{{ day.checked ? '✓' : '' }}</view>
          <text class="week-day__reward">+10</text>
        </view>
      </view>

      <button class="primary-button claim-button" :disabled="claiming || state.checked_in" :loading="claiming" @tap="claim">
        {{ state.checked_in ? '今日已签到' : '今日签到 +10' }}
      </button>
      <text class="streak">已连续签到 <strong>{{ state.current_streak }}</strong> 天<template v-if="state.current_streak && state.current_streak % 7 === 6"> · 明天额外 +5</template></text>

      <view class="ledger">
        <view class="ledger__head"><text>最近明细</text><text>{{ state.transactions.length }} 条</text></view>
        <view v-if="!state.transactions.length" class="ledger__empty">完成第一次签到后，奖励记录会显示在这里。</view>
        <view v-for="item in state.transactions" :key="item.id" class="ledger-row">
          <view><text class="ledger-row__title">{{ item.description }}</text><text class="ledger-row__date">{{ shortTime(item.created_at) }}</text></view>
          <text class="ledger-row__amount">+{{ item.amount }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.checkin-view { min-height: 100vh; }
.balance-block { padding: 34rpx 4rpx 24rpx; border-bottom: 1rpx solid #ece7df; }
.balance-block__label, .balance-block__value, .balance-block__note { display: block; }
.balance-block__label { color: #526170; font-size: 24rpx; font-weight: 750; }
.balance-block__value { margin-top: 8rpx; color: #9a651e; font-family: serif; font-size: 72rpx; font-weight: 900; line-height: 1; }
.balance-block__note { margin-top: 12rpx; color: #738092; font-size: 21rpx; }
.week-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4rpx; padding: 24rpx 0 18rpx; }
.week-day { min-width: 0; padding: 10rpx 2rpx; border: 1rpx solid transparent; border-radius: 8rpx; text-align: center; }
.week-day.today { border-color: #d8af69; background: #fffaf0; }
.week-day__date, .week-day__name, .week-day__reward { display: block; white-space: nowrap; }
.week-day__date { color: #525e6e; font-size: 18rpx; }
.week-day__name { margin-top: 4rpx; color: #27364a; font-size: 19rpx; font-weight: 750; }
.week-day__mark { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; margin: 10rpx auto 0; border: 1rpx solid #cfd4dc; border-radius: 50%; color: #fff; font-size: 22rpx; }
.week-day__mark.checked { border-color: #b27a24; background: #b27a24; }
.week-day__reward { margin-top: 6rpx; color: #7b8492; font-size: 18rpx; }
.claim-button { width: 100%; margin-top: 8rpx; }
.claim-button[disabled] { background: #e7e2d9; color: #7b8492; }
.streak { display: block; padding: 18rpx 0 24rpx; border-bottom: 1rpx solid #e5e7eb; color: #64748b; font-size: 23rpx; text-align: center; }
.streak strong { color: #9a651e; font-size: 30rpx; }
.ledger { padding-top: 24rpx; }
.ledger__head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12rpx; border-bottom: 1rpx solid #eceff2; color: #27364a; font-size: 28rpx; font-weight: 850; }
.ledger__head text:last-child { color: #8a93a2; font-size: 20rpx; font-weight: 500; }
.ledger__empty { padding: 44rpx 10rpx; color: #8a93a2; font-size: 22rpx; text-align: center; }
.ledger-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 108rpx; border-bottom: 1rpx solid #eceff2; }
.ledger-row__title, .ledger-row__date { display: block; }
.ledger-row__title { color: #27364a; font-size: 25rpx; font-weight: 800; }
.ledger-row__date { margin-top: 6rpx; color: #8a93a2; font-size: 20rpx; }
.ledger-row__amount { color: #9a651e; font-size: 29rpx; font-weight: 850; }
</style>
