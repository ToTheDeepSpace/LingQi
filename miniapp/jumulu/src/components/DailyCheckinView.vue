<script setup lang="ts">
import { computed, ref } from 'vue'
import MiniNavBar from './MiniNavBar.vue'
import StatePanel from './StatePanel.vue'
import type { DailyCheckinState, ReferralSummary } from '../types'
import { apiRequest } from '../utils/api'
import { loadReferralSummary } from '../utils/share'

const props = withDefaults(defineProps<{ preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ back: [] }>()
const state = ref<DailyCheckinState | null>(null)
const referral = ref<ReferralSummary | null>(null)
const loading = ref(false)
const error = ref('')
const claiming = ref(false)
const showLedger = ref(false)

const checkinByDate = computed(() => new Map((state.value?.checkins || []).map(item => [item.checkin_date, item])))
const streakCycleDays = computed(() => {
  const streak = Math.max(0, Number(state.value?.current_streak || 0))
  if (!streak) return 0
  return ((streak - 1) % 7) + 1
})
const streakRemaining = computed(() => Math.max(0, 7 - streakCycleDays.value))
const progressWidth = computed(() => `${Math.min(100, streakCycleDays.value / 7 * 100)}%`)
const nextReward = computed(() => {
  if (state.value?.checked_in) return Number(checkinByDate.value.get(state.value.today)?.reward || 10)
  const nextStreak = Number(state.value?.current_streak || 0) + 1
  return nextStreak % 7 === 0 ? 15 : 10
})
const verificationCount = computed(() => Number(referral.value?.stats.stage1_reward_count || 0))
const interactionCount = computed(() => Number(referral.value?.stats.stage2_reward_count || 0))

const previewState: DailyCheckinState = {
  today: '2026-07-30',
  checked_in: false,
  current_streak: 3,
  balance: 86,
  bonus_balance: 86,
  checkins: [
    { id: 'preview-3', checkin_date: '2026-07-29', streak: 3, daily_reward: 10, streak_bonus: 0, reward: 10 },
    { id: 'preview-2', checkin_date: '2026-07-28', streak: 2, daily_reward: 10, streak_bonus: 0, reward: 10 },
    { id: 'preview-1', checkin_date: '2026-07-27', streak: 1, daily_reward: 10, streak_bonus: 0, reward: 10 },
  ],
  transactions: [
    { id: 'preview-tx-1', amount: 10, description: '每日签到奖励', created_at: '2026-07-29T00:31:00.000Z' },
    { id: 'preview-tx-2', amount: 20, description: '邀请好友完成有效互动奖励', created_at: '2026-07-28T13:16:00.000Z' },
  ],
}

const previewReferral: ReferralSummary = {
  referral_code: 'JML2026',
  stats: {
    registered_invites: 0,
    valid_invites: 0,
    converted_invites: 0,
    invitee_bonus_count: 0,
    stage1_reward_count: 0,
    stage2_reward_count: 0,
    referrer_reward_total: 0,
  },
  rules: {
    new_user_base_bonus: 30,
    invitee_extra_bonus: 10,
    referrer_stage1_bonus: 10,
    referrer_stage2_bonus: 20,
  },
  referrals: [],
}

const week = computed(() => {
  const anchor = state.value?.today || new Date().toISOString().slice(0, 10)
  const date = new Date(`${anchor}T00:00:00.000Z`)
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayTime = new Date(`${anchor}T00:00:00.000Z`).getTime()
  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(date)
    item.setUTCDate(item.getUTCDate() + index)
    const key = item.toISOString().slice(0, 10)
    const actual = checkinByDate.value.get(key)
    const dayOffset = Math.round((item.getTime() - todayTime) / 86400000)
    const projectedStreak = Number(state.value?.current_streak || 0)
      + Math.max(0, dayOffset)
      + (state.value?.checked_in || dayOffset < 0 ? 0 : 1)
    const reward = Number(actual?.reward || (projectedStreak > 0 && projectedStreak % 7 === 0 ? 15 : 10))
    return {
      key,
      date: `${item.getUTCMonth() + 1}/${item.getUTCDate()}`,
      weekday: weekdays[item.getUTCDay()],
      today: key === anchor,
      past: key < anchor,
      checked: Boolean(actual),
      reward,
    }
  })
})

function shortTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function progressLabel(value: number, target: number) {
  return value < target ? `${value}/${target}` : `${value} 人`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (props.preview) {
      state.value = { ...previewState, checkins: [...previewState.checkins], transactions: [...previewState.transactions] }
      referral.value = previewReferral
      return
    }
    const [nextState, nextReferral] = await Promise.all([
      apiRequest<DailyCheckinState>('/lc/daily-checkin'),
      loadReferralSummary().catch(() => null),
    ])
    state.value = nextState
    referral.value = nextReferral
  } catch (err) {
    error.value = err instanceof Error ? err.message : '签到记录加载失败'
  } finally {
    loading.value = false
  }
}

async function claim() {
  if (claiming.value || state.value?.checked_in) return
  claiming.value = true
  try {
    if (props.preview && state.value) {
      state.value = {
        ...state.value,
        checked_in: true,
        current_streak: state.value.current_streak + 1,
        balance: state.value.balance + nextReward.value,
        bonus_balance: state.value.bonus_balance + nextReward.value,
        checkins: [
          {
            id: 'preview-today',
            checkin_date: state.value.today,
            streak: state.value.current_streak + 1,
            daily_reward: 10,
            streak_bonus: nextReward.value - 10,
            reward: nextReward.value,
          },
          ...state.value.checkins,
        ],
      }
      uni.showToast({ title: `赠送榜金 +${nextReward.value}`, icon: 'none' })
      return
    }
    const next = await apiRequest<DailyCheckinState>('/lc/daily-checkin', { method: 'POST' })
    state.value = next
    const reward = next.claim?.reward || 10
    const bonus = next.claim?.streak_bonus || 0
    uni.showToast({ title: bonus ? `到账 ${reward}，含连签奖励` : `赠送榜金 +${reward}`, icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err as Error).message, icon: 'none' })
  } finally {
    claiming.value = false
  }
}

function toggleLedger() {
  showLedger.value = !showLedger.value
}

void load()
defineExpose({ load })
</script>

<template>
  <view class="checkin-view">
    <MiniNavBar title="签到与奖励" inline-back :message="false" @back="emit('back')" />
    <StatePanel :loading="loading" :error="error" @retry="load" />

    <template v-if="state && !loading && !error">
      <view class="streak-hero">
        <view>
          <text class="streak-hero__value">已连续 <strong>{{ state.current_streak }}</strong> 天</text>
          <text class="streak-hero__note">{{ state.checked_in ? '今天已完成，连签继续' : '今天签到，连签不中断' }}</text>
        </view>
        <view class="streak-hero__balance">
          <text>赠送榜金</text>
          <strong>{{ state.bonus_balance }}</strong>
        </view>
      </view>

      <view class="week-strip" aria-label="本周签到">
        <view
          v-for="day in week"
          :key="day.key"
          class="week-day"
          :class="{ today: day.today, checked: day.checked, bonus: day.reward > 10 }"
        >
          <text class="week-day__name">{{ day.today ? '今天' : day.weekday }}</text>
          <text class="week-day__date">{{ day.date }}</text>
          <view class="week-day__mark">{{ day.checked ? '✓' : day.reward > 10 ? '★' : '' }}</view>
          <text class="week-day__status">{{ day.today && !day.checked ? '待领取' : day.reward > 10 ? '连签奖' : day.checked ? '已领取' : '待签到' }}</text>
          <text class="week-day__reward">+{{ day.reward }}</text>
        </view>
      </view>

      <view class="streak-progress">
        <view class="streak-progress__copy">
          <text><strong>{{ streakCycleDays }}</strong> / 7</text>
          <text>{{ streakRemaining ? `还差 ${streakRemaining} 天领连签奖` : '本轮连签奖励已达成' }}</text>
        </view>
        <view class="streak-progress__track"><view class="streak-progress__fill" :style="{ width: progressWidth }" /></view>
      </view>

      <button class="checkin-button" :disabled="claiming || state.checked_in" :loading="claiming" @tap="claim">
        <text>{{ state.checked_in ? '今日已签到' : '签到并保住连签' }}</text>
        <text>{{ state.checked_in ? `今天已到账 ${nextReward} 赠送榜金` : `本次到账 ${nextReward} 赠送榜金` }}</text>
      </button>
      <text class="deadline">{{ state.checked_in ? '明天记得继续签到' : '今天 23:59 前有效' }}</text>

      <view class="invite-tasks">
        <view class="invite-task">
          <view class="invite-task__copy">
            <strong>邀请好友完成验证</strong>
            <text>每邀请 1 位新玩家完成手机号验证，奖励 {{ referral?.rules.referrer_stage1_bonus || 10 }} 赠送榜金</text>
          </view>
          <text class="invite-task__progress">{{ progressLabel(verificationCount, 2) }}</text>
          <button class="invite-task__button" open-type="share" data-share-kind="invite">邀请好友</button>
        </view>
        <view class="invite-task">
          <view class="invite-task__copy">
            <strong>好友完成首次有效互动</strong>
            <text>受邀玩家的首条有效评价等行为通过后，奖励 {{ referral?.rules.referrer_stage2_bonus || 20 }} 赠送榜金</text>
          </view>
          <text class="invite-task__progress">{{ progressLabel(interactionCount, 1) }}</text>
          <button class="invite-task__button" open-type="share" data-share-kind="invite">邀请好友</button>
        </view>
      </view>

      <view class="ledger">
        <view class="ledger__head" @tap="toggleLedger">
          <view><text class="ledger__icon">账</text><strong>奖励明细</strong></view>
          <text>{{ showLedger ? '收起' : `${state.transactions.length} 条 ›` }}</text>
        </view>
        <template v-if="showLedger">
          <view v-if="!state.transactions.length" class="ledger__empty">完成签到或邀请任务后，奖励记录会显示在这里。</view>
          <view v-for="item in state.transactions" :key="item.id" class="ledger-row">
            <view><text class="ledger-row__title">{{ item.description }}</text><text class="ledger-row__date">{{ shortTime(item.created_at) }}</text></view>
            <text class="ledger-row__amount">+{{ item.amount }}</text>
          </view>
        </template>
      </view>

      <text class="balance-note">赠送榜金仅用于站内功能，不可提现</text>
    </template>
  </view>
