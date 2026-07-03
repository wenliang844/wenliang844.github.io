# 📐 代码质量分析

> 分析日期：2026-06-18 | 分析范围：全站 JS（21 个文件）、构建脚本（8 个模板模块）、CSS

---

## 2026-07-03 复查补充

### 📌 CQ-11: ESLint 当前仍有 77 个 warning，集中在视觉交互大文件

- **📍 位置**：`js/galaxy.js:136-205`, `js/galaxy.js:283-427`, `js/galaxy.js:686-690`, `js/gesture.js:427`, `js/gesture.js:1018-1019`, `js/gesture.js:1101-1102`, `js/gesture.js:1320`, `js/gesture.js:1907`
- **📝 当前状况描述**：`npm run lint:check` 0 error 但输出 77 个 warning，主要是 `no-var` 与 `prefer-const`。这些 warning 集中在 `galaxy.js` 与 `gesture.js`，二者又是动画/摄像头交互热区，后续维护者容易在 `var` 函数作用域、循环复用变量和闭包中引入边界 bug。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  // 分批改造，不和功能变更混在一起
  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    // ...
  }
  ```
  建议新建纯机械提交：只处理 `no-var` / `prefer-const`，并保留现有动画测试和工具箱冒烟验证。
- **📊 预期收益**：降低视觉交互模块的维护噪音，让未来 lint warning 更能指向真实问题。
- **🔗 相关建议引用**：[TD-11](tech-debt.md#td-11-eslint-8-迁移前应先清零当前-warning-债务), [MR-TOOLS-04](module-reviews/tools-gesture-and-api.md#mr-tools-04-视觉交互脚本已成为代码质量热点)

### 📌 CQ-12 [已修复]: 安全回归测试只检查连续 key 字面量，无法识别拼接型密钥

- **📍 位置**：`tests/assistant.test.mjs:519-525`, `tests/assistant-deep.test.mjs:288-299`, `js/assistant.js:39-63`
- **✅ 修复状态**：测试现在明确阻断 `OPENAI_DEFAULT_API_KEY` / `LLM_EXPERIENCE_KEYS` 等默认 key 机制，并用运行时断言保证默认 preset 空 key 不会调用 `fetch`；用户自填 key 才会请求。
- **🧪 回归测试**：`tests/assistant.test.mjs` 与 `tests/assistant-deep.test.mjs` 均已加强源码扫描；`tests/assistant.test.mjs` 覆盖默认空 key 不请求和自填 key 请求。
- **📝 原状况描述**：测试断言源码不包含 `/sk-[A-Za-z0-9_-]{20,}/` 和 `/tp-[A-Za-z0-9_-]{20,}/`，但源码用数组片段 `.join("")` 还原 key，绕过了连续字面量扫描。测试还保留默认体验 key 的行为断言，导致安全目标和行为目标互相冲突。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  assert.doesNotMatch(code, /OPENAI_DEFAULT_API_KEY|LLM_EXPERIENCE_KEYS/);
  assert.doesNotMatch(code, /withEffectiveApiKey\(.*preset/s);
  ```
  更稳妥的做法是加入运行时测试：默认配置提交问题时不得调用 `fetch`，必须提示用户输入 key。
