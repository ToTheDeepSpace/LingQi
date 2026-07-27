<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageIntro from '../../components/PageIntro.vue'
import { legalDocument, type LegalDocumentKind } from '../../content/legalDocuments'

const kind = ref<LegalDocumentKind>('terms')
const document = computed(() => legalDocument(kind.value))

onLoad((query) => {
  kind.value = query?.type === 'privacy' ? 'privacy' : 'terms'
})

function copyOfficialUrl() {
  uni.setClipboardData({
    data: document.value.officialUrl,
    success: () => uni.showToast({ title: '网页正式版链接已复制', icon: 'success' }),
  })
}

function openWechatPrivacyContract() {
  // #ifdef MP-WEIXIN
  uni.openPrivacyContract({
    fail: () => uni.showToast({ title: '请先在微信后台配置隐私保护指引', icon: 'none' }),
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中查看', icon: 'none' })
  // #endif
}
</script>

<template>
  <view class="page legal-page">
    <PageIntro :nav-title="kind === 'privacy' ? '隐私政策' : '用户协议'" :title="document.title" fallback="/pages/mine/index" />
    <text class="legal-title">{{ document.title }}</text>
    <view class="legal-meta">
      <text>正式公示版本</text>
      <text>更新日期 {{ document.version }}</text>
    </view>
    <text class="legal-intro">{{ document.intro }}</text>

    <view class="notice">
      <strong>{{ document.noticeTitle }}</strong>
      <text>{{ document.notice }}</text>
    </view>

    <view v-for="section in document.sections" :key="section.title" class="legal-section">
      <text class="section-heading">{{ section.title }}</text>
      <text v-for="paragraph in section.paragraphs" :key="paragraph" class="paragraph">• {{ paragraph }}</text>
    </view>

    <view class="legal-actions">
      <button v-if="kind === 'privacy'" class="secondary-button" @tap="openWechatPrivacyContract">微信隐私保护指引</button>
      <button class="secondary-button" @tap="copyOfficialUrl">复制网页正式版链接</button>
    </view>
  </view>
</template>

<style scoped>
.legal-page { padding-bottom: calc(64rpx + env(safe-area-inset-bottom)); }
.legal-title { display: block; padding-top: 18rpx; color: #1f2937; font-size: 34rpx; font-weight: 900; line-height: 1.35; }
.legal-meta { display: flex; justify-content: space-between; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid #e7e1d8; color: #7b8492; font-size: 21rpx; }
.legal-intro { display: block; padding: 18rpx 0 6rpx; color: #475569; font-size: 24rpx; line-height: 1.65; }
.notice { margin: 18rpx 0 8rpx; padding: 18rpx 20rpx; border: 1rpx solid #ecd6ad; border-radius: 10rpx; background: #fff9ec; }
.notice strong, .notice text, .section-heading, .paragraph { display: block; }
.notice strong { color: #8b5919; font-size: 26rpx; }
.notice text { margin-top: 8rpx; color: #684c2a; font-size: 23rpx; line-height: 1.65; }
.legal-section { padding: 22rpx 0; border-bottom: 1rpx solid #ece8e1; }
.section-heading { color: #1f2937; font-size: 28rpx; font-weight: 850; line-height: 1.4; }
.paragraph { margin-top: 12rpx; color: #4b5563; font-size: 24rpx; line-height: 1.75; }
.legal-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 24rpx; }
.legal-actions button:only-child { grid-column: 1 / -1; }
@media (max-width: 360px) {
  .legal-actions { grid-template-columns: 1fr; }
}
</style>
