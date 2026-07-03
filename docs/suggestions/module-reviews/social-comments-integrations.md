# 社交分享与评论集成韧性分析

本轮聚焦文章分享、微信二维码、微博/X 分享入口与 Giscus 评论集成。现有测试覆盖了分享 URL 编码、二维码 XSS 防护、订阅与反馈主流程、Giscus switch 模式、占位提示与 observer 清理，说明主路径质量较稳；剩余风险主要集中在生产环境 canonical 分享、第三方脚本失败降级、评论隐私/性能成本和站内状态同步。

## 验证记录

- 测试命令：`node --test tests/share.test.mjs tests/subscribe.test.mjs tests/subscribe-deep.test.mjs tests/feedback.test.mjs tests/giscus-behavior.test.mjs tests/share-subscribe-feedback-deep.test.mjs`
- 结果：70/70 通过
- 覆盖范围：X/微博/微信分享、复制链接失败兜底、二维码安全渲染、订阅弹窗、反馈本地保存、Giscus 单页与列表切换行为

## 建议清单

### 1. 分享 URL 依赖当前 `location.origin`，本地或预览环境可能分享错误域名

- 📌 问题/建议标题：分享链接应优先使用 canonical URL 或 `SITE.baseURL`
- 📍 位置：`js/share.js:14-35`、`src/templates/post.mjs:82-90`、`src/config.mjs:11-13`
- 📝 当前状况描述：文章模板把 `data-share-url` 渲染为 `/post/<slug>/` 相对路径，运行时 `share.js` 用 `window.location.origin` 拼接绝对地址。生产环境域名正确时没有问题，但本地调试、预览部署、镜像站或临时域名下点击分享/复制，会把 `localhost`、预览域或镜像域分享出去。站点模板已经输出 canonical URL，构建配置也有 `SITE.baseURL`，但分享模块没有复用它。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：优先读取当前页面 canonical；列表页每篇文章可由模板直接输出绝对 canonical 分享 URL，避免运行时根据 origin 猜测。

```js
function canonicalOrigin() {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical || !canonical.href) return window.location.origin;
  return new URL(canonical.href).origin;
}

function absUrl(path) {
  if (/^https?:/i.test(path)) return path;
  return canonicalOrigin() + path;
}
```

或者在构建期输出：

```js
const url = `${SITE.baseURL}/post/${post.slug}/`;
return `<div class="post-share" data-share-url="${escapeAttr(url)}">`;
```

- 📊 预期收益：保证社交平台、复制链接和二维码指向稳定生产 URL，减少预览环境误传播和 SEO canonical 不一致。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md`、`docs/suggestions/module-reviews/seo-analysis.md`

### 2. 评论脚本在文章页立即加载，缺少视口触发或用户同意层

- 📌 问题/建议标题：Giscus 可改为接近评论区时懒加载，或提供显式“加载评论”按钮
- 📍 位置：`src/templates/post.mjs:254-263`、`src/templates/post.mjs:397-413`、`js/giscus.js:99-102`、`js/giscus.js:125-136`
- 📝 当前状况描述：单篇页和文章列表页都会把 `/js/giscus.js` 作为 defer 脚本加载；脚本执行后会立即向 `https://giscus.app/client.js` 注入第三方脚本。很多用户只阅读正文顶部或中部，不一定滚动到评论区，但仍会承担第三方脚本连接、执行和 iframe 初始化成本；从隐私角度看，也会在用户未表达评论意图前接触第三方服务。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：保留评论容器和占位文案，使用 `IntersectionObserver` 在评论区接近视口时加载；若想更重视隐私，可先显示“加载评论”按钮，点击后再注入脚本。

```js
function loadCommentsOnce() {
  if (thread.dataset.loaded === "true") return;
  thread.dataset.loaded = "true";
  thread.appendChild(buildScript(currentOptions()));
}

const observer = new IntersectionObserver(function (entries) {
  if (entries.some((entry) => entry.isIntersecting)) {
    loadCommentsOnce();
    observer.disconnect();
  }
}, { rootMargin: "600px 0px" });

observer.observe(thread);
```

- 📊 预期收益：减少首屏和短阅读路径的第三方成本，降低不必要的外部连接暴露，同时保留评论能力。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`、`docs/suggestions/performance-bottlenecks.md`

### 3. Giscus 加载失败时评论区可能长期空白

- 📌 问题/建议标题：为第三方评论脚本增加 `onerror`、超时和可操作降级
- 📍 位置：`js/giscus.js:76-102`、`js/giscus.js:125-136`
- 📝 当前状况描述：已配置 Giscus 时，代码只 append `https://giscus.app/client.js`，没有监听脚本加载失败、超时或 iframe 初始化失败。若用户网络屏蔽 giscus、CSP 配置回退、浏览器扩展拦截或第三方服务临时不可用，评论区可能没有明确提示，用户会误以为页面没有评论功能。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：包装脚本注入流程，设置超时 fallback，并提供可操作替代入口，例如跳转到联系页或 GitHub Discussions。

```js
function renderCommentsFallback(reason) {
  const p = document.createElement("p");
  p.className = "comments-hint";
  p.textContent = t("dyn.comments.loadFail", "评论加载失败，可稍后重试或通过留言页反馈。");
  thread.replaceChildren(p);
  if (window.CWLLogger) {
    window.CWLLogger.warn("Giscus load failed", { reason: reason });
  }
}

const script = buildScript(opts);
const timer = window.setTimeout(function () {
  renderCommentsFallback("timeout");
}, 8000);
script.onload = function () { window.clearTimeout(timer); };
script.onerror = function () {
  window.clearTimeout(timer);
  renderCommentsFallback("script-error");
};
```

