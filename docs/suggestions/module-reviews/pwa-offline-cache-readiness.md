# PWA 离线能力与缓存策略就绪度评审

分析范围：`src/templates/layout.mjs`、`src/pwa-cache-policy.mjs`、`src/pwa-precache.mjs`、`src/service-worker-template.mjs`、`scripts/build.mjs`、`scripts/generate-service-worker.mjs`、`scripts/check-pwa-precache.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`scripts/pwa-smoke.mjs`、`js/search.js`、`js/relay.js`、`js/tools.js`、`js/assistant.js`、`js/feedback.js`、`docs/suggestions/new-features.md`。

## 本轮验证

- `npm run test:http-smoke`：manifest 可读、图标可达，PWA 离线页和 Service Worker artifact 可达，7 个路由全部可访问，包含 `/404.html` 错误页恢复入口。
- 已新增 `manifest.webmanifest`、`/offline.html`、`/service-worker.js` 和 `/js/pwa-register.js`；公共模板输出 `<link rel="manifest">`、`theme-color` 和 PWA 注册脚本，临时构建会复制 manifest、offline fallback，并通过 `src/service-worker-template.mjs` 生成 Service Worker。
- 现有前端数据请求中，搜索索引使用 `fetch("/search-index.json", { cache: "no-cache" })`，中转站数据使用 `cache: "no-store"`；这说明不同数据源已经隐含了不同新鲜度诉求，但还没有集中缓存策略。
- 已新增 `src/pwa-cache-policy.mjs` 和 `tests/pwa-cache-policy.test.mjs`，把导航、静态资源、搜索索引、动态数据、敏感/外部请求的缓存策略矩阵变成可执行契约；测试会加载 Service Worker 并校验其镜像策略一致。预缓存清单也已新增 `src/pwa-precache.mjs` 与 `scripts/check-pwa-precache.mjs`，校验 19 个预缓存 URL 与 Service Worker 一致、本地文件存在、生成物所有权归属、Font Awesome 字体引用覆盖、2 个页面级资源来自 `PAGE_ASSETS` 且 0 个不可缓存条目，其中 `/css/assistant.css` 覆盖按需助手浮层的离线可用性。`service-worker.js` 已由 `src/service-worker-template.mjs` 生成，并由 `npm run check:service-worker` 只读防漂移。PWA smoke 已扩展搜索索引未缓存/已缓存离线矩阵、单篇文章在线/离线阅读状态和浏览器级 Service Worker 版本升级清理，Service Worker activate fixture 也覆盖旧缓存清理。全局搜索弹窗现在会显示搜索索引状态条，区分待加载、加载中、已就绪、离线可搜索、离线未加载和索引异常。本轮验证：PWA 策略/预缓存/生成器聚焦测试通过，`npm run check:service-worker`、`npm run check:pwa-precache`、搜索行为测试和 browser smoke 通过。

## 结论摘要

当前站点已具备保守 PWA 外壳：Web App Manifest、Service Worker 注册、离线 fallback、缓存安全矩阵、预缓存一致性检查、预缓存资源所有权检查、Service Worker 整文件生成检查、搜索索引离线矩阵、旧缓存清理 fixture、浏览器级版本升级 smoke、搜索离线错误态、搜索索引状态条、单篇文章离线阅读状态和页面资源 manifest 派生预缓存均已落地，并纳入 HTTP smoke、构建测试、单元策略测试、只读质量门禁和 Playwright PWA smoke。`new-features.md` 已有“PWA 离线支持”的功能建议，本报告进一步拆成工程落地视角：哪些资源适合预缓存、哪些数据必须保持 network-first 或 no-store、Service Worker 不能缓存哪些用户敏感请求，以及如何把离线能力纳入现有 smoke 和发布验证。下一步重点不再是“是否有 SW/清单守卫/升级回归/离线提示/生成门禁/文章状态提示/页面资源派生缓存/所有权归属检查/搜索索引状态条”，而是继续产品化更多离线资源可见性。

## 📌 PWA-01 [已修复第二阶段]：站点已有 Web App Manifest、Service Worker 与离线 fallback

- 📌 问题/建议标题：补最小 PWA 外壳，但先保持保守缓存范围
- 📍 位置：`src/templates/layout.mjs`、`manifest.webmanifest`、`offline.html`、`service-worker.js`、`js/pwa-register.js`、`scripts/build.mjs`、`docs/suggestions/new-features.md:205-233`
- 📝 当前状况描述：公共模板 `<head>` 已输出 favicon、manifest、theme-color、资源 hint、CSS、脚本、SEO meta、JSON-LD 和 PWA 注册脚本；`manifest.webmanifest` 描述站点名称、启动 URL、scope、standalone display、主题色和 favicon 图标，构建到临时目录时也会复制该文件。当前已新增 noindex 的 `/offline.html` 和根作用域 `/service-worker.js`，网络中断时未命中的导航会回退到离线说明页。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：当前已完成保守外壳。Service Worker 只处理导航 fallback、少量稳定静态资源和搜索索引，不缓存用户请求、外部接口、relay/API/未知 endpoint 或携带敏感信息的请求。

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0f172a">
<script>
if ("serviceWorker" in navigator && isSecureContext) {
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
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

## 📌 PWA-02 [已修复第三阶段]：离线预缓存清单、Service Worker 文件和页面资源清单已有一致性守卫

- 📌 问题/建议标题：用构建期 manifest 生成 Service Worker 预缓存列表
- 📍 位置：`scripts/build.mjs`、`src/page-assets.mjs`、`src/pwa-precache.mjs`、`src/service-worker-template.mjs`、`scripts/generate-service-worker.mjs`、`scripts/check-pwa-precache.mjs`、`src/templates/layout.mjs`、`tests/service-worker-generation.test.mjs`
- 📝 当前状况描述：项目已经开始把页面级 CSS 放进 `src/page-assets.mjs`，公共模板也集中维护 core scripts。这是 PWA 的好基础。当前已新增 `src/pwa-precache.mjs` 作为 19 个保守 app-shell 预缓存 URL 的源码契约，其中 `PWA_PRECACHE_PAGE_ASSETS` 由 `pageAssetUrls()` 从 `PAGE_ASSETS` 派生，当前覆盖 `/css/tools.css` 与 `/css/trust.css`；按需加载的 `/css/assistant.css` 作为核心交互资产进入 `PWA_PRECACHE_CORE_ASSETS`。`check:pwa-precache` 会比对 `service-worker.js` 暴露的 `PRECACHE_URLS`、检查本地文件、反查 `data/generated-artifact-manifest.json` 的资源所有权、Font Awesome 字体引用、页面资源覆盖数和缓存策略。`service-worker.js` 也已由 `src/service-worker-template.mjs` 生成，`check:service-worker` 会比较根目录产物与模板输出，`build --out` 会使用同一模板。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已先把 core CSS/JS、页面级 assets、favicon、webfont 和离线 fallback 汇入 `src/pwa-precache.mjs`；后续如需扩大到更多关键路由 HTML 或搜索索引预热，应继续复用同一源码契约和检查器。

```js
const precache = [
  "/",
  "/post/",
  "/tools/",
  "/ai/",
  "/trust/",
  "/css/coder.css",
  ...CORE_SCRIPTS,
  ...pageAssetUrls(PAGE_ASSETS),
  "/search-index.json",
  "/offline.html",
];
```

- 📊 预期收益：让离线能力跟随现有构建系统演进，减少新增页面或拆分 CSS 后忘记更新 Service Worker 的风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-resource-ownership-and-page-styles.md`、`docs/suggestions/module-reviews/build-artifact-synchronization.md`

