# GitHub PR 发布 API

## 目标与边界

`worker/src/index.ts` 是单作者边缘发布服务。浏览器不持有 GitHub 仓库令牌；GitHub OAuth 只用于确认当前用户等于 `OWNER_GITHUB_LOGIN`，实际写仓库由 Worker 中的细粒度 `GITHUB_TOKEN` 完成。文章正文仍只写入 `src/posts/*.md`，Git 是唯一内容真源。

服务提供以下接口：

- `GET /api/v1/auth/github/start`：创建短期签名 state 并跳转 GitHub OAuth。
- `GET /api/v1/auth/github/callback`：验证 state 和作者白名单，签发 8 小时 HttpOnly 会话。
- `GET /api/v1/auth/session`：返回当前作者和只存在于页面内存的 CSRF Token。
- `POST /api/v1/admin/publish`：校验内容，创建分支、写入 Markdown、创建 PR，并返回 PR/预览 URL。
- `GET /api/v1/admin/publish/status?pr=42`：读取该 PR 和提交检查，返回聚合后的 CI/合并状态。
- `POST /api/v1/admin/assets/presign`：为已登录作者签发 5 分钟图片上传许可。
- `PUT /api/v1/admin/assets/upload/{objectKey}`：复验图片魔数、真实尺寸和字节数后写入 R2。
- `GET /api/v1/admin/assets`：为已登录作者分页列出可复用图片及公开元数据。
- `GET /api/v1/admin/assets/orphans?minimumAgeDays=30`：将 R2 库存与当前发布内容清单对比，只读返回孤立资源候选。
- `POST /api/v1/ai/chat`：对公开文章执行关键词/向量混合召回，以 SSE 返回回答和来源。
- `POST /api/v1/admin/knowledge/reindex`：认证作者重新计算当前知识分块向量。
- `POST /api/v1/auth/logout`：清除发布会话。

所有写请求必须同时通过精确 Origin、签名 Cookie、作者白名单和 CSRF 校验。请求体上限为 600 KB；slug 只能决定 `src/posts/{slug}.md`，不能构造任意仓库路径。PR 创建失败会删除临时分支。

图片许可接口需要 Cookie、Origin 和 CSRF；实际上传只接受精确 Origin 与一次性用途的短期签名许可，许可只保存在页面内存。服务端仅接受 AVIF/JPEG/PNG/WebP，限制 8 MB、单边 12000px 和 4000 万像素，并校验声明类型、实际魔数、真实尺寸和 SHA-256。对象键由服务端随机生成，R2 使用 `etagDoesNotMatch: *` 禁止覆盖已有对象，返回资源使用一年 immutable 缓存。

媒体库列表接口是作者只读接口，需要精确 Origin 和有效 HttpOnly 会话，但不需要 CSRF。它固定限制在 `images/uploads/` 前缀，单页最多 60 条，只返回对象键、公开 HTTPS URL、MIME、字节、尺寸、上传时间和合法 SHA-256，不返回 `uploadedBy`、Cookie、上传许可或其他自定义元数据。R2 cursor 作为不透明值分页，编辑器只在内存中保留当前结果。

每次构建还会生成 `asset-references.json`，记录已发布文章正文和封面引用的 `images/uploads/` 对象键及内容哈希。孤立资源审计接口会读取该清单并分页扫描 R2；保护窗口默认 30 天，可配置范围为 7–365 天。响应始终带有 `dryRun: true`，只报告候选数量、可回收字节和最小公开元数据，不执行删除。这样未合并 PR 或刚上传但尚未使用的素材不会被自动清理；实际删除继续要求人工复核 R2 对象键。

知识问答只读取构建生成的 `knowledge/chunks.json`。查询先执行中文/英文关键词召回，再用 Workers AI embedding 与 Vectorize 进行向量召回，以数据集哈希过滤旧向量；证据低于阈值时不调用生成模型，直接返回“不知道”。模型上下文明确把文章正文视为数据而非指令，回答必须使用 `[n]` 引用，SSE 的 `sources` 事件只返回同站文章路径。

## GitHub 配置

1. 创建 GitHub OAuth App，Callback URL 设置为 `https://<api-domain>/api/v1/auth/github/callback`。
2. 创建只授权当前仓库的 Fine-grained PAT。
3. PAT 仅授予 `Contents: Read and write`、`Pull requests: Read and write`、`Checks: Read-only`、`Metadata: Read-only`。
4. OAuth App 只请求 `read:user`，OAuth 用户 Token 不会写入 Cookie、日志或数据库。

