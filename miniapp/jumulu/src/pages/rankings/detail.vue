<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import MiniNavBar from '../../components/MiniNavBar.vue'
import ReportFlag from '../../components/ReportFlag.vue'
import StatePanel from '../../components/StatePanel.vue'
import type { Ranking, RankingComment } from '../../types'
import { apiRequest, encoded, readAuth, requireLogin } from '../../utils/api'
import { dateText, RANKING_TYPE_TEXT } from '../../utils/format'
import { shareImage, sharePath, timelineSharePayload } from '../../utils/share'

const id = ref('')
const item = ref<Ranking | null>(null)
const comments = ref<RankingComment[]>([])
const loading = ref(false)
const error = ref('')
const commentText = ref('')
const submitting = ref(false)
const images = computed(() => (item.value?.display_files || []).map(file => file.url).filter(Boolean))

async function load() {
  if (!id.value) return
  loading.value = true; error.value = ''
  try {
    const [ranking, commentItems] = await Promise.all([
      apiRequest<Ranking>(`/lc/rankings/${encoded(id.value)}`),
      apiRequest<RankingComment[]>(`/lc/rankings/${encoded(id.value)}/comments`),
    ])
    item.value = ranking
    comments.value = commentItems
  } catch (err) { error.value = err instanceof Error ? err.message : '口碑详情加载失败' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

async function vote(voteType: 'like' | 'dislike' | 'joy') {
  try {
    await requireLogin()
    const existingVote = voteType === 'joy' ? item.value?.my_joy_vote : item.value?.my_vote
    if (existingVote?.vote_type === voteType) {
      const confirm = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: voteType === 'joy' ? '撤销欢乐？' : '撤销这张立场票？',
          content: existingVote.can_cancel === false ? '这张票已经超过 24 小时，不能撤销。' : '24 小时内可以撤销，口碑票不涉及退款。',
          confirmText: '撤销',
          success: result => resolve(Boolean(result.confirm && existingVote.can_cancel !== false)),
          fail: () => resolve(false),
        })
      })
      if (!confirm) return
      const result = await apiRequest<Partial<Ranking> & {
        myVote?: Ranking['my_vote']
        myJoyVote?: Ranking['my_joy_vote']
      }>(`/lc/rankings/${encoded(id.value)}/vote?voteType=${voteType}`, { method: 'DELETE' })
      if (item.value) item.value = {
        ...item.value,
        ...result,
        my_vote: result.myVote || null,
        my_joy_vote: result.myJoyVote || null,
      }
      uni.showToast({ title: '已撤销', icon: 'success' })
      return
    }
    const result = await apiRequest<Partial<Ranking> & {
      myVote?: Ranking['my_vote']
      myJoyVote?: Ranking['my_joy_vote']
    }>(`/lc/rankings/${encoded(id.value)}/vote`, { method: 'POST', data: { voteType } })
    if (item.value) item.value = {
      ...item.value,
      ...result,
      my_vote: result.myVote || null,
      my_joy_vote: result.myJoyVote || null,
    }
    uni.showToast({ title: voteType === 'like' ? '已同意' : voteType === 'dislike' ? '已反对' : '已标记欢乐', icon: 'success' })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
}

async function submitComment() {
  const content = commentText.value.trim()
  if (!content) return
  try {
    await requireLogin()
    submitting.value = true
    await apiRequest(`/lc/rankings/${encoded(id.value)}/comments`, { method: 'POST', data: { content } })
    commentText.value = ''
    uni.showModal({ title: '评论已提交', content: '评论通过审核后会公开展示。', showCancel: false })
  } catch (err) { if ((err as Error).message !== '请先登录') uni.showToast({ title: (err as Error).message, icon: 'none' }) }
  finally { submitting.value = false }
}

function loginToComment() {
  void requireLogin().catch(() => undefined)
}

function openProfile(profileId?: string | null) { if (profileId) uni.navigateTo({ url: `/pages/profile/detail?id=${encoded(profileId)}` }) }
function previewImages(index: number) { uni.previewImage({ current: index, urls: images.value }) }

onLoad(options => { id.value = String(options?.id || ''); void load() })
onPullDownRefresh(load)
onShareAppMessage(() => ({
  title: item.value ? `${RANKING_TYPE_TEXT[item.value.type]}｜${item.value.subject_name}` : '剧幕录口碑事件',
  path: sharePath(`/pages/rankings/detail?id=${encoded(id.value)}`),
  imageUrl: shareImage(images.value[0]),
}))
onShareTimeline(() => timelineSharePayload(item.value ? `${RANKING_TYPE_TEXT[item.value.type]}｜${item.value.subject_name}` : '剧幕录口碑事件', `id=${encoded(id.value)}`, images.value[0]))
</script>

