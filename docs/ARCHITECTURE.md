# CWLBlog 架构说明

## 系统边界

CWLBlog 当前是静态优先的个人知识品牌站，不是多用户 CMS。文章正文、元数据和版本保存在 Git；浏览器只负责阅读交互、本地草稿和可选的第三方评论/订阅。动态服务尚未成为部署必需项。

## 构建数据流

```text
src/posts/*.md + src/content.config.ts + images/posts/*
                       |
          +------------+-------------+
          |                          |
          v                          v
 Astro Content Collections     scripts/build.mjs
 Schema / /post 路由           图片、RSS、Sitemap、知识派生
          |                          |
          +------------+-------------+
                       v
         根目录静态产物 + Pagefind 全文索引
                       |
                       v
              GitHub Pages / CDN
```

Astro Content Collections 已接管 `/post/` 列表和 `/post/{slug}/` 详情路由，并在路由生成前执行类型化 front matter Schema。`scripts/build.mjs` 仍负责统一文章领域模型、`draft: true` 隔离、图片处理，以及分类、系列、标签、知识资产、RSS 和 Sitemap 等派生产物；`scripts/sync-astro-output.mjs` 只允许把 Astro 的 `post/` 输出覆盖到 GitHub Pages 根目录。当前兼容层继续复用成熟的 HTML 模板，因此迁移前后的 URL、canonical、正文和交互保持一致。

Sharp 校验本地封面并生成 960px AVIF/WebP；Pagefind 对最终 HTML 的完整正文建索引；`knowledge/chunks.json` 以稳定哈希输出公开正文分块，供边缘混合检索和向量更新使用。`knowledge/health.json` 派生主题覆盖、内容陈旧度、链接孤立和维护优先级，知识资产页直接消费同一模型。迁移边界和后续拆分顺序见 [Astro 迁移说明](ASTRO_MIGRATION.md)。

## 内容模型

文章 front matter 的核心字段包括：

- 身份与 SEO：`title`、`shortTitle`、`slug`、`summary`、`description`
- 生命周期：`date`、`modified`、`draft`
- 组织：`tags`、`category`、`series`、`order`
- 媒体：`cover`、`coverAlt`

分类和系列使用 `src/config.mjs` 中的稳定 ASCII ID 作为 URL。展示名称可以调整，但 ID 和已发布 slug 不应随意变更。

## 浏览器架构

- `/post/` 路由由 `src/pages/post/` 中的 Astro 页面生成；共享布局暂由 `src/templates/layout.mjs` 兼容输出，下一阶段再拆为原生 Astro 组件。
- `css/coder.css` 承载既有全站样式，`css/content.css` 承载文章、知识页和新增内容组件；后续继续按 token/layout/component/page 拆分。
- 浏览器脚本大部分仍是全局 IIFE，按页面使用 `defer` 加载；CodeMirror 工作台已使用 TypeScript、esbuild 和严格 `tsc --noEmit` 门禁，其他脚本将渐进迁移为 ES Modules/TypeScript。
- 搜索优先使用 Pagefind，保留 `search-index.json` 作为兼容数据源。
- 编辑器使用 CodeMirror 6 和 IndexedDB 保存多草稿，支持 Markdown 诊断、快捷格式、WikiLink 与预览同步；草稿数据不上传、不进入 Service Worker 缓存。认证作者可申请短期图片上传许可，许可与 CSRF 只存在页面内存。

## PWA 缓存边界

`service-worker.js` 只处理同源 GET 请求：

- 文章、分类、系列、标签和知识页：网络优先，离线时回退到已访问版本。
- CSS、JavaScript、图片、字体和 Pagefind：缓存命中后立即返回，并在后台更新。
- `/editor/`、`/overleaf/`、`/api/`：页面请求以及由这些页面发起的同源子资源请求全部绕过 Service Worker。

私有边界同时检查请求 URL 与 `request.referrer`，避免已控制页面把 `/js/editor*.js` 等创作资源写入共享缓存。缓存有显式版本号，激活新版本时仅清理带 `cwlblog-public-` 前缀的旧缓存，不触碰其他站点数据。

`build:pwa` 会对 Service Worker 逻辑以及公开 `css/js/images/fonts`、离线页和 Manifest 计算内容哈希并写入缓存名。新 HTML 与旧 CSS/JS 因部署顺序混用的窗口因此受控；相同输入重复构建保持同一版本。

## 内容关系

Markdown 支持 `[[slug|显示文字]]` 和普通站内文章链接。构建器基于 Markdown token 树提取关系，忽略代码块和行内代码；不存在的目标会使构建失败。每篇文章得到 `outgoingLinks` 与 `backlinks`，知识图谱把正文引用作为独立边类型输出，因此推荐、孤立文章检测和后续 RAG 都可复用同一关系数据。

文末推荐在构建期计算，正文引用权重最高，其次为同系列、同专题和共同标签，发布时间接近度只用于小幅排序。推荐卡会显示主要原因；算法只依赖公开文章元数据和引用关系，不创建访客画像。

## 外部服务