- **📊 预期收益**：让测试真正约束“前端不得携带任何可还原密钥”，避免未来用字符串拼接、base64、分段常量等方式绕过扫描。
- **🔗 相关建议引用**：[S-11](security-audit.md#s-11-assistantjs-仍在前端运行时拼接并使用默认体验-api-key)

---

## 📌 CQ-01 [已修复]: `editing()` 函数在 3 个文件中重复定义

- **📍 位置**：`js/blog.js`、`js/search-loader.js`、`js/search.js`
- **✅ 修复状态**：三个模块的快捷键编辑态判断已统一委托给 `window.CWLUtils.isEditing()`，不再重复维护 `INPUT/TEXTAREA/SELECT/contenteditable` 判断。
- **🧪 回归测试**：新增源码回归测试，确认快捷键模块复用公共 helper，且不再复制 input tag 判断；保留 blog 输入框快捷键跳过行为测试。
- **📊 实际收益**：消除 3 处重复代码，编辑态规则回到单一维护点。
- **🔗 相关建议**：[B-12](bugs-and-risks.md#b-12)

---

## 📌 CQ-02 [已修复]: `copyText` 函数在 3 个文件中重复实现

- **📍 原位置**：`js/utils.js`、`js/coder.js`、`js/share.js`
- **✅ 修复状态**：`coder.js` 与 `share.js` 已删除内联 Clipboard API / `execCommand` fallback，统一委托 `window.CWLUtils.copyText`。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 新增源码测试，确认复制调用方不再复制 `execCommand` 或 textarea fallback。
- **📊 实际收益**：剪贴板兼容逻辑回到 `utils.js` 单一维护点，减少重复 fallback 代码。
- **🔗 相关建议**：[CQ-01](#cq-01)

---

## 📌 CQ-03 [已修复]: `escapeHtml` 在 3 个上下文中独立实现

- **📍 原位置**：`src/lib/format.mjs`、`js/utils.js`、`js/search.js`
- **✅ 修复状态**：`search.js` 已删除本地 `escapeHtml`，搜索结果高亮改用 DOM text node + `<mark>` 节点渲染。服务端 `format.mjs` 与客户端 `utils.js` 保留各自边界内的转义 helper。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 新增源码测试，确认 `search.js` 不再保留本地 `escapeHtml` 或手写 HTML entity 编码表。
- **📊 实际收益**：消除搜索模块的重复转义实现，并进一步降低字符串 HTML 渲染维护风险。
- **🔗 相关建议**：[S-01](security-audit.md#s-01)

---

## 📌 CQ-04 [已修复]: `t()` i18n 辅助函数在多个文件中各自定义

- **📍 原位置**：`js/blog.js`、`js/coder.js`、`js/editor.js`、`js/feedback.js`、`js/giscus.js`、`js/overleaf.js`、`js/search.js`、`js/share.js`、`js/subscribe.js`、`js/tools.js`
- **✅ 修复状态**：新增 `window.CWLUtils.t(key, fallback)`，稳定业务模块统一使用公共 i18n helper，不再维护本地 `function t(...)` 包装。
- **🧪 回归测试**：`tests/utils-deep.test.mjs` 覆盖 `CWLUtils.t` 的翻译代理和 fallback；`tests/js-behavior.test.mjs` 新增源码测试，确认稳定模块使用 `CWLUtils.t` 且不再定义本地 `t()`。
- **📊 实际收益**：消除 10 个模块中的重复 i18n wrapper，后续翻译 fallback 规则只需维护一处。`assistant.js` 的更大范围 i18n 文案治理继续归入 CQ-05。
- **🔗 相关建议**：[CQ-01](#cq-01), [CQ-05](#cq-05)

---

## 📌 CQ-05: `assistant.js` 硬编码中文文案，未接入 i18n 系统

- **📍 位置**：`js/assistant.js`（1568 行，全站最大 JS 文件，含 134 个函数）
- **📝 当前状况**：AI 助手模块是全站最复杂的前端模块（超过 coder.js 的 567 行），包含：
  - 本地关键词匹配导航系统（PAGES/POSTS/QUICK_ACTIONS）
  - LLM API 集成（OpenAI/Anthropic 格式，支持流式响应）
  - 多会话管理（最多 20 个会话，localStorage 持久化）
  - 全屏模式 + 透明度调节
  - 历史记录面板
  - 所有文案硬编码中文（第 1-26 行的 PAGES/POSTS 数据、回复文本等）
  - 切换到英文模式后，AI 助手仍显示中文
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

## 📌 CQ-06: `coder.js` IIFE 过长（567 行），职责过多（全站第二大 JS 文件）

- **📍 位置**：`js/coder.js:1-567`
- **📝 当前状况**：单个 IIFE 承担了 6 个独立职责（注：`assistant.js` 以 1568 行成为全站最大文件）：
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

## 📌 CQ-07 [已修复]: 大量使用 `Array.prototype.slice.call()` 转换 NodeList

- **📍 原位置**：`js/coder.js`、`js/blog.js`、`js/tools.js`、`js/overleaf.js`
- **✅ 修复状态**：应用源码中的 `Array.prototype.slice.call(...)` 集合转换已统一替换为 `Array.from(...)`。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 新增源码测试，确认相关应用模块不再使用旧式集合转换。
- **📊 实际收益**：代码更简洁，DOM 集合转换写法与项目 `ecmaVersion: 2020` 配置一致。
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

## 📌 CQ-10 [已修复]: 构建脚本中 `renderContent()` 执行两次正则替换

- **📍 位置**：`scripts/build.mjs`
- **✅ 修复状态**：`renderHeadings()` 在单次标题遍历中同时生成正文 heading id 和 TOC 数据，`extractToc()` 复用同一流程。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖 TOC 与正文锚点一致性。
- **📊 实际收益**：构建期标题处理逻辑更简洁，并避免 TOC 与正文锚点生成规则漂移。
- **🔗 相关建议**：[B-06](bugs-and-risks.md#b-06)

---

## 代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 命名规范 | ⭐⭐⭐⭐ | 一致的 camelCase，语义清晰 |
| 注释质量 | ⭐⭐⭐⭐⭐ | 每个文件/函数都有清晰的中文注释 |
| 错误处理 | ⭐⭐⭐⭐ | try-catch 覆盖 localStorage、网络请求等 |
| 代码重复 | ⭐⭐⭐⭐ | editing、copyText、escapeHtml、t() 和 readingMinutes 已统一；assistant 文案治理另见 CQ-05 |
| 文件粒度 | ⭐⭐⭐ | coder.js 过大（560 行），其他文件合理 |
| 现代化程度 | ⭐⭐⭐⭐ | 主要旧式 DOM 集合转换已替换为 ES2015+ 写法 |
| XSS 防护 | ⭐⭐⭐⭐⭐ | 全面的转义处理 |

> 综合评分：**4.0 / 5** — 良好，主要改进点在剩余重复逻辑消除和现代化。
