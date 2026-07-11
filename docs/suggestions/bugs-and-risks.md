# 🐛 潜在 Bug 与崩溃风险分析

> 分析日期：2026-06-18 | 分析范围：全站 JS / 构建脚本 / HTML 模板

---

## 2026-07-03 复查补充

### 📌 B-13: 生产验证脚本默认会覆盖根目录构建产物

- **📍 位置**：`scripts/validate-production.mjs:222-254`, `scripts/build.mjs:31-35`, `scripts/build.mjs:586-608`
- **📝 当前状况描述**：`validate-production.mjs` 的 `checkBuild()` 直接执行 `node scripts/build.mjs`，而 `build.mjs` 默认输出到项目根目录，会重写 `post/*/index.html`、`post/index.html`、`tags/index.html`、`categories/index.html`、`tools/index.html`、`sitemap.xml`、`robots.txt`、`index.xml`、`search-index.json` 等产物。本轮运行后没有产生 Git diff，但“验证”脚本具备写入副作用，不适合只读质量门禁。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const outDir = join(ROOT, "temp", "production-validate");
  await execFileAsync("node", ["scripts/build.mjs", "--out", outDir], { cwd: ROOT });
  // 后续检查 join(outDir, output)，最后清理 temp 目录
  ```
  或新增 `npm run build:check`，固定输出到临时目录，CI 和 `validate:production` 全部使用该命令。
- **📊 预期收益**：避免本地验证污染工作区，减少生成文件意外混入业务提交的风险。
- **🔗 相关建议引用**：[DE-11](devex-improvements.md#de-11-把生产验证改造成真正只读的质量门禁), [DE-05](devex-improvements.md#de-05)

### 📌 B-14: 工具箱按需脚本加载 Promise 过早 resolve，手势页存在初始化竞态

- **📍 位置**：`js/tools.js:68-92`, `js/tools.js:312-315`, `js/tools.js:842-846`, `js/gesture.js:2339-2341`
- **📝 当前状况描述**：`loadScript()` 创建 `<script>` 后立即 `return Promise.resolve()`，没有等待 `onload`。用户切换到 Galaxy/Gesture 面板后，面板已可交互，但 `gesture.js` 可能尚未执行到按钮事件绑定。极端弱网或 CDN 阻塞时，用户点击“开启摄像头”可能没有反应，且当前只在 console warn。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  loadedToolRuntimes[id] = Promise.all(scripts.map(loadScript));
  ```
  UI 层在 runtime 加载中禁用该面板关键按钮，失败时在 `tool-status` 中展示可恢复错误。
