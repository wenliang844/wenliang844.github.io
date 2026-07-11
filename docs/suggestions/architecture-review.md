# 🏗️ 架构设计评审

> 分析日期：2026-06-18 | 分析范围：整体架构、模块依赖、数据流、扩展性

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────┐
│                    源码层 (src/)                      │
│  config.mjs ← 站点配置                                │
│  posts/*.md ← Markdown 文章                           │
│  templates/*.mjs ← HTML 模板（8 个模块）               │
│  lib/format.mjs ← 格式化工具                          │
└──────────────────┬──────────────────────────────────┘
                   │ build.mjs
                   ▼
┌─────────────────────────────────────────────────────┐
│                  产物层（根目录）                       │
│  post/<slug>/index.html ← 单篇文章页                  │
│  post/index.html ← 博客列表页                         │
│  tags/, categories/, ai/, tools/, appreciation/...    │
│  sitemap.xml, index.xml (RSS), search-index.json      │
└──────────────────┬──────────────────────────────────┘
                   │ 浏览器加载
                   ▼
┌─────────────────────────────────────────────────────┐
│                  运行时层 (js/)                        │
│  error-handler.js → utils.js → i18n.js → coder.js    │
│  search-loader.js → search.js (懒加载)               │
│  subscribe.js, assistant.js                          │
│  [页面特有] blog.js, share.js, giscus.js, toc.js...   │
│  [工具页] tools-core.js → tools.js                    │
└─────────────────────────────────────────────────────┘
```

---

## 📌 AR-01: 脚本加载顺序隐式依赖，无显式声明

- **📍 位置**：`src/templates/layout.mjs:117`
- **📝 当前状况**：脚本加载顺序为：
  ```javascript
  const allScripts = ["/js/error-handler.js", "/js/utils.js", "/js/i18n.js",
                      "/js/coder.js", "/js/search-loader.js", "/js/subscribe.js",
                      "/js/assistant.js", ...scripts];
  ```
  模块间存在隐式依赖关系：
  - `coder.js` 依赖 `CWLUtils`（utils.js）和 `cwlT`（i18n.js）
  - `search.js` 依赖 `CWLUtils.debounce`
  - `subscribe.js` 依赖 `cwlT`
  - `blog.js` 依赖 `CWLUtils.debounce` 和 `coderShowPost`（coder.js）

  但这些依赖没有在代码中显式声明或检查。如果有人调整加载顺序，可能导致运行时错误。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  1. 在每个模块顶部添加依赖检查：
     ```javascript
     // coder.js
     if (!window.CWLUtils) {
       console.warn("coder.js: utils.js not loaded yet");
     }
     ```
  2. 或在 `layout.mjs` 中用注释标注依赖关系：
     ```javascript
     // 加载顺序：error-handler → utils → i18n → [其他模块按依赖排序]
     const allScripts = [
       "/js/error-handler.js",  // 无依赖
       "/js/utils.js",          // 无依赖
       "/js/i18n.js",           // 无依赖
       "/js/coder.js",          // 依赖: utils, i18n
       "/js/search-loader.js",  // 依赖: 无（search.js 懒加载）
       "/js/subscribe.js",      // 依赖: i18n
       "/js/assistant.js",      // 依赖: 无
       ...scripts,
     ];
     ```

- **📊 预期收益**：降低维护风险，新人理解成本降低
- **🔗 相关建议**：[CQ-06](code-quality.md#cq-06), [DE-01](devex-improvements.md#de-01)

---

## 📌 AR-02: 全局变量作为模块通信机制，命名空间不统一

- **📍 位置**：多个文件
- **📝 当前状况**：模块间通过全局变量通信：

  | 全局变量 | 定义位置 | 使用位置 |
  |----------|----------|----------|
  | `CWLUtils` | utils.js | coder.js, search.js, blog.js, share.js, tools.js |
  | `CWLErrorHandler` | error-handler.js | （未被其他模块使用） |
  | `CWLToolsCore` | tools-core.js | tools.js |
  | `CWLPerformance` | performance-monitor.js | （未被其他模块使用） |
  | `cwlT` | i18n.js | coder.js, blog.js, search.js, share.js, subscribe.js, tools.js |
  | `cwlLang` | i18n.js | search.js, share.js |
  | `cwlSetLang` | i18n.js | （未被其他模块使用） |
  | `cwlOpenSearch` | search.js | search-loader.js, assistant.js |
  | `coderShowPost` | coder.js | blog.js |

  命名风格不统一：`CWL*`（大驼峰）、`cwl*`（小驼峰）、`coder*`（前缀不同）。
- **⚠️ 影响程度**：低（功能正确，但命名空间混乱）
- **💡 建议方案**：统一到 `CWL` 命名空间：
  ```javascript
  // i18n.js
  window.CWL = window.CWL || {};
  window.CWL.t = t;
  window.CWL.lang = function() { return lang; };
  window.CWL.setLang = setLang;

  // coder.js
  window.CWL.showPost = showPost;
  window.CWL.openSearch = open; // search.js
  ```
  保留 `cwlT` 等旧名称作为兼容别名，逐步迁移。
- **📊 预期收益**：统一命名空间，减少全局污染，IDE 补全更友好
- **🔗 相关建议**：[AR-03](#ar-03)

---

## 📌 AR-03: 无模块系统，21 个 JS 文件全部通过 `<script defer>` 加载

- **📍 位置**：所有 JS 文件
- **📝 当前状况**：项目使用原生 IIFE + 全局变量模式，没有 ES Modules 或 CommonJS。每个文件是一个 IIFE，通过 `<script defer>` 按顺序加载。这是 GitHub Pages 静态站点的合理选择（无需打包工具），但有以下限制：
  - 无法 tree-shake 未使用的代码
  - 无法按需 import/export
  - 每个文件需要手动维护加载顺序
- **⚠️ 影响程度**：低（当前规模可接受）
- **💡 建议方案**：
  1. **短期**：保持现状（IIFE 模式对静态站点足够）
  2. **中期**：考虑将核心模块改为 ES Modules：
     ```html
     <script type="module">
       import { t, lang } from '/js/i18n.js';
       import { throttle, debounce } from '/js/utils.js';
       // ...
     </script>
     ```
     注意：ES Modules 在所有现代浏览器中支持，但需要处理兼容性。
  3. **长期**：引入 esbuild 等轻量打包工具，开发时用 ES Modules，构建时打包为 IIFE

- **📊 预期收益**：更好的代码组织，支持 tree-shaking
- **🔗 相关建议**：[P-03](performance-bottlenecks.md#p-03), [DE-01](devex-improvements.md#de-01)

---

## 📌 AR-04: 构建脚本模板系统设计良好，但缺少增量构建

- **📍 位置**：`scripts/build.mjs`
- **📝 当前状况**：构建脚本每次运行都重新处理所有 Markdown 文件并生成所有页面。当前 6 篇文章构建时间约 600ms（测试记录），完全可接受。但随着文章增多，全量构建时间会线性增长。
- **⚠️ 影响程度**：低（当前规模无需优化）
- **💡 建议方案**：
  1. **短期**：保持全量构建（简单可靠）
  2. **中期**：添加文件哈希缓存，只重建变更文件：
     ```javascript
     // .build-cache.json
     { "manage-system.md": "abc123", "finance-saas-backend.md": "def456" }
     ```
  3. **长期**：集成 chokidar 文件监听，实现增量构建

- **📊 预期收益**：文章数量增长后构建时间保持常数
- **🔗 相关建议**：[DE-02](devex-improvements.md#de-02)

---

## 📌 AR-05: 客户端-服务端职责边界清晰

- **📍 位置**：整体架构
- **📝 当前状况**：职责划分合理：
  - **服务端（构建时）**：Markdown → HTML、TOC 提取、搜索索引生成、RSS/Sitemap、JSON-LD
  - **客户端（运行时）**：主题切换、i18n、搜索、TOC 交互、分享、评论、动画

  唯一的灰色地带是 `readingMinutes`——构建时计算一次（SSR 占位），客户端再计算一次（可能因语言切换而不同）。这是合理的设计决策。
- **⚠️ 影响程度**：无（正面评价）
- **💡 建议方案**：维持当前划分，新功能优先考虑构建时实现（减少客户端 JS）。
- **📊 预期收益**：架构一致性
- **🔗 相关建议**：[B-05](bugs-and-risks.md#b-05)

---

## 📌 AR-06: CSS 无组件化，所有样式在单一文件中

- **📍 位置**：`css/coder.css`（4655 行）
- **📝 当前状况**：整个站点样式在一个文件中，按功能区域用注释分隔：
  ```css
  /* Ambient animated backdrop */
  /* Navigation */
  /* Home */
  /* Blog list */
  /* Article */
  /* Search modal */
  /* Subscribe modal */
  /* Tools */
  /* Editor */
  /* ... */
  ```
  优点是加载简单（单文件），缺点是无法按页面拆分。
- **⚠️ 影响程度**：低
- **💡 建议方案**：保持单文件（GitHub Pages 无构建 CSS 的能力），但用 BEM 命名或 CSS 注释建立清晰的组件边界。考虑在构建脚本中添加 CSS 拆分逻辑（按页面生成独立 CSS）。
- **📊 预期收益**：可维护性提升
- **🔗 相关建议**：[P-02](performance-bottlenecks.md#p-02), [CQ-09](code-quality.md#cq-09)

---

## 📌 AR-07 [新增]: `assistant.js` 是全站最大的"God Module"（1568 行）

- **📍 位置**：`js/assistant.js`（1568 行，134 个函数）
- **📝 当前状况**：assistant.js 是全站最大的 JS 文件，远超 coder.js（567 行）。它在一个 IIFE 中集成了：
  - **本地导航匹配系统**（PAGES/POSTS/QUICK_ACTIONS 数据 + score/matches 函数）
  - **LLM API 集成**（OpenAI/Anthropic 双格式，支持流式 SSE 响应）
  - **多会话管理**（最多 20 个会话，localStorage 持久化，CRUD 操作）
  - **UI 框架**（全屏/悬浮/最小化三种模式，透明度调节，可拖拽定位）
  - **历史记录面板**（会话列表、切换、删除）
  - **设置面板**（API 配置、模型选择、中转站预设）
  - **i18n 部分支持**（PAGES/POSTS 有 titleEn，但回复文本硬编码中文）

  这是一个典型的"God Module"反模式——所有功能耦合在一个文件中。
- **⚠️ 影响程度**：中（可维护性差，测试困难，加载非按需）
- **💡 建议方案**：拆分为独立模块：
  ```
  js/assistant-data.js    — PAGES/POSTS/QUICK_ACTIONS 数据（~50 行）
  js/assistant-llm.js     — LLM API 调用 + 流式响应处理（~200 行）
  js/assistant-storage.js — 会话管理 + localStorage 持久化（~150 行）
  js/assistant-ui.js      — UI 渲染 + 事件处理（~400 行）
  js/assistant.js         — 入口 + 协调（~100 行）
  ```
  或至少将 LLM 相关代码提取为独立模块，按需加载（用户切换到 LLM 模式时才加载）。
- **📊 预期收益**：代码可测试性提升，LLM 模块按需加载减少首屏 JS 体积
- **🔗 相关建议**：[CQ-06](code-quality.md#cq-06), [S-00](security-audit.md#s-00)

---

## 📌 AR-08: 工具箱和助手资源需要从全站核心层剥离

- **📍 位置**：`src/templates/layout.mjs:225-226`, `css/coder.css:3910-6084`, `tools/index.html:89-1235`, `src/templates/tools.mjs:923-944`
- **📝 当前状况描述**：工具箱、Markdown 编辑器、手势视觉工具和 AI 助手都已经从“页面小功能”增长为独立应用级界面，但样式仍塞在全站 `coder.css`，工具页 HTML 也一次性 SSR 所有 31 个工具面板。当前架构继续扩展时，首页/文章页会承担工具和助手的样式成本，工具页会承担所有工具 markup 的首屏解析成本。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  核心层：layout + nav + article + shared modal
  应用层：tools shell + tool panel lazy mount
  浮层层：assistant JS/CSS 按首次打开加载
  ```
  构建脚本可以先支持 `pageStyles` / `pageScripts` 数组，不必立即引入复杂 bundler。
