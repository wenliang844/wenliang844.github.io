# 路由注册与内容发现治理评审

分析范围：`src/config.mjs`、`src/page-assets.mjs`、`src/templates/layout.mjs`、`src/templates/ai.mjs`、`js/ai-tabs.js`、`scripts/build.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`tests/links.test.mjs`、`tests/build.test.mjs`、`tests/templates-extended.test.mjs`、`tests/performance.test.mjs`。

## 本轮验证

- 只读运行 `node scripts/http-smoke.mjs`：关键路由通过，分别为 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/` 和 `/404.html`。
- 新增 `npm run test:http-smoke:full` 与 `npm run test:browser-smoke:full`，通过 `--scope full` 覆盖 `STATIC_PAGES` 全量静态页；本轮验证 HTTP full 14 条路由通过，browser full 桌面 14 条、移动 13 条静态页和 `/tools/` 交互通过。
- `tests/links.test.mjs` 新增搜索索引路径反查，确认 `SEARCH_PAGES` 的页面目标存在，并验证 `/ai/#nav` 这类 hash route 具备对应 Tab 面板和 `ai-tabs.js` 脚本契约。
- `tests/build.test.mjs` 新增临时构建 route-to-output 完整性检查，确认 `STATIC_PAGES` 中每个静态路由都会出现在 `build --out` 产物中。
- 只读运行 `node --test tests/links.test.mjs tests/workflows.test.mjs`：14/14 通过，覆盖 HTML 链接、公共脚本顺序、CI workflow、HTTP/browser smoke 脚本存在性等静态契约。
- 只读运行 `node --test tests/build.test.mjs`：4/4 通过，覆盖构建基础产物、输出目录安全、已提交静态页和临时构建静态页完整性。
- 只读检查 `src/config.mjs`、`scripts/build.mjs`、`src/page-assets.mjs`、`scripts/http-smoke.mjs` 和 `scripts/browser-smoke.mjs`，确认当前公共页面路由在多个清单中分散维护。

## 结论摘要

站点当前的路由和内容发现能力已经具备良好基础：sitemap、RSS、搜索索引、导航、页面级 CSS、HTTP smoke、browser smoke 都有对应实现和测试。但这些能力不是从同一个路由 manifest 派生，而是散落在多个文件里手工同步。随着 `/trust/`、`/sponsor/`、`/appreciation/`、`/editor/`、`/overleaf/` 等页面增加，主要风险不在单个页面崩溃，而在“新增页面后忘记加入搜索、站点地图、smoke、性能预算或导航入口”的长尾漂移。

## 📌 RRG-01：公共页面路由在多个清单中重复维护，新增页面容易漏接内容发现链路

- 📌 问题/建议标题：建立单一 public route manifest，统一派生 sitemap、search、navigation、assets 和 smoke 覆盖
- 📍 位置：`src/config.mjs:22-36`、`src/config.mjs:39-115`、`src/templates/layout.mjs:6-25`、`src/page-assets.mjs:1-11`、`scripts/build.mjs:580-615`、`scripts/http-smoke.mjs:10`、`scripts/browser-smoke.mjs:11-14`
- 📝 当前状况描述：静态页 sitemap 清单在 `STATIC_PAGES`，搜索页在 `SEARCH_PAGES`，导航菜单在 `NAV_ITEMS`/`MORE_ITEMS`，页面级 CSS 在 `PAGE_ASSETS`，构建输出在 `scripts/build.mjs` 的多个 `writeFileEnsured()` 调用中，HTTP/browser smoke 又各自维护 `ROUTES`。这些清单大多描述同一批公共页面，但没有共享数据源。新增或重命名页面时，开发者需要记住同步多处，否则页面可能能构建，却缺少搜索入口、sitemap、性能预算或 smoke 验证。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：新增只读可导出的 `PUBLIC_ROUTES` manifest，让各链路按字段筛选，不再复制路由字符串。

```js
export const PUBLIC_ROUTES = [
  {
    path: "/tools/",
    output: "tools/index.html",
    title: "在线工具箱",
    nav: { group: "more", key: "tools" },
    sitemap: { priority: "0.6", withDate: true },
    search: { summary: "...", tags: ["工具"] },
    assets: { styles: ["/css/tools.css"] },
    smoke: { http: true, browser: ["desktop", "mobile"] },
    budget: { rawKb: 145, gzipKb: 26 },
  },
];
```

- 📊 预期收益：新增页面时只补一份契约，构建、搜索、SEO、导航、测试和性能预算自动同步，降低“页面上线但不可发现”的风险。
- 🔗 相关建议引用：`module-reviews/search-and-seo-pipeline.md`、`module-reviews/build-artifact-synchronization.md`、`module-reviews/suggestions-knowledge-base-governance.md`

## 📌 RRG-02 [部分修复]：HTTP/browser smoke 只覆盖关键路由，未覆盖完整静态页清单

