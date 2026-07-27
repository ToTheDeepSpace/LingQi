# 剧幕录微信小程序内容安全接入

## 生产配置

- AppID：读取 `LINGQI_WECHAT_MINI_APP_ID`
- AppSecret：读取 `LINGQI_WECHAT_MINI_APP_SECRET`
- 消息推送 Token：读取 `LINGQI_WECHAT_MINI_MSG_TOKEN`
- 消息推送 URL：`https://jumulu.jusichen.com/api/wechat/mini/events`
- 数据格式：JSON
- 消息加密：第一版使用明文模式；签名仍由 Token 校验

Token 只保存在腾讯云服务端环境文件和微信公众平台，不写入代码、日志、知识库或截图。

## 检查边界

1. 小程序公开文字在对应业务写接口内调用 `msgSecCheck`。客户端的预检只改善反馈速度，不能代替服务端检查。
2. 小程序上传的公开图片在上传接口调用 `mediaCheckAsync`，初始状态为 `pending`；公开资料的业务提交口还会再次核对检查记录，不能靠绕过上传接口直接塞外链。
3. 微信通过消息推送回传图片结果。回调按签名、AppID 和 `trace_id` 更新审计记录。
4. 管理员公开头像、主页主图、档案照片和红黑榜正文图片前，服务端再次确认微信图片检查为 `pass`。
5. `review`、`risky`、`pending` 和 `error` 图片均不能公开。
6. 举报证据、身份认领材料等只供管理员读取的私密材料不在公共页面展示，继续执行本地格式清洗和人工审核。

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

头像、委托条主图、DM / 店家档案照片、红黑榜公开图和作品图在业务提交口强制确认图片检查记录。私密举报证据、认领材料和支付凭证不公开，不混入公开图片检查闸门，但仍执行文件清洗、权限隔离和人工审核。

## 审计记录

`lc_wechat_content_checks` 只保存：

- 用户、业务场景和目标引用
- 文字内容哈希或图片 URL 哈希
- 微信 `trace_id`
- `pass / review / risky / pending / error`
- 标签、错误码和时间

表内不复制用户原文，不保存图片二进制。管理员在“账号与安全 / 安全日志”查看最近记录。

## 提审验证

1. 确认微信后台开发版为 `0.1.36`，包体 593171 字节。
2. 在微信公众平台消息推送配置页保存 URL `https://jumulu.jusichen.com/api/wechat/mini/events`，选择明文模式和 JSON；截图必须遮住 Token。
3. 在开发者工具登录测试账号，分别提交一条角色点评、一条红黑榜评论和一张公开图片。
4. 录制业务接口成功返回；文字接口必须由服务端产生微信检查记录，图片接口必须先返回 `pending`。
5. 打开网站管理后台“账号与安全 / 安全日志”，录制相同 `trace_id` 从 `pending` 变为 `pass`。
6. 尝试在图片仍为 `pending` 时点击管理员通过，录制服务端拒绝公开；待 `pass` 后再次通过。
7. 截图保留回调配置、业务接口、后台检查记录和审核闸门，遮住 Token、OpenID、手机号、邮箱和用户证据原图。

运维可运行 `scripts/verify-wechat-mini-content-safety.mjs` 做重复验收。脚本只输出 HTTP 状态、审计记录 ID、状态和时间，不输出账号标识、OpenID、JWT 或密钥。

## 2026-07-27 生产验收状态

- 正式文字检查已通过：`msgSecCheck` 返回成功，数据库生成 `production_acceptance / text / pass` 记录。
- 正式图片任务已被 `mediaCheckAsync` 接受并生成 `pending` 记录。
- 图片任务等待 90 秒仍未收到微信回调，证明当前微信公众平台消息推送配置尚未保存或未生效；这项完成前不能宣称图片异步闭环已经验收通过。

## 网站微信账号

网站扫码登录保持可选。已登录用户可在“账号与安全”主动绑定或更换微信。网站开放平台 OpenID 与小程序 OpenID 不相同；后端只在获得同一开放平台 UnionID 时合并身份，不把两个 OpenID 直接比较。