- **📊 预期收益**：让新增工具和助手能力在自己的资源边界内增长，避免继续推高全站基础包。
- **🔗 相关建议引用**：[P-17](performance-bottlenecks.md#p-17-全站统一加载-codercss工具箱和助手样式成本扩散到所有页面), [P-18](performance-bottlenecks.md#p-18-工具页首屏一次性解析-31-个工具面板)

---

## 模块依赖图

```
error-handler.js (独立)
utils.js (独立)
i18n.js (独立)
coder.js → utils.js, i18n.js
search-loader.js → [search.js (懒加载)]
search.js → utils.js, i18n.js, [Fuse.js (懒加载)]
subscribe.js → i18n.js
assistant.js (独立，硬编码中文)
blog.js → utils.js, i18n.js, coder.js(coderShowPost)
share.js → utils.js, i18n.js, [qrcode.min.js]
giscus.js → i18n.js
toc.js (独立)
post-next.js → utils.js
tools-core.js (独立)
tools.js → tools-core.js, i18n.js
feedback.js → i18n.js
editor.js → i18n.js, [marked.js, DOMPurify]
overleaf.js → i18n.js
performance-monitor.js (独立)
highlight-loader.js → [hljs]
logger.js (独立)
```

> 整体评估：架构设计合理，职责划分清晰。主要改进方向是统一命名空间和考虑模块化迁移。
