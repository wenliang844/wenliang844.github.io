# 🎨 用户体验优化建议

> 分析日期：2026-06-18 | 分析范围：交互设计、视觉反馈、响应式、无障碍

---

## 2026-07-03 复查补充

### 📌 UX-11: 手势与 API 工具的隐私边界文案需要更精确

- **📍 位置**：`src/templates/tools.mjs:123-170`, `src/templates/tools.mjs:793-870`, `src/templates/tools.mjs:923-926`, `tools/index.html:307-356`, `tools/index.html:1233-1235`
- **📝 当前状况描述**：工具箱 lead 文案写“其余工具全部在浏览器本地运行”，手势面板写“所有数据均在浏览器本地处理，不会上传到任何服务器”。但手势工具会加载第三方 CDN 脚本/模型，API Tester 会发送用户填写的 URL/Header/Body，并保存历史。当前文案没有明确区分“本地处理”“外部资源加载”“用户主动发送请求”“本地持久化历史”这四个边界。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  手势工具：摄像头画面在本机浏览器处理；首次使用会下载第三方开源模型资源。
  API Tester：请求会直接发送到你填写的目标 URL；保存历史前会自动隐藏 Authorization 等敏感头。
  ```
  在 API Tester header 区附近增加小型隐私提示和“不要保存敏感 header”的状态反馈；手势面板在开启摄像头前展示模型来源和本地处理说明。
- **📊 预期收益**：让用户在摄像头授权和 API key 输入前理解真实数据流，减少误用与信任落差。
- **🔗 相关建议引用**：[S-12](security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage), [S-13](security-audit.md#s-13-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束)

### 📌 UX-12: AI 助手超时和用户手动停止使用同一错误文案

- **📍 位置**：`js/assistant.js:652-668`, `js/assistant.js:670-687`, `js/assistant.js:1461-1481`
- **📝 当前状况描述**：`withTimeout()` 超时会调用 `controller.abort()`，用户点击停止也会触发 abort；`normalizeLlmError()` 对所有 `AbortError` 都返回“已停止生成。”。当请求实际因 60 秒超时或网络中断被取消时，用户会误以为自己手动停止了生成，无法判断是否应重试、切换中转站或缩短提示词。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  function withTimeout(parentSignal) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort(new DOMException("timeout", "TimeoutError"));
    }, REQUEST_TIMEOUT_MS);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
  }

  function normalizeLlmError(error) {
    if (error && error.name === "TimeoutError") return "请求超时，请稍后重试或切换中转站。";
    if (error && error.name === "AbortError") return "已停止生成。";
  }
  ```
  如果目标浏览器不支持 abort reason，可在闭包中维护 `didTimeout` 标志。
