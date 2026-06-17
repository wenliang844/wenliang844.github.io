# 🔍 模块深度分析：Markdown 编辑器 (`js/editor.js`)

> 分析日期：2026-06-18

---

## 模块概况

| 指标 | 值 |
|------|-----|
| 行数 | 405 |
| 职责 | 在线 Markdown 编辑器，支持实时预览、工具栏、自动保存、导出 |
| 依赖 | i18n.js, marked (可选), DOMPurify (可选), hljs (可选), CWLUtils (可选) |

## ✅ 优秀实践

1. **DOMPurify 净化**：所有 Markdown 渲染结果都经过 `DOMPurify.sanitize()` 处理（第 102-104 行），防止存储型 XSS
2. **优雅降级**：marked 不可用时降级为 `<pre>` 转义输出（第 93-97 行）
3. **自动保存**：使用 localStorage 持久化编辑状态（第 132-138 行）
4. **同步滚动**：编辑区和预览区滚动比例同步（第 305-322 行）

---

## 📌 MR-EDITOR-01: `escapeHtml` 重复定义（第 4 次）

- **📍 位置**：`js/editor.js:115-121`（与 utils.js、search.js、overleaf.js 重复）
- **📝 当前状况**：editor.js 定义了自己的 `escapeHtml`，与 `CWLUtils.escapeHtml` 功能完全相同。
- **⚠️ 影响程度**：低
- **💡 建议方案**：移除内联定义，使用 `CWLUtils.escapeHtml`。
- **📊 预期收益**：消除第 4 处重复

---

## 📌 MR-EDITOR-02: `copyHtml` 使用内联 clipboard fallback

- **📍 位置**：`js/editor.js:339-365`
- **📝 当前状况**：第 4 次出现内联的 clipboard fallback 实现。
- **⚠️ 影响程度**：低
- **💡 建议方案**：使用 `CWLUtils.copyText`。

---

## 📌 MR-EDITOR-03: `marked.setOptions` 使用已废弃的 `highlight` 回调

- **📍 位置**：`js/editor.js:64-83`
- **📝 当前状况**：
  ```javascript
  window.marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function (code, lang) { ... }
  });
  ```
  `marked` v5+ 已移除 `highlight` 选项，推荐使用 `marked-highlight` 扩展。当前使用的是 `marked@18`，`highlight` 选项已被忽略。
- **⚠️ 影响程度**：中（代码高亮在编辑器中不生效）
- **💡 建议方案**：使用 `markedHighlight` 扩展或在渲染后手动高亮（当前第 160-171 行的 `hljs.highlightElement` 已经做了兜底）。
- **📊 预期收益**：编辑器中代码高亮正确生效
- **🔗 相关建议**：[COMP-02](../competitive-analysis.md#comp-02)

---

## 📌 MR-EDITOR-04: `readingMinutes` 第 3 次重复定义

- **📍 位置**：`js/editor.js:146-154`
- **📝 当前状况**：`updateStats()` 中内联了阅读时间计算逻辑，与 `coder.js:221-229` 和 `build.mjs:274-282` 重复。
- **⚠️ 影响程度**：低
- **💡 建议方案**：提取到 `CWLUtils.readingMinutes(text)`。

---

## 📌 MR-EDITOR-05: 导出的 Markdown 缺少必填字段

- **📍 位置**：`js/editor.js:108-121`
- **📝 当前状况**：`frontMatter()` 只生成 `title`、`date` 和 `draft`，但构建脚本要求的必填字段是 `title`、`shortTitle`、`date`、`summary`、`description`。导出的文件无法直接通过构建验证。
- **⚠️ 影响程度**：中（用户体验问题）
- **💡 建议方案**：在编辑器中添加 `shortTitle`、`summary`、`description` 输入框，或在导出时提醒用户补充。
- **📊 预期收益**：导出的 Markdown 可直接用于构建
- **🔗 相关建议**：无

---

## 模块健康度评分：4.0 / 5 — 优秀
