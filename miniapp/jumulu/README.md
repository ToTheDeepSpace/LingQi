# 剧幕录小程序

基于 uni-app（Vue 3 + TypeScript）的微信小程序首版。生产 API 固定使用 `https://jumulu.jusichen.com/api`，管理后台继续使用网站 `/admin`。

## 首版范围

- 首页、DM 档案、店家档案、角色点评、红黑榜、拼车区
- 微信登录、首次注册昵称、手机号绑定
- DM/店家/角色评价、榜单投票与评论、举报
- 发布人主页和“我的内容”管理
- 微信文本内容安全预检

首版不包含钱包支付、网站管理后台、档案编辑和榜单创建。

## 命令

```bash
npm install
npm run check
```

微信构建产物位于 `dist/build/mp-weixin`。开发者工具使用 AppID `wx613356b3e1334eef` 导入该目录。
