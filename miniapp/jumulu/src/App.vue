<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { refreshCurrentUser } from './utils/auth'
import { apiRequest, readAuth } from './utils/api'

let checkingFollows = false
let checkingNotifications = false
async function ensureCityFollows() {
  if (checkingFollows || !readAuth()?.token) return
  const current = getCurrentPages().at(-1)?.route || ''
  if (current === 'pages/follows/index') return
  checkingFollows = true
  try {
    const data = await apiRequest<{ onboarding_required?: boolean }>('/lc/follows')
    if (data.onboarding_required) uni.navigateTo({ url: '/pages/follows/index' })
  } catch { /* 页面内会给出可重试反馈 */ }
  finally { checkingFollows = false }
}

async function refreshNotificationCount() {
  if (checkingNotifications) return
  if (!readAuth()?.token) {
    uni.setStorageSync('jumulu:notifications:unread', 0)
    uni.$emit('jumulu:notification-count', 0)
    return
  }
  checkingNotifications = true
  try {
    const data = await apiRequest<{ unread_count?: number }>('/lc/account/status')
    const count = Math.max(0, Number(data.unread_count || 0))
    uni.setStorageSync('jumulu:notifications:unread', count)
    uni.$emit('jumulu:notification-count', count)
  } catch { /* 页面内会给出可重试反馈 */ }
  finally { checkingNotifications = false }
}

onLaunch(() => {
  void refreshCurrentUser({ silent: true }).then(() => Promise.all([ensureCityFollows(), refreshNotificationCount()]))
  uni.$on('jumulu:auth-changed', () => setTimeout(() => {
    void ensureCityFollows()
    void refreshNotificationCount()
  }, 250))
  uni.$on('jumulu:refresh-notifications', () => void refreshNotificationCount())
})
onShow(() => {
  void ensureCityFollows()
  void refreshNotificationCount()
})
</script>

<style>
page {
  min-height: 100%;
  background: #fffdf8;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
}

view, text, input, textarea, button, image, scroll-view {
  box-sizing: border-box;
}

button::after { border: 0; }

.page {
  min-height: 100vh;
  padding: 0 24rpx calc(48rpx + env(safe-area-inset-bottom));
}

.surface {
  background: #ffffff;
  border: 1rpx solid #eadfce;
  border-radius: 10rpx;
}

.section-title {
  margin: 32rpx 0 16rpx;
  color: #1f2937;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 800;
}

.muted { color: #6b7280; }
.gold { color: #9a651e; }
.danger { color: #a53232; }

.primary-button,
.secondary-button,
.danger-button {
  min-height: 76rpx;
  padding: 0 26rpx;
  border-radius: 10rpx;
  font-size: 27rpx;
  font-weight: 800;
  line-height: 76rpx;
}

.primary-button { background: #b9781f; color: #ffffff; }
.secondary-button { background: #ffffff; color: #334155; border: 1rpx solid #d9dde4; }
.danger-button { background: #fff6f5; color: #a53232; border: 1rpx solid #efc9c5; }

.input,
.textarea,
.picker-field {
  width: 100%;
  border: 1rpx solid #d9dde4;
  border-radius: 10rpx;
  background: #ffffff;
  color: #1f2937;
  font-size: 27rpx;
}

.input,
.picker-field {
  height: 76rpx;
  padding: 0 22rpx;
  line-height: 76rpx;
}

.textarea {
  min-height: 210rpx;
  padding: 18rpx 22rpx;
  line-height: 1.65;
}

.field-label {
  display: block;
  margin: 22rpx 0 10rpx;
  color: #374151;
  font-size: 25rpx;
  font-weight: 800;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chip {
  padding: 8rpx 14rpx;
  border-radius: 8rpx;
  background: #eef4fb;
  color: #275389;
  font-size: 23rpx;
  line-height: 1.25;
}

.action-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.action-row > button { flex: 1; min-width: 0; }

.page-tools {
  margin-bottom: 16rpx;
  padding: 12rpx;
  border: 1rpx solid #eadfce;
  border-radius: 10rpx;
  background: #ffffff;
}

.page-actions {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 12rpx;
  margin-top: 12rpx;
}

.page-actions button { width: 100%; margin: 0; }

.form-surface {
  margin-bottom: 20rpx;
  padding: 0 4rpx 24rpx;
}

.sticky-submit {
  position: sticky;
  z-index: 80;
  bottom: 0;
  margin: 24rpx -24rpx calc(-48rpx - env(safe-area-inset-bottom));
  padding: 16rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eadfce;
  background: rgba(255, 253, 248, 0.98);
}

.safe-bottom { padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); }
</style>
