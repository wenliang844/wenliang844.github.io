# PWA 离线能力与缓存策略就绪度评审

分析范围：`src/templates/layout.mjs`、`scripts/build.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`js/search.js`、`js/relay.js`、`js/tools.js`、`js/assistant.js`、`js/feedback.js`、`docs/suggestions/new-features.md`。

## 本轮验证

- `npm run test:http-smoke`：manifest 可读、图标可达，7 个路由全部可访问，包含 `/404.html` 错误页恢复入口。
- 已新增 `manifest.webmanifest`，公共模板输出 `<link rel="manifest">` 和 `theme-color`，临时构建会复制 manifest；当前仍未发现 `service-worker.js`、`sw.js`、`navigator.serviceWorker` 或 `caches.open`。
- 现有前端数据请求中，搜索索引使用 `fetch("/search-index.json", { cache: "no-cache" })`，中转站数据使用 `cache: "no-store"`；这说明不同数据源已经隐含了不同新鲜度诉求，但还没有集中缓存策略。

## 结论摘要

当前站点已具备最小 Web App Manifest，可作为后续安装能力的基础，但还不是离线 PWA。`new-features.md` 已有“PWA 离线支持”的功能建议，本报告进一步拆成工程落地视角：哪些资源适合预缓存、哪些数据必须保持 network-first 或 no-store、Service Worker 不能拦截哪些用户敏感请求，以及如何把离线能力纳入现有 smoke 和发布验证。建议继续采用分阶段策略：manifest 已落地，下一步先做只读离线 fallback，再谨慎引入运行时缓存。

## 📌 PWA-01 [部分修复]：站点已有 Web App Manifest，Service Worker 与离线阅读仍缺失

- 📌 问题/建议标题：补最小 PWA 外壳，但先保持保守缓存范围
- 📍 位置：`src/templates/layout.mjs:248-264`、`manifest.webmanifest`、`scripts/build.mjs`、仓库根目录仍缺少 `service-worker.js`、`docs/suggestions/new-features.md:205-233`
- 📝 当前状况描述：公共模板 `<head>` 已输出 favicon、manifest、theme-color、资源 hint、CSS、脚本、SEO meta 和 JSON-LD；`manifest.webmanifest` 描述站点名称、启动 URL、scope、standalone display、主题色和 favicon 图标，构建到临时目录时也会复制该文件。源码中仍没有 Service Worker 注册逻辑，用户在网络中断时还不能继续打开已读文章。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：manifest 已完成；下一阶段只加空壳注册与保守 Service Worker。Service Worker 只处理导航 fallback 与少量稳定静态资源，不缓存用户请求和外部接口。

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0f172a">
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
}
</script>
```

```json
{
  "name": "CWLBlog",
  "short_name": "CWLBlog",
  "start_url": "/",
  "display": "standalone",
  "icons": [{ "src": "/images/favicon.png", "sizes": "32x32", "type": "image/png" }]
}
```

- 📊 预期收益：支持添加到主屏幕、基础离线页、弱网下更快恢复；同时避免一开始就把动态数据和敏感请求纳入缓存。
- 🔗 相关建议引用：`docs/suggestions/new-features.md#-f-07-pwa-支持--离线阅读`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`

## 📌 PWA-02：离线预缓存清单不能手写，应从构建产物和页面资源清单派生

- 📌 问题/建议标题：用构建期 manifest 生成 Service Worker 预缓存列表
- 📍 位置：`scripts/build.mjs:536-616`、`src/page-assets.mjs:1-80`、`src/templates/layout.mjs:65-73`、`tests/templates-extended.test.mjs:23-35`
- 📝 当前状况描述：项目已经开始把页面级 CSS 放进 `src/page-assets.mjs`，公共模板也集中维护 core scripts。这是 PWA 的好基础。但如果 Service Worker 另外手写 `PRECACHE_URLS`，很容易漏掉 `/css/tools.css`、`/css/trust.css`、`/js/vendor/fuse.min.js`、`search-index.json` 或新增页面产物，造成“在线测试通过、离线打开缺资源”的漂移。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：构建时输出 `pwa-assets.json` 或直接生成 `service-worker.js` 中的版本化清单，来源包括 core CSS/JS、页面级 assets、关键路由 HTML、favicon、搜索索引和离线 fallback。

```js
const precache = [
  "/",
  "/post/",
  "/tools/",
  "/ai/",
  "/trust/",
  "/css/coder.css",
  ...CORE_SCRIPTS,
  ...Object.values(PAGE_ASSETS).flatMap((entry) => entry.styles || []),
  "/search-index.json",
  "/offline.html",
];
```

- 📊 预期收益：让离线能力跟随现有构建系统演进，减少新增页面或拆分 CSS 后忘记更新 Service Worker 的风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-resource-ownership-and-page-styles.md`、`docs/suggestions/module-reviews/build-artifact-synchronization.md`

