# 📐 代码质量分析

> 分析日期：2026-06-18 | 分析范围：全站 JS（21 个文件）、构建脚本（8 个模板模块）、CSS

---

## 📌 CQ-01: `editing()` 函数在 3 个文件中重复定义

- **📍 位置**：
  - `js/blog.js:211-215`
  - `js/search-loader.js:5-9`
  - `js/search.js:74-78`
- **📝 当前状况**：三个文件各自定义了功能完全相同的 `editing()` 函数：
  ```javascript
  function editing() {
    const el = document.activeElement || {};
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }
  ```
  而 `js/utils.js:177-189` 已经提供了 `Utils.isEditing()` 方法，功能完全等价。
- **⚠️ 影响程度**：中（维护成本，修改一处需同步修改多处）
- **💡 建议方案**：将所有 `editing()` 调用替换为 `window.CWLUtils.isEditing()`：
  ```javascript
  // 替换前
  if (editing()) { return; }
  // 替换后
  if (window.CWLUtils && window.CWLUtils.isEditing()) { return; }
  ```
- **📊 预期收益**：消除 3 处重复代码，单一维护点
- **🔗 相关建议**：[B-12](bugs-and-risks.md#b-12)

---

## 📌 CQ-02: `copyText` 函数在 3 个文件中重复实现

- **📍 位置**：
  - `js/utils.js:29-39`（规范实现，带 fallback）
  - `js/coder.js:173-194`（内联 fallback）
  - `js/share.js:55-83`（内联 fallback）
- **📝 当前状况**：三处都实现了剪贴板复制逻辑（Clipboard API → execCommand fallback）。`coder.js` 和 `share.js` 都尝试使用 `CWLUtils.copyText`，但各自保留了完整的 fallback 实现。
- **⚠️ 影响程度**：低（功能正确，但冗余代码约 60 行）
- **💡 建议方案**：移除 `coder.js` 和 `share.js` 中的 fallback 实现，直接使用：
  ```javascript
  const copyText = window.CWLUtils ? window.CWLUtils.copyText : function(text) {
    return navigator.clipboard.writeText(text);
  };
  ```
  `utils.js` 保证在所有页面先加载（layout.mjs:117），所以 `CWLUtils` 一定可用。
- **📊 预期收益**：减少约 40 行重复代码
- **🔗 相关建议**：[CQ-01](#cq-01)

---

## 📌 CQ-03: `escapeHtml` 在 3 个上下文中独立实现

- **📍 位置**：
  - `src/lib/format.mjs:57-59`（构建脚本，服务端）
  - `js/utils.js:15-22`（客户端工具库）
  - `js/search.js:80-87`（搜索模块，内联）
- **📝 当前状况**：三个独立的 `escapeHtml` 实现，功能基本相同但细节略有差异：
  - `format.mjs`：`escapeAttr + '&#39;'` 转义
  - `utils.js`：完整的 5 种字符转义
  - `search.js`：与 `utils.js` 完全相同但独立实现

  `search.js` 的实现是不必要的重复，因为它在同一 IIFE 中可以访问 `window.CWLUtils.escapeHtml`。
- **⚠️ 影响程度**：低
- **💡 建议方案**：`search.js` 中移除内联 `escapeHtml`，改用 `window.CWLUtils.escapeHtml`。构建脚本的实现保留（Node.js 环境无法使用浏览器 API）。
- **📊 预期收益**：消除 1 处重复，减少搜索模块体积
- **🔗 相关建议**：[S-01](security-audit.md#s-01)

---

## 📌 CQ-04: `t()` i18n 辅助函数在 7 个文件中各自定义

- **📍 位置**：
  - `js/coder.js:114-116`
  - `js/blog.js:30-32`
  - `js/search.js:50-52`
  - `js/share.js:24-26`
  - `js/subscribe.js:16-18`
  - `js/tools.js:7-9`
  - `js/assistant.js`（未使用 t()，硬编码中文）
- **📝 当前状况**：每个需要 i18n 的 JS 文件都定义了自己的 `t()` 包装函数：
  ```javascript
  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }
  ```
  这是完全相同的 3 行代码重复了 6 次。
- **⚠️ 影响程度**：低（代码冗余但不影响功能）
- **💡 建议方案**：两种方案选其一：
  1. **保守方案**：在 `utils.js` 中添加 `Utils.t = function(key, fb) { return window.cwlT ? window.cwlT(key, fb) : fb; }`
  2. **彻底方案**：`i18n.js` 加载后直接将 `cwlT` 暴露为全局函数（已实现），各模块直接调用 `cwlT(key, fallback)` 而不需包装

- **📊 预期收益**：减少约 18 行重复代码
- **🔗 相关建议**：[CQ-01](#cq-01), [CQ-05](#cq-05)

---

## 📌 CQ-05: `assistant.js` 硬编码中文文案，未接入 i18n 系统

- **📍 位置**：`js/assistant.js:1-240`
- **📝 当前状况**：AI 助手模块的所有文案都是硬编码中文，包括：
  - 页面导航关键词（第 3-9 行）
  - 文章关键词匹配（第 14-20 行）
  - 回复文本（第 60-84 行）
  - 快捷按钮（第 123-127 行）
  - 输入框 placeholder（第 138 行）

  切换到英文模式后，AI 助手仍显示中文。
- **⚠️ 影响程度**：中（影响英文用户体验）
- **💡 建议方案**：为 `assistant.js` 添加 i18n 支持：
  ```javascript
  // 在 i18n.js 的 EN 字典中添加 assistant.* 键
  // assistant.greeting, assistant.noMatch, assistant.quick.tools 等
  // assistant.js 中使用 t() 函数获取当前语言文案
  ```
  同时在 `assistant.js` 的 `answer()` 函数中，根据当前语言返回对应语言的结果。
- **📊 预期收益**：英文用户获得完整的 AI 助手体验
- **🔗 相关建议**：[F-02 新功能](new-features.md#f-02)

---

## 📌 CQ-06: `coder.js` IIFE 过长（560 行），职责过多

- **📍 位置**：`js/coder.js:1-560`
- **📝 当前状况**：单个 IIFE 承担了 6 个独立职责：
  1. 主题切换（第 1-36 行）
  2. 文章面板切换（第 41-93 行）
  3. 阅读进度条 + 返回顶部（第 98-167 行）
  4. 代码复制按钮（第 170-216 行）
  5. 阅读时间 + TOC 生成（第 220-421 行）
  6. 滚动动画 + 技能条动画 + 粒子效果（第 426-559 行）

  总计 560 行，是全站最大的 JS 文件。
- **⚠️ 影响程度**：中（可维护性）
- **💡 建议方案**：按职责拆分为独立模块：
  ```
  js/theme.js        — 主题切换（~30 行）
  js/post-switch.js  — 文章面板切换（~50 行）
  js/progress.js     — 阅读进度条 + 返回顶部（~70 行）
  js/code-copy.js    — 代码复制按钮（~50 行）
  js/reading.js      — 阅读时间 + TOC（~200 行）
  js/animations.js   — 滚动动画 + 粒子效果（~130 行）
  ```
  或保持单文件但用注释分隔（当前已这样做，只是文件太长）。
- **📊 预期收益**：按需加载特定功能，代码审查更容易
- **🔗 相关建议**：[AR-01 架构评审](architecture-review.md#ar-01)

---

## 📌 CQ-07: 大量使用 `Array.prototype.slice.call()` 转换 NodeList

- **📍 位置**：`js/coder.js:41-42,279,338,427,449`、`js/blog.js:8,38,121`
- **📝 当前状况**：多处使用 `Array.prototype.slice.call(document.querySelectorAll(...))` 将 NodeList 转为数组。这是 ES5 时代的写法。
- **⚠️ 影响程度**：低
- **💡 建议方案**：使用现代 API：
  ```javascript
  // ES5
  const items = Array.prototype.slice.call(document.querySelectorAll(".foo"));
  // ES2015+
  const items = Array.from(document.querySelectorAll(".foo"));
  // ES2022+
  const items = [...document.querySelectorAll(".foo")];
  ```
  ESLint 已配置 `ecmaVersion: 2020`，可以安全使用 `Array.from()`。
- **📊 预期收益**：代码更简洁，符合现代 JS 规范
- **🔗 相关建议**：[TD-01](tech-debt.md#td-01)

---

## 📌 CQ-08: `blog.js` 中 `fab.innerHTML` 在开关状态切换时使用 innerHTML

- **📍 位置**：`js/blog.js:276,282`
- **📝 当前状况**：
  ```javascript
  fab.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
  // ...
  fab.innerHTML = '<i class="fas fa-list" aria-hidden="true"></i>';
  ```
  虽然内容是硬编码（安全），但频繁创建/销毁 DOM 节点不如直接修改属性高效。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  const icon = fab.querySelector("i");
  // 切换时只修改 class
  icon.className = open ? "fas fa-times" : "fas fa-list";
  ```
- **📊 预期收益**：减少 DOM 操作，代码更清晰
- **🔗 相关建议**：[P-01](performance-bottlenecks.md#p-01)

---

## 📌 CQ-09: CSS 中大量重复的组件变体样式

- **📍 位置**：`css/coder.css`（4655 行）
- **📝 当前状况**：CSS 文件中存在多组结构相似但细节不同的组件样式：
  - `.post-share .share-btn` 和 `.sponsor-mini-btn` 的 hover/active 状态
  - `.search-modal` 和 `.subscribe-modal` 的 overlay/card 结构
  - `.feedback-item` 和 `.post-item` 的卡片样式
  - `.tool-panel` 和 `.article-content` 的代码块样式

  这些可以通过 CSS 自定义属性或 utility class 减少重复。
- **⚠️ 影响程度**：低（CSS gzip 后差异不大）
- **💡 建议方案**：提取共用组件样式：
  ```css
  .modal-overlay { /* 共用遮罩样式 */ }
  .modal-card { /* 共用弹窗卡片样式 */ }
  .search-modal { /* 搜索特有样式 */ }
  .subscribe-modal { /* 订阅特有样式 */ }
  ```
- **📊 预期收益**：CSS 文件减少约 200-300 行，维护更容易
- **🔗 相关建议**：[P-02](performance-bottlenecks.md#p-02)

---

## 📌 CQ-10: 构建脚本中 `renderContent()` 执行两次正则替换

- **📍 位置**：`scripts/build.mjs:165-185`
- **📝 当前状况**：`renderContent()` 先调用 `tidyHtml(marked.parse(markdown))` 生成 HTML，然后用 `extractToc(html)` 提取 TOC，再用 `replace(/<(h[2-3])>.../gs, ...)` 为标题添加 ID。这意味着标题正则匹配执行了两次（extractToc 一次，renderContent 内部一次）。
- **⚠️ 影响程度**：低（构建时性能，不影响用户）
- **💡 建议方案**：合并两次替换为一次遍历：
  ```javascript
  function renderContent(markdown) {
    const html = tidyHtml(marked.parse(markdown));
    const toc = [];
    let h2Index = 0;
    const htmlWithIds = html.replace(/<(h[2-3])>(.*?)<\/\1>/gs, (match, tag, content) => {
      // 同时提取 TOC 和添加 ID
      const level = parseInt(tag[1]);
      const text = content.replace(/<[^>]+>/g, '');
      const id = `toc-${level === 2 ? ++h2Index : h2Index}-${...}`;
      toc.push({ level, text, id });
      return `<${tag} id="${id}">${content}</${tag}>`;
    });
    // ...
  }
  ```
- **📊 预期收益**：构建速度微提升，代码更简洁
- **🔗 相关建议**：[B-06](bugs-and-risks.md#b-06)

---

## 代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 命名规范 | ⭐⭐⭐⭐ | 一致的 camelCase，语义清晰 |
| 注释质量 | ⭐⭐⭐⭐⭐ | 每个文件/函数都有清晰的中文注释 |
| 错误处理 | ⭐⭐⭐⭐ | try-catch 覆盖 localStorage、网络请求等 |
| 代码重复 | ⭐⭐⭐ | 5 处明显重复（editing, copyText, escapeHtml, t(), readingMinutes） |
| 文件粒度 | ⭐⭐⭐ | coder.js 过大（560 行），其他文件合理 |
| 现代化程度 | ⭐⭐⭐ | 混合使用 ES5 和 ES2015+ 写法 |
| XSS 防护 | ⭐⭐⭐⭐⭐ | 全面的转义处理 |

> 综合评分：**3.9 / 5** — 良好，主要改进点在代码重复消除和现代化。
