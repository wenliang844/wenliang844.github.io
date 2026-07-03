# ⚡ 性能瓶颈分析

> 分析日期：2026-06-18 | 分析范围：前端渲染、资源加载、构建产物、动画性能

---

## 2026-07-03 复查补充

### 📌 P-13: 关键静态产物体积已经接近当前性能预算

- **📍 位置**：`css/coder.css:1-6637`, `tools/index.html:1-1308`, `post/index.html:1-1283`, `js/gesture.js:1-2470`, `js/assistant.js:1-1686`
- **📝 当前状况描述**：本轮文件体积扫描显示：`css/coder.css` 140,052 bytes、`tools/index.html` 108,156 bytes、`post/index.html` 109,869 bytes、`js/gesture.js` 90,300 bytes、`js/assistant.js` 61,368 bytes。CSS 仍在测试中的 140 KiB 预算内，但已经贴边；工具箱和博客列表 HTML 都超过 100KB，随着工具和文章继续增加，首屏解析成本仍需继续控制。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  1. 为 tools/post 建立独立体积预算：HTML < 120KB、首屏 JS < 80KB、CSS < 140KB。
  2. 工具箱按 category 拆分 HTML：首屏只渲染 active panel，其余 panel 通过 template 或 JSON 延迟挂载。
  3. CSS 按页面拆分：core.css + tools.css + article.css，并在构建期按页面注入。
  ```
- **📊 预期收益**：控制解析与样式计算成本，避免个人站点功能持续扩张后首屏退化。
- **🔗 相关建议引用**：[P-02](#p-02), [P-03](#p-03), [P-07](#p-07)

### 📌 P-14: 手势工具首次启动依赖远程模型链路，弱网下冷启动不可控

- **📍 位置**：`js/gesture.js:160-167`, `js/gesture.js:169-207`, `js/gesture.js:213-252`, `js/gesture.js:258-265`, `src/templates/tools.mjs:793-870`
- **📝 当前状况描述**：点击手势工具后，MediaPipe vision bundle、WASM、hand landmarker、object detector、face-api 模型、Three.js 均按需远程加载。当前 UI 只有“加载模型...”这类状态，没有资源大小、失败重试、预热、缓存策略或离线提示。弱网下用户可能在摄像头授权前后等待较久，且失败原因不可见。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const MODEL_ASSETS = [
    "/models/hand_landmarker.task",
    "/models/efficientdet_lite0.tflite",
  ];

  async function warmGestureAssets() {
    await Promise.all(MODEL_ASSETS.map((url) => fetch(url, { cache: "force-cache" })));
  }
  ```
  将模型自托管后用 `Cache-Control` 和 Service Worker 预缓存；UI 上显示“下载模型/初始化摄像头/开始识别”三段状态，并允许用户重试。