</template>

<style scoped>
.checkin-view { min-height: 100vh; margin: 0 -24rpx; padding-bottom: 36rpx; background: #fffdf8; }
.streak-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24rpx; padding: 42rpx 32rpx 32rpx; border-bottom: 1rpx solid #e7e2d9; }
.streak-hero__value, .streak-hero__note, .streak-hero__balance text, .streak-hero__balance strong { display: block; }
.streak-hero__value { color: #173f70; font-size: 38rpx; font-weight: 850; line-height: 1.2; }
.streak-hero__value strong { font-size: 62rpx; font-weight: 900; }
.streak-hero__note { margin-top: 9rpx; color: #5f6a79; font-size: 24rpx; }
.streak-hero__balance { flex: 0 0 auto; text-align: right; }
.streak-hero__balance text { color: #687383; font-size: 22rpx; }
.streak-hero__balance strong { margin-top: 7rpx; color: #bd7e1d; font-size: 52rpx; line-height: 1; }
.week-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 28rpx 24rpx 18rpx; border-bottom: 1rpx solid #eee9e1; }
.week-day { min-width: 0; padding: 10rpx 2rpx 13rpx; border: 1rpx solid transparent; text-align: center; }
.week-day.today { border-color: #cfd8e4; border-radius: 10rpx; background: #f1f5fa; }
.week-day.bonus { border-color: #d49a3d; border-radius: 10rpx; color: #a56511; }
.week-day__name, .week-day__date, .week-day__status, .week-day__reward { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.week-day__name { color: #4f5a69; font-size: 20rpx; font-weight: 750; }
.week-day.today .week-day__name { color: #173f70; }
.week-day.bonus .week-day__name, .week-day.bonus .week-day__date { color: #a56511; }
.week-day__date { margin-top: 7rpx; color: #657081; font-size: 19rpx; }
.week-day__mark { display: flex; width: 40rpx; height: 40rpx; align-items: center; justify-content: center; margin: 13rpx auto 0; border: 2rpx solid #9ba8b7; border-radius: 50%; color: #173f70; font-size: 25rpx; font-weight: 900; line-height: 1; }
.week-day.checked .week-day__mark { border-color: #173f70; }
.week-day.bonus .week-day__mark { border-color: #c38322; color: #c38322; }
.week-day__status { margin-top: 8rpx; color: #687383; font-size: 17rpx; }
.week-day__reward { margin-top: 4rpx; color: #173f70; font-size: 20rpx; font-weight: 800; }
.week-day.bonus .week-day__reward { color: #b77213; }
.streak-progress { padding: 20rpx 32rpx 22rpx; }
.streak-progress__copy { display: flex; align-items: baseline; justify-content: space-between; gap: 18rpx; color: #657081; font-size: 22rpx; }
.streak-progress__copy strong { color: #173f70; font-size: 36rpx; }
.streak-progress__copy text:last-child { text-align: right; }
.streak-progress__track { height: 10rpx; margin-top: 12rpx; overflow: hidden; border-radius: 5rpx; background: #e4e7ec; }
.streak-progress__fill { height: 100%; border-radius: 5rpx; background: #173f70; }
.checkin-button { display: flex; width: calc(100% - 64rpx); min-height: 114rpx; flex-direction: column; align-items: center; justify-content: center; margin: 6rpx 32rpx 0; border-radius: 10rpx; background: #c48624; color: #fff; line-height: 1.25; }
.checkin-button text:first-child { font-size: 31rpx; font-weight: 900; }
.checkin-button text:last-child { margin-top: 9rpx; font-size: 21rpx; font-weight: 650; }
.checkin-button[disabled] { background: #d8d1c5; color: #6d7480; }
.deadline { display: block; padding: 15rpx 0 28rpx; border-bottom: 1rpx solid #e7e2d9; color: #788291; font-size: 21rpx; text-align: center; }
.invite-tasks { margin: 26rpx 32rpx 0; overflow: hidden; border: 1rpx solid #dfe3e8; border-radius: 12rpx; background: #fff; }
.invite-task { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 14rpx; min-height: 126rpx; padding: 18rpx 20rpx; border-bottom: 1rpx solid #e7e9ed; }
.invite-task:last-child { border-bottom: 0; }
.invite-task__copy { min-width: 0; }
.invite-task__copy strong, .invite-task__copy text { display: block; }
.invite-task__copy strong { color: #173f70; font-size: 25rpx; }
.invite-task__copy text { margin-top: 7rpx; color: #697586; font-size: 20rpx; line-height: 1.45; }
.invite-task__progress { color: #173f70; font-size: 28rpx; font-weight: 850; white-space: nowrap; }
.invite-task__button { width: 124rpx; min-height: 58rpx; margin: 0; padding: 0 12rpx; border: 1rpx solid #d39a42; border-radius: 8rpx; background: #fff; color: #a96913; font-size: 21rpx; font-weight: 800; line-height: 56rpx; }
.ledger { margin: 0 32rpx; overflow: hidden; border: 1rpx solid #dfe3e8; border-top: 0; border-radius: 0 0 12rpx 12rpx; background: #fff; }
.ledger__head { display: flex; min-height: 88rpx; align-items: center; justify-content: space-between; gap: 18rpx; padding: 0 20rpx; }
.ledger__head view { display: flex; align-items: center; gap: 12rpx; }
.ledger__head strong { color: #27364a; font-size: 26rpx; }
.ledger__head > text { color: #778293; font-size: 21rpx; }
.ledger__icon { display: flex; width: 38rpx; height: 38rpx; align-items: center; justify-content: center; border: 1rpx solid #95a0af; border-radius: 7rpx; color: #526071; font-size: 18rpx; font-weight: 850; }
.ledger__empty { padding: 34rpx 20rpx; border-top: 1rpx solid #eceff2; color: #8a93a2; font-size: 21rpx; text-align: center; }
.ledger-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 96rpx; margin: 0 20rpx; border-top: 1rpx solid #eceff2; }
.ledger-row__title, .ledger-row__date { display: block; }
.ledger-row__title { color: #27364a; font-size: 23rpx; font-weight: 800; }
.ledger-row__date { margin-top: 5rpx; color: #8a93a2; font-size: 19rpx; }
.ledger-row__amount { color: #a96913; font-size: 27rpx; font-weight: 850; }
.balance-note { display: block; padding: 28rpx 24rpx 4rpx; color: #7c8592; font-size: 21rpx; text-align: center; }
</style>