- Giscus：文章评论，按需加载并依赖 GitHub 身份。
- Buttondown：邮件订阅。
- Umami/Plausible：可选匿名统计；未配置时不发起请求，遵守 DNT/GPC。
- AI：当前为本地规则/用户自有密钥体验；站点不分发可复用的模型密钥，只允许两个只读中转站预设，密钥不落盘。
- 知识问答：可选 Workers AI + Vectorize 边缘能力，回答只基于公开分块并返回原文来源；未配置时保持网络静默。

全站 CSP 已移除 `script-src 'unsafe-inline'`，JSON-LD 由逐页 SHA-256 哈希授权，`script-src-attr 'none'` 禁止内联事件；文章详情页才允许 Giscus，只有工具箱允许固定版本 jsDelivr。Pagefind 和 MediaPipe 页面按能力获得专用 `wasm-unsafe-eval`，普通 `unsafe-eval` 始终禁用。公开路由也已移除样式侧 `unsafe-inline`，一方脚本不再写入内联样式，静态 `style` 属性会让构建失败。CodeMirror 6 依赖运行时测量样式，因此仅 `/editor/` 保留样式侧兼容例外，并由测试阻止扩散到其他路由。网络权限同样按能力生成：公共页只连接明确的统计、订阅、固定 AI 预设和配置的 Worker Origin，联系页增加 Web3Forms；只有包含任意目标 API 测试器的 `/tools/` 保留宽泛 HTTPS。

## 单作者发布边缘

`worker/src/index.ts` 已实现 `/api/v1` 发布边缘。GitHub OAuth 只验证作者白名单，仓库写入使用服务端细粒度 Token；签名 HttpOnly Cookie、精确 Origin 与 CSRF 共同保护写接口。发布操作只允许写入 `src/posts/{slug}.md`，并通过临时分支和 PR 进入现有 CI，不直接修改主分支。创建后由只读作者接口聚合 PR 与 Check Runs 状态，编辑器采用有上限的轮询显示 CI 成功、失败、合并或关闭终态。

图片上传采用 Worker 签发的 5 分钟内存许可和 R2 对象存储。服务端生成 `images/uploads/YYYY/MM/{uuid}.{ext}`，复验类型、魔数、字节、真实像素与 SHA-256，并以条件写入阻止许可重放覆盖。认证作者可通过固定前缀、cursor 分页的只读媒体库复用历史图片；列表响应不暴露上传者和任意 R2 元数据。构建期 `asset-references.json` 与 R2 分页审计提供带最短保护期的孤立资源 dry-run，当前不开放自动删除。公开读取走独立 HTTPS 资源域名；Analytics Engine 只保存登录名、事件、slug/对象键和错误码，不保存正文、图片内容或 Token。完整配置见 [GitHub PR 发布 API](PUBLISHING_API.md)。

知识问答以关键词召回与 Vectorize 召回做融合排序，只允许当前 `datasetHash` 的向量进入上下文。`AiBudget` Durable Object 原子执行每 IP 哈希分钟限流和每日全局熔断；低证据问题不调用生成模型。作者可在编辑器手动重建索引，每周定时任务处理遗漏更新。

临时聊天室保持静态站与动态状态分离：`/chat/` 只发布大厅和客户端，`ChatRoom` Durable Object 按邀请码隔离 WebSocket、在线状态和滚动消息历史，`ChatGate` 按 HMAC 后的访客 IP 隔离创建与加入限流。房间闹钟在闲置两小时后关闭连接并清空存储，聊天室页面与请求均绕过 PWA 缓存。

离线评测集覆盖每篇已发布文章，CI 要求词法 Top-3 Recall 与离题问题拒答率均不低于 90%。模型回答在发给浏览器前会删除超出本次来源数量的引用编号；有事实回答但没有合法引用时补入 `[1]`，明确“不知道/证据不足”的回答不伪造引用。`npm run eval:knowledge` 可单独执行该门禁。

## 内容健康与恢复

内容健康模型以“当前月月初”和仓库最新 `modified` 日期中的较晚者作为时钟：90 天进入复核、180 天进入更新队列。这样停更时陈旧度仍会推进，又把纯时间导致的生成文件变化限制为每月一次；恢复构建可用 `CWL_CONTENT_AS_OF=YYYY-MM-DD` 固定时钟。模型同时计算四个稳定主题各 5 篇的阶段覆盖目标、正文入出链孤立、图谱孤立和标签稀疏度。它用于安排内容维护，不采集或推断访客数据。

`.github/workflows/content-backup.yml` 每月生成内容快照，对 Markdown、原始图片和内容 Schema 建立 SHA-256 清单，执行一次隔离目录恢复后保存 90 天 Artifact。配置 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME` 时，工作流会通过 S3 兼容接口把 R2 对象纳入同一快照；未配置时明确降级为 Git 内容快照。恢复工具先验证全部路径、字节数与哈希，只允许创建新目录，不覆盖工作区。

## 目标演进

近期继续保持静态优先：文章集合和路由已迁移到 Astro Content Collections/TypeScript，下一步迁移公共布局并拆分浏览器 IIFE。Git 仍是唯一内容源。只有资源上传、Git PR 发布、带引用的 AI 问答等动态请求进入版本化边缘 API。向量分块、资源元数据和审计日志可使用独立数据库，文章正文不得与 Git 双写。

多用户、租户、会员、主题市场和插件市场不在当前系统边界内；达到明确用户规模后再评估平台化。
