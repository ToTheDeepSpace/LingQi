# 微信服务通知旧方案（0.1.49，已暂停，禁止按此发布）

## 2026-09-05 21:24 用户纠正：当前实现不满足需求

用户明确要求：按业务模块设置长期保留的提醒开关；有人发起委托或发送会话消息时及时提醒，点击后直接进入小程序内双方实时对话。不是让用户为下一条通知反复订阅。

`c7ab752` 只有一次性微信订阅、站内通知转发、15秒轮询与通知详情，**没有双方实时会话，也不具备离开小程序后无限次微信提醒资格**。测试通过不代表完成用户目标。暂停迁移、部署、上传、提审，以下内容仅保留为旧方案实现记录，不是可执行发布授权。

需要先将“长期保存的模块偏好”“小程序内实时聊天”“小程序外微信持续触达”分开设计并验证。当前微信官方规则仍限制一次性订阅额度，长期/限频和新版服务动态有类目与模板资格要求；不能把产品偏好等同微信下发权限。正式通道可行性未证实，不能通过更换按钮文案、滥用其他行业模板、强制反复授权或接入IM SDK冒充已解决。

本次暂停不删除旧代码或微信已添加模板，不改任何生产业务数据；线上通知功能尚未部署，已上传开发版仍0.1.48。

## 范围和当前状态

2026-09-05 用户确认先接“平台有通知后，在微信消息列表收到提示”。本次只接现有 `lc_account_notifications` 的新增通知，不扩展双边交易支付、抽佣或售后规则；“我的提交”里的动态汇总不等于新增站内通知。

- 代码在 `codex/wechat-service-notifications-20260905`，小程序版本 0.1.49。
- 微信后台已添加匹配模板；生产应用、数据库和已上传开发版 0.1.48 尚未变更。尚未发送真实微信通知或完成手机验收。
- 新入口在消息中心顶部：接收下一条提醒 / 暂停提醒。客户端在点击前准备短时请求，点击时直接调用订阅 API，不自动弹授权。
- 普通一次性订阅一次对应一条。记录接受不是无限授权或精确剩余额度，微信发送接口最终校验额度。发送成功仅记录 `api_accepted`，不等于手机展示成功。

## 已验证的账号模板

- AppID：`wx613356b3e1334eef`
- 类目：日历 292、预约/报名 698、社区/论坛 794。
- 模板“未读消息提醒”，公共 tid `4456`，type `2`；选取 kidList `[4,5,3]`。
- 实际 template ID：`b36niF4nvnAF3k4K7ju4J1joO2jzpsEhqfOQMhKrcyU`。
- 字段：`phrase4` 消息类型、`thing5` 消息内容、`date3` 发送时间。
- 场景：站内业务通知未读提醒。只发送固定短提示与时间，不发送用户姓名、聊天正文、联系方式或证明材料。
- 当前官方入口及字段已核验；未假定本账号具有长期订阅或新版服务动态资格。

## 实现与安全边界

数据库 AFTER INSERT 触发器在业务事务内记录投递项，通知 ID 是唯一键。没订阅的消息记为跳过，不历史补发。发送工作器每 15 秒扫描，跨进程使用会话级 advisory lock；取任务用 `FOR UPDATE SKIP LOCKED`，网络请求不占业务事务。

发送前检查未读、24 小时内、当前微信绑定、非合并账号、最新订阅和模板。暂停、取消或账号绑定改变后跳过。微信签名校验后的 `subscribe_msg_change_event` 同步拒绝状态；旧回调不覆盖更新后的偏好。未授权、失败、超时均不删除站内通知。

微信 43101 标记需再次订阅；无效 token / 43108 / -1 等明确拒绝最多尝试三次。网络超时、非明确结果和中断发送标记 unknown，不自动重发，以免重复消耗授权。若额度不足响应与新订阅并发，只更新原订阅版本。客户端确认可幂等重试，但旧确认不能恢复已暂停状态。

仅服务端推导当前账号 OpenID 摘要；请求 ID 绑定账号、模板、微信身份、10 分钟有效期。订阅确认要求签名令牌的 `wechat-miniapp` 通道，不能仅凭客户端 Header。私密接口使用账户状态鉴权，受限账号仍可处理账号通知，合并账号须重新登录。通知详情按当前所有者过滤，避免深链越权。