<template>
  <view class="page">
    <MiniNavBar title="口碑详情" fallback="/pages/rankings/index" />
    <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !item" @retry="load" />
    <template v-if="item">
      <view class="article surface" :class="`article--${item.type}`">
        <view class="article__top">
          <text class="article__type">{{ RANKING_TYPE_TEXT[item.type] }}</text>
          <view class="article__tools">
            <text class="article__city">{{ item.subject_city || '城市待补充' }}</text>
            <button class="article__share" open-type="share">分享</button>
            <ReportFlag target-type="ranking" :target-id="item.id" :title="`${item.subject_name}的口碑事件`" :own="item.poster_id === readAuth()?.id" />
          </view>
        </view>
        <text class="article__subject">{{ item.subject_name }}</text>
        <text class="article__meta"><template v-if="item.event_script_name">《{{ item.event_script_name }}》 · </template><template v-if="item.event_store_name">{{ item.event_store_name }} · </template>{{ dateText(item.event_date || item.created_at) }}</text>
        <text class="article__content">{{ item.content }}</text>
        <view v-if="images.length" class="gallery">
          <view v-for="(url, index) in images" :key="url" class="gallery__item">
            <image class="gallery__image" :src="url" mode="aspectFill" @tap="previewImages(index)" />
            <ReportFlag target-type="ranking" :target-id="item.id" :target-sub-id="`image:${index}`" :title="`${item.subject_name}的第 ${index + 1} 张图片`" :own="item.poster_id === readAuth()?.id" />
          </view>
        </view>
        <view class="article__author">
          <text :class="{ link: item.poster_id }" @tap="openProfile(item.poster_id)">发布人：{{ item.author_name || '用户' }}</text>
          <text>更新于 {{ dateText(item.last_activity_at || item.created_at) }}</text>
        </view>
      </view>

      <view class="votes surface">
        <button class="vote" :class="{ active: item.my_vote?.vote_type === 'like' }" @tap="vote('like')">同意 {{ item.agree_count ?? item.likes ?? 0 }}</button>
        <button class="vote" :class="{ active: item.my_vote?.vote_type === 'dislike' }" @tap="vote('dislike')">反对 {{ item.oppose_count ?? item.dislikes ?? 0 }}</button>
        <button class="vote" :class="{ active: item.my_joy_vote?.vote_type === 'joy' }" @tap="vote('joy')">欢乐 {{ item.joys || 0 }}</button>
      </view>

      <text class="section-title">评论</text>
      <view v-if="readAuth()?.token" class="composer surface">
        <textarea v-model="commentText" class="textarea" maxlength="600" placeholder="补充事实、体验或不同意见。请勿公开他人隐私。" />
        <button class="primary-button" :loading="submitting" :disabled="submitting || !commentText.trim()" @tap="submitComment">提交评论</button>
      </view>
      <button v-else class="secondary-button login-comment" @tap="loginToComment">登录后评论</button>
      <view v-if="!comments.length" class="surface empty">暂无公开评论。</view>
      <view v-for="comment in comments" :key="comment.id" class="comment surface">
        <view class="comment__head"><text :class="{ link: comment.author_id }" @tap="openProfile(comment.author_id)">{{ comment.author_name || '用户' }}</text><text>{{ dateText(comment.created_at) }}</text></view>
        <text class="comment__content">{{ comment.content }}</text>
        <view class="comment__bottom">
          <text v-if="comment.is_pinned" class="pinned">相关方回应</text>
          <ReportFlag target-type="comment" :target-id="comment.id" title="榜单评论" :own="comment.author_id === readAuth()?.id" />
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.article { position: relative; padding: 24rpx; overflow: hidden; }
.article::before { position: absolute; inset: 0 auto 0 0; width: 7rpx; background: #b9781f; content: ''; }
.article--black::before { background: #26303f; }
.article--white::before { background: #b7bec8; }
.article__top, .article__author, .comment__head, .comment__bottom { display: flex; justify-content: space-between; gap: 16rpx; }
.article__type { color: #9a651e; font-size: 24rpx; font-weight: 900; }
.article__tools { display: flex; align-items: center; gap: 10rpx; }
.article__city, .article__meta, .article__author { color: #7b8492; font-size: 22rpx; }
.article__share { width: auto; min-height: 46rpx; margin: 0; padding: 0 10rpx; border: 1rpx solid #d7dee7; border-radius: 7rpx; background: #fff; color: #526174; font-size: 19rpx; line-height: 44rpx; }
.article__subject { display: block; margin-top: 12rpx; font-family: serif; font-size: 42rpx; font-weight: 900; }
.article__meta, .article__content { display: block; margin-top: 12rpx; }
.article__content { color: #27364a; font-size: 29rpx; line-height: 1.78; white-space: pre-wrap; }
.article__author { margin-top: 20rpx; padding-top: 14rpx; border-top: 1rpx solid #ece6de; }
.link { color: #275389; font-weight: 750; }
.gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-top: 18rpx; }
.gallery__item { position: relative; }
.gallery__image { width: 100%; height: 250rpx; border-radius: 8rpx; background: #f2ece4; }
.gallery__item :deep(.report-flag) { position: absolute; right: 6rpx; bottom: 6rpx; background: rgba(255,255,255,.9); }
.votes { display: flex; gap: 10rpx; margin-top: 14rpx; padding: 10rpx; }
.vote { flex: 1; min-width: 0; border-radius: 8rpx; background: #fff; color: #475569; font-size: 24rpx; }
.vote.active { background: #f3e4c9; color: #8b5919; font-weight: 850; }
.composer { margin-top: 14rpx; padding: 18rpx; }
.composer button { width: 100%; margin-top: 14rpx; }
.login-comment { width: 100%; margin: 14rpx 0 0; }
.empty { padding: 36rpx; color: #64748b; text-align: center; }
.comment { margin-top: 12rpx; padding: 18rpx; }
.comment__head { color: #7b8492; font-size: 22rpx; }
.comment__content { display: block; margin-top: 12rpx; color: #374151; font-size: 26rpx; line-height: 1.65; white-space: pre-wrap; }
.comment__bottom { margin-top: 14rpx; color: #7b8492; font-size: 22rpx; }
.comment__bottom :deep(.report-flag) { margin-left: auto; }
.pinned { color: #9a651e; font-weight: 800; }
</style>
