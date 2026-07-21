<script setup lang="ts">
import { ref } from 'vue'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, checkMiniContent, requireLogin } from '../../utils/api'

const title = ref('')
const content = ref('')
const city = ref('')
const neededDate = ref('')
const desiredRole = ref('')
const budget = ref('')
const privateContact = ref('')
const submitting = ref(false)

async function submit() {
  try {
    await requireLogin()
    if (!title.value.trim() || !content.value.trim()) throw new Error('请填写标题和需求内容')
    if (!privateContact.value.trim()) throw new Error('请留下接受申请后用于联系的方式')
    submitting.value = true
    await checkMiniContent(`${title.value} ${content.value} ${city.value} ${desiredRole.value} ${budget.value}`, 'commission_submit')
    await apiRequest('/lc/commissions', {
      method: 'POST',
      data: {
        title: title.value.trim(),
        content: content.value.trim(),
        city: city.value || null,
        neededDate: neededDate.value || null,
        desiredRole: desiredRole.value.trim() || null,
        budget: budget.value.trim() || null,
        targetType: 'creator',
        privateContact: privateContact.value.trim(),
      },
    })
    uni.showModal({ title: '已提交审核', content: '委托上墙前由管理员审核；接单申请不会逐条审核。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="同城委托" title="发布委托" description="委托先审核上墙；你同意承接申请后，双方联系方式立即互相可见。" fallback="/pages/carpools/index" />
    <view class="form-surface">
      <text class="field-label first">标题 *</text><input v-model="title" class="input" maxlength="80" placeholder="一句话说清想找什么人" />
      <text class="field-label">需求内容 *</text><textarea v-model="content" class="textarea" maxlength="2000" placeholder="说明角色、时间、体验偏好或其他要求" />
      <view class="two"><view><text class="field-label">城市</text><CitySearchPicker :value="city || '补充城市'" :allow-all="false" @change="city = $event" /></view><view><text class="field-label">需要日期</text><picker mode="date" :value="neededDate" @change="neededDate = $event.detail.value"><view class="picker-field">{{ neededDate || '选择日期' }}</view></picker></view></view>
      <view class="two"><view><text class="field-label">想要的角色</text><input v-model="desiredRole" class="input" maxlength="80" placeholder="可不填" /></view><view><text class="field-label">预算</text><input v-model="budget" class="input" maxlength="80" placeholder="可面议" /></view></view>
      <text class="field-label">同意申请后交换的联系方式 *</text><input v-model="privateContact" class="input" maxlength="300" placeholder="微信号或手机号" />
      <text class="privacy">委托审核和管理员查看申请时不会展示这里的联系方式。只有你同意某条申请后，才会立即向双方展示。</text>
      <view class="sticky-submit"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">提交审核</button></view>
    </view>
  </view>
</template>

<style scoped>
.first { margin-top: 0; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.privacy { display: block; margin-top: 12rpx; color: #64748b; font-size: 22rpx; line-height: 1.55; }
.sticky-submit button { width: 100%; }
</style>