- **📊 预期收益**：让失败反馈更可诊断，减少用户对“停止/超时/网络失败”的困惑。
- **🔗 相关建议引用**：[B-16](bugs-and-risks.md#b-16-ai-助手-sse-流结束时可能丢失最后一个未闭合事件), [MR-AST-05](module-reviews/assistant-deep-dive.md#mr-ast-05-请求取消语义需要区分用户停止与超时)

### 📌 UX-13 [已修复核心问题]: AI 助手默认模式与隐私文案需要重新对齐

- **📍 位置**：`js/assistant.js:337-339`, `js/assistant.js:1306-1316`, `js/assistant.js:1445-1450`
- **✅ 修复状态**：助手默认进入本地站点模式，刷新后会恢复用户保存的 `site` / `llm` 偏好；LLM 隐私文案已改为“请填写你自己的 API key，密钥只保存在本机浏览器”，不再暗示内置体验 key。
- **🧪 回归测试**：`tests/assistant.test.mjs` 覆盖默认站点模式、模式恢复、空 key 不请求、用户自填 key 才请求。
- **📝 原状况描述**：助手读取模式时固定回到 LLM，隐私文案仍说明“未填写时使用内置体验 key”。这与安全复查中“前端不应内置可还原 key”的目标冲突，也让用户在站点问答和大模型问答之间的切换成本变高。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  站点模式：默认打开，仅查询本站内容，不发送到外部服务。
  大模型模式：需用户显式开启，并选择“自填 key”或“服务端体验代理”。
  ```
  在首次开启 LLM 时展示一次性确认：请求会发送到配置的 endpoint，本地会保存最近对话上下文，可在设置中关闭保存。
- **📊 预期收益**：让默认体验符合最小外发原则，用户能清楚理解何时使用本地规则、何时调用外部模型。
- **🔗 相关建议引用**：[B-15](bugs-and-risks.md#b-15-ai-助手模式偏好写入后不会被恢复), [S-11](security-audit.md#s-11-assistantjs-仍在前端运行时拼接并使用默认体验-api-key), [S-14](security-audit.md#s-14-ai-助手对话和-llm-上下文长期留存在-localstorage)

### 📌 UX-14 [已修复]: Markdown 编辑器主输入框缺少可关联标签

- **📍 位置**：`editor/index.html:117-119`, `src/templates/tools.mjs:405-407`, `tools/index.html:634-636`
- **✅ 修复状态**：独立编辑器页和工具箱内嵌 Markdown 编辑器均已增加 `<label class="sr-only" for="markdown-input" data-i18n="editor.input.label">Markdown 原文输入</label>`；`js/i18n.js` 已补英文文案，`css/coder.css` 已补 `.sr-only` 通用视觉隐藏工具类。
- **🧪 验证**：`node --test tests/templates-extended.test.mjs tests/css.test.mjs tests/i18n-a11y.test.mjs` 通过；模板测试和静态 HTML 扫描确认 `/editor/`、`/tools/` 均输出关联 label。
- **📝 原状况描述**：JSDOM 表单标签审计显示独立编辑器页和工具箱内嵌 Markdown 编辑器的 `textarea#markdown-input` 没有关联的 `<label for="markdown-input">`、`aria-label` 或 `aria-labelledby`。视觉上有编辑区上下文，但屏幕阅读器和表单导航无法稳定读出该输入区用途。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```html
  <label class="sr-only" for="markdown-input">Markdown 原文输入</label>
  <textarea id="markdown-input" spellcheck="false"></textarea>
  ```
  如果不想新增可见文案，也可使用 `aria-label="Markdown 原文输入"` 并接入 `data-i18n-aria`。
- **📊 预期收益**：提升编辑器键盘和辅助技术可用性，避免一个核心输入控件在自动化 a11y 审计中持续报错。
- **🔗 相关建议引用**：[MR-EDITOR-06](module-reviews/editor.md#mr-editor-06-markdown-主输入框缺少可访问名称), [DE-14](devex-improvements.md#de-14-增加页面级-dom-契约审计防止-seo-a11y-回退)

### 📌 UX-15 [已修复]: QR 结果图片缺少尺寸和加载属性，生成后可能产生布局跳动

- **📍 位置**：`src/templates/tools.mjs:559`, `tools/index.html:806-809`
- **✅ 修复状态**：`img#qr-image` 已补 `width="256"`、`height="256"`、`loading="lazy"`、`decoding="async"`，CSS 增加 `.qr-box img { aspect-ratio: 1; }` 保持方形预留。
- **🧪 验证**：`node --test tests/templates-extended.test.mjs tests/css.test.mjs tests/i18n-a11y.test.mjs` 通过；模板和 CSS 测试锁定尺寸/加载属性与方形比例。
- **📝 原状况描述**：`img#qr-image` 有 `alt` 和 `hidden`，但没有 `width`、`height`、`loading`、`decoding`。当用户生成二维码后，图片从 hidden 状态显示，浏览器需要在 data URL 解码后才知道尺寸，预览区域可能出现轻微布局跳动。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```html
  <img id="qr-image" alt="QR code" width="256" height="256" loading="lazy" decoding="async" hidden>
  ```
  CSS 中给 `.tool-preview` 或 QR 容器预留固定 `min-height`，生成失败时也保持布局稳定。
- **📊 预期收益**：减少二维码生成瞬间的布局抖动，让工具输出区更稳定。
- **🔗 相关建议引用**：[P-11](performance-bottlenecks.md#p-11), [DE-14](devex-improvements.md#de-14-增加页面级-dom-契约审计防止-seo-a11y-回退)

---

## 📌 UX-01 [已修复]: 移动端导航菜单无遮罩层，点击外部区域无法关闭

- **📍 位置**：`src/templates/layout.mjs`、`css/coder.css`、手写 HTML 页面导航区
- **✅ 修复状态**：导航 checkbox 后增加 `.menu-overlay` label，移动端菜单打开时显示固定遮罩；点击遮罩会通过原生 label/checkbox 关系关闭菜单，无需新增脚本。
- **🧪 回归测试**：`tests/templates.test.mjs` 覆盖模板输出，`tests/css.test.mjs` 锁定遮罩层级，`tests/i18n-a11y.test.mjs` 扫描所有 HTML 页面。
- **📊 实际收益**：移动端用户可点击菜单外区域关闭导航，保留无 JS 可用性并减少遮挡困扰。
- **🔗 相关建议**：[P-01](performance-bottlenecks.md#p-01)

---

## 📌 UX-02 [已修复]: 搜索结果无键盘快捷键提示，首次使用学习成本高

- **📍 原位置**：`src/templates/layout.mjs`、`js/search.js`
- **✅ 修复状态**：导航搜索按钮增加本地化 `title` 和更具体的 `aria-label`，提示 `Ctrl+K` 与 `/`；`search.js` 初始化和语言切换时会同步 title/aria，覆盖手写页面中的旧按钮。
- **🧪 回归测试**：`tests/templates.test.mjs` 锁定模板输出，`tests/js-behavior.test.mjs` 验证运行时中文/英文提示会写入按钮。
- **📊 实际收益**：快捷键提示进入 tooltip 与辅助技术可读名称，不额外增加可见界面噪音。
- **🔗 相关建议**：[S-10](security-audit.md#s-10)

---

## 📌 UX-03: 文章正文图片无点击放大（Lightbox）功能

- **📍 位置**：`src/templates/post.mjs`（文章正文渲染）
- **📝 当前状况**：readme.md 中提到"图片懒加载 + 点击放大（lightbox）"已完成（√），但当前代码中未发现 lightbox 实现。文章中的图片直接以原始尺寸显示，无法点击放大查看细节。
- **⚠️ 影响程度**：中
- **💡 建议方案**：实现轻量 lightbox：
  ```javascript
  // 为文章图片添加点击放大
  document.querySelectorAll(".article-content img").forEach(function(img) {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function() {
      const overlay = document.createElement("div");
      overlay.className = "lightbox-overlay";
      const clone = img.cloneNode();
      clone.style.cursor = "zoom-out";
      overlay.appendChild(clone);
      overlay.addEventListener("click", function() { overlay.remove(); });
      document.body.appendChild(overlay);
    });
  });
  ```
  CSS：
  ```css
  .lightbox-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.9); display: flex;
    align-items: center; justify-content: center;
    cursor: zoom-out;
  }
  .lightbox-overlay img { max-width: 90vw; max-height: 90vh; }
  ```
- **📊 预期收益**：技术文章配图可查看细节，阅读体验提升
- **🔗 相关建议**：[P-11](performance-bottlenecks.md#p-11)

---

## 📌 UX-04 [已修复]: 阅读进度条在非文章页面仍显示

- **📍 位置**：`js/coder.js`
- **✅ 修复状态**：滚动处理会检测当前是否存在活动文章；无文章页面保留 `.read-progress` 布局钩子但设置 `hidden`，避免首页、工具箱等页面显示误导性的阅读进度。
- **🧪 回归测试**：`tests/coder.test.mjs` 与 `tests/coder-deep.test.mjs` 覆盖文章页显示和非文章页隐藏。
- **📊 实际收益**：非文章页面视觉更干净，文章页阅读进度行为保持不变。
- **🔗 相关建议**：[TD-08](tech-debt.md#td-08)

---

## 📌 UX-05 [已修复]: 订阅表单无输入验证视觉反馈

- **📍 原位置**：`js/subscribe.js`、`css/coder.css`
- **✅ 修复状态**：页脚订阅表单和订阅弹窗在邮箱无效时都会添加 `.is-invalid` 与 `aria-invalid="true"`，聚焦输入框；用户继续输入时自动清除错误状态。
- **🧪 回归测试**：`tests/subscribe-deep.test.mjs` 覆盖页脚和弹窗错误态，`tests/css.test.mjs` 锁定 `.subscribe-input.is-invalid` 与 `.subscribe-modal-input.is-invalid` 样式。
- **📊 实际收益**：订阅失败原因从仅文字提示升级为文字、边框和可访问性状态同步反馈。
- **🔗 相关建议**：[B-08](bugs-and-risks.md#b-08)

---

## 📌 UX-06 [已修复]: 反馈页面无"清空全部"按钮

- **📍 位置**：`js/feedback.js`
- **✅ 修复状态**：反馈列表存在多条本地留言时，会在列表顶部显示“清空全部”按钮；用户确认后清空本地存储并回到空状态。
- **🧪 回归测试**：`tests/feedback.test.mjs` 新增批量清空确认测试，验证 DOM、空状态和 localStorage 同步清空。
- **📝 原状况**：用户可以逐条删除反馈，但没有"清空全部"按钮。如果积累了大量反馈，逐条删除很繁琐。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在反馈列表顶部添加清空按钮：
  ```javascript
  if (entries.length > 1) {
    const clearAll = document.createElement("button");
    clearAll.textContent = t("contact.fb.clearAll", "清空全部");
    clearAll.className = "feedback-clear-all";
    clearAll.addEventListener("click", function() {
      if (confirm(t("contact.fb.confirmClear", "确定清空所有反馈？"))) {
        save([]);
        render();
      }
    });
    listEl.before(clearAll);
  }
  ```
- **📊 预期收益**：反馈管理更便捷
- **🔗 相关建议**：无

---

## 📌 UX-07 [已修复]: 工具箱缺少"重置"按钮

- **📍 位置**：`js/tools.js`、`src/templates/tools.mjs`
- **✅ 修复状态**：工具面板会自动安装“重置”按钮，恢复初始输入值、清空输出和状态；UUID、时间戳、颜色、Markdown 预览、二维码等派生 UI 也会回到初始状态。按钮文案支持中英文切换。
- **🧪 回归测试**：`tests/tools.test.mjs` 覆盖重置按钮安装、JSON/时间/UUID/颜色/二维码状态恢复和 i18n 状态刷新；Playwright 移动端工具箱抽查通过。
- **📝 原状况**：工具箱的各工具（JSON 格式化、Base64 等）有输入和输出区域，但没有统一的"清空/重置"按钮。用户需要手动清空输入框。
- **⚠️ 影响程度**：低
- **💡 建议方案**：为每个工具面板添加重置按钮：
  ```html
  <button class="tool-reset" data-tool-reset="json-input">
    <i class="fas fa-eraser"></i> 重置
  </button>
  ```
  JS 处理：
  ```javascript
  if (event.target.closest("[data-tool-reset]")) {
    const targetId = event.target.closest("[data-tool-reset]")
      .getAttribute("data-tool-reset");
    const el = document.getElementById(targetId);
    if (el) el.value = "";
    // 清空输出和状态
  }
  ```
- **📊 预期收益**：工具使用更流畅
- **🔗 相关建议**：无

---

## 📌 UX-08 [已修复]: 文章分享条在移动端显示拥挤

- **📍 位置**：`src/templates/post.mjs:70-79`、`css/coder.css`
- **✅ 修复状态**：已在 480px 及以下视口让分享条换行，标签独占一行，4 个分享按钮等宽排列并允许收缩，避免窄屏拥挤。
- **🧪 回归测试**：`tests/css.test.mjs` 新增窄屏分享条布局守卫，覆盖 `.post-share`、`.share-label` 与 `.share-btn` 的移动端规则。
- **📝 原状况**：分享条包含 4 个按钮（X、微博、微信、复制链接）+ 文字标签，在窄屏设备上可能水平溢出或换行不美观。
- **⚠️ 影响程度**：低
- **💡 建议方案**：移动端改为紧凑布局：
  ```css
  @media (max-width: 480px) {
    .post-share {
      flex-wrap: wrap;
      gap: 8px;
    }
    .share-label { width: 100%; }
    .share-btn { flex: 1; min-width: 0; }
  }
  ```
- **📊 预期收益**：移动端分享体验改善
- **🔗 相关建议**：无

---

## 📌 UX-09 [已修复]: 无障碍（Accessibility）改进清单

- **📍 位置**：全站
- **✅ 修复状态**：全站已新增键盘可聚焦的 `.skip-link`，指向每页唯一的 `#main-content`；公共模板和 404、首页、about、contact、editor、overleaf 等手写页均已覆盖。
- **🧪 回归测试**：`tests/i18n-a11y.test.mjs` 扫描所有已提交 HTML，确认 skip link 和 main target 同时存在；`tests/css.test.mjs` 验证 skip link 默认隐藏、聚焦时显示。
- **📝 当前状况**：项目已有较好的 ARIA 基础（`aria-label`、`aria-expanded`、`role` 等），以下状态已更新：

  | 项目 | 现状 | 建议 |
  |------|------|------|
  | 跳过导航链接 | ✅ 已实现 | 全站链接到 `#main-content` |
  | 焦点可见性 | ⚠️ 部分 | 确保所有交互元素有 `:focus-visible` 样式 |
  | 颜色对比度 | ✅ 良好 | 暗色主题下 muted 文本对比度约 4.5:1 |
  | 表单标签 | ✅ 良好 | 所有 input 都有 label/aria-label |
  | 动画减弱 | ✅ 已实现 | `prefers-reduced-motion` 检测 |

- **📊 实际收益**：键盘用户可直接跳到主要内容，减少重复穿过导航的成本，WCAG 2.1 AA 体验更完整。
- **🔗 相关建议**：[S-05](security-audit.md#s-05)

---

## 📌 UX-10 [已修复]: 返回顶部按钮在页面刚加载时短暂可见

- **📍 原位置**：`css/coder.css`、`js/coder.js`
- **✅ 修复状态**：CSS 在 `body` 尚未带有 `.to-top-ready` 时隐藏 `.to-top`；`coder.js` 首次完成 `onScroll()` 状态计算后再添加 `.to-top-ready`，避免恢复滚动位置时出现未初始化闪烁。
- **🧪 回归测试**：`tests/css.test.mjs` 锁定初始化隐藏规则，`tests/coder-deep.test.mjs` 验证首次滚动状态计算后会标记 ready。
- **📊 实际收益**：返回顶部按钮只在状态计算完成后进入可显示状态，减少页面初始视觉抖动。
- **🔗 相关建议**：无

---

## UX 优化优先级

| 优先级 | 编号 | 影响用户范围 | 实施难度 |
|--------|------|-------------|----------|
| 🥇 | UX-03 | 文章读者 | 低 |
| 🥇 | UX-09 | 无障碍用户 | 中 |
| ✅ | UX-05 | 订阅用户 | 已完成 |
| ✅ | UX-02 | 搜索用户 | 已完成 |
| ~~🥉~~ | ~~UX-06~~ | ~~反馈用户~~ | ~~低~~ ✅ 已修复 |
| ~~🥉~~ | ~~UX-07~~ | ~~工具箱用户~~ | ~~低~~ ✅ 已修复 |
| ~~🥉~~ | ~~UX-08~~ | ~~移动端用户~~ | ~~低~~ ✅ 已修复 |
| ✅ | UX-10 | 所有用户 | 已完成 |
