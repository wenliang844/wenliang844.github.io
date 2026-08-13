# CWLBlog

CWLBlog 是一个以 Markdown + Git 为内容真源的个人技术博客和知识资产站。Astro Content Collections 负责文章 Schema 与路由，Node.js 构建器生成图片、分类、系列、知识图谱、RSS、Sitemap 与 Pagefind 全文索引，产物可直接部署到 GitHub Pages。

## 当前能力

- Markdown 文章、严格 front matter 校验、`draft: true` 发布隔离
- Astro Content Collections 类型化内容模型，以及保持既有 URL 的静态文章路由
- 分类、标签、系列连续阅读、文章修订时间与 Git 历史入口
- Pagefind 中文全文搜索、全文 RSS、Sitemap、canonical、OG 和 JSON-LD
- Sharp 响应式图片流水线，生成 AVIF/WebP 并校验尺寸与 alt
- CodeMirror 6 Markdown 工作台、IndexedDB 多草稿、实时诊断/预览与 Markdown 导出
- 单作者 GitHub OAuth 发布边缘，可从编辑器创建内容分支、PR 和预览链接
- R2 安全图片上传，包含短期许可、魔数/尺寸复验、随机不可覆盖对象键
- 移动端目录抽屉、阅读进度、Giscus 评论与邮件订阅
- WikiLink、文章反向链接，以及由标签、系列和正文引用构建的知识图谱
- 内容健康看板，跟踪主题覆盖、内容陈旧度、孤立节点和维护优先级
- 基于正文引用、系列、专题、标签与时效的可解释文章推荐
- 基于公开文章的混合检索知识问答，包含原文引用、无证据兜底和预算限流
- 可选 Umami/Plausible 分析适配器，默认关闭并遵守 DNT/GPC
- PWA 离线阅读公开文章；编辑器、简历编辑器和 API 永不进入缓存
- 可嵌入式在线群聊，由 Minnit Chat 托管并支持访客昵称加入
- 每月带 SHA-256 清单的内容备份、可选 R2 镜像与隔离恢复演练

## 本地开发

要求 Node.js 22.12.0 或以上版本。

```bash
npm ci
npm run build
npm run serve
```

本地地址为 `http://127.0.0.1:8137/`。

## 内容工作流

1. 在 `src/posts/` 新建 Markdown 文件。
2. 填写标题、slug、日期、摘要、分类、系列、封面与 `coverAlt` 等元数据。
3. 草稿阶段设置 `draft: true`，构建不会发布该文章。
4. 运行 `npm run validate:posts` 和 `npm run build`。
5. 使用 `npm run serve` 检查文章、搜索、图片与移动阅读体验。

现有文章 URL、canonical 和 RSS 地址是兼容性契约，重命名 slug 前必须提供迁移方案。

## 质量门禁

```bash
npm run check:readonly
npm run check:types
npm run check:astro
npm run check:generated
npm run test:coverage
npm run test:e2e
npm run security:secrets
npm run validate:production
npm audit --registry=https://registry.npmjs.org
```

CI 还会运行 Lighthouse 预算：Performance 不低于 90，Accessibility 和 SEO 不低于 95。

## 目录

- `src/posts/`：Markdown 内容源
- `src/content.config.ts`、`src/pages/post/`：Astro 内容 Schema 与文章路由
- `src/templates/`：静态页面模板
- `src/config.mjs`：站点、分类、系列和搜索页配置
- `scripts/build.mjs`：内容、图片和站点产物构建
- `scripts/sync-astro-output.mjs`：把 Astro 文章产物安全同步到 GitHub Pages 根目录
- `src/editor-codemirror.ts`：CodeMirror 编辑器源码，构建为仅编辑页加载的独立 bundle
- `src/client/site-runtime.ts`：全站主题与视觉交互唯一源码；Astro 直接导入，并生成兼容页使用的 `js/coder.js`
- `worker/src/index.ts`：GitHub OAuth、CSRF、内容校验、PR 发布与审计边缘 API
- `src/templates/chat.mjs`、`js/chat-embed.js`、`css/chat.css`：Minnit 在线聊天室嵌入页、无障碍增强与响应式样式
- `js/`、`css/`：浏览器交互、生成后的编辑器 bundle 与样式
- `pagefind/`：构建后的全文搜索资源
- `knowledge/graph.json`：构建期知识关系数据
- `knowledge/health.json`：构建期内容健康、主题覆盖和维护队列数据
- `scripts/backup-content.mjs`：内容快照、完整性验证和隔离恢复工具
- `tests/`：单元、构建、覆盖率和 Playwright 测试
- `docs/ROADMAP.md`：当前交付状态与后续路线

## 架构约束

- Git 始终是文章正文和版本的唯一真源。
- 动态能力采用边缘 API 渐进引入，不为个人站提前建设多租户 CMS。
- 浏览器中不保存平台 AI 密钥；AI 能力必须使用用户自有密钥或服务端代理。
- 生成产物随仓库提交，以兼容 GitHub Pages 分支部署。

详见 [变更日志](CHANGELOG.md)、[升级路线](docs/ROADMAP.md)、[架构说明](docs/ARCHITECTURE.md)、[Astro 迁移](docs/ASTRO_MIGRATION.md)、[发布 API](docs/PUBLISHING_API.md)、[部署说明](docs/DEPLOYMENT.md)、[安全说明](docs/SECURITY.md)和[性能说明](docs/PERFORMANCE.md)。