- **📊 预期收益**：消除弱网竞态，提升视觉/摄像头工具的可预期性和可诊断性。
- **🔗 相关建议引用**：[MR-TOOLS-02](module-reviews/tools-gesture-and-api.md#mr-tools-02-按需-runtime-加载没有等待脚本执行完成), [P-14](performance-bottlenecks.md#p-14-手势工具首次启动依赖远程模型链路弱网下冷启动不可控)

### 📌 B-15: AI 助手模式偏好写入后不会被恢复

- **📍 位置**：`js/assistant.js:31`, `js/assistant.js:337-339`, `js/assistant.js:1306-1309`
- **📝 当前状况描述**：`MODE_KEY` 已定义，`applyMode()` 也会把用户选择的 `site` / `llm` 写入 localStorage，但 `readMode()` 固定返回 `"llm"`。用户切到“站点模式”后刷新页面会重新回到大模型模式，保存逻辑与读取逻辑不对称。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  function readMode() {
    const saved = storageGet(MODE_KEY);
    if (saved === "site" || saved === "llm") {
      return saved;
    }
    return "site";
  }
  ```
  如果产品仍希望默认展示 LLM，可在没有 API key 且没有体验代理时回落到 `site`，避免新用户默认进入网络请求路径。
- **📊 预期收益**：恢复用户偏好的一致性，减少刷新后误入大模型模式和误解隐私边界的概率。
- **🔗 相关建议引用**：[MR-AST-02](module-reviews/assistant-deep-dive.md#mr-ast-02-模式偏好保存与读取不对称), [UX-13](ux-improvements.md#ux-13-ai-助手默认模式与隐私文案需要重新对齐)

### 📌 B-16: AI 助手 SSE 流结束时可能丢失最后一个未闭合事件

- **📍 位置**：`js/assistant.js:594-649`
- **📝 当前状况描述**：`postStream()` 每次把 `buffer.split("\n\n")` 的最后一段留作未完成事件，但 `reader.read()` 返回 `done` 后直接 `break`，没有调用 `decoder.decode()` flush，也没有处理剩余 `buffer`。如果中转站最后一个 `data:` 事件没有以空行结尾，最后一段 delta 可能不会进入 `onDelta()`。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  function consumeEvent(eventText) {
    eventText.split("\n").forEach(consumeLine);
  }

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    events.forEach(consumeEvent);
  }
  ```
  同时增加一个单元测试：模拟最后一个 SSE 事件不带尾随 `\n\n`，断言回答文本完整。
- **📊 预期收益**：提升流式回答完整性，避免少数中转站或代理实现差异导致尾句缺失。
- **🔗 相关建议引用**：[MR-AST-03](module-reviews/assistant-deep-dive.md#mr-ast-03-sse-解析缺少流结束收尾处理), [DE-13](devex-improvements.md#de-13-为-ai-助手和-cron-边界行为补充回归测试)

---

## 📌 B-01 [已修复]: `coder.js` 中 `draw()` 递归动画无法停止，离开页面持续消耗资源

- **📍 位置**：`js/coder.js`
- **✅ 修复状态**：`draw()` 不再无条件递归调度；粒子队列为空时停止，页面隐藏时取消待执行帧，重新移动指针时再按需启动。
- **🧪 回归测试**：新增 jsdom fake canvas 测试，验证 idle 不启动、pointermove 启动、粒子耗尽停止。
- **📊 实际收益**：后台标签页和鼠标静止场景不再持续消耗动画帧预算。
- **🔗 相关建议**：[P-01 性能瓶颈](performance-bottlenecks.md#p-01)

---

## 📌 B-02 [已修复]: `coder.js` 粒子数组 splice 在遍历中执行，可能导致跳过元素

- **📍 原位置**：`js/coder.js`
- **✅ 修复状态**：粒子删除已使用 `removeParticle(index)` 的 swap-and-pop 策略，避免在动画热路径中调用 `splice()`。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 新增源码守卫，确认粒子热路径不包含 `.splice(`，并保留 `removeParticle()`、尾元素交换和 `pop()`。
- **📊 实际收益**：降低粒子高频过期删除时的数组搬移和 GC 压力。
- **🔗 相关建议**：[B-01](#b-01)

---

## 📌 B-03 [已修复]: `search.js` 中 `list.innerHTML = ""` 后紧跟 `innerHTML =` 赋值，混合使用 DOM API

- **📍 原位置**：`js/search.js`
- **✅ 修复状态**：搜索结果标题、标签和摘要高亮已改用 `appendHighlightedText()` 构建 text node 与 `<mark>` 节点，列表清空改用 `replaceChildren()`。
- **🧪 回归测试**：`tests/security.test.mjs` 新增源码测试，确认搜索结果不再使用 `titleDiv.innerHTML`、`tagEl.innerHTML`、`snippetDiv.innerHTML`。
- **📊 实际收益**：保留搜索高亮体验，同时消除结果渲染中的维护型 XSS 注入面。
- **🔗 相关建议**：[S-01 安全审计](security-audit.md#s-01)

---

## 📌 B-04 [已修复]: `giscus.js` 中 `thread.innerHTML = placeholder()` 使用 innerHTML 注入含 `<code>` 标签的文本

- **📍 原位置**：`js/giscus.js`
- **✅ 修复状态**：未配置 giscus 时的占位提示已改为 `createPlaceholder()` + `thread.replaceChildren(...)`，不再把 i18n 文案直接赋值给 `innerHTML`。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 新增源码测试，确认 `giscus.js` 不再对 `thread.innerHTML` 赋值。
- **📊 实际收益**：保留 `<code>` 视觉语义，同时消除翻译文案被篡改时的潜在 HTML 注入面。
- **🔗 相关建议**：[B-03](#b-03), [S-01](security-audit.md#s-01)

---

## 📌 B-05 [已修复]: `coder.js` 中 `readingMinutes` 与 `build.mjs` 中重复定义，行为可能漂移

- **📍 原位置**：`js/coder.js`、`js/editor.js` 和 `scripts/build.mjs`
- **✅ 修复状态**：构建端阅读时间已提取到 `src/lib/reading.mjs`，`scripts/build.mjs` 复用并重新导出该 helper；客户端统一通过 `CWLUtils.readingMinutes()` 供 `coder.js` 与 `editor.js` 调用。
- **🧪 回归测试**：`tests/build-extended.test.mjs` 验证 build re-export 与共享 helper 一致，`tests/utils.test.mjs` 覆盖客户端 helper，`tests/editor.test.mjs` 覆盖编辑器统计复用路径。
- **📊 实际收益**：消除 SSR 占位、文章页运行时和编辑器统计之间的阅读时间算法漂移风险。
- **🔗 相关建议**：[CQ-02 代码重复](code-quality.md#cq-02)

---

## 📌 B-06 [已修复]: `extractToc()` 和 `renderContent()` 中标题 ID 生成逻辑重复，且不处理重复标题

- **📍 位置**：`scripts/build.mjs`
- **✅ 修复状态**：标题 ID 生成已提取到共享流程，正文标题和 TOC 使用同一次 `renderHeadings()` 结果；重复标题会追加 `-2`, `-3` 后缀。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖重复 h2/h3 标题，并验证 TOC id 与正文 `id` 一致。
- **📊 实际收益**：消除重复标题导致的 TOC 跳转错乱，并减少 `extractToc()` / `renderContent()` 逻辑漂移。
- **🔗 相关建议**：[B-07](#b-07)

---

## 📌 B-07 [已修复]: `coder.js` 的 `buildToc()` 与构建脚本的 `extractToc()` 双重生成 TOC

- **📍 位置**：`js/coder.js:276-327` 和 `scripts/build.mjs:147-162`
- **✅ 修复状态**：`coder.js` 新增 `hasServerRenderedToc()`，检测单篇页 `.post-layout` 内已有 `.toc-sidebar` 时跳过动态 `.article-toc` 构建；博客列表页仍按需动态生成目录。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 覆盖 SSR TOC 存在时不再创建重复动态 TOC。
- **📊 实际收益**：单篇文章页不再重复扫描标题和追加第二套目录，减少客户端计算与视觉重复风险。
- **🔗 相关建议**：[B-06](#b-06)

---

## 📌 B-08: `subscribe.js` 使用 `mode: "no-cors"` 提交表单，无法判断服务端是否成功

- **📍 位置**：`js/subscribe.js:34-45`
- **📝 当前状况**：`fetch(ENDPOINT, { method: "POST", mode: "no-cors", body })` 后直接在 `.then()` 中显示成功消息。由于 `no-cors` 模式下响应体不可读，即使服务端返回 4xx/5xx，前端也会显示"差一步！请查收确认邮件完成订阅。"。
- **⚠️ 影响程度**：中
- **💡 建议方案**：这是 Buttondown embed 端点的限制（不支持 CORS），无法在前端修复。建议在 UI 文案中说明"提交后请检查邮箱确认"，并添加重试按钮。长期方案是自建订阅代理端点。
- **📊 预期收益**：用户不会误以为订阅已成功，减少困惑
- **🔗 相关建议**：[F-01 新功能建议](new-features.md#f-01)

---

## 📌 B-09 [已修复]: `performance-monitor.js` 使用已废弃的 `performance.timing` API

- **📍 位置**：`js/performance-monitor.js`
- **✅ 修复状态**：导航时序采集已改用 `performance.getEntriesByType("navigation")[0]`，不再引用废弃的 `performance.timing`。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 新增源码测试，确认使用 Navigation Timing Level 2 且不包含 `performance.timing`。
- **📊 实际收益**：消除废弃 API 使用点，兼容未来浏览器性能 API 演进。
- **🔗 相关建议**：[TD-01 技术债务](tech-debt.md#td-01)

---

## 📌 B-10 [已修复]: `feedback.js` 中 `formatTime` 使用 `isNaN(date.getTime())` 但未用 `Number.isNaN`

- **📍 位置**：`js/feedback.js`
- **✅ 修复状态**：`formatTime()` 已改用 `Number.isNaN(date.getTime())`，避免全局 `isNaN` 的隐式类型转换。
- **🧪 回归测试**：`tests/feedback.test.mjs` 新增源码测试，防止日期校验回退到全局 `isNaN`。
- **📊 实际收益**：代码风格与其他时间处理模块一致，消除潜在的类型转换维护风险。
- **🔗 相关建议**：[CQ-01 代码质量](code-quality.md#cq-01)

---

## 📌 B-11 [已修复]: `coder.js` 中 `window.pageYOffset` 已废弃

- **📍 位置**：`js/coder.js`、`js/toc.js`
- **✅ 修复状态**：滚动偏移读取改用 `window.scrollY`，并在 `toc.js` 中保留 `document.documentElement.scrollTop` fallback。
- **🧪 回归测试**：`tests/coder.test.mjs` 与 `tests/coder-deep.test.mjs` 覆盖滚动初始化路径。
- **📊 实际收益**：跟进现代 Web API，避免继续扩散废弃别名。
- **🔗 相关建议**：[TD-01](tech-debt.md#td-01)

---

## 📌 B-12 [已修复]: `blog.js` 中 `editing()` 函数与 `search.js`、`search-loader.js` 重复定义

- **📍 位置**：`js/blog.js`、`js/search.js`、`js/search-loader.js`
- **✅ 修复状态**：快捷键模块统一调用 `window.CWLUtils.isEditing()`，删除重复的 DOM tag 判断。
- **🧪 回归测试**：`tests/js-behavior.test.mjs` 锁定公共 helper 复用；`tests/blog.test.mjs` 继续验证输入框聚焦时 J/K 快捷键不会切换文章。
- **📊 实际收益**：消除 3 处重复代码，避免未来只改一处导致快捷键行为漂移。
- **🔗 相关建议**：[CQ-02](code-quality.md#cq-02)

---

## 问题统计

| 等级 | 数量 | 编号 |
|------|------|------|
| 🔴 高 | 0 | — |
| 🟡 中 | 1 | B-08 |
| ✅ 已修复 | 11 | B-01, B-02, B-03, B-04, B-05, B-06, B-07, B-09, B-10, B-11, B-12 |
| 🟢 低 | 0 | — |

> 整体评估：无高危 Bug，代码质量良好。主要风险集中在维护一致性（重复逻辑）和废弃 API 使用上。
