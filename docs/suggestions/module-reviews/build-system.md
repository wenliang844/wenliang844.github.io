# 🔍 模块深度分析：构建系统 (`scripts/build.mjs` + `src/`)

> 分析日期：2026-06-18 | 文件：`scripts/build.mjs`、`src/config.mjs`、`src/templates/*.mjs`、`src/lib/format.mjs`

---

## 模块概况

| 指标 | 值 |
|------|-----|
| 总行数 | ~1500 行（build.mjs 549 + 模板 800 + 配置 110 + 工具 70） |
| 文件数 | 10 个（1 构建 + 1 配置 + 8 模板 + 1 工具库） |
| 测试覆盖 | 3 个测试文件，覆盖核心逻辑 |
| 外部依赖 | marked, yaml |

## ✅ 优秀实践

### 1. 输入验证完善
`build.mjs` 对 front-matter 进行了全面的验证：
- 必填字段检查（title, shortTitle, date, summary, description）
- 字段长度限制（title 200, shortTitle 100, description 500）
- Slug 格式验证（仅允许字母、数字、连字符、下划线）
- Slug 唯一性验证（防止 URL 冲突）
- 日期格式验证（严格 YYYY-MM-DD 格式 + 日期有效性）

### 2. XSS 防护到位
所有用户可控的输出（front-matter 文本）都经过 `escapeHtml` / `escapeAttr` 处理，只有 Markdown 正文（受信任的源）保留原始 HTML。

### 3. 错误处理清晰
构建失败时收集所有错误并统一报告，不会因为第一个错误就中断：
```javascript
for (const file of files) {
  try { ... }
  catch (error) { errors.push(...); }
}
if (errors.length > 0) { throw new Error(...); }
```

### 4. 输出路径安全
`--out` 参数限制在项目目录内，防止路径遍历攻击。

---

## 📌 MR-BUILD-01: `extractToc()` 和 `renderContent()` 的标题 ID 生成逻辑重复

- **📍 位置**：`scripts/build.mjs:147-185`
- **📝 当前状况**：两个函数各自独立实现标题 ID 生成，使用相同的正则和 `h2Index` 逻辑。
- **⚠️ 影响程度**：中（维护一致性风险）
- **💡 建议方案**：提取为共享函数：
  ```javascript
  function generateHeadingIds(html) {
    const toc = [];
    let h2Index = 0;
    const htmlWithIds = html.replace(/<(h[2-3])>(.*?)<\/\1>/gs, (match, tag, content) => {
      const level = parseInt(tag[1]);
      const text = content.replace(/<[^>]+>/g, '');
      const id = `toc-${level === 2 ? ++h2Index : h2Index}-${text.replace(/[^\w一-龥]+/g, '-').toLowerCase().slice(0, 50)}`;
      toc.push({ level, text, id });
      return `<${tag} id="${id}">${content}</${tag}>`;
    });
    return { html: htmlWithIds, toc };
  }
  ```
- **📊 预期收益**：消除重复，单一数据源
- **🔗 相关建议**：[B-06](../bugs-and-risks.md#b-06), [CQ-10](../code-quality.md#cq-10)

---

## 📌 MR-BUILD-02: RSS 生成逻辑重复 3 次

- **📍 位置**：`scripts/build.mjs:401-487`
- **📝 当前状况**：`buildRss()`、`buildPostRss()`、`buildCategoriesRss()` 三个函数结构几乎完全相同，只有 `<title>`、`<link>`、`<description>` 和 `<atom:link>` 不同。
- **⚠️ 影响程度**：低
- **💡 建议方案**：提取为参数化函数：
  ```javascript
  function buildRssFeed(posts, { title, link, description, selfHref }) {
    // 共用逻辑
  }
  ```
- **📊 预期收益**：减少约 40 行重复代码
- **🔗 相关建议**：[CQ-02](../code-quality.md#cq-02)

---

## 📌 MR-BUILD-03: `tidyHtml()` 的空行压缩可能影响 Markdown 渲染结果

- **📍 位置**：`scripts/build.mjs:132-144`
- **📝 当前状况**：`tidyHtml()` 将连续空行压缩为单行，但用 `\x00` 占位保护 `<pre>` 块。如果文章中使用 HTML 块级元素（如 `<div>`、`<details>`），这些块之间的空行会被压缩，可能影响某些 CSS 布局（如 margin collapsing）。
- **⚠️ 影响程度**：低
- **💡 建议方案**：扩大保护范围，不仅保护 `<pre>` 还保护 `<div>`、`<details>`、`<table>` 等块级元素。
- **📊 预期收益**：HTML 块元素布局更准确
- **🔗 相关建议**：无

---

## 📌 MR-BUILD-04: 构建脚本无增量构建能力

- **📍 位置**：`scripts/build.mjs:489-548`
- **📝 当前状况**：每次 `npm run build` 都重新处理所有 6 篇文章，生成所有页面。当前 6 篇文章构建时间约 600ms，完全可接受。
- **⚠️ 影响程度**：低（当前规模无需优化）
- **💡 建议方案**：当文章超过 30 篇时考虑添加文件哈希缓存。
- **📊 预期收益**：预防性优化
- **🔗 相关建议**：[AR-04](../architecture-review.md#ar-04)

---

## 📌 MR-BUILD-05 [已修复]: `renderPage()` 的 `scripts` 数组与 `allScripts` 合并逻辑不直观

- **📍 原位置**：`src/templates/layout.mjs`
- **✅ 修复状态**：核心脚本已提取为 `CORE_SCRIPTS`，并通过 `new Set([...CORE_SCRIPTS, ...scripts])` 合并去重。
- **🧪 回归测试**：`tests/templates.test.mjs` 覆盖核心脚本和页面脚本重复传入时只输出一次。
- **📊 实际收益**：防止未来模板误传重复脚本导致浏览器重复请求与重复执行。
- **🔗 相关建议**：[AR-01](../architecture-review.md#ar-01)

---

## 模块健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码质量 | ⭐⭐⭐⭐⭐ | 清晰的注释、完善的验证 |
| 安全性 | ⭐⭐⭐⭐⭐ | 全面的 XSS 防护和输入验证 |
| 可维护性 | ⭐⭐⭐⭐ | 职责分离良好，少量重复 |
| 测试覆盖 | ⭐⭐⭐⭐ | 核心逻辑有测试，但未全覆盖 |
| 性能 | ⭐⭐⭐⭐ | 当前规模表现良好 |
| 扩展性 | ⭐⭐⭐⭐ | 模板系统易于添加新页面 |

> 综合评分：**4.3 / 5** — 优秀
