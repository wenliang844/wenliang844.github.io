# 🚀 新功能建议

> 分析日期：2026-06-18 | 基于项目现有能力和技术栈的扩展建议

---

## 2026-07-03 复查补充

### 📌 F-11: 为 API Tester 增加“隐私模式”和敏感信息脱敏保存

- **📍 位置**：`src/templates/tools.mjs:123-170`, `js/tools.js:461-529`, `js/tools.js:584-643`
- **📝 当前状况描述**：API Tester 已经具备中转站填充、发送请求和历史保存，是很实用的工具；但历史保存默认包含 header/body，缺少面向 API key 场景的隐私模式。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  [x] 隐私模式：发送后不保存历史
  [x] 保存时自动隐藏 Authorization/Cookie/x-api-key
  [ ] 保存 body
  ```
  默认开启隐私模式；当用户点击“保存请求”时弹出一次性确认，说明哪些字段会持久化。
- **📊 预期收益**：在保留调试效率的同时增强安全感，API Tester 可以更放心地承载真实开发调试场景。
- **🔗 相关建议引用**：[S-12](security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage), [UX-11](ux-improvements.md#ux-11-手势与-api-工具的隐私边界文案需要更精确)

### 📌 F-12: 手势工具增加模型缓存状态面板

- **📍 位置**：`src/templates/tools.mjs:793-870`, `js/gesture.js:160-265`, `js/gesture.js:486-515`
- **📝 当前状况描述**：手势工具功能已经覆盖手势、绘画、切水果、人脸分析和 3D 重建，但用户无法知道模型是否已缓存、当前加载到哪一步、失败时该重试哪一段。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  模型状态：
  - 手势识别模型：已缓存 / 下载中 / 失败
  - 物体检测模型：按需下载
  - 人脸分析模型：按需下载
  - 3D 引擎：按需下载
  ```
  如果后续引入 Service Worker，可提供“预缓存手势模型”按钮。
