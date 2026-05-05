# 灵契 LingQi

> 让每个把纸片人带到现实的人都被看见。

**灵契**是面向泛二次元创作者的专属主页平台。卡司/DM、Coser、摄影师、妆造师可以创建个人主页，展示作品、管理档期、连接粉丝。

## 设计理念

### 金生水（Gold & Water）
- **金**：暖白底色、金色点缀、干净线条、精致感
- **水**：深邃蓝黑（ink）、流动感、留白与呼吸感
- **金生水**：金色渐变过渡到蓝色，贯穿整套 UI

### 品牌色板
| Token | 色值 | 用途 |
|---|---|---|
| `gold-500` | `#c9922e` | 主金色强调 |
| `ink-800` | `#132b4a` | 深水色背景/按钮 |
| `cream` | `#faf8f5` | 页面底色 |
| `warm-white` | `#fdfcf9` | 卡片底色 |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | **React 19** + **TypeScript** |
| 构建工具 | **Vite 8** |
| 样式 | **TailwindCSS v4** (CSS `@theme` 设计令牌) |
| 字体 | Noto Serif SC / Noto Sans SC |
| 后端 | **Vercel Serverless Functions** (Express) |
| 数据库 | **Supabase** (PostgreSQL + Storage) |
| 认证 | JWT (jsonwebtoken + bcryptjs) |

## 页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | Home | 落地页，介绍平台 |
| `/explore` | Explore | 发现创作者，筛选+分页 |
| `/explore/:id` | CreatorProfile | 创作者公开主页 |
| `/login` | Login | 登录/注册（分屏布局） |
| `/dashboard` | Dashboard | 创作者后台（资料/服务/档期/作品） |
| `/admin` | Admin | 管理后台（审核创作者/联系申请） |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 环境变量

复制 `.env.example` 到 `.env` 并填入实际值：

```
VITE_SUPABASE_URL=       # Supabase 项目地址
VITE_SUPABASE_ANON_KEY=  # Supabase 匿名密钥
SUPABASE_SERVICE_ROLE_KEY= # Supabase 服务角色密钥
JWT_SECRET=              # JWT 签名密钥
ADMIN_PASSWORD=          # 管理后台密码
```

## 与剧掌柜的关系

**灵契**和**[剧掌柜](https://github.com/ToTheDeepSpace/LingQi)（script-scheduler）** 是两个独立但互联的产品，共享同一套 Supabase 数据库，构成沉浸式娱乐操作系统 + 创作者经济平台。

| | 剧掌柜 | 灵契 |
|--|--------|------|
| **定位** | 店家的操作系统 | 创作者的职业主页 |
| **用户** | 店家客服、店长 | 卡司/DM、Coser、摄影师、妆造师 |
| **功能** | 排期管理、抢车模式、签到、卡司管理 | 个人主页、作品集、档期、粉丝联系 |
| **前端** | schedule 管理界面 | 创作者平台 (lingqi.vercel.app) |

### 打通方式

**场景一：卡司入驻灵契 → 自动关联剧掌柜**
卡司在灵契注册填写手机号 → 创建个人主页 → 剧掌柜通过手机号自动识别该卡司 → 排班数据同步

**场景二：玩家通过灵契约卡司 → 对应剧掌柜排期**
粉丝查看卡司档期 → 申请联系 → 客服收到申请 → 在剧掌柜创建排期 → 粉丝确认

**场景三：档期日历 ↔ 排班表双向同步**
剧掌柜创建排期 → 对应卡司的灵契主页自动显示该时段不可约 → 无需重复填档期

### 数据关联

剧掌柜的 `actors` 表和灵契的 `lc_profiles` 表通过**手机号**关联，实现卡司 ↔ 创作者的数据互通。

详细 BP 见 `script-scheduler/BP_v4.md`。

## 部署

项目部署在 **Vercel**：[https://lingqi.vercel.app](https://lingqi.vercel.app)

```bash
vercel --prod
```
