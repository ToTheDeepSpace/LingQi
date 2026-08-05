# 剧幕录微信小程序内容安全接入

## 生产配置

- AppID：读取 `LINGQI_WECHAT_MINI_APP_ID`
- AppSecret：读取 `LINGQI_WECHAT_MINI_APP_SECRET`
- 消息推送 Token：读取 `WECHAT_MP_TOKEN`
- 消息推送 URL：`https://jumulu.jusichen.com/api/wechat/mp/events`
- 数据格式：JSON
- 消息加密：第一版使用明文模式；签名仍由 Token 校验

Token 只保存在腾讯云服务端环境文件和微信公众平台，不写入代码、日志、知识库或截图。
`/api/wechat/mini/events` 仅保留为旧验收链路的兼容入口，生产配置和验收脚本统一使用 `/api/wechat/mp/events`，避免回调落到只验签但不更新审核状态的错误处理器。

## 三项微信安全能力

| 微信接口 | 剧幕录用途 | 执行位置 |
| --- | --- | --- |
| `/wxa/msg_sec_check` | 检查用户提交的文字 | 小程序 UGC 对应的服务端业务接口 |
| `/wxa/media_check_async` | 异步检查公开图片 | 图片上传、回调和管理员公开闸门 |
| `/wxa/getuserriskrank` | 判断注册、营销奖励和 UGC 操作的用户风险等级 | 小程序新账号创建前、邀请/签到奖励前、全部 UGC 文字中间件 |

用户风险接口使用微信规定的三个场景：`0` 注册、`1` 营销防作弊、`2` UGC。等级 `0-2` 允许继续，等级 `3` 进入进一步安全核验，等级 `4` 阻止自动动作；普通接口异常时不伪装成低风险通过。为减少重复调用，同一 OpenID、场景和网络地址的有效结果在服务端内存缓存 5 分钟。

当前小程序实测返回 `48001 api unauthorized`。代码已接入，但在微信公众平台开通接口权限前，只有 `48001 / 61007` 两种“账号尚未授权”错误会记录后继续，避免第三项尚未获权时拖垮已经正常工作的注册和发布；其他异常继续失败关闭。权限开通后无需改代码，下一次缓存过期即自动开始执行等级拦截。

用户风险接口只发送微信要求的 AppID、OpenID、场景和网络地址，不附加手机号或邮箱。审计只保存业务动作、场景、风险等级、决策、错误码和是否命中缓存；OpenID 和网络地址不复制进风险元数据，用户页面也不展示风险等级。

## 检查边界

1. 小程序提交的公开内容和私密文字都在对应业务写接口内调用 `msgSecCheck`。客户端不再先调用独立预检接口，避免同一份内容重复消耗微信检查额度；服务端检查成功后才进入业务写入。
2. 小程序上传的公开图片在上传接口调用 `mediaCheckAsync`，初始状态为 `pending`；公开资料的业务提交口还会再次核对检查记录，不能靠绕过上传接口直接塞外链。
3. 微信通过消息推送回传图片结果。回调按签名、AppID 和 `trace_id` 更新审计记录。
4. 管理员公开头像、主页主图、档案照片和红黑榜正文图片前，服务端再次确认微信图片检查为 `pass`。
5. `review`、`risky`、`pending` 和 `error` 图片均不能公开。
6. 举报证据、身份认领材料等只供管理员读取的私密材料不在公共页面展示，继续执行本地格式清洗和人工审核。
7. 同一批小程序公开图片必须全部存在检查记录且全部为 `pass`；回调丢失导致 `pending` 超过 35 分钟后，用户重新提交会安全地发起新任务，避免永久卡死。
8. 业务记录通过 `moderation_precheck.wechat_image_safety_required` 保存图片来源策略：小程序公开图片写入 `true`，网站和历史未标记记录按本地人工审核处理。管理员通过时只对明确标记为 `true` 的记录强制要求微信图片结果，避免把网站投稿永久卡死。
9. DM / 店家评价过程中顺带创建的待审档案也执行相同的图片检查和来源标记；复用上传阶段的检查记录，不重复调用微信接口。
10. 微信官方限制单张媒体不超过 10MB；平台自身统一限制为 8MB，给转码和平台差异留出余量。用于检查的 OpenID 需要在近两小时访问过小程序。令牌失效返回 `40001`、`40014` 或 `42001` 时，服务端只清除对应旧缓存并重试一次；其他错误保持失败关闭。
11. 小程序公开图片只有在微信异步任务成功受理后才保留。任务提交失败时，服务端会删除刚写入的本机文件或 COS 对象，避免失败请求持续堆积无主文件；已经受理并等待回调的图片必须保留，保证微信能够拉取。
12. 管理员把公开配图转为私密证据、接管旧版证据时，只能读取新旧官方域名的 `/uploads/` 图片；每次重定向都会重新验证来源，读取 8 秒超时，并在响应头或流式读取超过 8MB 时立即终止。

