<script setup lang="ts">
import { computed, ref } from 'vue'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'
import { generateCarpoolMessage, parseCarpoolMessage } from '../../../../../src/lib/carpoolMessage'

const rawMessage = ref('')
const generatedMessage = ref('')
const parseWarnings = ref<string[]>([])
const city = ref('')
const eventDate = ref('')
const startTime = ref('')
const deadlineDate = ref('')
const scriptName = ref('')
const roleName = ref('')
const neededCount = ref(1)
const leaderContact = ref('')
const content = ref('')
const subsidyType = ref<ReturnType<typeof parseCarpoolMessage>['subsidyType']>('none')
const subsidyAmount = ref(0)
const subsidyDiscount = ref<number | null>(null)
const subsidyNote = ref('')
const showMore = ref(false)
const submitting = ref(false)

const subsidyOptions = [
  { value: 'none', label: '不写补贴' },
  { value: 'half_price', label: '半价' },
  { value: 'free_ticket', label: '免票' },
  { value: 'discount', label: '具体折扣' },
  { value: 'a_subsidy', label: 'A补' },
  { value: 'fixed_deduct', label: '减固定金额' },
  { value: 'custom', label: '自定义' },
] as const

const subsidyIndex = computed(() => Math.max(0, subsidyOptions.findIndex(item => item.value === subsidyType.value)))

