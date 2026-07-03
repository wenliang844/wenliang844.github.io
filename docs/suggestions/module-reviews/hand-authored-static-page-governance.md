# 手写静态页公共外壳治理评审

分析范围：`about/index.html`、`contact/index.html`、`editor/index.html`、`overleaf/index.html`、`404.html`、`src/templates/layout.mjs`、`src/config.mjs`、`scripts/build.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`tests/links.test.mjs`、`tests/i18n-a11y.test.mjs`、`tests/build.test.mjs`。

## 本轮验证

- 只读抽样 `about/`、`contact/`、`editor/`、`overleaf/`、`404.html` 的 HTML head、导航、脚本和页脚。
- 只读运行 `node --test tests/i18n-a11y.test.mjs`：16/16 通过，说明现有测试能守住 lang、meta、H1 数量、导航 aria、skip link、交互标签、footer 订阅与 sponsor CTA 等基础线。
- 只读比较 `src/templates/layout.mjs` 的公共导航/脚本/页脚与手写 HTML，确认存在公共外壳漂移。

## 结论摘要

项目当前是混合静态架构：文章页、AI、工具、鉴赏、赞助、信任、标签、归档等由 `scripts/build.mjs` 生成；`about/`、`contact/`、`editor/`、`overleaf/`、`404.html` 等仍是手写 HTML。手写页的基础可访问性测试表现不错，但公共导航、脚本顺序、页脚链接和路由语义已经开始和 `renderPage()` 模板分叉。建议不要急着大规模重写页面，而是先建立“公共外壳 parity test”，再逐步把手写页迁移到模板或 partial 生成。

## 📌 HSG-01：手写页导航缺少模板中的 `/trust/` 入口，隐私与信任页可发现性不一致

- 📌 问题/建议标题：为手写页与 `renderPage()` 增加导航链接清单一致性测试
- 📍 位置：`src/templates/layout.mjs:20-24`、`about/index.html:54-60`、`contact/index.html:55-61`、`editor/index.html:58-64`、`overleaf/index.html:55-61`、`404.html:55-61`
- 📝 当前状况描述：公共模板的 `MORE_ITEMS` 包含 `/tools/`、`/overleaf/`、`/trust/` 三个入口；抽样手写页的 “更多” 菜单只有 `/tools/` 和 `/overleaf/`。因此从生成页能在更多菜单进入“隐私与信任”，但从 About、Contact、Editor、Overleaf、404 等手写页需要依赖 footer、搜索或其它入口。当前链接测试只验证已有 `href` 是否存在，不会发现“应该有但缺失”的导航项。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：把模板导航 href 集合导出或在测试中从生成页抽取基准，然后对所有 HTML 的 `.navigation-list` 进行集合比较。

```js
const requiredNavHrefs = ["/post/", "/ai/", "/appreciation/", "/tools/", "/overleaf/", "/trust/", "/contact/", "/sponsor/"];
for (const file of htmlFiles) {
  const nav = parseNav(file);
  assert.deepEqual(requiredNavHrefs.filter((href) => !nav.hrefs.includes(href)), []);
}
```

- 📊 预期收益：隐私、赞助、反馈等关键入口在所有页面保持一致，降低新增公共链接后只同步生成页的风险。
- 🔗 相关建议引用：`module-reviews/route-registry-and-discovery-governance.md`、`module-reviews/privacy-and-trust-center.md`

## 📌 HSG-02：手写页缺少模板页脚中的 `footer-links`，站点说明入口覆盖不完整

- 📌 问题/建议标题：将页脚 links 作为公共 chrome 契约，而不只测试订阅和 sponsor CTA
- 📍 位置：`src/templates/layout.mjs:138-140`、`src/templates/layout.mjs:286-287`、`about/index.html:130-140`、`contact/index.html:134-140`、`editor/index.html:140-146`、`overleaf/index.html:133-139`、`404.html:94-100`、`tests/i18n-a11y.test.mjs:83-93`
- 📝 当前状况描述：公共模板会渲染 `<nav class="footer-links">`，包含隐私与信任、联系反馈、赞助支持入口；抽样手写页没有 `footer-links`。`tests/i18n-a11y.test.mjs` 能验证 footer 有订阅表单和 sponsor CTA，但没有验证 `footer-links` 的存在及 href 集合。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在可访问性测试中增加 footer links parity，或者把 footer partial 抽成构建时注入。

```js
const requiredFooterLinks = ["/trust/", "/contact/", "/sponsor/"];
for (const file of await htmlFiles()) {
  const footer = parseFooter(file);
  assert.ok(footer.hasClass("footer-links"), `${file} missing footer-links`);
  assert.deepEqual(missing(requiredFooterLinks, footer.hrefs), []);
}
```

- 📊 预期收益：站点说明、隐私和反馈路径在页面底部保持稳定，尤其有利于从工具页、简历页和 404 页回到可信说明。
- 🔗 相关建议引用：`module-reviews/privacy-and-trust-center.md`、`module-reviews/i18n-and-accessibility.md`

## 📌 HSG-03：公共脚本顺序在手写页和 `CORE_SCRIPTS` 之间不完全一致

- 📌 问题/建议标题：统一公共脚本顺序，避免未来 runtime 依赖产生隐性差异
- 📍 位置：`src/templates/layout.mjs:62-70`、`about/index.html:28-34`、`contact/index.html:28-35`、`editor/index.html:28-38`、`overleaf/index.html:28-35`、`404.html:30-36`、`tests/links.test.mjs:63-91`
- 📝 当前状况描述：`CORE_SCRIPTS` 的顺序是 `error-handler -> utils -> i18n -> coder -> search-loader -> subscribe -> assistant-loader`。抽样手写页中，About/Contact/Editor/Overleaf 多数把 `subscribe.js` 放在 `search-loader.js` 前面，404 与模板一致。当前测试验证了部分脚本存在和若干前后关系，但没有要求手写页与模板的公共脚本序列完全一致。
- ⚠️ 影响程度：低到中
- 💡 建议方案（含伪代码或示例片段）：将公共脚本序列作为明确测试基准；页面专属脚本通过 `extraScriptsBeforeSearch` 或 `extraScriptsAfterCore` 明确声明插入位置。

```js
const CORE = ["/js/error-handler.js", "/js/utils.js", "/js/i18n.js", "/js/coder.js", "/js/search-loader.js", "/js/subscribe.js", "/js/assistant-loader.js"];
const scripts = extractScripts(html).filter((src) => CORE.includes(src));
assert.deepEqual(scripts, CORE, `${file} core scripts drifted`);
```

- 📊 预期收益：公共 runtime 的加载时序更可预期；未来搜索、订阅、助手或 i18n 之间出现依赖时，不会因为手写页脚本顺序不同而只在部分页面复现。
- 🔗 相关建议引用：`module-reviews/client-javascript.md`、`module-reviews/runtime-observability-and-error-resilience.md`

## 📌 HSG-04：`/contact/` 的唯一 H1 是“关于CWL”，路由语义与页面主标题不一致

- 📌 问题/建议标题：为静态页增加 route-specific H1/metadata 语义校验
- 📍 位置：`contact/index.html:7-13`、`contact/index.html:75-93`、`scripts/http-smoke.mjs:110-116`、`scripts/browser-smoke.mjs:205-206`、`tests/i18n-a11y.test.mjs:83-93`
- 📝 当前状况描述：`/contact/` 的 `<title>`、canonical、OG 和 JSON-LD 都指向联系页，但 `main` 内唯一 H1 是 `data-i18n="about.h1"` 的“关于CWL”，真正的“联系”是 H2。现有 smoke 只检查存在 H1，i18n/a11y 测试只检查每页恰好一个 H1，因此不会发现路由语义和主标题不一致。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在 route manifest 中声明期望 H1 或 `data-i18n` key，测试 title、canonical、H1、JSON-LD `@type/name` 是否同向。

```js
const routeContracts = {
  "/contact/": { h1I18n: "contact.h1", titleIncludes: "联系", jsonLdType: "ContactPage" },
};
for (const [route, contract] of Object.entries(routeContracts)) {
  const html = await readRouteHtml(route);
  assert.match(html, new RegExp(`<h1[^>]*data-i18n="${contract.h1I18n}"`));
}
```

- 📊 预期收益：SEO、可访问性和用户第一屏语义保持一致；搜索结果点击到联系页后，用户能立即看到“联系/留言”主任务。
- 🔗 相关建议引用：`module-reviews/seo-feed-and-structured-data.md`、`module-reviews/i18n-and-accessibility.md`

## 📌 HSG-05：手写静态页没有构建来源，公共 head/CSP/OG 更新需要人工复制

- 📌 问题/建议标题：将手写页迁移为模板输入，或建立公共 head/chrome 快照测试
- 📍 位置：`scripts/build.mjs:580-615`、`src/config.mjs:22-36`、`about/index.html:3-36`、`editor/index.html:3-40`、`overleaf/index.html:3-37`
- 📝 当前状况描述：`scripts/build.mjs` 会生成文章、列表、标签、归档、AI、工具、鉴赏、赞助、信任、sitemap、RSS 和搜索索引，但不会生成 About、Contact、Editor、Overleaf、404。它们直接维护完整 head、CSP、resource hints、OG/Twitter、JSON-LD、导航和页脚。每次公共 CSP、资源提示、搜索按钮属性、footer links 或赞助链接调整，都需要人工复制到这些手写页。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：短期增加 chrome snapshot test；中期把手写页改成 `src/templates/static-pages/*.mjs` 或 markdown/json 输入，由 `renderPage()` 输出。

```js
const generatedShell = renderPage({ title: "Shell Probe", description: "...", active: "", main: "<main id=\"main-content\"></main>" });
const expectedHeadTokens = extractCommonHeadTokens(generatedShell);
for (const file of handAuthoredPages) {
  assertCommonTokens(file, expectedHeadTokens);
}
```

- 📊 预期收益：公共安全策略、分享元信息、导航和页脚一次更新全站生效，同时保留手写页面的业务主体内容。
- 🔗 相关建议引用：`module-reviews/build-artifact-synchronization.md`、`module-reviews/route-registry-and-discovery-governance.md`

## 📌 HSG-06：404 页面未进入 smoke 路由，错误页交互入口只能依赖静态测试

- 📌 问题/建议标题：为 404 增加专门的 noindex + search/subscribe/assistant 可用性 smoke
- 📍 位置：`404.html:7-37`、`404.html:75-83`、`scripts/http-smoke.mjs:10`、`scripts/browser-smoke.mjs:11-14`
- 📝 当前状况描述：404 页面具备 `noindex,follow`、canonical、结构化数据、搜索按钮、订阅和助手脚本。但 HTTP/browser smoke 只覆盖公共正常路由，没有专门请求一个不存在路径并断言 GitHub Pages 404 体验或本地静态服务器 404 回退。错误页往往是用户迷路时最需要搜索和返回入口的页面，值得拥有轻量冒烟。
- ⚠️ 影响程度：低到中
- 💡 建议方案（含伪代码或示例片段）：本地 smoke 可以直接请求 `/404.html`；部署后可额外检查不存在路径返回 404 页面内容。

```js
await smokeRoute(baseUrl, "/404.html", {
  expectedTitle: /404/,
  requiredMeta: 'name="robots" content="noindex,follow"',
  requiredLinks: ["/", "/post/"],
});
```

- 📊 预期收益：确保错误页在发布后仍保留可导航、可搜索、可恢复的体验，不因公共 chrome 漂移变成孤岛。
- 🔗 相关建议引用：`module-reviews/browser-visual-smoke-testing.md`、`module-reviews/ux-improvements.md`

## 建议优先级

1. 中高优先级：补齐手写页导航和 footer links parity test，尤其是 `/trust/` 入口。
2. 中优先级：修正 `/contact/` 的 H1 语义，并增加 route-specific H1/metadata 契约。
3. 中优先级：把公共脚本顺序纳入 chrome parity，避免手写页和模板继续分叉。
4. 中优先级：逐步把 About/Contact/Editor/Overleaf/404 迁移到模板输入，或至少增加 head/chrome snapshot。
5. 低到中优先级：为 404 增加专门 smoke，覆盖错误页恢复路径。

## 本轮健康度评分

- 手写静态页治理健康度：3.4 / 5
- 当前强项：手写页基础可访问性测试通过，head 元信息、CSP、OG、JSON-LD 和公共脚本总体完整。
- 主要扣分：公共 chrome 复制维护导致导航、footer、搜索提示和脚本顺序漂移；联系页主标题语义与路由目标不一致。
