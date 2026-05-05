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

## 部署

项目部署在 **Vercel**：[https://lingqi.vercel.app](https://lingqi.vercel.app)

```bash
vercel --prod
```
