<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, readAuth, requireLogin } from '../../utils/api'

const title = ref('')
const content = ref('')
const city = ref('')
const neededDate = ref('')
const neededEndDate = ref('')
const desiredRole = ref('')
const budget = ref('')
const privateContact = ref('')
const acceptExpedition = ref(false)
const submitting = ref(false)

onMounted(async () => {
  if (!readAuth()?.token || city.value) return
  try {
    const follows = await apiRequest<{ cities: string[] }>('/lc/follows')
    if (follows.cities?.[0]) city.value = follows.cities[0]
  } catch { /* city remains selectable */ }
})

function setExpedition(event: Event) {
  const detail = (event as Event & { detail?: { value?: boolean } }).detail
  acceptExpedition.value = Boolean(detail?.value)
}

async function submit() {
  try {
    await requireLogin()
    if (!title.value.trim() || !content.value.trim()) throw new Error('请填写标题和需求内容')
    if (!city.value) throw new Error('请选择委托执行城市')
    if (!privateContact.value.trim()) throw new Error('请留下接受申请后用于联系的方式')
    submitting.value = true
    await apiRequest('/lc/commissions', {
      method: 'POST',
      data: {
        title: title.value.trim(),
        content: content.value.trim(),
        city: city.value || null,
        neededDate: neededDate.value || null,
        neededEndDate: neededEndDate.value || null,
        desiredRole: desiredRole.value.trim() || null,
        budget: budget.value.trim() || null,
        targetType: 'creator',
        privateContact: privateContact.value.trim(),
        acceptExpedition: acceptExpedition.value,
      },
    })
    uni.showModal({ title: '已提交审核', content: '委托上墙前由管理员审核；接单申请不会逐条审核。', showCancel: false, success: () => uni.navigateBack() })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="委托需求" title="发布委托" description="选择执行城市，并决定是否接受异地委托师远征。" fallback="/pages/commissions/index" />
    <view class="form-surface">
      <text class="field-label first">标题 *</text><input v-model="title" class="input" maxlength="80" placeholder="一句话说清想找什么人" />
      <text class="field-label">需求内容 *</text><textarea v-model="content" class="textarea" maxlength="2000" placeholder="说明角色、时间、体验偏好或其他要求" />
      <view class="two"><view><text class="field-label">执行城市 *</text><CitySearchPicker :value="city || '选择城市'" :allow-all="false" @change="city = $event" /></view><view><text class="field-label">开始日期</text><picker mode="date" :value="neededDate" @change="neededDate = $event.detail.value; if (neededEndDate && neededEndDate < neededDate) neededEndDate = neededDate"><view class="picker-field">{{ neededDate || '选择日期' }}</view></picker></view></view>
      <view class="date-end"><text class="field-label">结束日期</text><picker mode="date" :value="neededEndDate" :start="neededDate || undefined" @change="neededEndDate = $event.detail.value"><view class="picker-field">{{ neededEndDate || (neededDate ? '默认与开始日期相同' : '请先选择开始日期') }}</view></picker></view>
      <view class="expedition-row">
        <view class="expedition-copy"><text class="expedition-title">接受异地委托师远征</text><text class="expedition-note">开启后，常驻外地但已声明可服务{{ city || '该城市' }}的委托师也可以申请。</text></view>
        <switch :checked="acceptExpedition" color="#b9781f" @change="setExpedition" />
      </view>
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
.date-end { width: calc(50% - 6rpx); margin-left: auto; }
.expedition-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 20rpx; padding: 18rpx; border: 1rpx solid #eadcc7; border-radius: 8rpx; background: #fff; }
.expedition-copy { min-width: 0; flex: 1; }
.expedition-title, .expedition-note { display: block; }
.expedition-title { color: #27364a; font-size: 25rpx; font-weight: 850; }
.expedition-note { margin-top: 5rpx; color: #64748b; font-size: 21rpx; line-height: 1.5; }
.privacy { display: block; margin-top: 12rpx; color: #64748b; font-size: 22rpx; line-height: 1.55; }
.sticky-submit button { width: 100%; }
@media (max-width: 360px) {
  .two { grid-template-columns: 1fr; }
  .date-end { width: 100%; }
}
</style>