## 📌 PWA-03 [已修复第二阶段]：不同数据源的新鲜度和隐私级别不同，需要明确缓存策略矩阵

- 📌 问题/建议标题：为 HTML、静态资源、搜索索引、中转站数据和用户请求建立缓存分层
- 📍 位置：`src/pwa-cache-policy.mjs`、`tests/pwa-cache-policy.test.mjs`、`js/search.js:207-224`、`js/relay.js:271-286`、`js/tools.js:1166-1180`、`js/assistant.js:600-633`
- 📝 当前状况描述：搜索索引用 `cache: "no-cache"`，适合弱一致性更新；中转站数据用 `cache: "no-store"`，适合展示较新的健康状态；助手和 API Tester 会发送用户配置的 endpoint、key、headers 和 body，绝不应该被 Service Worker 默认缓存。当前已新增 `classifyPwaRequest()` 和 `PWA_CACHE_POLICY_MATRIX`，Service Worker 镜像该策略：导航走 `network-first`，静态资源走 `cache-first`，搜索索引走 `stale-while-revalidate`，relay 数据和 `/api/` 默认 `network-only`，未知同源请求默认 `network-only`。
- ⚠️ 影响程度：高。核心策略风险已收敛到可测试函数，并已通过 VM 加载 SW 的方式校验镜像策略一致。
- 💡 建议方案（含伪代码或示例片段）：已先写策略矩阵，再编码 Service Worker 路由。默认只缓存 same-origin GET 的导航、静态资源和搜索索引；API、表单、助手、工具箱自定义请求、第三方请求全部 network-only。

```js
classifyPwaRequest("/search-index.json").strategy; // stale-while-revalidate
classifyPwaRequest("/data/relay-providers.json").strategy; // network-only
classifyPwaRequest("/css/coder.css").strategy; // cache-first
classifyPwaRequest({ url: "/post/", mode: "navigate" }).strategy; // network-first
```

