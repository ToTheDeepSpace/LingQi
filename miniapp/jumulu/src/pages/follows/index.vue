<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import CitySearchPicker from '../../components/CitySearchPicker.vue'
import PageIntro from '../../components/PageIntro.vue'
import type { Dossier } from '../../types'
import { apiRequest, encoded, requireLogin } from '../../utils/api'

const cities = ref<string[]>([])
const candidate = ref('')
const stores = ref<Dossier[]>([])
const loading = ref(true)
const saving = ref(false)

async function load() {
  try {
    await requireLogin()
    const data = await apiRequest<{ cities: string[]; stores: Dossier[] }>('/lc/follows')
    cities.value = data.cities || []
    stores.value = data.stores || []
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { loading.value = false }
}
function addCity(value: string) {
  candidate.value = value
  if (!value || cities.value.includes(value)) return
  if (cities.value.length >= 5) return uni.showToast({ title: '最多关注 5 个城市', icon: 'none' })
  cities.value.push(value)
}
function removeCity(city: string) { cities.value = cities.value.filter(item => item !== city) }
async function save() {
  if (!cities.value.length) return uni.showToast({ title: '请至少关注一个城市', icon: 'none' })
  saving.value = true
  try {
    await apiRequest('/lc/follows/cities', { method: 'PUT', data: { cities: cities.value } })
    uni.$emit('jumulu:follows-changed')
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) uni.navigateBack()
      else uni.switchTab({ url: '/pages/index/index' })
    }, 350)
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { saving.value = false }
}
async function unfollow(store: Dossier) {
  try {
    await apiRequest(`/lc/follows/stores/${encoded(store.id)}`, { method: 'PUT', data: { following: false } })
    stores.value = stores.value.filter(item => item.id !== store.id)
  } catch (err) { uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}
function openStore(id: string) { uni.navigateTo({ url: `/pages/stores/detail?id=${encoded(id)}` }) }
onLoad(load)
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="内容偏好" title="关注设置" description="至少关注一个城市，最多五个；店家在档案页关注。" fallback="/pages/mine/index" />
    <view v-if="loading" class="loading">正在读取...</view>
    <template v-else>
      <text class="field-label first">关注城市</text>
      <CitySearchPicker :value="candidate || '搜索并添加城市'" :allow-all="false" @change="addCity" />
      <view class="selected"><button v-for="city in cities" :key="city" @tap="removeCity(city)">{{ city }} ×</button></view>
      <button class="primary-button save" :loading="saving" :disabled="saving || !cities.length" @tap="save">保存城市</button>
      <text class="section-title">关注店家</text>
      <view v-if="!stores.length" class="empty">还没有关注店家，可以从店家档案页添加。</view>
      <view v-for="store in stores" :key="store.id" class="store-row surface">
        <view class="store-main" @tap="openStore(store.id)"><strong>{{ store.dm_name }}</strong><text>{{ store.city || '城市待补' }}<template v-if="store.workplace"> · {{ store.workplace }}</template></text></view>
        <button @tap="unfollow(store)">取消</button>
      </view>
    </template>
  </view>
</template>

<style scoped>
.loading, .empty { padding: 36rpx 0; color: #64748b; }
.first { margin-top: 0; }
.selected { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; }
.selected button { width: auto; min-height: 58rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #e4c894; border-radius: 8rpx; background: #fff5df; color: #8b5919; font-size: 23rpx; line-height: 58rpx; }
.save { width: 100%; margin-top: 18rpx; }
.store-row { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-bottom: 12rpx; padding: 18rpx; }
.store-main { min-width: 0; flex: 1; }
.store-main strong, .store-main text { display: block; }
.store-main strong { color: #27364a; }
.store-main text { margin-top: 6rpx; color: #64748b; font-size: 22rpx; }
.store-row button { width: auto; min-height: 58rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #d9dde4; border-radius: 8rpx; background: #fff; color: #64748b; font-size: 23rpx; line-height: 58rpx; }
</style>
