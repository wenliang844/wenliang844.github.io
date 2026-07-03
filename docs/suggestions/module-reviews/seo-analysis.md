# 🔍 SEO 与可访问性专项分析

> 分析日期：2026-06-18

---

## 1. SEO 现状评估

### ✅ 已实现的 SEO 措施

| 措施 | 状态 | 说明 |
|------|------|------|
| `<title>` 标签 | ✅ | 每页独立标题 |
| `meta description` | ✅ | 每页独立描述 |
| `canonical` URL | ✅ | 所有页面都有 `<link rel="canonical">` |
| Open Graph 标签 | ✅ | og:title, og:description, og:image, og:url |
| Twitter Card | ✅ | summary_large_image 或 summary |
| Sitemap | ✅ | 含图片扩展 |
| RSS Feed | ✅ | 3 个 RSS（首页、文章、分类） |
| JSON-LD | ✅ | 首页有 WebSite，文章页有 Article，静态页有 Person/CollectionPage/WebApplication/ContactPage 等结构化数据 |
| `robots.txt` | ✅ | 存在 |
| 语义化 HTML | ✅ | header, main, article, section, nav, footer |
| 图片 alt 属性 | ⚠️ | Markdown 图片有 alt，但部分装饰图标用 `aria-hidden` |

---

## 📌 SEO-01 [已修复]: 首页缺少 JSON-LD 结构化数据

- **📍 位置**：`index.html`（手写页面）
- **✅ 修复状态**：首页 `<head>` 已补充 `WebSite` JSON-LD，包含站点名称、URL、描述、作者与发布者信息。
- **🧪 回归测试**：`tests/build-extra.test.mjs` 解析首页 JSON-LD，验证 `@context`、`@type`、站点 URL 和作者字段。
- **📊 实际收益**：搜索引擎能更明确识别站点实体和作者归属。
- **🔗 相关建议**：无

---

## 📌 SEO-02 [已修复]: 静态页面缺少 JSON-LD

- **📍 位置**：`src/templates/layout.mjs`、`src/templates/*.mjs`、手写 HTML 页面
- **✅ 修复状态**：新增 `buildPageJsonLd()` / `siteUrl()` helper；博客列表、时间归档、标签、AI、工具箱、鉴赏、赞助等生成页输出对应结构化数据；关于、联系、编辑器、Overleaf 手写页补充 Person / ContactPage / WebApplication JSON-LD。
- **🧪 回归测试**：`tests/templates-extended.test.mjs` 验证模板输出的类型和关键字段；`tests/build-extra.test.mjs` 解析生成页和手写页 JSON-LD，确认 `@context`、`@type` 与绝对 URL。
- **📊 实际收益**：搜索引擎能更明确识别站点页面类型、工具应用、集合列表、作者实体和联系方式。

---

## 📌 SEO-03 [已修复]: `sitemap.xml` 中 `priority` 值设置

- **📍 位置**：`src/config.mjs`、`scripts/build.mjs`
- **✅ 修复状态**：首页 sitemap priority 改为 `1.0`，文章页输出 `0.8`，其他静态页输出 `0.6`，不再生成 `<priority>0</priority>`。
- **🧪 回归测试**：`tests/build.test.mjs` 覆盖首页、静态页、文章页 priority 输出和低优先级回退检查。
- **📊 实际收益**：搜索引擎能获得更合理的站点页面重要性信号。

---

## 📌 SEO-04: 手写 HTML 页面缺少 `lang` 属性的一致性

- **📍 位置**：`index.html`、`404.html`、`about/index.html` 等手写页面
- **📝 当前状况**：所有页面都有 `<html lang="zh-CN">`，但 i18n 切换到英文时，`i18n.js` 会动态修改为 `lang="en"`。搜索引擎爬虫看到的是初始的 `zh-CN`。
- **⚠️ 影响程度**：低（搜索引擎不执行 JS 切换语言）
- **💡 建议方案**：对于英文版本，考虑使用 `hreflang` 标签或独立的英文 URL（如 `/en/post/xxx/`）。当前客户端切换方案对 SEO 不友好，但对个人博客影响很小。
- **📊 预期收益**：多语言 SEO 优化