- 📊 预期收益：兼顾离线体验、数据新鲜度和隐私边界，避免 Service Worker 从性能优化变成隐藏的数据保留层。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/local-data-retention-map.md`、`docs/suggestions/module-reviews/assistant-loader-and-llm-runtime.md`

## 📌 PWA-04 [已修复第四阶段]：离线用户体验已覆盖反馈保存、导航 fallback、搜索索引错误态和缓存状态

- 📌 问题/建议标题：补离线 fallback、搜索索引缓存状态和可见重试入口
- 📍 位置：`js/feedback.js:170-190`、`js/search.js:197-224`、`src/templates/layout.mjs:248-286`
- 📝 当前状况描述：反馈表单在提交失败时会提示“已保存到本地（当前离线或提交失败）”。当前已新增 `/offline.html`，导航缓存未命中时会显示离线说明和返回首页/文章列表入口。站内搜索索引加载失败也已区分离线且索引未缓存、索引 JSON 结构异常、HTTP 暂时不可用和通用加载失败，并补充中英文文案与 JSDOM 行为测试。全局搜索弹窗还新增 `.search-modal-status` 状态条，使用 `aria-live="polite"` 展示索引待加载、加载中、已就绪、离线可搜索、离线未加载和索引异常状态。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：离线 fallback、搜索差异化提示和搜索索引状态条已完成；后续若继续增强，可再增加显式“联网后重试”按钮或主动预热搜索索引。

```js
function searchLoadErrorMessage() {
  if (navigator.onLine === false) {
    return t("dyn.search.offline", "当前离线，搜索只在索引已缓存后可用。");
  }
  return t("dyn.search.loadFail", "搜索索引加载失败，请稍后重试。");
}
```

- 📊 实际收益：用户能理解离线限制、未缓存边界、资源损坏风险，以及“索引已加载所以离线仍可搜索”的状态，降低“缓存命中页面可用、搜索不可用却不知道原因”的体验落差。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-discovery-and-object-search.md`、`docs/suggestions/ux-improvements.md`

## 📌 PWA-05 [已修复第二阶段]：Service Worker 根作用域会扩大安全边界，需先定义禁止缓存和禁止拦截范围

- 📌 问题/建议标题：为助手、API Tester、订阅、反馈和第三方请求设置 network-only 安全护栏
- 📍 位置：`src/pwa-cache-policy.mjs`、`service-worker.js`、`tests/pwa-cache-policy.test.mjs`、`src/templates/layout.mjs:45-59`、`js/assistant.js:600-633`、`js/tools.js:940-1220`、`js/subscribe.js:1-80`、`js/feedback.js:170-190`
- 📝 当前状况描述：站点 CSP 允许 Giscus、Buttondown、Web3Forms、CDN 和用户自定义 API Tester/助手 endpoint。Service Worker 注册在根作用域后有能力观察 same-origin 下的所有 fetch，也可能因为错误代码缓存带有鉴权信息的请求或响应。当前策略函数和 SW 均默认拒绝缓存非 GET、跨域请求、敏感 query、敏感 header 和未知同源 endpoint；测试会断言 SW 与源码策略一致。
- ⚠️ 影响程度：高。安全矩阵已可执行，并已接入保守 SW；后续风险主要是清单生成和策略双写漂移。
- 💡 建议方案（含伪代码或示例片段）：在 SW 中默认拒绝缓存非 GET、带敏感 header、查询串含 token/key/signature 的请求；API Tester 与助手请求建议继续显式加 `cache: "no-store"` 并让 SW network-only。

```js
classifyPwaRequest({ url: "/feedback", method: "POST" }).strategy; // network-only
classifyPwaRequest("/tools/?api_key=secret").reason; // sensitive query
classifyPwaRequest({ url: "/search-index.json", headers: { Authorization: "Bearer secret" } }).reason; // sensitive header
```