三张新表启用 RLS，撤销继承的宽泛默认授权；应用仅 SELECT/INSERT/UPDATE，无 DELETE/TRUNCATE，无跨项目读取权限。实际生产应用角色为 Tencent PG 的 BYPASSRLS 服务端角色，不向客户端开放数据库。该迁移虽沿用 `supabase/migrations` 目录，目标是腾讯云本机 PostgreSQL，非旧 Supabase 项目。

## 发布步骤（需要本轮配套发布确认）

1. 检查工作树、提交与生产当前版本，保留回滚提交。备份腾讯云 `lingqi_prod_candidate`，先执行 `20260905210000_wechat_notification_delivery.sql`。只新增表、索引与通知触发器，不改现有通知内容、不补历史数据。
2. 使用 `scripts/wechat-notification-template.mjs` 默认只读检查模板仍存在；已添加则勿重复选取。`--apply` 会选择该模板，需账号配置权限，脚本不打印 token/secret。
3. 在受管 `/srv/secrets/lingqi_app_runtime.env` 配置：
   - `LINGQI_WECHAT_NOTIFY_ENABLED=true`
   - `LINGQI_WECHAT_NOTIFY_TEMPLATE_ID=b36niF4nvnAF3k4K7ju4J1joO2jzpsEhqfOQMhKrcyU`
   - `LINGQI_WECHAT_NOTIFY_PAGE_STATE=trial` 用于开发/体验验收；正式发布前改 `formal` 并重启。
   - 微信 AppID/secret 沿用当前服务受管配置，不写入仓库、共享日志或命令输出。
4. 部署后检查 `lingqi.service`、本机端口 **3002**、公网 health、未登录私密接口 401、数据库启动 schema contract 和触发器存在。
5. 上传开发版 0.1.49，保留上传回执；不能把构建成功当上传成功。未经用户要求不代提审。
6. 测试账号手机点“接收下一条提醒”并允许，随后触发一条正常业务站内通知。生产测试通知必须由用户指定测试账号并同意测试场景，禁止对所有用户补发。
7. 验证微信服务通知出现、点击显示该条通知、业务事项可查看。再验证拒绝、暂停、额度用尽、微信系统通知关闭时的表现。真机接收和页面跳转证据是最终验收，不能只看 API 返回 0。
8. 正式发布前切 page state 为 formal。若用户拒绝/屏蔽或额度耗尽，明确提示重订阅/设置；不得假装无权限问题已解决。

## 本地验证

- `npm run lint`
- `npm run check:miniapp`
- `npm run build:tencent`
- `npx tsc -p tsconfig.test.json && node --test dist-test/tests/*.test.js`（273 项）
- `npm run build:server && JUMULU_TEST_PGLITE_MODULE=/path/to/pglite/dist/index.js node --test tests/wechatNotifications.integration.mjs`（5 组 PostgreSQL 引擎场景，无真实推送）
- 本地 H5 模拟数据在 320/390/768px 检查按钮首屏可见、无横向溢出，暂停后状态变更通过；截图位于本机 `/private/tmp/jumulu-wechat-notify.sRq5aG/message-center-390.png`。这不是微信授权/接收的真机验收。

## 运维与回滚

按 `lc_wechat_notification_deliveries.state/reason/error_code` 查失败；不要记录完整发送 URL/token/OpenID 或私密正文。40037/47003 查模板及字段，43107 查类目/能力限制，43101 用户重新订阅，43108 限流串行处理。unknown 不人工直接改回 pending，应先核实是否已发送，并重新取得用户测试授权。

暂停全局发送：将 ENABLED 改 false 并重启，站内通知不受影响，入口明确显示未配置。全局暂停后的恢复不会重发超 24 小时或已读通知。回滚旧代码时保留新表审计和触发器，不删除/回退现有通知、订阅或投递记录；回滚前先关工作器。再次开启须确认模板、页面状态和队列中待发范围。

## 官方依据

- [订阅消息总览](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)
- [一次性弹窗订阅](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
- [发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)
- [选用模板](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_addwxanewtemplate.html)
