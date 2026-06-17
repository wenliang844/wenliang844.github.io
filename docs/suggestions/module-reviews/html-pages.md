# 🔍 模块深度分析：手写 HTML 页面一致性

> 分析日期：2026-06-18

---

## 📌 MR-HTML-01: 手写 HTML 页面脚本加载顺序不一致

- **📍 位置**：多个手写 HTML 页面
- **📝 当前状况**：生成页面（通过 `renderPage()`）的脚本顺序为：
  ```
  error-handler → utils → i18n → coder → search-loader → subscribe → assistant
  ```
  但手写页面的顺序各不相同：

  | 页面 | search-loader 位置 | subscribe 位置 | 额外脚本 |
  |------|-------------------|----------------|----------|
  | index.html | 5th ✅ | 6th ✅ | — |
  | 404.html | 5th ✅ | 6th ✅ | — |
  | about/ | 6th ⚠️ | 5th ⚠️ | — |
  | contact/ | 7th ⚠️ | 5th ⚠️ | feedback.js |
  | editor/ | 9th ⚠️ | 5th ⚠️ | marked, purify, highlight, editor |
  | tools/ | 5th ✅ | 6th ✅ | tools-core, tools |
  | sponsor/ | 5th ✅ | 6th ✅ | — |

  `about/`、`contact/`、`editor/` 三个页面的 `subscribe.js` 和 `search-loader.js` 顺序颠倒。
- **⚠️ 影响程度**：低（所有脚本使用 `defer`，执行顺序与 HTML 中的声明顺序一致，但这些模块之间无直接依赖，所以功能不受影响）
- **💡 建议方案**：统一所有手写页面的脚本顺序，与 `layout.mjs` 中的 `allScripts` 保持一致：
  ```html
  <script src="/js/error-handler.js" defer></script>
  <script src="/js/utils.js" defer></script>
  <script src="/js/i18n.js" defer></script>
  <script src="/js/coder.js" defer></script>
  <script src="/js/search-loader.js" defer></script>
  <script src="/js/subscribe.js" defer></script>
  <script src="/js/assistant.js" defer></script>
  <!-- 页面特有脚本 -->
  ```
- **📊 预期收益**：一致性提升，减少维护混淆
- **🔗 相关建议**：[AR-01](../architecture-review.md#ar-01)

---

## 📌 MR-HTML-02: 手写页面与生成页面的导航高亮方式不一致

- **📍 位置**：手写 HTML 页面的 `<nav>` 部分
- **📝 当前状况**：生成页面通过 `renderNav(active)` 为当前栏目添加 `class="active"`。手写页面也手动添加了 active class，但：
  - `contact/index.html` 的"留言反馈"链接有 `class="nav-feedback"` 但没有 active 标记
  - 手写页面中"关于"链接的 active 状态需要手动维护

  这意味着如果在 `layout.mjs` 中修改导航结构，手写页面不会自动同步。
- **⚠️ 影响程度**：低
- **💡 建议方案**：考虑将手写页面的导航也改为构建时生成（通过构建脚本注入），或在文档中明确说明手写页面需要手动同步。
- **📊 预期收益**：导航一致性

---

## 📌 MR-HTML-03: 手写页面缺少 `<link rel="preconnect">` 标签

- **📍 位置**：手写 HTML 页面
- **📝 当前状况**：生成页面（通过 `renderPage()`）自动添加：
  ```html
  <link rel="preconnect" href="https://giscus.app">
  <link rel="dns-prefetch" href="https://giscus.app">
  ```
  但手写页面中只有 `index.html` 有这些标签（手动添加）。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在所有手写页面的 `<head>` 中添加 preconnect 标签。
- **📊 预期收益**：第三方资源连接优化

---

## 📌 MR-HTML-04: `404.html` 的 meta description 过于简短

- **📍 位置**：`404.html`
- **📝 当前状况**：
  ```html
  <meta name="description" content="页面未找到。">
  ```
  虽然 404 页面的 description 对 SEO 影响很小，但可以更友好。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```html
  <meta name="description" content="CWLBlog - 页面未找到。返回首页浏览 AI 协作开发、Java 后端和工程实践文章。">
  ```
- **📊 预期收益**：404 页面体验微提升

---

---

## 📌 MR-HTML-05: `highlight-loader.js` 和 `logger.js` 是死代码

- **📍 位置**：`js/highlight-loader.js`（51 行）、`js/logger.js`（114 行）
- **📝 当前状况**：经过全项目搜索确认：
  - `highlight-loader.js`：未被任何 HTML 页面或 JS 文件引用。代码高亮功能在编辑器页面通过直接加载 `highlight.min.js` 实现。
  - `logger.js`：定义了 `CWLLogger` 全局对象，但未被任何文件使用。`enabled: false`，`endpoint: ''`。

  这两个文件共 165 行，是开发阶段的工具或未来功能的占位代码。
- **⚠️ 影响程度**：无（不影响功能，但增加仓库体积和维护混淆）
- **💡 建议方案**：
  1. 如果确认不再需要，删除这两个文件
  2. 如果计划未来使用，在文件顶部添加 `// UNUSED - planned for future use` 注释
  3. 在 `.eslintrc.json` 的 overrides 中移除对这两个文件的特殊规则
- **📊 预期收益**：减少死代码，仓库更干净
- **🔗 相关建议**：[TD-06](../tech-debt.md#td-06)

---

## 模块健康度评分：3.5 / 5 — 中等

> 手写 HTML 页面功能完整，但与生成页面的维护一致性是主要改进方向。建议长期将手写页面也纳入构建流程。