function defaultDeadline(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function applyParsed() {
  if (!rawMessage.value.trim()) {
    uni.showToast({ title: '先粘贴一段拼车消息', icon: 'none' })
    return
  }
  const parsed = parseCarpoolMessage(rawMessage.value)
  if (parsed.eventDate) {
    eventDate.value = parsed.eventDate
    if (!deadlineDate.value) deadlineDate.value = defaultDeadline(parsed.eventDate)
  }
  if (parsed.startTime) startTime.value = parsed.startTime
  if (parsed.scriptName) scriptName.value = parsed.scriptName
  if (parsed.roleName) roleName.value = parsed.roleName
  if (parsed.leaderContact) leaderContact.value = parsed.leaderContact
  if (parsed.content) content.value = parsed.content
  subsidyType.value = parsed.subsidyType
  subsidyAmount.value = parsed.subsidyAmount
  subsidyDiscount.value = parsed.subsidyDiscount
  subsidyNote.value = parsed.subsidyNote
  parseWarnings.value = parsed.warnings
  uni.showToast({ title: parsed.warnings.length ? '已解析，请核对提示' : '已填入车次字段', icon: 'none' })
}

function currentGeneratedMessage() {
  return generateCarpoolMessage({
    eventDate: eventDate.value,
    startTime: startTime.value,
    city: city.value,
    scriptName: scriptName.value.trim(),
    roleName: roleName.value.trim(),
    neededCount: Math.max(1, Math.min(20, Number(neededCount.value) || 1)),
    subsidyType: subsidyType.value,
    subsidyAmount: subsidyAmount.value,
    subsidyDiscount: subsidyDiscount.value,
    subsidyNote: subsidyNote.value,
    deadlineDate: deadlineDate.value,
    leaderContact: leaderContact.value.trim(),
    content: content.value.trim(),
  })
}

function refreshGenerated() {
  generatedMessage.value = currentGeneratedMessage()
  uni.showToast({ title: '已生成转发消息', icon: 'none' })
}

function copyGenerated() {
  const text = generatedMessage.value.trim() || currentGeneratedMessage()
  if (!text) {
    uni.showToast({ title: '先核对车次字段', icon: 'none' })
    return
  }
  generatedMessage.value = text
  uni.setClipboardData({ data: text })
}

function changeSubsidy(event: { detail: { value: string | number } }) {
  const option = subsidyOptions[Number(event.detail.value)]
  subsidyType.value = option?.value || 'none'
}

async function submit() {
  try {
    await requireLogin()
    if (!city.value || !eventDate.value || !deadlineDate.value || !scriptName.value.trim() || !leaderContact.value.trim() || !content.value.trim()) throw new Error('请补齐城市、日期、截止日期、剧本、联系方式和拼车说明')
    if (deadlineDate.value > eventDate.value) throw new Error('申请截止日期不能晚于开车日期')
    submitting.value = true
    await checkMiniContent(`${city.value} ${scriptName.value} ${roleName.value} ${content.value}`, 'carpool_submit')
    await apiRequest('/lc/carpools', {
      method: 'POST',
      data: {
        city: city.value,
        eventDate: eventDate.value,
        startTime: startTime.value || null,
        deadlineDate: deadlineDate.value,
        scriptName: scriptName.value.trim(),
        roleName: roleName.value.trim() || null,
        neededCount: Math.max(1, Math.min(20, Number(neededCount.value) || 1)),
        leaderContact: leaderContact.value.trim(),
        content: content.value.trim(),
        subsidyMode: subsidyType.value === 'none' ? 'none' : subsidyType.value === 'a_subsidy' ? 'asking' : 'offering',
        subsidyType: subsidyType.value,
        subsidyAmount: subsidyAmount.value,
        subsidyDiscount: subsidyDiscount.value,
        subsidyNote: subsidyNote.value.trim(),
        rawMessage: rawMessage.value.trim(),
        generatedMessage: generatedMessage.value.trim() || currentGeneratedMessage(),
        boostAmount: 0,
      },
    })
    uni.showModal({ title: '已提交审核', content: '审核通过后会出现在同城拼车中。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="同城拼车" title="拼车工作台" description="粘贴消息，核对车次，再生成可继续转发的文案。" fallback="/pages/carpools/index" />
    <view class="form-surface">
      <text class="field-label first">粘贴车头消息</text>
      <textarea v-model="rawMessage" class="textarea source-message" maxlength="2000" placeholder="例：🚗6.14 晚场 无限x琳琅=祝魇cp（各半价）" />
      <button class="secondary-button parse-button" @tap="applyParsed">解析拼车消息</button>
      <view v-if="parseWarnings.length" class="warning-list">
        <text v-for="warning in parseWarnings" :key="warning">{{ warning }}</text>
      </view>

      <view class="section-divider"><text>核对车次</text></view>
      <text class="field-label first">城市 *</text><CitySearchPicker :value="city || '选择城市'" :allow-all="false" @change="city = $event" />
      <view class="two"><view><text class="field-label">开车日期 *</text><picker mode="date" :value="eventDate" @change="eventDate = $event.detail.value"><view class="picker-field">{{ eventDate || '选择日期' }}</view></picker></view><view><text class="field-label">开始时间</text><picker mode="time" :value="startTime" @change="startTime = $event.detail.value"><view class="picker-field">{{ startTime || '选择时间' }}</view></picker></view></view>
      <text class="field-label">申请截止 *</text><picker mode="date" :value="deadlineDate" @change="deadlineDate = $event.detail.value"><view class="picker-field">{{ deadlineDate || '选择截止日期' }}</view></picker>
      <text class="field-label">剧本 *</text><input v-model="scriptName" class="input" maxlength="80" placeholder="填写剧本名" />
      <view class="two"><view><text class="field-label">缺的角色</text><input v-model="roleName" class="input" maxlength="80" placeholder="可不填" /></view><view><text class="field-label">缺几人 *</text><input v-model="neededCount" class="input" type="number" maxlength="2" /></view></view>
      <text class="field-label">车头联系方式 *</text><input v-model="leaderContact" class="input" maxlength="300" placeholder="微信号或手机号" />
      <text class="field-label">拼车说明 *</text><textarea v-model="content" class="textarea" maxlength="1600" placeholder="说明车况、角色缺口和其他要求" />

      <button class="more-toggle" @tap="showMore = !showMore">{{ showMore ? '收起补贴设置' : '补贴设置（可选）' }}</button>
      <view v-if="showMore" class="more-panel">
        <text class="field-label first">补贴类型</text>
        <picker :range="subsidyOptions" range-key="label" :value="subsidyIndex" @change="changeSubsidy">
          <view class="picker-field">{{ subsidyOptions[subsidyIndex]?.label }}</view>
        </picker>
        <view v-if="subsidyType === 'a_subsidy' || subsidyType === 'fixed_deduct'" class="two">
          <view><text class="field-label">金额</text><input v-model="subsidyAmount" class="input" type="number" /></view>
          <view><text class="field-label">补贴原话</text><input v-model="subsidyNote" class="input" maxlength="300" placeholder="例：A补50" /></view>
        </view>
        <view v-else-if="subsidyType === 'discount'" class="two">
          <view><text class="field-label">几折</text><input v-model="subsidyDiscount" class="input" type="digit" placeholder="例：8.5" /></view>
          <view><text class="field-label">补贴原话</text><input v-model="subsidyNote" class="input" maxlength="300" placeholder="例：各8.5折" /></view>
        </view>
        <template v-else-if="subsidyType !== 'none'">
          <text class="field-label">补贴原话</text><input v-model="subsidyNote" class="input" maxlength="300" placeholder="完整保留原消息里的说法" />
        </template>
      </view>

      <view class="message-actions">
        <button class="secondary-button" @tap="refreshGenerated">生成转发消息</button>
        <button class="secondary-button" @tap="copyGenerated">复制消息</button>
      </view>
      <textarea v-if="generatedMessage" v-model="generatedMessage" class="textarea generated-message" maxlength="2000" />
      <view class="sticky-submit"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">发布拼车</button></view>
    </view>
  </view>
</template>

<style scoped>
.first { margin-top: 0; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.source-message { min-height: 220rpx; }
.parse-button { width: 100%; margin: 16rpx 0 0; }
.warning-list { display: grid; gap: 8rpx; margin-top: 14rpx; border: 1rpx solid #f4d7a2; border-radius: 12rpx; background: #fffaf0; padding: 14rpx 16rpx; }
.warning-list text { color: #a05b13; font-size: 22rpx; line-height: 1.55; }
.section-divider { display: flex; align-items: center; gap: 16rpx; margin: 24rpx 0 2rpx; color: #263547; font-size: 25rpx; font-weight: 850; }
.section-divider::after { height: 1rpx; flex: 1; background: #ebe7e0; content: ""; }
.more-toggle { width: 100%; min-height: 70rpx; margin: 18rpx 0 0; border: 1rpx solid #dce3ec; border-radius: 12rpx; background: #fff; color: #275389; font-size: 23rpx; font-weight: 800; line-height: 70rpx; }
.more-panel { margin-top: 12rpx; border: 1rpx solid #ebe7e0; border-radius: 12rpx; background: #fbfaf8; padding: 16rpx; }
.message-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.message-actions button { width: 100%; }
.generated-message { min-height: 190rpx; margin-top: 12rpx; background: #fffaf2; }
.sticky-submit button { width: 100%; }
</style>
