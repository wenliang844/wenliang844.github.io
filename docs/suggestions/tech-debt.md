# 💳 技术债务分析

> 分析日期：2026-06-18 | 分析范围：过时依赖、废弃 API、遗留代码、工程化债务

---

## 📌 TD-01: 使用已废弃的 Web API

- **📍 位置**：多个文件
- **📝 当前状况**：

  | 废弃 API | 位置 | 现代替代 |
  |----------|------|----------|
  | `document.execCommand("copy")` | utils.js:59, coder.js:189, share.js:68 | `navigator.clipboard.writeText()` |
  | `Array.prototype.slice.call()` | coder.js:41, blog.js:8 等 | `Array.from()` 或展开运算符 |

  注意：`execCommand("copy")` 作为 fallback 保留是正确的（兼容性考虑），但主路径应始终优先 Clipboard API。
- **⚠️ 影响程度**：低（当前功能不受影响，未来浏览器可能移除）
- **💡 建议方案**：逐步替换：
  ```javascript
  // Array.prototype.slice.call → Array.from
  const items = Array.from(document.querySelectorAll(".foo"));
  ```
- **📊 预期收益**：跟上 Web 标准演进，消除控制台 deprecation 警告
- **🔗 相关建议**：[CQ-07](code-quality.md#cq-07)

---

## 📌 TD-02: ESLint 配置使用 v8，ESLint 9 已发布

- **📍 位置**：`.eslintrc.json` + `package.json`
- **📝 当前状况**：
  ```json
  "eslint": "^8.57.0"
  ```
  ESLint 9 于 2024 年发布，引入了新的 flat config 格式（`eslint.config.js`）。ESLint 8 已进入维护模式。
- **⚠️ 影响程度**：低（功能不受影响，但无法使用新规则）
- **💡 建议方案**：
  1. 短期：保持 ESLint 8（稳定可靠）
  2. 中期：迁移到 ESLint 9 flat config：
     ```javascript
     // eslint.config.js
     export default [
       { rules: { "no-console": ["warn", { "allow": ["warn", "error"] }] } },
     ];
     ```
  3. 注意：ESLint 9 需要 Node.js >= 18.18.0

- **📊 预期收益**：使用最新规则，配置更灵活
- **🔗 相关建议**：[DE-01](devex-improvements.md#de-01)

---

## 📌 TD-03: `marked` 库版本 v18，API 可能变化

- **📍 位置**：`package.json`、`scripts/build.mjs`
- **📝 当前状况**：
  ```json
  "marked": "^18.0.5"
  ```
  使用 `marked.parse()` API，当前版本兼容。但 marked 库的主版本号更新频繁（v4→v5→...→v18），每次大版本可能有 breaking changes。
- **⚠️ 影响程度**：低（当前锁定在 ^18.0.5）
- **💡 建议方案**：
  1. 保持 `package-lock.json` 锁定版本
  2. 定期检查 marked 的 changelog
  3. 考虑添加 `marked` 的配置项测试（确保升级后行为一致）

- **📊 预期收益**：避免依赖升级导致构建失败
- **🔗 相关建议**：[DE-03](devex-improvements.md#de-03)

---

## 📌 TD-04: `jsdom` 仅用于测试，未在生产代码中使用

- **📍 位置**：`package.json`
- **📝 当前状况**：
  ```json
  "jsdom": "^27.0.1"
  ```
  `jsdom` 是 devDependency，用于测试中模拟 DOM 环境。这是合理的使用方式，但 `jsdom@27` 是 2025 年发布的版本，可能不是最新。
- **⚠️ 影响程度**：无
- **💡 建议方案**：定期运行 `npm audit` 和 `npm outdated` 检查依赖更新。
- **📊 预期收益**：保持依赖安全性
- **🔗 相关建议**：[DE-03](devex-improvements.md#de-03)

---

## 📌 TD-05: `.gitignore` 中缺少 `node_modules` 检查

- **📍 位置**：`.gitignore`
- **📝 当前状况**：`node_modules` 目录已存在于工作目录中但不在 git 追踪中（正确的 `.gitignore` 配置）。但 `.gitignore` 可能缺少以下条目：
  - `.build-cache.json`（如果未来添加增量构建缓存）
  - `temp/`（测试临时目录，已在 `.gitignore` 中）
  - `.claude/`（Claude Code 配置目录）
- **⚠️ 影响程度**：低
- **💡 建议方案**：检查并更新 `.gitignore`，确保包含：
  ```
  node_modules/
  temp/
  .claude/
  *.log
  ```
- **📊 预期收益**：避免意外提交无关文件
- **🔗 相关建议**：无

---

## 📌 TD-06: `performance-monitor.js` 和 `logger.js` 未被任何页面引用

- **📍 位置**：`js/performance-monitor.js`、`js/logger.js`
- **📝 当前状况**：这两个文件存在于 `js/` 目录中，但：
  - `performance-monitor.js`：`enabled: false`，未被任何 HTML 页面引入
  - `logger.js`：未被任何 HTML 页面引入
  - `highlight-loader.js`：未被任何 HTML 页面引入

  它们可能是开发阶段的工具，或者是未来功能的占位代码。
- **⚠️ 影响程度**：无（不影响生产环境，但增加仓库体积）
- **💡 建议方案**：
  1. 如果确认不再需要，删除这些文件
  2. 如果计划未来使用，在文件顶部添加注释说明用途和计划
  3. `performance-monitor.js` 可以考虑集成到构建报告中（构建时输出性能指标）

- **📊 预期收益**：减少仓库中的死代码
- **🔗 相关建议**：[CQ-06](code-quality.md#cq-06)

---

## 📌 TD-07: `eslintrc.json` 中 globals 声明了未使用的全局变量

- **📍 位置**：`.eslintrc.json:40-50`
- **📝 当前状况**：
  ```json
  "globals": {
    "CWLUtils": "readonly",
    "CWLErrorHandler": "readonly",
    "cwlT": "readonly",
    "cwlLang": "readonly",
    "cwlOpenSearch": "readonly",
    "coderShowPost": "readonly",
    "Fuse": "readonly",
    "marked": "readonly",
    "DOMPurify": "readonly",
    "hljs": "readonly"
  }
  ```
  其中：
  - `CWLErrorHandler`：定义了但未被其他文件使用
  - `DOMPurify`：声明了但在 `eslintrc.json` 的 overrides 中未使用（`editor.js` 可能使用）
  - `hljs`：由 `highlight-loader.js` 使用，但该文件未被引入

- **⚠️ 影响程度**：低
- **💡 建议方案**：清理未使用的全局声明，只保留实际使用的。
- **📊 预期收益**：ESLint 配置更准确
- **🔗 相关建议**：[TD-06](#td-06)

---

## 📌 TD-08: CSS 中使用了 `scroll-behavior: smooth`，与 JS 平滑滚动冲突

- **📍 位置**：`css/coder.css:77`
- **📝 当前状况**：
  ```css
  html { scroll-behavior: smooth; }
  ```
  同时 `coder.js:110` 和 `toc.js:74` 使用 `window.scrollTo({ behavior: "smooth" })`。CSS 的 `scroll-behavior: smooth` 会让所有锚点跳转都变成平滑滚动，包括那些期望瞬时跳转的场景（如 `window.scrollTo({ behavior: "instant" })` 被覆盖）。
- **⚠️ 影响程度**：低
- **💡 建议方案**：移除 CSS 中的 `scroll-behavior: smooth`，改由 JS 按需控制：
  ```css
  html { /* 移除 scroll-behavior: smooth */ }
  ```
  或保留 CSS 设置，但 JS 中显式指定 `behavior: "instant"` 时不受影响（现代浏览器支持）。
- **📊 预期收益**：更精确的滚动控制
- **🔗 相关建议**：[UX-04](ux-improvements.md#ux-04)

---

## 📌 TD-09: 无 TypeScript / JSDoc 类型注解

- **📍 位置**：所有 JS 文件
- **📝 当前状况**：项目使用纯 JavaScript，没有 TypeScript 也没有 JSDoc 类型注解。只有少量函数有 JSDoc 注释（如 `utils.js` 的工具函数、`layout.mjs` 的 `renderMeta` 和 `renderPage`）。
- **⚠️ 影响程度**：低（静态站点规模较小，类型错误容易发现）
- **💡 建议方案**：
  1. **短期**：为关键函数添加 JSDoc 类型注解：
     ```javascript
     /**
      * @param {string} key - i18n 键名
      * @param {string} fallback - 默认文案
      * @returns {string}
      */
     function t(key, fallback) { ... }
     ```
  2. **长期**：构建脚本（src/）考虑迁移到 TypeScript，利用类型检查减少构建脚本 bug

- **📊 预期收益**：IDE 补全更准确，重构更安全
- **🔗 相关建议**：[DE-01](devex-improvements.md#de-01)

---

## 📌 TD-10: 测试覆盖仅覆盖构建逻辑和工具函数，无前端功能测试

- **📍 位置**：`tests/` 目录
- **📝 当前状况**：当前 518 个测试覆盖：
  - 构建脚本输出验证（build.test.mjs）
  - HTML 模板转义验证（templates.test.mjs）
  - 工具函数验证（tools.test.mjs）
  - HTML 结构验证（link 一致性、脚本顺序、noopener 等）

  但以下功能没有测试覆盖：
  - 客户端 JS 功能（主题切换、i18n、搜索、分享等）
  - CSS 渲染效果
  - 用户交互流程
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  1. **短期**：保持当前 Node.js 测试（高性价比）
  2. **中期**：添加 Puppeteer/Playwright E2E 测试，覆盖关键用户流程：
     - 首页加载 → 点击文章 → 阅读 → 搜索 → 切换语言
     - 工具箱各工具的基本功能
  3. **长期**：集成到 CI/CD 流程

- **📊 预期收益**：回归测试覆盖完整，重构信心提升
- **🔗 相关建议**：[DE-02](devex-improvements.md#de-02)

---

## 技术债务汇总

| 类别 | 数量 | 严重程度 |
|------|------|----------|
| 废弃 API | 2 处 | 低 |
| 过时依赖 | 2 个 | 低 |
| 死代码 | 3 个文件 | 低 |
| 缺少类型 | 全局 | 低 |
| 测试缺口 | 前端功能 | 中 |
| 配置清理 | 2 处 | 低 |

> 整体评估：技术债务轻微，主要集中在"锦上添花"层面。项目在可维护性和代码质量方面做得不错，没有严重的债务负担。
