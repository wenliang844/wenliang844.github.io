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

## 📌 B-03: `search.js` 中 `list.innerHTML = ""` 后紧跟 `innerHTML =` 赋值，混合使用 DOM API

- **📍 位置**：`js/search.js:279-357`
- **📝 当前状况**：`render()` 函数先用 `list.innerHTML = ""` 清空结果，然后用 `document.createElement` 安全构建每个结果项，但 `titleDiv.innerHTML = highlightText(...)` 和 `snippetDiv.innerHTML = snippet(...)` 仍使用 innerHTML。虽然 `highlightText` 和 `snippet` 都经过 `escapeHtml` 处理，但这种混合模式增加了未来维护时引入 XSS 的风险。
- **⚠️ 影响程度**：低（当前实现安全，但维护风险高）
- **💡 建议方案**：统一使用 DOM API 构建，或在 `highlightText` 中使用 `Range` API 做高亮而非字符串拼接
- **📊 预期收益**：消除潜在 XSS 向量，代码一致性提升
- **🔗 相关建议**：[S-02 安全审计](security-audit.md#s-02)

---

## 📌 B-04: `giscus.js` 中 `thread.innerHTML = placeholder()` 使用 innerHTML 注入含 `<code>` 标签的文本

- **📍 位置**：`js/giscus.js:33-46`
- **📝 当前状况**：当 giscus 未配置时，`placeholder()` 返回含 `<code>` 标签的 HTML 字符串并直接赋值给 `innerHTML`。虽然当前内容是硬编码的 i18n 文案（不含用户输入），但 `t()` 函数返回值如果被篡改（如通过恶意翻译插件），可能引入 XSS。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  function placeholder() {
    const p = document.createElement("p");
    p.className = "comments-hint";
    // 分段构建，code 标签用 DOM API
    const prefix = document.createTextNode(t("dyn.comments.prefix", "评论区尚未配置。"));
    p.appendChild(prefix);
    // ...
  }
  ```
- **📊 预期收益**：消除潜在 innerHTML XSS 向量
- **🔗 相关建议**：[B-03](#b-03), [S-01](security-audit.md#s-01)

---

## 📌 B-05: `coder.js` 中 `readingMinutes` 与 `build.mjs` 中重复定义，行为可能漂移

- **📍 位置**：`js/coder.js:221-229` 和 `scripts/build.mjs:274-282`
- **📝 当前状况**：阅读时间计算逻辑在客户端（coder.js）和服务端（build.mjs）各实现了一份。两处使用相同的 `READING_SPEED_CHINESE = 350` 和 `READING_SPEED_ENGLISH = 200` 常量，但没有共享机制。如果只修改一处，SSR 占位值与客户端计算值将不一致，导致阅读时间闪烁。
- **⚠️ 影响程度**：中
- **💡 建议方案**：将常量提取到 `src/lib/reading.mjs` 并在构建脚本中导入；客户端通过内联 `<script>` 设置全局常量 `window.READING_SPEED_CHINESE = 350`
- **📊 预期收益**：消除 SSR/CSR 不一致风险，单一数据源
- **🔗 相关建议**：[CQ-02 代码重复](code-quality.md#cq-02)

---

## 📌 B-06 [已修复]: `extractToc()` 和 `renderContent()` 中标题 ID 生成逻辑重复，且不处理重复标题

- **📍 位置**：`scripts/build.mjs`
- **✅ 修复状态**：标题 ID 生成已提取到共享流程，正文标题和 TOC 使用同一次 `renderHeadings()` 结果；重复标题会追加 `-2`, `-3` 后缀。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖重复 h2/h3 标题，并验证 TOC id 与正文 `id` 一致。
- **📊 实际收益**：消除重复标题导致的 TOC 跳转错乱，并减少 `extractToc()` / `renderContent()` 逻辑漂移。
- **🔗 相关建议**：[B-07](#b-07)

---

## 📌 B-07: `coder.js` 的 `buildToc()` 与构建脚本的 `extractToc()` 双重生成 TOC

- **📍 位置**：`js/coder.js:276-327` 和 `scripts/build.mjs:147-162`
- **📝 当前状况**：构建脚本在 SSR 时生成 TOC 数据（`post.toc`），但 `coder.js` 在客户端又重新扫描 DOM 构建 TOC。这意味着每篇文章的 TOC 会被生成两次——构建期一次（虽然当前未直接用于渲染），运行时一次。构建期生成的 `post.toc` 仅被 `renderToc()`（post.mjs:82-105）用于渲染单篇页的侧边栏 TOC，而列表页的 TOC 由 `coder.js` 的 `buildToc()` 动态生成。
- **⚠️ 影响程度**：低
- **💡 建议方案**：明确职责划分——单篇页 TOC 完全由 SSR 渲染（已实现），列表页 TOC 由 `coder.js` 动态生成（合理，因为面板切换时需要重建）。但应删除 `coder.js` 中对单篇页重复构建 TOC 的逻辑（通过检测是否已有 `.article-toc` 来跳过）。
- **📊 预期收益**：避免单篇页 TOC 闪烁，减少客户端计算
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
| 🟡 中 | 2 | B-05, B-08 |
| ✅ 已修复 | 6 | B-01, B-06, B-09, B-10, B-11, B-12 |
| 🟢 低 | 4 | B-02, B-03, B-04, B-07 |

> 整体评估：无高危 Bug，代码质量良好。主要风险集中在维护一致性（重复逻辑）和废弃 API 使用上。