---

## 📌 SEO-05 [已修复]: 文章页的 `datePublished` 和 `dateModified` 相同

- **📍 位置**：`scripts/build.mjs`、`src/templates/post.mjs`、`js/editor.js`
- **✅ 修复状态**：构建脚本支持可选 `modified` front matter；未填写时回退发布日期，填写时校验日期格式且不得早于 `date`；文章 JSON-LD 使用 `post.modified || post.date` 输出 `dateModified`。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖 modified 默认值、合法后续日期和早于发布日期的拒绝；`tests/templates-extended.test.mjs` 验证 Article JSON-LD 输出独立 `dateModified`；编辑器导出 Markdown 追加 `modified` 字段。
- **📊 实际收益**：文章后续修订时可向搜索引擎提供准确更新时间信号，同时保持旧文章 front matter 向后兼容。

---

## 📌 SEO-06: 图片缺少 `alt` 属性的自动化检查

- **📍 位置**：`scripts/build.mjs`
- **📝 当前状况**：Markdown 中的图片由作者手动编写 alt 文本，构建脚本不做检查。如果作者忘记写 alt，生成的 `<img>` 标签将缺少 alt 属性。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在构建脚本中添加图片 alt 检查：
  ```javascript
  const imgNoAlt = html.match(/<img(?![^>]*\balt=)[^>]*>/g);
  if (imgNoAlt) {
    console.warn(`Warning: ${imgNoAlt.length} image(s) missing alt attribute`);
  }
  ```
- **📊 预期收益**：可访问性和 SEO 评分提升

---

## 📌 SEO-07 [已修复]: 404 页面缺少 JSON-LD 结构化数据

- **📍 位置**：`404.html:1-98`
- **✅ 修复状态**：`404.html` 已补充 `WebPage` JSON-LD，并增加 `<meta name="robots" content="noindex,follow">`，同时保留真实不存在路径的 404 状态语义。
- **🧪 验证**：`tests/build-extra.test.mjs` 已把 `404.html` 纳入手写页 JSON-LD 检查，并新增 `noindex,follow` 断言。
- **📝 原状况描述**：第 3 轮 JSDOM 审计显示 19 个非临时 HTML 页面中，只有 `404.html` 没有 `script[type="application/ld+json"]`。404 页不需要强 SEO，但可以用 `WebPage` 或 `CollectionPage` 弱化标注，帮助搜索引擎理解它是站内错误页而非内容页。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```html
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "页面未找到",
    "url": "https://wenliang844.github.io/404.html",
    "isPartOf": { "@type": "WebSite", "name": "CWLBlog" }
  }
  </script>
  ```
- **📊 预期收益**：提升手写页面结构化数据一致性，减少 SEO 审计中的单点例外。
- **🔗 相关建议引用**：[DE-14](../devex-improvements.md#de-14-增加页面级-dom-契约审计防止-seo-a11y-回退), [MR-HTML-06](html-pages.md#mr-html-06-页面级-dom-审计显示手写页仍有少量例外)

---

## 可访问性评估

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 语言声明 | ✅ | `<html lang="zh-CN">` |
| 标题层级 | ✅ | h1 → h2 → h3 正确嵌套 |
| ARIA 标签 | ✅ | 导航、搜索、模态框都有 aria 属性 |
| 键盘导航 | ✅ | Tab 顺序合理，有焦点样式 |
| 颜色对比度 | ⚠️ | 暗色主题下 muted 文本对比度偏低 |
| 跳过导航链接 | ❌ | 缺少 "Skip to content" 链接 |
| 表单标签 | ✅ | 所有 input 都有 label/aria-label |
| 动画减弱 | ✅ | `prefers-reduced-motion` 检测 |
| 焦点陷阱 | ✅ | 模态框有焦点管理 |
| 语义化 HTML | ✅ | 正确使用语义标签 |

> SEO 综合评估：**3.9 / 5** — 良好，主要改进点在结构化数据。