## 全量 UGC 覆盖

以下写接口只要使用服务端签发的 `wechat-miniapp` 会话，就会在业务写入前强制执行微信文字检查：

| 场景 | 接口 |
| --- | --- |
| 账号申诉 | `/api/lc/account/appeals` |
| 委托师委托条 | `/api/lc/provider-listings/mine` |
| 公开主页资料 | `/api/lc/creators/:id` |
| 服务项目与作品集 | `/api/lc/services`、`/api/lc/portfolio` |
| 委托需求与接单申请 | `/api/lc/commissions`、`/api/lc/commissions/:id/applications` |
| 剧本与角色点评 | `/api/lc/scripts/:id/ratings`、`/api/lc/entity-ratings` |
| 拼车与上车申请 | `/api/lc/carpools`、`/api/lc/carpools/:id/applications` |
| 举报与建议反馈 | `/api/lc/reports`、`/api/lc/site-messages` |
| DM / 店家档案与评价 | `/api/lc/dm-dossiers`、`/api/lc/dm-ratings`、`/api/lc/store-ratings` |
| 红黑白榜、投票附言与评论 | `/api/lc/rankings`、`/api/lc/rankings/:id/vote`、`/api/lc/rankings/:id/comments` |
| 红黑白榜修改、重提与相关方说明 | `/api/lc/rankings/:id/edit-requests`、`/api/lc/rankings/:id/resubmit`、`/api/lc/rankings/:id/comments/:cid/related-certify` |
| 公开档期、标签与剧本资料共建 | `/api/lc/availability`、`/api/lc/availability/import-text`、`/api/lc/tags`、`/api/lc/scripts/contributions` |
| 攻略、评价回应与缠头留言 | `/api/lc/guides`、`/api/lc/rating-discussions/:ratingType/:ratingId/official-response`、`/api/lc/rating-discussions/:ratingType/:ratingId/follow-up`、`/api/lc/dm-dossiers/:id/gifts` |
| 档案修改、认领、任职关系与认证说明 | `/api/lc/dossier-edits/:dossierId`、`/api/lc/dm-dossiers/:id/claim`、`/api/lc/dm-dossiers/:id/affiliations`、`/api/lc/certifications` |
| 店家公开资料、评价回复与申诉 | `/api/lc/shop/profile`、`/api/lc/shop/review/:id/reply`、`/api/lc/shop/review/:id/appeal` |

头像、委托条主图、DM / 店家档案照片、红黑榜公开图和作品图在业务提交口强制确认图片检查记录。私密举报证据、认领材料和支付凭证不公开，不混入公开图片检查闸门，但仍执行文件清洗、权限隔离和人工审核。多图审核材料最多 8 张，每张最多 8MB、单次请求合计最多 18MB；生产 Nginx 的 20MB 请求体上限作为更外层保护。

微信检查只接收对应场景中需要判断的文字。手机号、微信号、支付凭证、身份证明图片、认领证据和原始档期截图文字不发送给微信；只检查最终会公开或进入人工处理的说明字段。店家公开资料和店家公开回复先进入 `lc_public_reviews`，管理员审核通过后才写入公开页面；私密联系电话和微信号独立保存，不随公开资料送审。

小程序业务写入的微信文字检查按登录账号限速为 10 分钟 80 次，无法取得账号标识时才退回 IP 限速；独立验收接口维持更严格的 10 分钟 12 次。这样可以阻止脚本批量消耗微信接口，同时不会让同一网络下的正常用户互相挤占主要额度。

## 新写入接口的强制分类

小程序的每一条写入接口都必须归入以下一类：

- `public-ugc`：会公开展示的用户内容，服务端必须强制调用微信文字检查；小程序公开图片还要经过异步图片检查和业务提交复核。
- `private-content`：只在当事人和管理员之间流转的申诉、申请或举报文字，服务端仍执行微信文字检查；私密证据图片不发送给微信，不在公共页面展示。
- `private-contact`：手机号、微信号等私密联系方式不发送给微信内容安全接口，只按业务权限向必要角色披露。
- `state-only`：关注、已读、上下架、撤回、接受或拒绝等不包含新公开言论的状态变更。

`tests/miniappMutationClassification.test.ts` 会扫描小程序源码中的全部非 GET 请求。新增写接口却未分类，或者需要检查的文字没有服务端微信检查时，测试会直接失败。

`tests/serverWriteRouteClassification.test.ts` 进一步扫描服务端全部已登录、非管理员写接口。任何读取正文、表单或文件却没有微信文字检查的入口，都必须明确归入私密凭证、私密联系方式、私密证据、公开媒体、财务或纯状态变更之一；不允许使用笼统的“其他”分类绕过检查。

## 审计记录

`lc_wechat_content_checks` 只保存：

