# Astro 迁移说明

## 当前边界

迁移采用逐路由替换，不改变 GitHub Pages 根目录发布方式：

| 能力 | 当前所有者 |
|---|---|
| Markdown front matter Schema | `src/content.config.ts` / Astro Content Collections |
| 文章、分类、系列、标签、知识路由 | `src/pages/` + `src/layouts/BaseLayout.astro` |
| 文章领域模型、内部链接、推荐 | `scripts/build.mjs` 共享函数 |
| 文章 head、导航与页脚 | `src/layouts/BaseLayout.astro` + `src/components/` |
| 分类、系列、标签、知识内容区 | `src/components/*.astro` 结构化组件 |
| 文章详情结构 | `ArticlePage.astro` 原生结构化组件 |
| 文章列表阅读器 | `PostListPage.astro` + `PostPanel.astro` 原生结构化组件 |
| 文章阅读器交互 | `src/client/article-runtime.ts` 及 `post-list.ts`、`article-toc.ts`、`post-extras.ts` 路由级 ES Modules |
| 全站主题与视觉交互 | `src/client/site-runtime.ts`；Astro 直接导入，兼容页构建为 `/js/coder.js` |
| 文章 Markdown 内容区 | `MarkdownContent.astro` 最小受信任边界 |
| RSS、Sitemap、知识 JSON 与未迁移页面 | `scripts/build.mjs --skip-astro-html` |
| Astro 产物同步 | `scripts/sync-astro-output.mjs`，五个内容目录 + 清理后 `_astro` 哈希资产 |

完整构建顺序是：编辑器 bundle → 非 Astro 派生产物 → Astro 内容路由 → 样式/PWA/CSP → Pagefind。最终 HTML 继续写入仓库根目录，现有 URL、canonical、RSS 地址和 GitHub Pages 分支部署不变。

## 不变量

- `src/posts/*.md` 和 Git 始终是文章正文与版本的唯一真源。
- `draft: true` 不得进入页面、搜索、RSS、Sitemap、知识图谱或 RAG 分块。
- Astro 与兼容构建器共享 `buildPosts`，不得复制排序、链接、图片或推荐逻辑。
- `BaseLayout.astro` 只能渲染组件插槽；文章元数据、目录、相关推荐、列表导航和聚合内容路由不得使用 `set:html`，构建后的 Markdown HTML 只能进入 `MarkdownContent.astro`。
- 列表面板的正文标题 ID 必须以文章 slug 为前缀；树链接、J/K 键切换、标签/关键词筛选、URL hash 和 Giscus 线程切换保持现有契约。
- 列表状态只由 `post-list.ts` 管理，不得重新引入 `window.coderShowPost` 或让全站 `coder.js` 绑定文章列表事件。
- 文章阅读进度/续读、代码复制、语法高亮、图片灯箱、阅读时长、列表内动态目录和下一篇推荐只由 `article-runtime.ts` 及其子模块管理；全站 `coder.js` 不得重新扫描文章正文或写入阅读位置。
- `code-highlight.ts` 只在首个代码块进入 800px 预取区后请求本地 `highlight.min.js`，必须复用已加载或加载中的脚本；无代码文章不得请求该 123 KB vendor，vendor 也不得被打进 Astro 入口 chunk。
- `site-runtime.ts` 是主题、返回顶部、渐显、技能条和指针效果的唯一源码；Astro 布局必须过滤 `/js/coder.js` 后直接导入它，兼容页只能消费由构建脚本生成的同名 IIFE 产物。初始化必须幂等，并在 `pagehide` 清理后支持 bfcache 恢复。
- 评论能力通过布局元数据显式授权 CSP；`post-extras.ts` 只在分享条或评论区接近视口时加载 QR、分享和 Giscus 运行时。
- Astro 输出只可覆盖 `/post/`、`/categories/`、`/series/`、`/tags/`、`/knowledge/`；目录中的 RSS/JSON 由同步合并保留，其他路由继续由原构建器或手写页负责。
- `_astro` 必须整体替换后发布并纳入 PWA 版本哈希，旧内容哈希文件不得跨构建累积。
- 每个 Astro 接管页包含生成器标记，生产校验会阻止兼容构建器意外覆盖它。

## 后续顺序

1. 迁移工具箱及其他公共页面，逐步减少 `/js/coder.js` 兼容 bundle 的消费者。
2. 把 RSS、Sitemap、知识 JSON 改为 Astro endpoint 或集成产物。
3. 所有公共页面迁移后，删除兼容 bundle、根目录同步桥和兼容 HTML 模板，改由 Pages Artifact 部署 Astro 输出目录。
