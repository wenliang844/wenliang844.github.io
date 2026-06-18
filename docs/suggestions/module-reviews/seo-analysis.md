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
| JSON-LD | ✅ | 首页有 WebSite，文章页有 Article 结构化数据 |
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

## 📌 SEO-02: 静态页面缺少 JSON-LD

- **📍 位置**：`src/templates/layout.mjs`、手写 HTML 页面
- **📝 当前状况**：只有文章页通过 `renderPostPage()` 生成 JSON-LD。以下页面缺少结构化数据：
  - 关于页（应有 Person 类型）
  - 博客列表页（应有 CollectionPage 类型）
  - 工具箱页（应有 WebApplication 类型）
  - 首页（应有 WebSite 类型）
- **⚠️ 影响程度**：中
- **💡 建议方案**：在 `renderPage()` 中支持传入 `jsonLd` 参数（已支持），为各页面添加对应的结构化数据。
- **📊 预期收益**：搜索引擎更好地理解站点结构

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

## 📌 SEO-05: 文章页的 `datePublished` 和 `dateModified` 相同

- **📍 位置**：`src/templates/post.mjs:165-166`
- **📝 当前状况**：
  ```javascript
  datePublished: isoDate(post.date),
  dateModified: isoDate(post.date),
  ```
  `dateModified` 使用与 `datePublished` 相同的日期。front-matter 中没有 `modified` 字段。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在 front-matter 中支持 `modified` 字段：
  ```yaml
  date: 2026-06-18
  modified: 2026-06-20
  ```
  构建脚本中：
  ```javascript
  dateModified: isoDate(data.modified || data.date),
  ```
- **📊 预期收益**：搜索引擎正确识别文章更新时间

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
