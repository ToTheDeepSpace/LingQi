# 剧幕录微信小程序虚拟支付

## 适用范围

小程序内以下三种固定服务使用微信小程序虚拟支付，不再新建普通 JSAPI 支付订单：

| product_id | 道具名 | 价格 |
| --- | --- | --- |
| `dossier_claim` | 档案认领 | 888 分 |
| `provider_listing` | 委托条上架 | 888 分 |
| `provider_contact` | 联系服务者 | 888 分 |

网站钱包充值和历史普通微信订单继续走原支付链路，不能与虚拟道具订单混用。

## 服务端配置

敏感值只保存在腾讯云 `/srv/secrets/lingqi_app_runtime.env`，不写入 Git、日志或知识库：

```text
LINGQI_WECHAT_VIRTUAL_PAY_OFFER_ID=
LINGQI_WECHAT_VIRTUAL_PAY_APP_KEY=
LINGQI_WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY=
LINGQI_WECHAT_VIRTUAL_PAY_ENV=0
```

- `env=0`：生产环境，使用正式 AppKey。
- `env=1`：沙箱环境，使用沙箱 AppKey。
- OfferId、沙箱 AppKey 和正式 AppKey 以微信公众平台虚拟支付配置页当前显示值为准。

## 道具同步

道具通过微信服务端 API 上传并发布，不依赖 Excel：

```bash
npm run sync:wechat-virtual-goods -- --env=1
npm run sync:wechat-virtual-goods -- --env=0
```

脚本逐个上传、查询任务、发布并再次查询任务。道具图片固定使用：

`https://jumulu.jusichen.com/api/wechat/virtual-pay/goods-image`

该地址返回 200x200 PNG，并允许 `https://mp.weixin.qq.com` 跨域读取。

## 支付与发货

1. 小程序每次发起支付前主动调用一次 `uni.login`。
2. 服务端用 code 换取临时 `session_key`，并校验 OpenID 与当前账号一致。
3. 服务端生成 JSON 字符串格式的 `signData`、`paySig` 和 `signature`；`session_key` 不入库、不返回。
4. 小程序调用 `wx.requestVirtualPayment`。
5. 微信向现有消息推送地址发送 `xpay_goods_deliver_notify`。
6. 服务端在数据库事务中校验账号、道具、金额、环境和 attach，只发放一次权益。
7. 回调丢失时，支付状态接口调用 `/xpay/query_order` 查单并通过 `/xpay/notify_provide_goods` 补发货。

客户端成功回调只表示微信支付流程结束，不能直接开通权益；最终状态必须以服务端回调或查单结果为准。
新小程序调用 `/api/lc/miniapp/virtual-service-payments/create`；旧 `/api/lc/service-payments/create` 只在 `0.1.44` 完成审核发布前兼容已上线版本，过渡结束后下线。

## 退款

收到 `xpay_refund_notify` 后，支付尝试和对应服务权益都标记为已退款。退款只撤销由该支付尝试开通的权益，不能影响其他订单。

## 上线验收

1. 数据库迁移 `20260805190000_wechat_virtual_service_payments.sql` 已执行。
2. 沙箱三个道具均上传并发布。
3. 沙箱支付能收到发货回调，重复回调不会重复发货。
4. 暂停回调后，状态查询能够补发货。
5. 正式三个道具均上传并发布。
6. 小程序开发版 `0.1.44` 使用正式环境完成一笔 8.88 元支付。
7. 管理后台和数据库只记录订单号、状态与必要审计字段，不记录 AppKey、AppSecret、session_key 或用户登录 code。

官方依据：

- `https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html`
- `https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html`