- 用户、业务场景和目标引用
- 文字内容哈希或图片 URL 哈希
- 微信 `trace_id`
- `pass / review / risky / pending / error`
- 标签、错误码和时间

表内不复制用户原文，不保存图片二进制。管理员在“账号与安全 / 安全日志”查看最近记录。

## 提审验证

1. 提审前确认微信后台开发版已更新为 `0.1.46`，并以当次上传回执记录包体大小；红黑榜信息流卡片、详情页主帖和评论均使用统一举报入口，退出状态不会显示可填写的发布、评价、认领、反馈或账号修改表单。
2. 在微信公众平台消息推送配置页保存 URL `https://jumulu.jusichen.com/api/wechat/mp/events`，选择明文模式和 JSON；截图必须遮住 Token。
3. 在开发者工具登录测试账号，分别提交一条角色点评、一条红黑榜评论和一张公开图片。
4. 录制业务接口成功返回；文字接口必须由服务端产生微信检查记录，图片接口必须先返回 `pending`。
5. 打开网站管理后台“账号与安全 / 安全日志”，录制相同 `trace_id` 从 `pending` 变为 `pass`。
6. 尝试在图片仍为 `pending` 时点击管理员通过，录制服务端拒绝公开；待 `pass` 后再次通过。
7. 使用刚访问过小程序的测试账号执行一次登录、签到和 UGC 提交，在安全日志确认分别出现用户风险场景 `0 / 1 / 2` 的检查记录。
8. 截图保留回调配置、业务接口、后台检查记录和审核闸门，遮住 Token、OpenID、手机号、邮箱和用户证据原图。

运维可运行 `scripts/verify-wechat-mini-content-safety.mjs` 做重复验收。脚本会验证真实文字检查、从公网访问回调 URL 的签名握手，并可选验证图片异步回调；只输出 HTTP 状态、审计记录 ID、状态、时间和回调 URL，不输出账号标识、OpenID、JWT、签名或密钥。

## 2026-07-29 生产验收状态

- 本文对应微信开发版 `0.1.42`（619866 字节）；完整测试 234/234、微信小程序与跨端安全专项 73/73 通过。
- 网站生产提交为 `2853b61`；手机首页在主图前完整展示 DM、店家、角色、红黑榜、委托和拼车六个入口，角色点评遇到空响应或非 JSON 网关错误时只显示中文业务提示。
- 正式文字检查已通过：`msgSecCheck` 返回成功，数据库生成 `production_acceptance / text / pass` 记录。
- 公网回调 URL 已使用生产 Token 完成签名握手，证明域名、TLS、Nginx 路由和服务端验签可用。
- 回调防重放校验已通过：新鲜时间戳返回 200，过期时间戳返回 403。
- 正式图片任务已被 `mediaCheckAsync` 接受并生成 `pending` 记录。
- 2026-08-05 核对发现微信公众平台一直启用 `/api/wechat/mp/events`，微信也曾向该地址成功发送 POST，但旧处理器只验签并返回成功，没有更新图片审核记录；现已统一由该生产入口处理 `wxa_media_check`。仍需重新提交一张真实图片，确认记录从 `pending` 变为 `pass` 后才能宣称图片闭环完成。
- 官方依据：`https://developers.weixin.qq.com/miniprogram/dev/server/API/sec-center/sec-check/api_mediacheckasync.html`

## 网站微信账号

网站扫码登录保持可选，只有服务端真实配置微信开放平台网站应用时才显示入口。已登录用户可在“账号与安全”主动绑定或更换微信。网站开放平台 OpenID 与小程序 OpenID 不相同；后端只在获得同一开放平台 UnionID 时合并身份，不把两个 OpenID 直接比较。

扫码回调不得把登录 JWT 放在 URL 参数里。当前使用两分钟有效、只可消费一次、数量有上限的随机兑换码；兑换码只放在不会发送给服务器的 URL fragment，登录页读到后立即清除，再通过同源 POST 换取会话，兑换响应禁止缓存。网页微信新账号与小程序新账号一样标记为尚未完成公开资料设置，必须另行提交公开昵称审核后才能发布。

## 小程序协议与隐私同意

- 小程序不会在启动或输入过程中自动创建账号。用户必须主动勾选《用户协议》和《隐私政策》，再点击“微信一键登录”。
- 用户协议和隐私政策提供小程序原生可读页面，不依赖尚未配置的 `web-view` 业务域名；隐私页另有用户主动点击后才调用的微信隐私保护指引入口。
- 登录请求携带当前协议版本，服务端在调用微信 `jscode2session` 前验证主动同意与版本。缺失、伪造或旧版本直接返回 400，不消耗微信登录调用。
- 成功登录的协议版本和同意时间写入现有安全日志，不新增数据库表，不在日志保存 OpenID、登录 code 或协议正文。