- 📌 问题/建议标题：从路由 manifest 派生 smoke 分层，区分 critical 与 full route checks
- 📍 位置：`src/config.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`package.json`、`tests/workflows.test.mjs`
- 📝 当前状况描述：`STATIC_PAGES` 包含 13 个静态页面路径；当前已新增 `FULL_SMOKE_ROUTES` 和 `--scope critical|full`，默认 smoke 继续快速覆盖核心路由，full smoke 覆盖 `/about/`、`/editor/`、`/overleaf/`、`/appreciation/`、`/sponsor/`、`/categories/`、`/tags/` 等完整静态页。剩余问题是 full scope 尚未接入 nightly/release workflow，仍需后续根据 CI 时长预算决定触发策略。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：保留 fast smoke，但增加 full smoke 模式；CI pull request 跑 critical，夜间或 release 跑 full。

```js
const routeSet = process.env.SMOKE_SCOPE === "full"
  ? PUBLIC_ROUTES.filter((route) => route.smoke?.http !== false)
  : PUBLIC_ROUTES.filter((route) => route.smoke?.critical);

for (const route of routeSet) {
  await smokeRoute(baseUrl, route.path);
}
```

- 📊 预期收益：保留快速反馈，同时让低频页面也能在发布前获得 `main#main-content`、`h1`、脚本可达性、移动端溢出等基础保障。
- 🔗 相关建议引用：`module-reviews/browser-visual-smoke-testing.md`、`module-reviews/test-coverage-risk-map.md`

## 📌 RRG-03 [已修复]：搜索索引中的 hash route 依赖 JS tab 逻辑，缺少搜索索引路径反查验证

- 📌 问题/建议标题：为 search-index 页面路径增加 URL/anchor/hash-route 校验
- 📍 位置：`src/config.mjs`、`src/templates/ai.mjs`、`js/ai-tabs.js`、`tests/links.test.mjs`
- 📝 当前状况描述：`SEARCH_PAGES` 包含 `/ai/#nav`，它不是普通 DOM anchor，而是由 `js/ai-tabs.js` 根据 `#nav` 激活 `data-ai-panel="nav"`。当前已新增 `search index page paths resolve to usable pages and hash routes` 测试：普通搜索路径必须指向已提交页面；普通 hash 必须存在 id/name；`/ai/#nav` 必须在目标页包含 `data-ai-panel="nav"` 和 `/js/ai-tabs.js`。后续新增 hash route 时只需补充 `SEARCH_HASH_ROUTE_CONTRACTS`。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：把搜索索引的页面路径纳入链接测试。普通 hash 检查 DOM id/name；声明为 hash route 的路径检查对应 JS 契约或面板 id。

```js
const hashRoutes = new Map([
  ["/ai/#nav", { panel: '[data-ai-panel="nav"]', script: "/js/ai-tabs.js" }],
]);

for (const page of SEARCH_PAGES) {
  const contract = hashRoutes.get(page.path);
  if (contract) {
    assert.match(aiHtml, new RegExp(contract.panel));
    assert.match(aiHtml, /src="\/js\/ai-tabs\.js"/);
  } else {
    assertAnchorTargetExists(page.path);
  }
}
```

- 📊 预期收益：搜索结果不只“写进 JSON”，还真正能跳到可用内容；AI 页面这类 tab/hash 混合交互也能被显式保护。
- 🔗 相关建议引用：`module-reviews/search-and-content-discovery.md`、`module-reviews/seo-feed-and-structured-data.md`

## 📌 RRG-04：页面级资产 manifest 只覆盖 tools/trust，尚未和路由、性能预算、构建输出统一

- 📌 问题/建议标题：把页面级 CSS/脚本/预算合并到路由 manifest，避免资源拆分治理只覆盖部分页面
- 📍 位置：`src/page-assets.mjs:1-11`、`src/templates/tools.mjs:1-2`、`src/templates/tools.mjs:1067`、`src/templates/trust.mjs:1-4`、`src/templates/trust.mjs:144`、`tests/templates-extended.test.mjs:24-35`、`tests/performance.test.mjs:270-281`
- 📝 当前状况描述：`PAGE_ASSETS` 很好地把 `/tools/` 和 `/trust/` 的页面级 CSS 从全站 CSS 中拆出来，测试也验证这些 CSS 引用和性能预算。但 manifest 目前只描述 styles，且只有两个路由使用。未来 `/ai/`、`/appreciation/`、`/overleaf/` 继续增长时，页面级脚本、CSS、CSP connect-src、性能预算和 smoke 仍需要分散维护。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：将 `PAGE_ASSETS` 作为 `PUBLIC_ROUTES.assets` 的一部分，并让性能预算从同一数据源读取。