- **📊 预期收益**：让高阶交互功能从“炫技 demo”更接近可诊断、可重复使用的工具。
- **🔗 相关建议引用**：[P-14](performance-bottlenecks.md#p-14-手势工具首次启动依赖远程模型链路弱网下冷启动不可控), [S-13](security-audit.md#s-13-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束)

---

## 📌 F-01: 阅读进度持久化 — 跨设备继续阅读

- **📍 位置**：`js/coder.js`（阅读进度条）、`js/post-next.js`（下一篇推荐）
- **📝 当前状况**：阅读进度条仅在当前页面会话中有效，刷新页面后重置。用户无法记住上次读到哪里。
- **⚠️ 影响程度**：低（功能增强）
- **💡 建议方案**：
  ```javascript
  // 保存阅读位置到 localStorage
  function saveReadingPosition() {
    const article = getActiveArticle();
    if (!article) return;
    const slug = article.dataset.postSlug || "";
    const progress = getReadingProgress();
    CWLUtils.storageSet("cwl-reading:" + slug, JSON.stringify({
      scroll: window.scrollY,
      progress: progress,
      time: Date.now()
    }));
  }

  // 文章页加载时恢复
  function restoreReadingPosition(slug) {
    const saved = CWLUtils.storageGet("cwl-reading:" + slug);
    if (saved) {
      const { scroll, progress, time } = JSON.parse(saved);
      if (Date.now() - time < 7 * 24 * 60 * 60 * 1000) { // 7天内有效
        showResumeToast(progress); // "上次读到 45%，点击继续"
      }
    }
  }
  ```
- **📊 预期收益**：提升长文阅读体验，增加用户回访粘性
- **🔗 相关建议**：[UX-05](ux-improvements.md#ux-05)

---

## 📌 F-02: AI 助手接入真实 LLM API

- **📍 位置**：`js/assistant.js`
- **📝 当前状况**：AI 助手是本地规则匹配版，只能匹配预定义的关键词和页面。功能有限但隐私友好。
- **⚠️ 影响程度**：低（功能增强）
- **💡 建议方案**：分两步实现：

  **第一步：混合模式**（保持隐私 + 增强能力）
  ```javascript
  // 本地规则优先，无匹配时可选调用 LLM
  function answer(query) {
    const localResult = localMatch(query);
    if (localResult.score > 0) return localResult;

    // 用户明确要求 AI 回答时才调用 API
    if (query.startsWith("/ai ")) {
      return callLLM(query.slice(4)); // 需要后端代理
    }

    return defaultResponse();
  }
  ```

  **第二步：后端代理**
  - 使用 Cloudflare Workers / Vercel Edge Functions 作为 API 代理
  - 前端不暴露 API key
  - 添加速率限制和内容过滤

- **📊 预期收益**：AI 助手从"导航工具"升级为"智能问答"
- **🔗 相关建议**：[CQ-05](code-quality.md#cq-05), [S-03](security-audit.md#s-03)

---

## 📌 F-03: 文章评论区增强 — Waline 替代 Giscus

- **📍 位置**：`js/giscus.js`
- **📝 当前状况**：使用 Giscus（GitHub Discussions）作为评论系统。优点是免费、无需后端；缺点是要求用户有 GitHub 账号，对非技术用户不友好。
- **⚠️ 影响程度**：低（功能建议）
- **💡 建议方案**：考虑 Waline 作为替代或补充：
  - 支持匿名评论（降低参与门槛）
  - 支持 Markdown 评论
  - 部署在 Vercel（免费额度足够）
  - 支持评论管理后台
  - 可与 Giscus 并存，让用户选择

  或保持 Giscus（技术博客的读者大多有 GitHub 账号），但在评论区添加引导：
  ```html
  <p>使用 GitHub 账号登录即可评论。没有 GitHub？<a href="/contact/#feedback-title">点这里反馈</a></p>
  ```

- **📊 预期收益**：降低评论参与门槛，增加互动
- **🔗 相关建议**：[UX-06](ux-improvements.md#ux-06)

---

## 📌 F-04 [已修复]: 暗色/亮色主题跟随系统

- **📍 位置**：`js/coder.js:6-36`
- **✅ 修复状态**：主题模式升级为 `auto / light / dark`。无本地偏好时默认 `auto` 跟随 `prefers-color-scheme`，系统主题变化会实时同步；用户点击选择亮/暗后写入 localStorage，并优先于系统偏好。
- **🧪 回归测试**：`tests/coder-deep.test.mjs` 覆盖 auto 跟随系统、系统变化监听、显式偏好不被系统变化覆盖；`tests/i18n-deep.test.mjs` 覆盖主题按钮无障碍文案。
- **📊 实际收益**：默认体验更贴近用户系统设置，同时保留手动主题选择。
- **🔗 相关建议**：[UX-01](ux-improvements.md#ux-01)

---

## 📌 F-05: 文章目录（TOC）浮动跟随滚动

- **📍 位置**：`js/toc.js`、`src/templates/post.mjs:82-105`
- **📝 当前状况**：单篇页的侧边栏 TOC 是固定位置（`position: sticky`），在文章内容区域内跟随滚动。但当用户滚动到文章底部时，TOC 可能遮挡 footer 内容。
- **⚠️ 影响程度**：低
- **💡 建议方案**：添加 TOC 底部边界检测：
  ```javascript
  function updateTocPosition() {
    const footer = document.querySelector(".footer");
    if (!footer) return;
    const footerTop = footer.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    if (footerTop < viewportHeight) {
      // footer 进入视口，TOC 应该停止在 footer 上方
      tocSidebar.style.bottom = (viewportHeight - footerTop + 20) + "px";
    } else {
      tocSidebar.style.bottom = "";
    }
  }
  ```
- **📊 预期收益**：TOC 不会遮挡 footer 内容
- **🔗 相关建议**：[UX-04](ux-improvements.md#ux-04)

---

## 📌 F-06: 文章标签云可视化

- **📍 位置**：`tags/index.html`（生成页）、`src/templates/tags.mjs`
- **📝 当前状况**：标签页显示所有标签及文章数量，但没有可视化效果（如不同大小、颜色）。
- **⚠️ 影响程度**：低
- **💡 建议方案**：添加标签云效果：
  ```css
  .tag-cloud-tag[data-count="1"] { font-size: 0.875rem; opacity: 0.7; }
  .tag-cloud-tag[data-count="2"] { font-size: 1rem; }
  .tag-cloud-tag[data-count="3"] { font-size: 1.25rem; }
  .tag-cloud-tag[data-count="4+"] { font-size: 1.5rem; font-weight: 600; }
  ```
  在构建脚本中为每个标签添加 `data-count` 属性。
- **📊 预期收益**：标签页视觉吸引力提升，热门标签一目了然
- **🔗 相关建议**：[UX-07](ux-improvements.md#ux-07)

---

## 📌 F-07: PWA 支持 — 离线阅读

- **📍 位置**：全站
- **📝 当前状况**：站点没有 Service Worker，无离线能力。
- **⚠️ 影响程度**：低（功能增强）
- **💡 建议方案**：添加最小 PWA 支持：
  ```javascript
  // sw.js
  const CACHE = "cwlblog-v1";
  const ASSETS = ["/", "/css/coder.css", "/js/error-handler.js", "/js/utils.js",
                  "/js/i18n.js", "/js/coder.js", "/search-index.json"];

  self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  });

  self.addEventListener("fetch", e => {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  });
  ```
  添加 `manifest.json`：
  ```json
  { "name": "CWLBlog", "start_url": "/", "display": "standalone",
    "theme_color": "#070b14", "background_color": "#070b14" }
  ```

- **📊 预期收益**：离线可读，移动端添加到主屏幕，加载速度提升（缓存命中时）
- **🔗 相关建议**：[P-06](performance-bottlenecks.md#p-06)

---

## 📌 F-08: 文章分享到微信时显示自定义卡片

- **📍 位置**：`js/share.js`、`src/templates/post.mjs`
- **📝 当前状况**：分享到微信使用二维码方式（显示当前页面 URL 的 QR 码）。微信内打开链接时，OG 标签决定了分享卡片的显示效果。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  1. 确保 OG 标签完整（已实现 ✅）
  2. 为每篇文章生成专属分享图（使用 Vercel OG / Satori 动态生成）：
     ```
     https://og.wenliang844.workers.dev?title=文章标题&tags=Java,Spring
     ```
  3. 或在文章 front-matter 中支持 `ogImage` 字段，手动指定分享图

- **📊 预期收益**：社交平台分享效果提升，点击率增加
- **🔗 相关建议**：无

---

## 📌 F-09: 文章系列/专栏功能

- **📍 位置**：`src/posts/*.md`、`src/templates/post.mjs`
- **📝 当前状况**：每篇文章独立存在，没有"系列"概念。如果写一组相关文章（如"低代码平台实战"系列），读者无法按顺序阅读。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在 front-matter 中添加 `series` 字段：
  ```yaml
  series: "低代码平台实战"
  seriesOrder: 1
  ```
  构建时：
  1. 同系列文章互相链接（"上一篇/下一篇 in 系列"）
  2. 添加系列索引页 `/series/低代码平台实战/`
  3. 文章页显示系列导航条

- **📊 预期收益**：相关内容组织更清晰，提升读者阅读深度
- **🔗 相关建议**：[F-10](#f-10)

---

## 📌 F-10: 文章目录树（左侧导航）支持搜索高亮匹配文本

- **📍 位置**：`js/blog.js:88-100`
- **📝 当前状况**：搜索框只过滤文章列表的显示/隐藏，不显示匹配的上下文。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在搜索结果中高亮匹配文本：
  ```javascript
  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  // 在 tree-title 中显示高亮
  titleEl.innerHTML = highlightMatch(title, query);
  ```
  注意：需要先用 `escapeHtml` 处理原文。
- **📊 预期收益**：搜索结果更直观
- **🔗 相关建议**：[B-03](bugs-and-risks.md#b-03)

---

## 功能优先级排序

| 优先级 | 编号 | 价值 | 实现难度 | 推荐度 |
|--------|------|------|----------|--------|
| 🥇 | F-04 | 用户体验 | 低 | ⭐⭐⭐⭐⭐ |
| 🥇 | F-06 | 视觉效果 | 低 | ⭐⭐⭐⭐ |
| 🥈 | F-01 | 阅读体验 | 中 | ⭐⭐⭐⭐ |
| 🥈 | F-10 | 搜索体验 | 低 | ⭐⭐⭐⭐ |
| 🥈 | F-09 | 内容组织 | 中 | ⭐⭐⭐ |
| 🥉 | F-07 | 离线能力 | 中 | ⭐⭐⭐ |
| 🥉 | F-05 | TOC 体验 | 低 | ⭐⭐⭐ |
| 🥉 | F-08 | 社交分享 | 中 | ⭐⭐ |
| 📋 | F-02 | AI 能力 | 高 | ⭐⭐ |
| 📋 | F-03 | 评论系统 | 高 | ⭐⭐ |
