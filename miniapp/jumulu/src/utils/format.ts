export function dateText(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

export function ratingText(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '暂无'
}

export function compactText(value?: string | null, limit = 96) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

export function currentDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const RANKING_TYPE_TEXT = { red: '红榜', black: '黑榜', white: '白榜' } as const

export function statusText(status?: string | null) {
  const map: Record<string, string> = {
    pending: '审核中', approved: '已公开', rejected: '未通过', withdrawn: '已撤回',
    closed: '已关闭', deleted_by_author: '已删除', pending_owner: '等待本人确认',
  }
  return map[String(status || '')] || status || '未知状态'
}
