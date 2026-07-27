import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('miniapp login requires an explicit current-version legal consent', () => {
  const mine = readFileSync('miniapp/jumulu/src/pages/mine/index.vue', 'utf8')
  const auth = readFileSync('miniapp/jumulu/src/utils/auth.ts', 'utf8')

  assert.match(mine, /checkbox-group class="legal-consent"/)
  assert.match(mine, /《用户协议》/)
  assert.match(mine, /《隐私政策》/)
  assert.match(mine, /:disabled="loading \|\| !legalAccepted"/)
  assert.match(auth, /if \(!options\.legalAccepted\) throw new Error/)
  assert.match(auth, /termsAccepted: true/)
  assert.match(auth, /termsVersion: TERMS_VERSION/)
  assert.match(auth, /privacyVersion: PRIVACY_VERSION/)
})

test('miniapp login asks WeChat for privacy authorization only after user action', () => {
  const mine = readFileSync('miniapp/jumulu/src/pages/mine/index.vue', 'utf8')
  const app = readFileSync('miniapp/jumulu/src/App.vue', 'utf8')

  assert.match(mine, /open-type="agreePrivacyAuthorization"/)
  assert.match(mine, /@agreeprivacyauthorization="handleWechatPrivacyAuthorization"/)
  assert.match(mine, /function handleWechatPrivacyAuthorization/)
  assert.match(mine, /if \(!legalAccepted\.value\)/)
  assert.doesNotMatch(app, /onNeedPrivacyAuthorization/)
})

test('miniapp legal documents are readable without relying on a web-view domain', () => {
  const pages = readFileSync('miniapp/jumulu/src/pages.json', 'utf8')
  const page = readFileSync('miniapp/jumulu/src/pages/legal/document.vue', 'utf8')
  const content = readFileSync('miniapp/jumulu/src/content/legalDocuments.ts', 'utf8')

  assert.match(pages, /pages\/legal\/document/)
  assert.doesNotMatch(page, /<web-view/)
  assert.match(page, /document\.sections/)
  assert.match(page, /uni\.openPrivacyContract/)
  assert.match(content, /九、知识产权与公开内容授权/)
  assert.match(content, /永久、不可撤销/)
  assert.match(content, /小程序 UGC 会按微信平台要求调用内容安全接口/)
})

test('server rejects missing or stale miniapp agreement versions before WeChat login', () => {
  const server = readFileSync('api/index.ts', 'utf8')
  const legal = readFileSync('miniapp/jumulu/src/content/legalDocuments.ts', 'utf8')

  const terms = legal.match(/TERMS_VERSION = '([^']+)'/)?.[1]
  const privacy = legal.match(/PRIVACY_VERSION = '([^']+)'/)?.[1]
  assert.ok(terms)
  assert.ok(privacy)
  assert.match(server, new RegExp(`LINGQI_TERMS_VERSION = '${terms}'`))
  assert.match(server, new RegExp(`LINGQI_PRIVACY_VERSION = '${privacy}'`))

  const routeStart = server.indexOf("app.post('/api/lc/miniapp/auth/wechat'")
  const route = server.slice(routeStart, routeStart + 7200)
  assert.match(route, /req\.body\?\.termsAccepted !== true/)
  assert.match(route, /termsVersion !== LINGQI_TERMS_VERSION/)
  assert.match(route, /privacyVersion !== LINGQI_PRIVACY_VERSION/)
  assert.ok(route.indexOf('termsAccepted !== true') < route.indexOf('jscode2session'))
  assert.match(route, /terms_version: termsVersion/)
  assert.match(route, /privacy_version: privacyVersion/)
  assert.match(route, /legal_consent_at: nowIso/)
})