- **📊 预期收益**：降低首次启动延迟和失败率，提升摄像头功能在移动网络下的可用性。
- **🔗 相关建议引用**：[S-13](security-audit.md#s-13-已修复核心治理-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束), [MR-TOOLS-01](module-reviews/tools-gesture-and-api.md#mr-tools-01-已修复核心治理-手势工具的供应链和隐私边界需要产品化治理)

### 📌 P-15: 测试覆盖率总体达标，但 relay 同步脚本覆盖率明显低于整体水平

- **📍 位置**：`scripts/parse-relay.mjs:1-593`, `scripts/update-commercial-relay.mjs:1-226`, `tests/relay.test.mjs:1-57`, `tests/workflows.test.mjs:1-55`
- **📝 当前状况描述**：`npm run test:coverage` 通过阈值，总体 line 94.44%、branch 78.33%、function 91.84%。但 `parse-relay.mjs` line 77.23%、branch 46.58%，`update-commercial-relay.mjs` line 68.14%、branch 64.91%，低于其他核心构建模块。relay 数据会进入公开 AI 中转站榜单，属于数据质量敏感路径。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  tests/relay-import-errors.test.mjs
  - SQL 字段缺失
  - 异常 JSON settings_config
  - 重复 provider 合并
  - token/email/url 查询参数脱敏
  - 商业源部分失败但保留已有数据
  ```
- **📊 预期收益**：提高数据同步脚本的回归防护，减少公开榜单因输入异常而污染或缺失。
- **🔗 相关建议引用**：[DE-02](devex-improvements.md#de-02), [S-09](security-audit.md#s-09)

### 📌 P-16: Cron 无解表达式会在主线程同步扫描两年分钟粒度

- **📍 位置**：`js/tools-core.js:938-980`, `tests/tools-core-deep.test.mjs:258-266`
- **✅ 修复状态**：当日字段受限、星期字段为通配符，且所选月份没有任何可匹配日期时，`parseCronExpression()` 会提前返回 `cronNoRuns`，不再逐分钟扫描两年；日字段和星期字段都受限时仍保留 Cron OR 语义。
- **🧪 验证**：`node --test tests/tools-core-deep.test.mjs tests/tools.test.mjs` 65/65 通过；新增性能预算断言要求 `0 0 31 2 *` 快速失败；Playwright mobile 烟测显示无解表达式约 0.7ms 返回错误态，`0 0 31 2 mon` 仍能正常给出后续执行时间。
- **📝 原状况描述**：`parseCronExpression()` 对合法但无解的表达式会循环最多 `1,051,200` 次，逐分钟推进两年。第 2 轮探测中，`0 0 31 2 *` 在本机约 127.57ms，同一批普通表达式约 0.19ms 到 1.52ms。该计算发生在工具页主线程，连续输入或低端移动设备上可能造成明显卡顿。
- **⚠️ 影响程度**：中
- **💡 后续建议**：
  ```javascript
  // 更通用的下一步：按字段跳跃，而不是逐分钟扫描。
  cursor = jumpToNextAllowedMinuteOrHour(cursor);
  ```
- **📊 实际收益**：典型无解日期表达式即时失败，避免工具箱交互被同步循环阻塞；更稀疏但可匹配的表达式仍可继续用字段跳跃优化。
- **🔗 相关建议引用**：[MR-CORE-01](module-reviews/tools-core.md#mr-core-01-cron-解析器需要避免主线程百万次扫描), [DE-13](devex-improvements.md#de-13-为-ai-助手和-cron-边界行为补充回归测试)

### 📌 P-17: 全站统一加载 `coder.css`，工具箱和助手样式成本扩散到所有页面

- **📍 位置**：`src/templates/layout.mjs:225-226`, `css/coder.css:3910-4898`, `css/coder.css:4982-6084`, `css/coder.css:6260-6543`
- **📝 当前状况描述**：第 5 轮统计显示 `css/coder.css` 已增长到 6,637 行，`layout.mjs` 仍在每个页面统一加载该文件。工具箱样式约从 3,910 行开始，AI 助手样式约 4,982-6,084 行，手势/视觉工具还有后续专属样式；普通文章页、404、关于页都会解析这些仅工具页或助手面板才需要的规则。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  css/core.css       — 变量、导航、布局、文章基础
  css/tools.css      — 工具箱、编辑器嵌入、视觉工具
  css/assistant.css  — AI 助手浮层
  ```
  构建层可先不引入打包器，只在 `renderPage()` 中按页面类型输出额外 `<link>`；AI 助手样式也可在助手首次打开时按需加载。
- **📊 预期收益**：降低非工具页的 CSS 解析和样式匹配成本，让 CSS 体积预算从“全站单包”转成“页面级预算”。
- **🔗 相关建议引用**：[MR-CSS-07](module-reviews/css-analysis.md#mr-css-07-复查发现-css-单包已增长到-6637-行), [AR-08](architecture-review.md#ar-08-工具箱和助手资源需要从全站核心层剥离)

### 📌 P-18: 工具页首屏一次性解析 31 个工具面板

- **📍 位置**：`tools/index.html:89-279`, `tools/index.html:302-1235`, `src/templates/tools.mjs:64-85`, `src/templates/tools.mjs:923-944`
- **✅ 修复状态**：工具页首屏只挂载 JSON 面板，其余 30 个工具面板进入 `<template data-tool-template>`，点击 tab 时再克隆、挂载并执行面板级初始化。当前 JSDOM 复测显示首屏约 310 个元素，template 中延迟保存约 920 个元素；Markdown、Galaxy、手势工具均按需挂载/加载。
- **📝 原状况描述**：JSDOM 审计显示工具页初始 HTML 包含 31 个 tab、31 个 panel，其中 30 个 panel 默认 hidden，但仍会被浏览器解析成 DOM；页面内有 50 个 textarea、55 个 input、141 个 button、总计约 1,199 个元素。用户首次只看到 JSON 工具，却已经支付了所有工具 markup 的解析成本。
- **⚠️ 影响程度**：中
- **💡 后续建议**：
  ```javascript
  // 后续可把工具逻辑也按类别拆分：
  import("/js/tools-data.js");
  import("/js/tools-security.js");
  ```
  面板 DOM 拆分已落地；中期继续把工具核心函数、Markdown/highlight/QR vendor 和 `/tools/` 专属 CSS 按类别或工具懒加载。
- **📊 实际收益**：减少工具页首屏 DOM 构建时间和内存占用，给继续新增工具留出空间；Lighthouse 分数和 unused JS/CSS 降幅待复测。
- **🔗 相关建议引用**：[P-13](#p-13-关键静态产物体积已经接近当前性能预算), [AR-08](architecture-review.md#ar-08-工具箱和助手资源需要从全站核心层剥离), [MR-TOOLS-05](module-reviews/tools-gesture-and-api.md#mr-tools-05-工具箱主模板已经过大新增工具会继续推高生成页体积)

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

## 📌 P-06 [已修复]: Fuse.js 搜索在首次打开时才加载，冷启动延迟明显

- **📍 位置**：`js/search-loader.js` 和 `js/search.js:211-239`
- **✅ 修复状态**：`search-loader.js` 在浏览器空闲期预加载搜索主脚本，并调用 `search.js` 暴露的 `window.cwlPreloadSearch()` 预热 Fuse.js 与 `/search-index.json`；不支持 `requestIdleCallback` 的浏览器使用 2.5 秒 `setTimeout` 降级。
- **📝 原始状况**：Fuse.js 和搜索索引在用户首次触发搜索时才加载。加载流程：
  1. 用户按 `/` 或点击搜索按钮
  2. 动态加载 `/js/vendor/fuse.min.js`（~25KB gzip）
  3. `fetch("/search-index.json")` 获取索引
  4. 构建 Fuse 实例
  5. 渲染搜索结果

  步骤 2-4 在首次搜索时引入 200-500ms 延迟。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 验证 idle 预热、`setTimeout` 降级、`loadSearch(false)` 和 `cwlPreloadSearch` 入口。
- **📊 实际收益**：搜索资源在首屏空闲后预热，用户首次打开搜索时更可能直接进入已构建索引状态。
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

## 📌 P-08 [已修复]: `coder.js` 滚动事件已节流但 `resize` 事件未节流

- **📍 原位置**：`js/coder.js` 阅读进度条与返回顶部滚动处理
- **✅ 修复状态**：`resize` 已拆成独立 `throttledResize`，使用 `SCROLL_CONSTANTS.RESIZE_THROTTLE = 200`，不再复用 100ms 的 `throttledScroll`。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 新增源码守卫，确认 resize 使用独立节流并禁止回退到 `addEventListener("resize", throttledScroll)`。
- **📊 实际收益**：窗口拖拽时降低阅读进度、返回顶部和 TOC active 更新频率，并避免 resize 与 scroll 共用节流状态。
- **🔗 相关建议**：[B-01](bugs-and-risks.md#b-01)

---

## 📌 P-09 [已修复]: `coder.js` 中 `shadowBlur` 每帧重置，GPU 开销大

- **📍 原位置**：`js/coder.js` 粒子动画绘制循环
- **✅ 修复状态**：粒子绘制已移除 `shadowColor` / `shadowBlur`，改为外层低透明圆 + 内层实心圆的双层绘制，用 `globalAlpha` 模拟辉光。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 新增源码守卫，确认 cursor 粒子热路径不再使用 `shadowBlur`，并继续覆盖粒子空闲时停止动画循环。
- **📊 实际收益**：避开 canvas 阴影渲染路径，降低低性能设备上的逐帧绘制成本。
- **🔗 相关建议**：[P-01](#p-01)

---

## 📌 P-10 [已修复]: 无资源预加载提示（preconnect / prefetch）

- **📍 位置**：所有页面 `<head>`
- **✅ 修复状态**：`src/templates/layout.mjs` 已集中声明第三方 resource hints；生成页和 404、首页、about、contact、editor、overleaf 等手写页均已补齐。
- **🧪 回归测试**：`tests/templates.test.mjs` 覆盖模板输出；`tests/performance.test.mjs` 扫描所有已提交 HTML，确保 `giscus.app`、`buttondown.com`、`www.ifdian.net` 和 `paypal.me` 的连接提示不缺失。
- **📊 实际收益**：订阅、评论和赞助入口的 DNS/连接建立可提前完成，减少首次交互时的第三方连接等待。
- **🔗 相关建议**：[P-04](#p-04)

---

## 📌 P-11 [部分修复]: 图片无尺寸属性，可能导致布局偏移 (CLS)

- **📍 位置**：文章正文中通过 Markdown 插入的 `<img>` 标签
- **✅ 已完成**：构建脚本已在 `renderContent()` 阶段为正文图片补齐 `loading="lazy"` 和 `decoding="async"`，已有显式 `loading` / `decoding` 的图片不会被覆盖。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖 Markdown 图片默认增强、已有属性保留，以及 `pre` 示例块不被误改。
- **📝 剩余问题**：Markdown 渲染后的 `<img>` 标签仍未自动注入 `width` 和 `height`，浏览器在图片加载前无法完全预留空间。
- **⚠️ 影响程度**：低（当前文章图片较少）
- **💡 后续方案**：在 Markdown 渲染时解析本地图片尺寸并注入 `width`/`height`，远程图片可允许在 front matter 或 Markdown 扩展语法中声明尺寸。
- **📊 实际收益**：正文图片延迟加载并异步解码，减少非首屏图片对带宽和主线程解码的影响；CLS 尺寸预留仍需后续补齐。
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
| ✅ 已修复 | P-08 | resize 独立节流 | 低 |
| 🥉 低 | P-10 | 第三方连接优化 | 低 |
| 🟨 部分 | P-11 | 图片加载优化已完成，尺寸预留待补齐 | 低 |
| 📋 预防 | P-05 | 未来扩展准备 | — |

---

## 📌 P-12 [已修复]: `backdrop-filter` 过度使用，移动端 GPU 压力大

- **📍 位置**：`css/coder.css`（18 个元素使用 `backdrop-filter: blur()`）
- **✅ 修复状态**：桌面端保留毛玻璃视觉；移动端 `max-width: 768px` 下导航、卡片、弹窗、浮层和下一篇推荐统一关闭 `backdrop-filter` / `-webkit-backdrop-filter`，关键浮层改用 `--surface-solid` 背景。
- **📝 原始状况**：导航栏、搜索弹窗、订阅弹窗、分享弹窗等多个组件使用了 `backdrop-filter: blur()`。在移动端 Safari 和低端 Android 上，多个毛玻璃效果叠加可能导致掉帧。统计：
  - 导航栏：`blur(16px) saturate(140%)` — 最昂贵
  - 搜索/订阅/分享弹窗：`blur(10px)` × 4
  - 文章浮层与卡片：`blur(10px)` × 多处
  - 其他组件：`blur(8px)` × 2
- **🧪 回归测试**：`tests/css.test.mjs` 验证移动端 media query 同时关闭标准和 WebKit 前缀的 backdrop blur，并为关键浮层设置实色背景。
- **📊 实际收益**：移动端减少 GPU 密集型背景采样；`coder.css` 当前约 136.77KB，仍低于 140KB 性能门禁。
- **🔗 相关建议**：[MR-CSS-06](module-reviews/css-analysis.md#mr-css-06)

> 整体评估：当前站点性能良好（静态站点天然轻量），主要优化空间在动画性能和资源加载策略上。
