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

## 📌 MR-EDITOR-01 [已修复]: `escapeHtml` 重复定义（第 4 次）

- **📍 位置**：`js/editor.js`
- **✅ 修复状态**：`editor.js` 当前不再保留本地 `escapeHtml` 函数，纯文本 fallback 使用局部 HTML entity 替换，业务转义 helper 统一保留在 `CWLUtils`。
- **📊 实际收益**：避免编辑器模块继续维护重复的命名 helper。

---

## 📌 MR-EDITOR-02 [已修复]: `copyHtml` 使用内联 clipboard fallback

- **📍 位置**：`js/editor.js`
- **✅ 修复状态**：`copyHtml()` 已委托 `CWLUtils.copyText()`，不再重复维护 Clipboard API / textarea / `execCommand` fallback。
- **🧪 回归测试**：`tests/editor.test.mjs` 覆盖复制调用；`tests/js-behavior.test.mjs` 扩展源码守卫，确认 editor/coder/share 复制调用方都委托公共 helper。
- **📊 实际收益**：复制 fallback 维护点继续收敛，降低浏览器兼容分支分裂风险。

---

## 📌 MR-EDITOR-03 [已修复]: `marked.setOptions` 使用已废弃的 `highlight` 回调

- **📍 位置**：`js/editor.js`
- **✅ 修复状态**：已移除 `marked.setOptions({ highlight })` 废弃配置，编辑器改为在 Markdown 渲染后统一调用 `hljs.highlightElement()` 高亮代码块。
- **🧪 回归测试**：`tests/editor.test.mjs` 使用 fake `marked`/`hljs` 验证不再传入 `highlight` 选项，并确认渲染后的代码块会被高亮。
- **📊 实际收益**：避免 `marked@18` 忽略废弃配置造成误导，编辑器代码高亮路径更清晰。
- **🔗 相关建议**：[COMP-02](../competitive-analysis.md#comp-02)

---

## 📌 MR-EDITOR-04 [已修复]: `readingMinutes` 第 3 次重复定义

- **📍 原位置**：`js/editor.js`
- **✅ 修复状态**：`updateStats()` 已改用 `CWLUtils.readingMinutes(text)`，阅读时长算法与文章页客户端保持一致。
- **🧪 回归测试**：`tests/editor.test.mjs` 新增统计测试，确认 700 个中文字符显示为 2 分钟。
- **📊 实际收益**：编辑器预估阅读时间不再维护第三份算法。

---

## 📌 MR-EDITOR-05 [已修复]: 导出的 Markdown 缺少必填字段

- **📍 位置**：`editor/index.html`、`js/editor.js`
- **✅ 修复状态**：编辑器新增短标题、摘要和描述输入；`frontMatter()` 导出 `title`、`shortTitle`、`date`、`summary`、`description` 和 `draft`。
- **🧪 回归测试**：`tests/editor.test.mjs` 拦截导出 Blob，验证 Markdown front matter 包含构建脚本必填字段并正确转义标题引号。
- **📊 实际收益**：导出的 Markdown 可直接进入当前 `src/posts/` 构建流程，减少用户手工补字段导致的构建失败。
- **🔗 相关建议**：无

---

## 📌 MR-EDITOR-06 [已修复]: Markdown 主输入框缺少可访问名称

- **📍 位置**：`editor/index.html:117-119`, `src/templates/tools.mjs:405-407`, `tools/index.html:634-636`
- **✅ 修复状态**：独立编辑器和工具箱内嵌编辑器已共享 `editor.input.label` 的屏幕阅读器 label，并补 `.sr-only` 工具类。
- **🧪 回归测试**：`tests/templates-extended.test.mjs` 校验工具页模板输出 label，`tests/css.test.mjs` 校验 `.sr-only`，浏览器烟测确认 `/editor/`、`/tools/` 均可按 label 找到输入框。
- **📝 原状况描述**：编辑器主输入框 `textarea#markdown-input` 没有关联 label 或 aria 名称。该控件是编辑器最重要的输入区域，缺少名称会影响屏幕阅读器用户定位，也会让页面级表单审计持续报错。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```html
  <label class="sr-only" for="markdown-input" data-i18n="editor.input.label">
    Markdown 原文输入
  </label>
  <textarea id="markdown-input" spellcheck="false"></textarea>
  ```
  工具箱内嵌编辑器与独立编辑器页应共享同一段 markup，避免修一处漏一处。
- **📊 预期收益**：提升编辑器无障碍质量，并降低手写页与工具模板之间的维护漂移。
- **🔗 相关建议引用**：[UX-14](../ux-improvements.md#ux-14-markdown-编辑器主输入框缺少可关联标签), [DE-14](../devex-improvements.md#de-14)

---

## 模块健康度评分：4.1 / 5 — 优秀
