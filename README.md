# 剧幕录

> 幕前有演绎，幕后有记录。

剧幕录是面向剧本杀和沉浸式娱乐参与者的卡司评分与口碑记录平台。核心功能从 DM 评分开始，支持各地各店口碑查询、红黑榜事件、城市口碑、公开档案、建议反馈和用户共建剧本库。

生产地址：<https://jumulu.jusichen.com>

## 产品边界

- `DM 评分`：每次真实开本一条综合五星评分，日期和剧本必填。
- `公开档案`：DM、店家和城市口碑可以关联查询；未收录 DM 可先提交档案再评分。
- `红黑榜`：承接具体推荐或避雷事件，口碑票与契约币加权分开展示。
- `剧本库`：与剧司辰共用剧本基础数据，用户提交后进入审核。
- `服务主页`：保留摄影、妆造、角色委托等服务能力，但不再承担产品主定位。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite 8、TailwindCSS v4 |
| API | Express 5、Node.js |
| 数据库 | 腾讯云本机 PostgreSQL |
| 认证 | JWT、bcryptjs |
| 文件 | 腾讯云 COS 或本地上传目录 |
| 部署 | 腾讯云 Nginx、systemd、Node 服务 |

## 主要路由

| 路由 | 说明 |
|---|---|
| `/` | 剧幕录首页 |
| `/dm` | DM 评分与档案 |
| `/dm/rate` | 提交 DM 评分 |
| `/rankings` | 红黑榜事件 |
| `/reputation/city` | 城市口碑 |
| `/scripts` | 角色点评与共用剧本库 |
| `/explore` | 服务大厅 |
| `/dashboard` | 个人后台 |
| `/admin` | 审核与管理后台 |

## 本地开发

```bash
npm install
npm run dev
```

完整构建与核心验证：

```bash
npm run lint
npm run build:tencent
npm run test:auth-flow
npm run test:dm-rating
npm run test:shared-script-library
npm run test:ranking-workflow
```

## 部署

```bash
npm run deploy:tencent
```

环境变量仍保留 `LINGQI_*`、`lc_*` 等内部兼容命名。产品改名不迁移数据库标识、认证项目枚举、存储前缀或历史 API 路径。

## 与剧司辰的关系

剧司辰负责店家排期、DM 工作台和经营数据；剧幕录负责面向玩家的公开评分、口碑事件、卡司档案和共建内容。两个产品使用同一套剧本基础数据，但店内经营数据不会自动公开。