```js
const route = routeByPath("/trust/");
renderPage({
  styles: route.assets.styles,
  scripts: route.assets.scripts,
  connectSrc: route.security.connectSrc,
});

const budgets = PUBLIC_ROUTES
  .filter((route) => route.budget)
  .map(({ path, output, assets, budget }) => ({ path, output, assets, budget }));
```

- 📊 预期收益：资源拆分、性能预算和安全策略会跟着页面注册一起演进，不需要每个测试单独补一份 route table。
- 🔗 相关建议引用：`module-reviews/css-resource-ownership-and-page-styles.md`、`module-reviews/performance-bottlenecks.md`

## 📌 RRG-05：robots.txt 的优先抓取列表是手写文案，容易与 sitemap 产生语义漂移

- 📌 问题/建议标题：从 sitemap 路由生成 robots 的 Allow 列表，或删减手写优先抓取清单
- 📍 位置：`src/config.mjs:22-36`、`scripts/build.mjs:415-463`
- 📝 当前状况描述：`buildRobots()` 手写了 `/post/`、`/tags/`、`/categories/`、`/ai/`、`/trust/` 的优先抓取项，但 `STATIC_PAGES` 还包含 `/tools/`、`/editor/`、`/overleaf/`、`/contact/`、`/appreciation/`、`/sponsor/`。因为 `Allow: /` 已经允许全站，这不是访问阻塞；问题在于 robots 的“优先抓取”语义会逐渐落后于 sitemap，维护者可能误以为某些页面被有意降级。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：要么完全依赖 sitemap，只保留 `Allow: /` 与 `Sitemap`；要么从 route manifest 的 `robotsPriority` 字段生成注释清单。

```js
function buildRobots(routes) {
  const priorityAllows = routes
    .filter((route) => route.robots?.priority)
    .map((route) => `Allow: ${route.path}`)
    .join("\n");
  return `User-agent: *\nAllow: /\n\n${priorityAllows}\n\nSitemap: ${SITE.baseURL}/sitemap.xml`;
}
```

- 📊 预期收益：SEO 运维文案和真实 sitemap 保持一致，减少后续排查收录问题时的误判。
- 🔗 相关建议引用：`module-reviews/seo-feed-and-structured-data.md`、`module-reviews/search-and-seo-pipeline.md`

## 📌 RRG-06 [已修复]：构建输出列表写在脚本流程里，路由可达性与产物新鲜度仍依赖人工记忆

- 📌 问题/建议标题：为构建产物增加 route-to-output 完整性检查
- 📍 位置：`scripts/build.mjs`、`src/config.mjs`、`tests/build.test.mjs`
- 📝 当前状况描述：`scripts/build.mjs` 明确写出文章页、列表页、标签页、归档页、AI、工具、鉴赏、赞助、信任、sitemap、RSS 和搜索索引的输出。当前已新增 `temporary build output covers every registered static page` 测试：构建到临时目录后，从 `STATIC_PAGES` 推导每个路由的 `index.html` 产物路径并逐一 `access()` 检查。既有 `registered static pages have committed index artifacts` 继续保护已提交产物，新测试保护源码构建输出覆盖。
- ⚠️ 影响程度：中。核心风险已收敛：新增静态 route 如果没有被构建脚本输出，会在构建测试阶段失败。
- 💡 建议方案（含伪代码或示例片段）：已先用 `STATIC_PAGES` 建立 route-to-output 完整性检查；未来抽象 `PUBLIC_ROUTES` 后可沿用同一模式，并继续反查 sitemap/search 是否按字段生成。

```js
await runBuild(["--out", outDir]);
for (const page of STATIC_PAGES) {
  await access(indexPathForRoute(outDir, page.path));
}
```

- 📊 预期收益：让“页面注册 -> 构建产物 -> sitemap/search/smoke”形成闭环，降低静态站点 committed artifact 与源码模板漂移的风险。
- 🔗 相关建议引用：`module-reviews/build-artifact-synchronization.md`、`module-reviews/content-publishing-quality-gates.md`

## 建议优先级

1. 高优先级：抽象 `PUBLIC_ROUTES`，先覆盖 path、output、sitemap、search、smoke、assets、budget 字段。
2. 中优先级：让 HTTP/browser smoke 从 route manifest 派生 critical/full 两套范围。
3. 中优先级：把 `SEARCH_PAGES` 的 hash route 纳入可执行验证，尤其是 `/ai/#nav`。
4. 中优先级：把页面级 CSS 与性能预算从 `PAGE_ASSETS` 合并进 route manifest。
5. 低优先级：精简或自动生成 robots 的优先抓取清单。

## 本轮健康度评分

- 路由与内容发现治理健康度：3.8 / 5
- 当前强项：sitemap、RSS、搜索索引、导航、页面级 CSS、smoke 和链接测试都有实际覆盖，核心页面的可达性已经稳定。
- 主要扣分：路由事实源分散，新增页面需要同步多处；search-index hash route 和 full route smoke 仍缺少统一的机器校验。