- 📊 预期收益：避免 PWA 引入新的隐私和安全风险，尤其保护助手 API key、API Tester 请求历史、订阅/反馈表单和第三方服务交互。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/csp-resource-policy-review.md`

## 📌 PWA-06 [已修复第一阶段]：现有 smoke 已覆盖离线基础路径、搜索索引矩阵和浏览器级升级清理

- 📌 问题/建议标题：把 PWA 能力纳入生产验证和 Playwright 离线冒烟
- 📍 位置：`scripts/http-smoke.mjs:9-140`、`scripts/browser-smoke.mjs:9-288`、`scripts/validate-production.mjs:266-324`
- 📝 当前状况描述：HTTP smoke 会启动本地静态服务并检查关键路由、H1、本地脚本 HEAD、manifest、图标、offline fallback、Service Worker 和注册脚本可达；browser smoke 会检查桌面/移动关键路由、工具箱交互和横向 overflow；`test:pwa-smoke` 会注册 Service Worker、切离线、验证搜索索引未缓存时离线不可用、在线加载后离线可用、已访问 `/post/` 可离线打开、未缓存路由显示 `/offline.html`、relay 动态数据不会离线从缓存返回。它还会让内置服务器临时返回 bumped `VERSION` 的 Service Worker，触发真实 `registration.update()` 和 `controllerchange`，确认旧 `cwlblog-*` 缓存清理且新版本 precache/runtime 存在。单元 fixture 也会触发 Service Worker activate，验证旧缓存清理且当前版本和其他应用缓存保留。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：当前 HTTP smoke 已检查静态 PWA artifact，`test:pwa-smoke` 已检查 SW 注册、基础 offline 行为、搜索索引已缓存/未缓存两种状态和浏览器级版本升级清理；单元测试已覆盖 activate 清理逻辑，`check:service-worker` 已覆盖整文件生成漂移，`check:pwa-precache` 已覆盖页面级离线资源。Browser smoke 已断言搜索弹窗的索引状态条进入 ready 状态。

```js
await page.goto(`${baseUrl}/`);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready);
await context.setOffline(true);
await page.goto(`${baseUrl}/post/`);
await expect(page.locator("main#main-content")).toBeVisible();
```

- 📊 预期收益：把“可安装、可离线、可升级”变成可回归的发布契约，而不是手动打开 DevTools 的偶然检查。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/browser-visual-smoke-testing.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`

## 📌 PWA-07 [已修复第一阶段]：单篇文章离线阅读状态可视化

- 📌 问题/建议标题：把“已缓存可离线阅读”变成用户可见状态
- 📍 位置：`src/templates/post.mjs`、`js/pwa-register.js`、`js/i18n.js`、`css/coder.css`、`scripts/pwa-smoke.mjs`
- 📝 当前状况描述：单篇文章页现在输出默认隐藏的 `.post-offline-status` 状态节点。`pwa-register.js` 会在 Service Worker 控制页面后显示“此文章已可离线阅读”，当浏览器离线且访问已缓存文章时切换为“正在离线阅读此文章”；英文模式显示 “This article is available offline” 和 “Reading this article offline”。状态会响应 `online` / `offline` / `controllerchange` / `cwl:langchange`。
- ⚠️ 影响程度：中。它不扩大缓存范围，只把现有 navigation runtime cache 的结果展示出来。
- 💡 建议方案（含伪代码或示例片段）：已复用公共 PWA 注册脚本，避免新增页面脚本入口。

```js
if (navigator.serviceWorker.controller) {
  status.hidden = false;
  status.textContent = navigator.onLine === false
    ? t("dyn.pwa.articleOffline", "正在离线阅读此文章")
    : t("dyn.pwa.articleReady", "此文章已可离线阅读");
}
```

- 📊 预期收益：用户在线阅读文章后能看到该文章可离线访问；离线打开缓存文章时也能理解当前内容来自离线缓存。
- 🔗 相关建议引用：`docs/suggestions/new-features.md#-f-07-pwa-支持--离线阅读`、`docs/suggestions/ux-improvements.md`

## 建议优先级

1. 已完成第二阶段：定义缓存策略矩阵、加入最小 Service Worker 注册和 `/offline.html` fallback，防止 Service Worker 扩大隐私风险。
2. 已完成第二阶段：生成 Service Worker 文件并接入 `check:service-worker`、build、CI 和质量基线，减少策略、版本和预缓存清单双写。
3. 已完成第三阶段：从 `PAGE_ASSETS` / 页面资源 manifest 派生页面级离线资源，并把按需助手 CSS 纳入核心预缓存，减少新增页面或拆分 CSS 后漏进缓存清单的风险。
4. 已完成第四阶段：`check:pwa-precache` 反查生成物所有权 manifest，19 个预缓存 URL 必须归属到 generated output、manual HTML、manual static file 或 copied asset directory，当前所有权缺口为 0。
5. 已完成第一阶段：产品化单篇文章离线阅读状态可视化，并由 PWA smoke 覆盖在线/离线/英文状态。
6. 已完成第一阶段：产品化搜索索引状态条，并由 JSDOM 搜索测试与 browser smoke 覆盖。
7. 低优先级：再逐步做模型资源预缓存状态面板。

## 本轮健康度评分

- PWA 就绪度：4.3 / 5
- 当前强项：静态站在线 smoke 稳定，Web App Manifest、Service Worker、离线 fallback 已落地并进入 HTTP/单元/Playwright PWA smoke，资源引用集中化正在推进，部分数据请求已显式声明 `no-cache` / `no-store`，缓存策略矩阵、预缓存清单、搜索索引状态条和 Service Worker 整文件生成均已可执行并与 SW 镜像校验。
- 主要扣分：模型资源预缓存状态还未产品化；当前预缓存仍保持保守范围，尚未主动预热搜索索引或更多关键内容页。