## 📌 PWA-03：不同数据源的新鲜度和隐私级别不同，需要明确缓存策略矩阵

- 📌 问题/建议标题：为 HTML、静态资源、搜索索引、中转站数据和用户请求建立缓存分层
- 📍 位置：`js/search.js:207-224`、`js/relay.js:271-286`、`js/tools.js:1166-1180`、`js/assistant.js:600-633`
- 📝 当前状况描述：搜索索引用 `cache: "no-cache"`，适合弱一致性更新；中转站数据用 `cache: "no-store"`，适合展示较新的健康状态；助手和 API Tester 会发送用户配置的 endpoint、key、headers 和 body，绝不应该被 Service Worker 默认缓存。当前这些策略分散在各脚本里，未来引入 Service Worker 后，如果用统一 `cacheFirst` 拦截所有 GET/POST，会破坏数据新鲜度，甚至扩大敏感信息留存范围。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：先写策略矩阵，再编码 Service Worker 路由。默认只缓存 same-origin GET 的静态资源；API、表单、助手、工具箱自定义请求、第三方请求全部 network-only。

```js
function cacheStrategy(request) {
  const url = new URL(request.url);
  if (request.method !== "GET") return "network-only";
  if (url.origin !== location.origin) return "network-only";
  if (url.pathname === "/search-index.json") return "stale-while-revalidate";
  if (url.pathname === "/data/relay-providers.json") return "network-first";
  if (/\.(css|js|png|svg|woff2?)$/.test(url.pathname)) return "cache-first";
  if (request.mode === "navigate") return "network-first";
  return "network-only";
}
```

- 📊 预期收益：兼顾离线体验、数据新鲜度和隐私边界，避免 Service Worker 从性能优化变成隐藏的数据保留层。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/local-data-retention-map.md`、`docs/suggestions/module-reviews/assistant-loader-and-llm-runtime.md`

## 📌 PWA-04：离线用户体验只覆盖反馈保存，站内搜索和内容浏览缺少离线状态反馈

- 📌 问题/建议标题：补离线 fallback、搜索索引缓存状态和可见重试入口
- 📍 位置：`js/feedback.js:170-190`、`js/search.js:197-224`、`src/templates/layout.mjs:248-286`
- 📝 当前状况描述：反馈表单在提交失败时会提示“已保存到本地（当前离线或提交失败）”，这是很好的离线感知。但其他核心路径还没有离线语义：导航到未缓存文章时只会浏览器错误，搜索索引加载失败只显示“稍后重试”，用户不知道是离线、索引未缓存还是资源损坏。PWA 上线后，如果没有明确 offline fallback，用户会把缓存未命中误认为站点坏了。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增 `/offline.html` 或模板内离线 fallback，并在搜索加载失败时区分 `navigator.onLine === false`。

```js
function searchLoadErrorMessage() {
  if (navigator.onLine === false) {
    return t("dyn.search.offline", "当前离线，搜索只在索引已缓存后可用。");
  }
  return t("dyn.search.loadFail", "搜索索引加载失败，请稍后重试。");
}
```

- 📊 预期收益：用户能理解离线限制和重试路径，降低“缓存命中页面可用、未命中页面白屏”的体验落差。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-discovery-and-object-search.md`、`docs/suggestions/ux-improvements.md`

