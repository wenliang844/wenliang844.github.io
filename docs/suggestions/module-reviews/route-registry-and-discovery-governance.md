# 路由注册与内容发现治理评审

分析范围：`src/config.mjs`、`src/page-assets.mjs`、`src/templates/layout.mjs`、`src/templates/ai.mjs`、`js/ai-tabs.js`、`scripts/build.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`tests/links.test.mjs`、`tests/build.test.mjs`、`tests/templates-extended.test.mjs`、`tests/performance.test.mjs`。

## 本轮验证

- 只读运行 `node scripts/http-smoke.mjs`：6 个关键路由通过，分别为 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/`。
- 只读运行 `node --test tests/links.test.mjs tests/workflows.test.mjs`：14/14 通过，覆盖 HTML 链接、公共脚本顺序、CI workflow、HTTP/browser smoke 脚本存在性等静态契约。
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

## 📌 RRG-02：HTTP/browser smoke 只覆盖 6 个关键路由，未覆盖完整静态页清单

- 📌 问题/建议标题：从路由 manifest 派生 smoke 分层，区分 critical 与 full route checks
- 📍 位置：`src/config.mjs:22-36`、`scripts/http-smoke.mjs:10`、`scripts/browser-smoke.mjs:11-14`、`tests/workflows.test.mjs:131-145`
- 📝 当前状况描述：`STATIC_PAGES` 包含 13 个静态页面路径，而 HTTP smoke 和 browser smoke 的核心路由只有 6 个。当前选择适合快速验证首页、工具、AI、博客、反馈和信任页，但 `/editor/`、`/overleaf/`、`/appreciation/`、`/sponsor/`、`/categories/`、`/tags/` 没有进入 smoke。`tests/workflows.test.mjs` 还用正则固定断言这 6 个路由，等于把“子集覆盖”固化成了脚本契约。
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

## 📌 RRG-03：搜索索引中的 hash route 依赖 JS tab 逻辑，缺少搜索索引路径反查验证

- 📌 问题/建议标题：为 search-index 页面路径增加 URL/anchor/hash-route 校验
- 📍 位置：`src/config.mjs:61-65`、`src/templates/ai.mjs:266-278`、`js/ai-tabs.js:27-48`、`tests/build.test.mjs:162-171`、`tests/links.test.mjs:138-170`
- 📝 当前状况描述：`SEARCH_PAGES` 包含 `/ai/#nav`，它不是普通 DOM anchor，而是由 `js/ai-tabs.js` 根据 `#nav` 激活 `data-ai-panel="nav"`。`tests/build.test.mjs` 只断言搜索索引里存在 `/ai/#nav`，`tests/links.test.mjs` 只扫描 HTML 中的 `href="#..."` 并检查目标 id/name。换句话说，搜索索引里的 hash route 没有被统一反查：如果未来 `#nav` 改名或 tab 逻辑失效，搜索结果可能仍生成成功，但点击后不能打开正确内容。
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

## 📌 RRG-06：构建输出列表写在脚本流程里，路由可达性与产物新鲜度仍依赖人工记忆

- 📌 问题/建议标题：为构建产物增加 route-to-output 完整性检查
- 📍 位置：`scripts/build.mjs:580-615`、`src/config.mjs:22-36`、`tests/links.test.mjs:47-60`
- 📝 当前状况描述：`scripts/build.mjs` 明确写出文章页、列表页、标签页、归档页、AI、工具、鉴赏、赞助、信任、sitemap、RSS 和搜索索引的输出。`tests/links.test.mjs` 会检查已提交 HTML 内部的链接是否存在，但它不直接验证 `STATIC_PAGES` 中每个页面是否有对应构建输出，也不验证构建脚本是否覆盖某个新 route。新增静态页时，如果只加入 sitemap 而忘记 `writeFileEnsured()`，可能要等链接或 smoke 间接碰到才暴露。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：测试 `PUBLIC_ROUTES` 中声明了 `output` 的页面，构建到临时目录后逐一检查文件存在，并反查 sitemap/search 是否按字段生成。

```js
await execFile("node", ["scripts/build.mjs", "--out", "temp/routes-check"]);
for (const route of PUBLIC_ROUTES) {
  if (route.output) {
    await access(join(ROOT, "temp/routes-check", route.output));
  }
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
