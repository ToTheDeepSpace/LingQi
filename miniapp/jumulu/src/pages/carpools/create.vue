<script setup lang="ts">
import { ref } from 'vue'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'

const city = ref('')
const eventDate = ref('')
const startTime = ref('')
const deadlineDate = ref('')
const scriptName = ref('')
const roleName = ref('')
const neededCount = ref(1)
const leaderContact = ref('')
const content = ref('')
const submitting = ref(false)

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
        subsidyMode: 'none',
        subsidyType: 'none',
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
    <PageIntro eyebrow="同城拼车" title="发布拼车" description="先写清时间、城市和缺口；审核通过后公开。" fallback="/pages/carpools/index" />
    <view class="form-surface">
      <text class="field-label first">城市 *</text><CitySearchPicker :value="city || '选择城市'" :allow-all="false" @change="city = $event" />
      <view class="two"><view><text class="field-label">开车日期 *</text><picker mode="date" :value="eventDate" @change="eventDate = $event.detail.value"><view class="picker-field">{{ eventDate || '选择日期' }}</view></picker></view><view><text class="field-label">开始时间</text><picker mode="time" :value="startTime" @change="startTime = $event.detail.value"><view class="picker-field">{{ startTime || '选择时间' }}</view></picker></view></view>
      <text class="field-label">申请截止 *</text><picker mode="date" :value="deadlineDate" @change="deadlineDate = $event.detail.value"><view class="picker-field">{{ deadlineDate || '选择截止日期' }}</view></picker>
      <text class="field-label">剧本 *</text><input v-model="scriptName" class="input" maxlength="80" placeholder="填写剧本名" />
      <view class="two"><view><text class="field-label">缺的角色</text><input v-model="roleName" class="input" maxlength="80" placeholder="可不填" /></view><view><text class="field-label">缺几人 *</text><input v-model="neededCount" class="input" type="number" maxlength="2" /></view></view>
      <text class="field-label">车头联系方式 *</text><input v-model="leaderContact" class="input" maxlength="300" placeholder="微信号或手机号" />
      <text class="field-label">拼车说明 *</text><textarea v-model="content" class="textarea" maxlength="1600" placeholder="说明车况、角色缺口和其他要求" />
      <view class="sticky-submit"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button></view>
    </view>
  </view>
</template>

<style scoped>
.first { margin-top: 0; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.sticky-submit button { width: 100%; }
</style>
