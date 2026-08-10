# Astro 迁移说明

## 当前边界

迁移采用逐路由替换，不改变 GitHub Pages 根目录发布方式：

| 能力 | 当前所有者 |
|---|---|
| Markdown front matter Schema | `src/content.config.ts` / Astro Content Collections |
| 文章列表与详情路由 | `src/pages/post/` |
| 文章领域模型、内部链接、推荐 | `scripts/build.mjs` 共享函数 |
| 公共 HTML 布局 | `src/templates/*.mjs` 兼容层 |
| RSS、Sitemap、分类、系列、知识图谱 | `scripts/build.mjs` |
| Astro 产物同步 | `scripts/sync-astro-output.mjs`，仅允许 `post/` |

完整构建顺序是：编辑器 bundle → 兼容派生产物 → Astro 文章路由 → Pagefind。最终 HTML 继续写入仓库根目录，现有 URL、canonical、RSS 地址和 GitHub Pages 分支部署不变。

## 不变量

- `src/posts/*.md` 和 Git 始终是文章正文与版本的唯一真源。
- `draft: true` 不得进入页面、搜索、RSS、Sitemap、知识图谱或 RAG 分块。
- Astro 与兼容构建器共享 `buildPosts`，不得复制排序、链接、图片或推荐逻辑。
- Astro 输出只可覆盖 `/post/`；分类、工具、首页等路由在迁移前继续由原构建器或手写页负责。
- 每个 Astro 接管页包含生成器标记，生产校验会阻止兼容构建器意外覆盖它。

## 后续顺序

1. 将 `layout.mjs` 的 head、导航、页脚拆为原生 Astro Layout/Component，同时保留 HTML 快照契约。
2. 迁移分类、系列、标签和知识资产页，删除对应的手工写文件分支。
3. 将浏览器 IIFE 逐页迁移为 TypeScript ES Modules，并让 Astro/Vite 按路由输出哈希资源。
4. 所有公共页面迁移后，删除根目录同步桥和兼容 HTML 模板，改由 Pages Artifact 部署 Astro 输出目录。
