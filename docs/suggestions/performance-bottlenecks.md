# ⚡ 性能瓶颈分析

> 分析日期：2026-06-18 | 分析范围：前端渲染、资源加载、构建产物、动画性能

---

## 📌 P-01 [已修复]: 粒子动画 `requestAnimationFrame` 持续运行，无空闲停止机制

- **📍 位置**：`js/coder.js`
- **✅ 修复状态**：粒子动画已改为按需启动；页面加载时不排队 rAF，首次 pointermove 后才启动，粒子耗尽后自动停止，页面隐藏时取消待执行帧。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 覆盖 idle 不启动、pointermove 启动、粒子衰减后停止。
- **📊 实际收益**：鼠标静止且无粒子时不再持续调度 rAF；页面隐藏时停止待执行帧，降低后台 CPU/GPU 消耗。
- **🔗 相关建议**：[B-01](bugs-and-risks.md#b-01), [UX-01](ux-improvements.md#ux-01)

---

## 📌 P-02: CSS 文件 4655 行单文件，无关键 CSS 提取

- **📍 位置**：`css/coder.css`（4655 行）
- **📝 当前状况**：整个站点样式在一个 4655 行的 CSS 文件中，包含所有页面（首页、文章、工具箱、编辑器、Overleaf、赞助、鉴赏等）的样式。首次加载任何页面都需要下载完整 CSS。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  1. **短期**：确保 GitHub Pages 的 gzip 压缩生效（CSS 文本压缩率通常 70-80%）
  2. **中期**：提取首屏关键 CSS（~5KB），其余异步加载：
     ```html
     <link rel="preload" href="/css/coder.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
     <noscript><link rel="stylesheet" href="/css/coder.css"></noscript>
     ```
  3. **长期**：按页面拆分 CSS（如 `tools.css`、`editor.css`），构建时合并

- **📊 预期收益**：首屏渲染时间减少 200-500ms（取决于网络条件）
- **🔗 相关建议**：[P-03](#p-03), [TD-02](tech-debt.md#td-02)

---

## 📌 P-03: 每页加载 7+ 个 JS 文件，无打包/合并

- **📍 位置**：`src/templates/layout.mjs:117`
- **📝 当前状况**：所有页面默认加载 7 个 JS 文件：
  ```
  error-handler.js, utils.js, i18n.js, coder.js, search-loader.js, subscribe.js, assistant.js
  ```
  部分页面还会额外加载 `blog.js`、`share.js`、`giscus.js`、`toc.js`、`post-next.js`、`tools-core.js`、`tools.js`、`editor.js`、`overleaf.js`、`feedback.js`、`performance-monitor.js` 等。每个 JS 文件都是独立的 HTTP 请求。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  1. **短期**：利用 HTTP/2 多路复用（GitHub Pages 已支持），确保所有 JS 使用 `defer`（已实现）
  2. **中期**：将核心 7 个文件合并为 `core.min.js`，页面特有文件保持独立
  3. **长期**：引入简单打包工具（如 esbuild），按页面入口生成 bundle

- **📊 预期收益**：减少 HTTP 请求数，首屏可交互时间缩短 100-300ms
- **🔗 相关建议**：[P-02](#p-02), [DE-01](devex-improvements.md#de-01)

---

## 📌 P-04: Font Awesome 全量加载，仅使用少量图标

- **📍 位置**：所有页面 `<link rel="stylesheet" href="/css/fontawesome-all.min.css">`
- **📝 当前状况**：加载完整的 Font Awesome CSS（包含 1600+ 图标），但全站仅使用约 20-30 个图标（fa-bars, fa-search, fa-adjust, fa-envelope, fa-heart, fa-copy, fa-check, fa-arrow-up, fa-robot, fa-paper-plane, fa-times, fa-list, fa-chevron-down, fa-clock, fa-comment-dots, fa-code, fa-terminal, fa-rss, fa-folder-open, fa-wrench, fa-laptop-code, fa-database, fa-cogs, fa-briefcase, fa-trophy, fa-star, fa-graduation-cap, fa-toolbox, fa-magic, fa-file, fa-download, fa-exclamation-circle, fa-arrow-right, fa-github 等）。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  1. 使用 Font Awesome 的 SVG + JS 方式（`@fortawesome/fontawesome-free/js/all.min.js`），按需渲染
  2. 或使用 [Fontello](https://fontello.com/) / [IcoMoon](https://icomoon.io/) 生成自定义图标字体，仅包含使用的图标
  3. 最简方案：将使用的图标改为内联 SVG（参考 `post.mjs` 中 `SHARE_ICONS` 的做法）

- **📊 预期收益**：减少 CSS 文件大小约 50-100KB（gzip 后），减少 FOUT（Flash of Unstyled Text）
- **🔗 相关建议**：[P-02](#p-02)

---

## 📌 P-05: 搜索索引 (`search-index.json`) 包含正文摘要，文件较大

- **📍 位置**：`scripts/build.mjs:329-347`
- **📝 当前状况**：搜索索引包含每篇文章的前 600 字纯文本，当前 6 篇文章约 3-5KB。随着文章数量增长，索引文件会线性增长。100 篇文章时预计 50-80KB。
- **⚠️ 影响程度**：低（当前规模可接受）
- **💡 建议方案**：
  1. 当前无需优化（6 篇文章索引很小）
  2. 当文章超过 30 篇时，考虑：
     - 减少 body 摘要长度（600 → 200 字）
     - 搜索时按需加载文章详情
     - 使用 Service Worker 缓存索引

- **📊 预期收益**：预防未来性能退化
- **🔗 相关建议**：[P-06](#p-06)

---

## 📌 P-06: Fuse.js 搜索在首次打开时才加载，冷启动延迟明显

- **📍 位置**：`js/search-loader.js` 和 `js/search.js:211-239`
- **📝 当前状况**：Fuse.js 和搜索索引在用户首次触发搜索时才加载。加载流程：
  1. 用户按 `/` 或点击搜索按钮
  2. 动态加载 `/js/vendor/fuse.min.js`（~25KB gzip）
  3. `fetch("/search-index.json")` 获取索引
  4. 构建 Fuse 实例
  5. 渲染搜索结果

  步骤 2-4 在首次搜索时引入 200-500ms 延迟。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  // 在页面空闲时预加载（不阻塞首屏）
  if ("requestIdleCallback" in window) {
    requestIdleCallback(function () {
      loadSearch(false); // 预加载但不打开
    });
  }
  ```
- **📊 预期收益**：首次搜索体验从"加载中"变为"即时响应"
- **🔗 相关建议**：[P-05](#p-05)

---

## 📌 P-07: 列表页加载全部文章正文，DOM 体积大

- **📍 位置**：`src/templates/post.mjs:293-313`
- **📝 当前状况**：博客列表页将所有 6 篇文章的完整 HTML 正文渲染在同一个页面中，通过 CSS class 切换 `active` 面板显示。这意味着首次加载 `/post/` 时需要下载和解析所有文章的完整 DOM。
- **⚠️ 影响程度**：中（当前 6 篇可接受，20+ 篇时会有明显延迟）
- **💡 建议方案**：
  1. **短期**：对非 active 面板使用 `content-visibility: auto`，让浏览器跳过离屏内容的渲染：
     ```css
     .blog-article:not(.active) {
       content-visibility: auto;
       contain-intrinsic-size: auto 500px;
     }
     ```
  2. **中期**：非 active 面板只渲染标题和摘要，点击后通过 `fetch` 加载完整正文
  3. **长期**：改为分页加载，每页 10 篇文章

- **📊 预期收益**：列表页首次渲染时间减少 30-50%（文章多时更明显）
- **🔗 相关建议**：[P-08](#p-08)

---

## 📌 P-08: `coder.js` 滚动事件已节流但 `resize` 事件未节流

- **📍 位置**：`js/coder.js:165-166`
- **📝 当前状况**：
  ```javascript
  window.addEventListener("scroll", throttledScroll, { passive: true });
  window.addEventListener("resize", throttledScroll);
  ```
  `scroll` 事件使用了 `throttle` 节流（100ms），但 `resize` 事件直接绑定同一个函数，没有独立节流。窗口拖拽时 resize 事件可能每秒触发 60+ 次。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  window.addEventListener("resize", window.CWLUtils
    ? window.CWLUtils.throttle(onScroll, 200)
    : onScroll);
  ```
- **📊 预期收益**：窗口拖拽时减少不必要的重绘
- **🔗 相关建议**：[B-01](bugs-and-risks.md#b-01)

---

## 📌 P-09 [已修复]: `coder.js` 中 `shadowBlur` 每帧重置，GPU 开销大

- **📍 原位置**：`js/coder.js` 粒子动画绘制循环
- **✅ 修复状态**：粒子绘制已移除 `shadowColor` / `shadowBlur`，改为外层低透明圆 + 内层实心圆的双层绘制，用 `globalAlpha` 模拟辉光。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 新增源码守卫，确认 cursor 粒子热路径不再使用 `shadowBlur`，并继续覆盖粒子空闲时停止动画循环。
- **📊 实际收益**：避开 canvas 阴影渲染路径，降低低性能设备上的逐帧绘制成本。
- **🔗 相关建议**：[P-01](#p-01)

---

## 📌 P-10: 无资源预加载提示（preconnect / prefetch）

- **📍 位置**：所有页面 `<head>`
- **📝 当前状况**：当前页面仅对 `giscus.app` 设置了 `preconnect` 和 `dns-prefetch`。但以下第三方域缺少预连接：
  - `buttondown.com`（订阅功能）
  - `api.web3forms.com`（反馈功能，当前未启用）
  - `www.ifdian.net`（赞助链接）
  - `PayPal.Me`（赞助链接）
- **⚠️ 影响程度**：低
- **💡 建议方案**：在 `<head>` 中添加：
  ```html
  <link rel="preconnect" href="https://buttondown.com">
  <link rel="dns-prefetch" href="https://www.ifdian.net">
  ```
- **📊 预期收益**：第三方资源连接建立时间减少 50-150ms
- **🔗 相关建议**：[P-04](#p-04)

---

## 📌 P-11: 图片无尺寸属性，可能导致布局偏移 (CLS)

- **📍 位置**：文章正文中通过 Markdown 插入的 `<img>` 标签
- **📝 当前状况**：Markdown 渲染后的 `<img>` 标签没有 `width` 和 `height` 属性，浏览器在图片加载前无法预留空间，导致 CLS（Cumulative Layout Shift）。
- **⚠️ 影响程度**：低（当前文章图片较少）
- **💡 建议方案**：在构建脚本的 `renderContent()` 中，为 `<img>` 标签添加 `loading="lazy"` 属性：
  ```javascript
  htmlWithIds = htmlWithIds.replace(/<img([^>]*)>/g, '<img$1 loading="lazy">');
  ```
  长期方案：在 Markdown 渲染时解析图片尺寸并注入 `width`/`height`。

- **📊 预期收益**：CLS 分数改善，图片延迟加载减少首屏带宽
- **🔗 相关建议**：[UX-03](ux-improvements.md#ux-03)

---

## 性能优化优先级排序

| 优先级 | 编号 | 预期收益 | 实施难度 |
|--------|------|----------|----------|
| 🥇 高 | P-01 | CPU/GPU 节省显著 | 低 |
| ✅ 已修复 | P-09 | 动画帧率提升 | 低 |
| 🥈 中 | P-02 | 首屏渲染加速 | 中 |
| 🥈 中 | P-03 | HTTP 请求减少 | 中 |
| 🥈 中 | P-04 | CSS 体积减小 | 中 |
| 🥈 中 | P-07 | 列表页渲染优化 | 低 |
| 🥉 低 | P-06 | 搜索体验提升 | 低 |
| 🥉 低 | P-08 | resize 性能 | 低 |
| 🥉 低 | P-10 | 第三方连接优化 | 低 |
| 🥉 低 | P-11 | CLS 改善 | 低 |
| 📋 预防 | P-05 | 未来扩展准备 | — |

---

## 📌 P-12 [新增]: `backdrop-filter` 过度使用，移动端 GPU 压力大

- **📍 位置**：`css/coder.css`（18 个元素使用 `backdrop-filter: blur()`）
- **📝 当前状况**：导航栏、搜索弹窗、订阅弹窗、分享弹窗、AI 助手面板等多个组件使用了 `backdrop-filter: blur()`。在移动端 Safari 和低端 Android 上，多个毛玻璃效果叠加会导致明显掉帧。统计：
  - 导航栏：`blur(16px) saturate(140%)` — 最昂贵
  - 搜索/订阅/分享弹窗：`blur(10px)` × 4
  - AI 助手面板：`blur(10px)` × 2
  - 其他组件：`blur(8px)` × 2
- **⚠️ 影响程度**：中（移动端用户体验明显受影响）
- **💡 建议方案**：
  ```css
  /* 移动端降级：用半透明背景替代毛玻璃 */
  @media (max-width: 768px) {
    .navigation,
    .search-modal-card,
    .subscribe-modal-card {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: var(--surface-solid);
    }
  }
  ```
- **📊 预期收益**：移动端帧率提升 10-20%，减少 GPU 内存占用
- **🔗 相关建议**：[MR-CSS-06](module-reviews/css-analysis.md#mr-css-06)

> 整体评估：当前站点性能良好（静态站点天然轻量），主要优化空间在动画性能和资源加载策略上。