- 📊 预期收益：把第三方不可用从“沉默空白”变成可恢复体验，提升问题诊断能力和用户信任。
- 🔗 相关建议引用：`docs/suggestions/full-browser-audit-2026-07-03.md`、`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`

### 4. Giscus 语言和主题不会跟随站内切换即时同步

- 📌 问题/建议标题：将站内语言/主题状态同步到 Giscus iframe
- 📍 位置：`js/giscus.js:15-23`、`js/giscus.js:76-95`、`js/coder.js:42-47`
- 📝 当前状况描述：Giscus 默认配置固定 `lang: "zh-CN"`，主题使用 `preferred_color_scheme`。站点自身支持中英文切换和 auto/light/dark 三态主题；但已加载的 Giscus iframe 不会在 `cwl:langchange` 或主题按钮切换后收到 `setConfig` 更新。用户可能看到页面正文已切为英文，评论 UI 仍是中文；或者站内手动浅色/深色与评论 iframe 主题不一致。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：站点主题切换时派发自定义事件，Giscus 模块监听语言与主题变化，并用官方 `postMessage({ giscus: { setConfig } })` 更新 iframe。

```js
function setGiscusConfig(partial) {
  const frame = thread.querySelector("iframe.giscus-frame");
  if (!frame || !frame.contentWindow) return;
  frame.contentWindow.postMessage(
    { giscus: { setConfig: partial } },
    "https://giscus.app"
  );
}

document.addEventListener("cwl:langchange", function () {
  setGiscusConfig({ lang: window.cwlLang && window.cwlLang() === "en" ? "en" : "zh-CN" });
});

document.addEventListener("cwl:themechange", function (event) {
  setGiscusConfig({ theme: event.detail.actualTheme === "dark" ? "dark" : "light" });
});
```

- 📊 预期收益：评论区与站内语言、主题保持一致，减少跨 iframe 的割裂感，也让主题切换测试更完整。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/module-reviews/core-reading-interactions.md`

### 5. Giscus 使用非严格映射，长期可能出现讨论串漂移

- 📌 问题/建议标题：对文章评论启用严格映射或统一 specific term
- 📍 位置：`js/giscus.js:86-91`、`src/templates/post.mjs:254-256`、`src/templates/post.mjs:397-400`
- 📝 当前状况描述：`buildScript()` 固定设置 `data-strict="0"`。列表页 switch 模式首次加载时使用 `mapping: "specific"` 和 `/post/<slug>/` term，稳定性较好；单篇页则使用默认 `mapping: "pathname"` 且 strict 为 0。未来若站点迁移路径、存在尾斜杠差异、预览环境路径不同或 GitHub Discussion 搜索匹配发生变化，非严格映射更容易关联到非预期讨论。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：文章页也显式传入 canonical pathname 作为 term，并将 strict 设为 1；如果需要兼容旧讨论，可提供迁移映射表或短期保持旧 term。

```js
function currentPostTerm() {
  const article = document.querySelector("article[data-post-slug]");
  if (article && article.dataset.postSlug) {
    return "/post/" + article.dataset.postSlug + "/";
  }
  return window.location.pathname;
}

thread.appendChild(buildScript({
  mapping: "specific",
  term: currentPostTerm(),
  strict: "1"
}));
```

- 📊 预期收益：降低评论串误匹配和未来 URL 迁移成本，尤其适合长期积累技术文章评论的站点。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/content-publishing-quality-gates.md`

### 6. 微博分享窗口缺少弹窗拦截后的降级反馈

- 📌 问题/建议标题：`window.open` 返回 `null` 时应回退到普通链接或复制分享地址
- 📍 位置：`js/share.js:208-213`、`src/templates/post.mjs:86-89`
- 📝 当前状况描述：微博分享按钮通过 `window.open(weibo, "_blank", "noopener")` 打开分享页。大多数浏览器会允许由用户点击触发的新窗口，但在严格弹窗策略、隐私插件或 WebView 环境中，`window.open` 可能返回 `null`。当前没有检测返回值，也没有把按钮临时改为普通链接或提示用户复制链接。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：检测 `window.open` 返回值，失败时将当前触发元素升级为可访问链接，或调用已有复制/二维码兜底。

```js
const opened = window.open(weibo, "_blank", "noopener");
if (!opened) {
  if (trigger.tagName.toLowerCase() === "a") {
    trigger.href = weibo;
    trigger.target = "_blank";
    trigger.rel = "noopener";
  } else {
    copyText(weibo).catch(function () {
      showQr(url, title);
    });
  }
}
```

- 📊 预期收益：提升 WebView、企业浏览器和强隐私配置下的分享可用性，避免点击无反馈。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/ux-improvements.md`

## 优先级建议

1. 优先处理 canonical 分享 URL 和 Giscus 加载失败 fallback，这两项最容易在生产或预览环境中造成用户可见问题。
2. 随后实现评论懒加载/显式加载，兼顾性能和隐私。
3. 最后补齐 Giscus 语言/主题同步、strict 映射和微博弹窗拦截兜底，提升长期维护韧性。

