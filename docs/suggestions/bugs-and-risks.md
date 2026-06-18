# 🐛 潜在 Bug 与崩溃风险分析

> 分析日期：2026-06-18 | 分析范围：全站 JS / 构建脚本 / HTML 模板

---

## 📌 B-01 [已修复]: `coder.js` 中 `draw()` 递归动画无法停止，离开页面持续消耗资源

- **📍 位置**：`js/coder.js`
- **✅ 修复状态**：`draw()` 不再无条件递归调度；粒子队列为空时停止，页面隐藏时取消待执行帧，重新移动指针时再按需启动。
- **🧪 回归测试**：新增 jsdom fake canvas 测试，验证 idle 不启动、pointermove 启动、粒子耗尽停止。
- **📊 实际收益**：后台标签页和鼠标静止场景不再持续消耗动画帧预算。
- **🔗 相关建议**：[P-01 性能瓶颈](performance-bottlenecks.md#p-01)

---

## 📌 B-02: `coder.js` 粒子数组 splice 在遍历中执行，可能导致跳过元素

- **📍 位置**：`js/coder.js:520-529`
- **📝 当前状况**：`draw()` 函数中使用 `for (let index = particles.length - 1; index >= 0; index -= 1)` 倒序遍历并在 `splice` 后 `continue`。虽然倒序遍历 + splice 在逻辑上是正确的，但 `splice` 在高频调用（60fps）中每帧可能执行多次，产生 GC 压力。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  // 用 swap-and-pop 替代 splice，避免数组重分配
  function removeParticle(index) {
    particles[index] = particles[particles.length - 1];
    particles.pop();
  }
  ```
- **📊 预期收益**：减少 GC 暂停，动画更流畅
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
| ✅ 已修复 | 10 | B-01, B-03, B-04, B-05, B-06, B-07, B-09, B-10, B-11, B-12 |
| 🟢 低 | 1 | B-02 |

> 整体评估：无高危 Bug，代码质量良好。主要风险集中在维护一致性（重复逻辑）和废弃 API 使用上。
