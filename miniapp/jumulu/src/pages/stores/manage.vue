<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import AuthFormGate from '../../components/AuthFormGate.vue'
import PageIntro from '../../components/PageIntro.vue'
import { apiRequest, encoded, readAuth, requestServicePayment } from '../../utils/api'

type Store = { store_dossier_id: string; name: string; city: string; status: string; revoke_reason?: string }
type Batch = { id: string; store_dossier_id: string; source: string; status: string; revealed_at?: string }
type Code = { id: string; batch_id: string; slot: number; last_four?: string; status: string; dm_name?: string }
type Data = { stores: Store[]; batches: Batch[]; codes: Code[] }
const data = ref<Data>({ stores: [], batches: [], codes: [] })
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const plaintext = ref<Array<{ id: string; code: string }>>([])
const labels: Record<string, string> = { unused: '未使用', reserved: '审核中／待补材料', used: '已使用', revoked: '已撤销' }
async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await apiRequest<Data>('/lc/store-certifications/mine') }
  catch (reason) { error.value = (reason as Error).message }
  finally { loading.value = false }
}
async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  try { await action(); await load() }
  catch (reason) { uni.showModal({ title: '暂未完成', content: (reason as Error).message, showCancel: false }) }
  finally { busy.value = false }
}
function confirm(content: string) {
  return new Promise<boolean>(resolve => uni.showModal({ title: '请确认', content, success: result => resolve(result.confirm), fail: () => resolve(false) }))
}
async function buy(storeId: string, batchId?: string) {
  if (!await confirm('支付90元加购11个一次性DM认证码。用码仍需人工审核，通过后自动绑定本店；离店不返还名额。')) return
  await run(async () => {
    const batch = batchId ? { id: batchId } : await apiRequest<{ id: string }>(`/lc/store-certifications/${encoded(storeId)}/code-packs`, { method: 'POST' })
    await requestServicePayment('store_code_pack', batch.id)
    uni.showToast({ title: '加购成功', icon: 'success' })
  })
}
async function reveal(batchId: string) {
  if (!await confirm('完整认证码仅展示这一次，请及时复制并保管。未使用的码丢失后可重置，旧码将失效。')) return
  await run(async () => {
    const result = await apiRequest<{ codes: Array<{ id: string; code: string }> }>(`/lc/store-code-batches/${encoded(batchId)}/reveal`, { method: 'POST' })
    plaintext.value = result.codes
    if (!result.codes.length) uni.showToast({ title: '已领取，请重置遗失的未使用码', icon: 'none' })
  })
}
async function resetCode(codeId: string) {
  if (!await confirm('重置后旧码立即失效，已发给DM但尚未提交的旧码也无法使用。确认重置？')) return
  await run(async () => {
    const result = await apiRequest<{ id: string; code: string }>(`/lc/store-codes/${encoded(codeId)}/regenerate`, { method: 'POST' })
    plaintext.value = [result]
  })
}
function copyCodes() { uni.setClipboardData({ data: plaintext.value.map(item => item.code).join('\n') }) }
function browseStores() { uni.navigateTo({ url: '/pages/stores/index' }) }
onShow(() => { if (readAuth()?.token && !busy.value) void load() })
onHide(() => { plaintext.value = [] })
</script>

<template>
  <view class="page">
    <PageIntro eyebrow="店家中心" nav-title="店家认证与名额" title="认证与DM名额" description="店家90元永久认证（暂行），人工审核通过含11个一次性认证码；每90元可再加购11个。" />
    <AuthFormGate message="登录后管理你的店家认证">
      <view v-if="plaintext.length" class="surface codes">
        <strong>请立即复制保存，仅本次展示</strong>
        <text v-for="item in plaintext" :key="item.id" selectable>{{ item.code }}</text>
        <button class="primary-button" @tap="copyCodes">复制全部认证码</button>
        <text class="hint">勿公开发布认证码。离开页面后不再显示；未使用的码可重置。</text>
      </view>
      <view v-if="loading" class="surface panel">正在读取名额…</view>
      <view v-else-if="error" class="surface panel" @tap="load">{{ error }} · 点击重试</view>
      <view v-else-if="!data.stores.length" class="surface panel">
        <strong>还没有通过认证的店家</strong>
        <text class="hint">找到你的店家档案，点击经营者认证，提交证明并支付90元；审核通过后在这里领码。</text>
        <button class="primary-button" @tap="browseStores">查找店家档案</button>
      </view>
      <template v-else>
      <view v-for="store in data.stores" :key="store.store_dossier_id" class="surface panel">
        <strong>{{ store.name }} · {{ store.city }}</strong>
        <text class="hint">{{ store.status === 'approved' ? '永久认证（暂行）· 已通过人工审核' : '认证已撤销：' + (store.revoke_reason || '请联系平台') }}</text>
        <button v-if="store.status === 'approved'" class="primary-button" :disabled="busy" :loading="busy" @tap="buy(store.store_dossier_id)">90元加购11个认证码</button>
        <view v-for="batch in data.batches.filter(item => item.store_dossier_id === store.store_dossier_id)" :key="batch.id" class="batch">
          <strong>{{ batch.source === 'addon' ? '加购包 · 11个' : '认证赠送 · 11个' }}</strong>
          <button v-if="batch.status === 'pending' && store.status === 'approved'" class="secondary-button" :disabled="busy" @tap="buy(store.store_dossier_id, batch.id)">继续支付90元</button>
          <text v-if="batch.status === 'revoked'" class="hint">此批名额已撤销</text>
          <button v-if="batch.status === 'issued' && !batch.revealed_at && store.status === 'approved'" class="secondary-button" :disabled="busy" @tap="reveal(batch.id)">领取本批认证码（仅展示一次）</button>
          <view v-for="code in data.codes.filter(item => item.batch_id === batch.id)" :key="code.id" class="code-row">
            <view><text>{{ code.slot }}. {{ code.last_four ? '尾号 ' + code.last_four : '尚未领码' }} · {{ labels[code.status] || code.status }}</text><text v-if="code.dm_name" class="hint">{{ code.dm_name }}</text></view>
            <button v-if="code.status === 'unused' && code.last_four && batch.status === 'issued' && store.status === 'approved'" class="reset" :disabled="busy" @tap="resetCode(code.id)">重置</button>
          </view>
        </view>
        <text class="hint">码在提交申请时预留，审核不通过可由同一账号补材料重提。审核通过后名额永久消耗并绑定店家，离店不返还。</text>
      </view>
      </template>
    </AuthFormGate>
  </view>
</template>

<style scoped>
.panel,.codes { margin-top: 20rpx; padding: 24rpx; }
strong { display: block; color: #27364a; font-size: 28rpx; }
.hint { display: block; margin: 12rpx 0; color: #64748b; font-size: 23rpx; line-height: 1.65; }
.batch { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid #e5e7eb; }
.code-row { display: flex; gap: 12rpx; align-items: center; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid #eef0f3; font-size: 23rpx; }
.reset { margin: 0; padding: 0 20rpx; flex-shrink: 0; color: #8b5919; background: #fff8e8; font-size: 22rpx; }
.codes { border: 2rpx solid #d9a857; }
.codes > text:not(.hint) { display: block; margin: 14rpx 0; font-family: monospace; font-size: 30rpx; }
</style>
