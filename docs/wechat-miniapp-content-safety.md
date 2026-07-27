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
2. 小程序上传的公开图片在上传接口调用 `mediaCheckAsync`，初始状态为 `pending`。
3. 微信通过消息推送回传图片结果。回调按签名、AppID 和 `trace_id` 更新审计记录。
4. 管理员公开头像、主页主图、档案照片和红黑榜正文图片前，服务端再次确认微信图片检查为 `pass`。
5. `review`、`risky`、`pending` 和 `error` 图片均不能公开。
6. 举报证据、身份认领材料等只供管理员读取的私密材料不在公共页面展示，继续执行本地格式清洗和人工审核。

## 审计记录

`lc_wechat_content_checks` 只保存：

- 用户、业务场景和目标引用
- 文字内容哈希或图片 URL 哈希
- 微信 `trace_id`
- `pass / review / risky / pending / error`
- 标签、错误码和时间

表内不复制用户原文，不保存图片二进制。管理员在“账号与安全 / 安全日志”查看最近记录。

## 提审验证

1. 在开发者工具登录测试账号。
2. 分别提交一条角色点评、一条红黑榜评论和一张公开图片。
3. 录制 Network 中业务接口成功返回；文字接口必须由服务端产生微信检查记录。
4. 打开网站管理后台“账号与安全 / 安全日志”，录制对应 `trace_id` 和检查结果。
5. 在微信公众平台消息推送配置页完成 URL 校验并保存。
6. 截图保留回调 URL、明文模式、接口成功返回和后台检查记录，截图中遮住 Token 与用户隐私。

## 网站微信账号

网站扫码登录保持可选。已登录用户可在“账号与安全”主动绑定或更换微信。网站开放平台 OpenID 与小程序 OpenID 不相同；后端只在获得同一开放平台 UnionID 时合并身份，不把两个 OpenID 直接比较。