## Worker 配置

先检查 [wrangler.toml](../worker/wrangler.toml) 中的站点 Origin、仓库、主分支和作者登录名，然后设置变量与秘密：

```bash
wrangler secret put GITHUB_CLIENT_ID --config worker/wrangler.toml
wrangler secret put GITHUB_CLIENT_SECRET --config worker/wrangler.toml
wrangler secret put GITHUB_TOKEN --config worker/wrangler.toml
wrangler secret put SESSION_SECRET --config worker/wrangler.toml
wrangler secret put PREVIEW_URL_TEMPLATE --config worker/wrangler.toml
```

`SESSION_SECRET` 至少 32 字节。`PREVIEW_URL_TEMPLATE` 可使用 `{branch}`、`{branchSlug}` 或 `{pr}` 占位符。没有可预测的预览域名时可以不配置，此时接口仍返回 PR URL。

创建 R2 桶并为其绑定 HTTPS 自定义域名：

```bash
wrangler r2 bucket create cwlblog-assets
```

`worker/wrangler.toml` 中 `ASSETS` 绑定必须指向该桶；通过 Cloudflare Dashboard 或生产环境配置注入真实的 `ASSET_PUBLIC_BASE` HTTPS 资源域名。仓库配置不会提供示例默认值，缺少该变量时上传接口会失败关闭。对象上传经 Worker 校验后写入 R2，公开读取直接走资源域名，不消耗发布 API。

创建 1024 维余弦 Vectorize 索引：

```bash
wrangler vectorize create cwlblog-knowledge --dimensions=1024 --metric=cosine
```

Worker 使用 Workers AI、Vectorize 和 `AiBudget` Durable Object。`AI_ENABLED` 默认是 `false`；首次部署后先在编辑器连接作者 GitHub 账号并点击“更新知识索引”，确认返回向量数，再把生产变量切换为 `true`。`AI_DAILY_REQUEST_LIMIT` 控制每日全局预算，`AI_REQUESTS_PER_MINUTE` 控制 HMAC 后访客标识的分钟限额；服务端不会保存原始 IP 或问题正文。每周一 03:00 UTC 会自动按当前公开分块重建向量。

发布前验证并部署：

```bash
npm run check:types
npm run check:worker
npm run deploy:worker
```

Wrangler 会创建/连接 `cwlblog_audit` Analytics Engine 数据集。审计记录只包含事件类型、GitHub 登录名、slug、分支或错误码和时间，不包含正文及任何 Token。

## 编辑器接入

将 `editor/index.html` 中的配置改为实际 API Origin：

```html
<meta name="cwl-api-base" content="https://api.example.com">
```

推荐让博客与 API 使用同一站点下的域名，使 `Secure; HttpOnly; SameSite=Lax` 会话正常工作。Worker 的 `SITE_ORIGIN` 必须与浏览器 `Origin` 完全一致，不能配置为通配符。

编辑器未配置 API 时仍可使用本地多草稿与 Markdown 导出；连接后才启用“创建发布 PR”和媒体库。创建 PR 后，编辑器立即读取 GitHub Check Runs，并以 10 秒间隔最多跟踪 5 分钟；`success`、`failure`、`merged` 或 `closed` 终态会立即停止轮询。媒体库支持筛选、分页、复用为封面或插入 Markdown 正文，服务端对象键始终通过 DOM 文本节点呈现。CSRF Token 只保存在运行时内存，刷新页面后通过会话接口重新获取。

## 预览部署

PR 预览由仓库关联的 Cloudflare Pages、Vercel 或其他预览平台负责。将其稳定的分支/PR URL 规则写入 `PREVIEW_URL_TEMPLATE`，API 会直接把计算后的地址返回编辑器。合并仍受 CI、代码审查和分支保护约束，Worker 不直接推送主分支。

## 验证

`tests/api-worker.test.mjs` 覆盖 OAuth state、作者拒绝、Cookie/CSRF/Origin、请求体上限、内容创建/更新、Draft PR、失败回滚、短期上传许可、图片校验、媒体库鉴权/分页/元数据最小化、混合检索引用、无证据兜底、原子限流/预算和向量重建。`npm run check:worker` 使用 Wrangler 对真实 Worker 入口执行部署 dry-run。