## 📌 PWA-05：Service Worker 根作用域会扩大安全边界，需先定义禁止缓存和禁止拦截范围

- 📌 问题/建议标题：为助手、API Tester、订阅、反馈和第三方请求设置 network-only 安全护栏
- 📍 位置：`src/templates/layout.mjs:45-59`、`js/assistant.js:600-633`、`js/tools.js:940-1220`、`js/subscribe.js:1-80`、`js/feedback.js:170-190`
- 📝 当前状况描述：站点 CSP 允许 Giscus、Buttondown、Web3Forms、CDN 和用户自定义 API Tester/助手 endpoint。Service Worker 一旦注册在根作用域，就有能力观察 same-origin 下的所有 fetch，也可能因为错误代码缓存带有鉴权信息的请求或响应。虽然浏览器不会让 SW 拦截跨 origin 响应体的所有细节，但错误策略仍可能导致用户配置、API 调试 URL、搜索/中转数据和离线缓存混在一起。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：在 SW 中默认拒绝缓存非 GET、带敏感 header、查询串含 token/key/signature 的请求；API Tester 与助手请求建议显式加 `cache: "no-store"` 并让 SW network-only。

```js
const SENSITIVE_QUERY = /(?:token|key|secret|signature|authorization|api_key)=/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || SENSITIVE_QUERY.test(url.search)) {
    event.respondWith(fetch(request));
    return;
  }
  // 只在明确白名单内应用缓存策略。
});
```

- 📊 预期收益：避免 PWA 引入新的隐私和安全风险，尤其保护助手 API key、API Tester 请求历史、订阅/反馈表单和第三方服务交互。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/csp-resource-policy-review.md`

## 📌 PWA-06：现有 smoke 只验证在线可用性，缺少安装清单、离线导航和缓存版本漂移测试

- 📌 问题/建议标题：把 PWA 能力纳入生产验证和 Playwright 离线冒烟
- 📍 位置：`scripts/http-smoke.mjs:9-140`、`scripts/browser-smoke.mjs:9-288`、`scripts/validate-production.mjs:266-324`
- 📝 当前状况描述：HTTP smoke 会启动本地静态服务并检查关键路由、H1 和本地脚本 HEAD；browser smoke 会检查桌面/移动关键路由、工具箱交互和横向 overflow。这些在线测试很有价值，但 PWA 上线后还需要验证 manifest 可读、图标存在、Service Worker 注册成功、离线后已缓存路由可打开、未缓存路由显示 fallback、缓存版本变更能清理旧缓存。否则 PWA 代码很可能“安装看似成功，离线实际不可用”。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：增加一个可选 `test:pwa-smoke`，用 Playwright 检查 manifest 和 offline 行为；生产验证中至少做静态 manifest/schema 检查。

```js
await page.goto(`${baseUrl}/`);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready);
await context.setOffline(true);
await page.goto(`${baseUrl}/post/`);
await expect(page.locator("main#main-content")).toBeVisible();
```

- 📊 预期收益：把“可安装、可离线、可升级”变成可回归的发布契约，而不是手动打开 DevTools 的偶然检查。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/browser-visual-smoke-testing.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`

## 建议优先级

1. 高优先级：先定义缓存策略矩阵和禁止缓存范围，防止 Service Worker 扩大隐私风险。
2. 中优先级：加入最小 Service Worker 注册，先做离线 fallback，并保持 manifest 已有检查。
3. 中优先级：从构建产物和 `PAGE_ASSETS` 派生预缓存清单，避免手写漂移。
4. 中优先级：补 PWA smoke，验证 manifest、SW 注册、离线路由和缓存升级。
5. 低优先级：再逐步做搜索索引 stale-while-revalidate、文章离线阅读和模型资源预缓存状态面板。

## 本轮健康度评分

- PWA 就绪度：3.1 / 5
- 当前强项：静态站在线 smoke 稳定，Web App Manifest 已落地并进入 HTTP smoke，资源引用集中化正在推进，部分数据请求已显式声明 `no-cache` / `no-store`。
- 主要扣分：无 Service Worker、无离线 fallback、无缓存策略矩阵、无离线/PWA 浏览器自动化测试。
