# CSS 资源归属与页面级样式评审

分析日期：2026-07-03
分析范围：公共布局模板、工具箱/信任页页面级 CSS、样式测试、链接完整性测试、生产验证脚本、当前生成产物。

## 本轮验证

- `node --test tests/css.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/performance.test.mjs tests/build.test.mjs tests/workflows.test.mjs`：111/111 通过。
- `npm run lint:check`、`npm run test:http-smoke`、`npm run test:browser-smoke`、`npm run test:coverage`、`npm run validate:production` 和 `git diff --check` 均已通过。
- 当前 `src/templates/tools.mjs` 与 `src/templates/trust.mjs` 已通过 `styles` 注入页面级 CSS，`tools/index.html` 引用 `/css/tools.css`，`trust/index.html` 引用 `/css/trust.css`；本轮提交需同时纳入这两个 CSS 文件和新信任页源文件。

## 结论摘要

项目正在从“所有样式集中在 `css/coder.css`”过渡到“公共 CSS + 页面级 CSS”。这个方向对性能和维护性都有价值，本轮已经完成工具页/信任页的首批页面级样式落地，新增 `src/page-assets.mjs` 统一声明页面级 CSS，用路由级 raw/gzip CSS 预算衡量实际加载成本，并补充“本地 CSS/JS 引用必须被 Git 跟踪”的发布护栏。剩余主要是更清晰的选择器归属边界。

---

## 📌 CSS-OWN-01 [已修复]：页面级 CSS 缺少统一资源清单，模板和产物容易漂移

- 📍 位置：`src/templates/layout.mjs:116-119`、`src/templates/layout.mjs:254-256`、`src/templates/tools.mjs:1058-1067`、`src/templates/trust.mjs:136-145`、`tools/index.html:15-16`、`trust/index.html:15-16`
- ✅ 修复状态：公共模板已经提供 `renderStyles(styles)`，并在全站固定加载 `/css/fontawesome-all.min.css` 与 `/css/coder.css` 后追加页面级样式。新增 `src/page-assets.mjs` 作为页面级资源清单，工具箱和信任页模板通过 `stylesForRoute("/tools/")` / `stylesForRoute("/trust/")` 读取样式；当前生成产物中 `tools/index.html` 和 `trust/index.html` 均已引用对应页面级 CSS，`tests/templates-extended.test.mjs` 会校验 manifest 与模板输出一致。
- 📝 剩余状况描述：生产验证脚本还未直接从 manifest 收集资源，但性能测试已覆盖已提交 HTML 的本地 CSS/JS 引用存在性和 Git 跟踪状态。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：为每个路由建立资源 manifest，并让模板、构建产物校验、链接测试和生产验证都从同一份 manifest 派生。

```js
// src/page-assets.mjs
export const PAGE_ASSETS = {
  "/": { styles: [] },
  "/tools/": { styles: ["/css/tools.css"] },
  "/trust/": { styles: ["/css/trust.css"] },
};

export function stylesForRoute(route) {
  return PAGE_ASSETS[route]?.styles ?? [];
}
```

```js
// 构建或测试中校验生成产物
for (const [route, assets] of Object.entries(PAGE_ASSETS)) {
  const html = await readGeneratedHtml(route);
  for (const href of assets.styles) {
    assert.match(html, new RegExp(`href="${escapeRegExp(href)}"`));
  }
}
```

- 📊 预期收益：新增页面或拆分 CSS 时只改一处配置，减少“源码模板已接入、生成 HTML 未同步”的上线风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/build-artifact-synchronization.md`、`docs/suggestions/module-reviews/trust-page-launch-readiness.md`、`docs/suggestions/module-reviews/layout-responsive-print-review.md`

---

## 📌 CSS-OWN-02 [已修复]：测试会读取未跟踪 CSS，本地通过不等于干净部署可用

- 📍 位置：`tests/css.test.mjs:123-132`、`tests/css.test.mjs:182-191`、`tests/performance.test.mjs:54-65`、`css/tools.css:1-60`、`css/trust.css:1-5`
- ✅ 修复状态：`tests/performance.test.mjs` 已新增 `referenced local CSS and JS files are tracked by git`，扫描所有已提交 HTML 的本地 `.css` / `.js` 引用，规范化路径后与 `git ls-files` 对比；如果本地存在但未提交，测试会失败。
- ⚠️ 影响程度：高
- 💡 已采用方案：对所有被 HTML 引用的本地 CSS/JS 增加“必须被 Git 跟踪”的只读校验；后续如果新增资源 manifest，也可以将 manifest 中的非 HTML 引用纳入同一校验。

```js
import { execFileSync } from "node:child_process";

function trackedFiles() {
  return new Set(execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean));
}

test("referenced CSS files are committed", async () => {
  const tracked = trackedFiles();
  for (const href of await collectCssRefsFromRenderedPages()) {
    assert.ok(tracked.has(href.replace(/^\//, "")), `${href} must be tracked by git`);
  }
});
```

- 📊 实际收益：能在提交前发现“本地有文件、仓库里没有”的部署缺口，尤其适合 GitHub Pages 这种直接发布静态文件的项目。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/build-artifact-synchronization.md`、`docs/suggestions/devex-improvements.md`

---

## 📌 CSS-OWN-03：`coder.css` 与页面级 CSS 的选择器边界尚未清晰，存在重复归属风险

- 📍 位置：`css/coder.css:3932-4228`、`css/coder.css:5678-5678`、`css/tools.css:1-60`、`css/tools.css:595-622`、`css/trust.css:1-5`
- 📝 当前状况描述：`css/tools.css` 已承载手势、星河和对象捕获等工具箱专属样式，但 `css/coder.css` 中仍保留 `.tools-page`、`.tool-btn` 等大量工具箱基础选择器。`css/trust.css` 也开始承载信任页专属规则，同时 `css/coder.css` 中仍出现信任页移动端规则。半拆分状态容易让后续修改者不确定某个选择器应该改全局文件还是页面文件，最终形成重复规则或覆盖顺序依赖。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：把 CSS 拆分定义成三层归属，并用注释或 manifest 记录迁移状态。

```text
css/coder.css
  - reset / theme tokens / typography
  - global layout / nav / footer
  - shared components used by 2+ routes

css/tools.css
  - only /tools/ panels and browser API demos
  - selectors should be rooted under .tools-page or .tool-*

css/trust.css
  - only /trust/ cards, service facts, report CTA
  - selectors should be rooted under .trust-page or .trust-*
```

```css
/* css/tools.css */
.tools-page .gesture-controls { ... }

/* css/trust.css */
.trust-page .trust-service-facts { ... }
```

- 📊 预期收益：减少选择器冲突和重复维护，也让后续按路由预算、按路由截图回归更容易落地。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-analysis.md`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`

---

## 📌 CSS-OWN-04 [已修复]：CSS 断言对格式过于敏感，压缩写法会触发误报

- 📍 位置：`tests/css.test.mjs:182-191`、`css/trust.css:3-5`
- ✅ 修复状态：`trust.css contains trust center selectors` 已改为允许压缩写法的 media query 正则，聚焦 CSS/模板/性能/构建/工作流测试 111/111 通过。
- 📝 剩余状况描述：类似断言如果继续增加，仍建议抽出 CSS 规范化 helper 或引入解析器，避免格式化、压缩或选择器重排变成测试噪音。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：对 CSS 规则使用解析器或最小规范化函数；如果继续用正则，应先去除无意义空白并拆成多个语义断言。

```js
function compactCss(css) {
  return css.replace(/\s+/g, "");
}

test("trust layout collapses on mobile", async () => {
  const css = compactCss(await readFile(join(ROOT, "css", "trust.css"), "utf8"));
  assert.ok(css.includes("@media(max-width:768px)"));
  assert.ok(css.includes(".trust-stats,.trust-card-grid,.trust-columns,.trust-service-facts{grid-template-columns:1fr"));
});
```

更稳的做法是接入 `postcss`：

```js
const root = postcss.parse(css);
const mobileRules = root.nodes.filter((node) => node.type === "atrule" && node.params.includes("max-width"));
assert.ok(mobileRules.some((rule) => rule.toString().includes(".trust-service-facts")));
```

- 📊 预期收益：减少 CSS 压缩和格式调整造成的误报，让测试更接近真实用户可见行为。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/seo-feed-and-structured-data.md`、`docs/suggestions/module-reviews/trust-page-launch-readiness.md`

---

## 📌 CSS-OWN-05 [已修复]：性能预算仍以 `coder.css` 原始体积为主，无法衡量路由级收益

- 📍 位置：`tests/performance.test.mjs:222-225`、`src/templates/layout.mjs:254-256`、`src/templates/tools.mjs:1066-1067`、`src/templates/trust.mjs:143-143`
- ✅ 修复状态：`tests/performance.test.mjs` 保留 `coder.css <= 140KB` 单文件门禁，同时新增 `/`、`/tools/`、`/trust/` 路由级 CSS 预算，校验 HTML 中的 CSS 引用必须等于 core CSS 加 `PAGE_ASSETS`，并统计 raw/gzip 总体积。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：增加路由级 CSS 预算报告，保留单文件门禁，同时统计 gzip 后大小。

```js
const CSS_BUDGETS = {
  "/": { rawKb: 135, gzipKb: 28, files: ["/css/coder.css"] },
  "/tools/": { rawKb: 150, gzipKb: 32, files: ["/css/coder.css", "/css/tools.css"] },
  "/trust/": { rawKb: 142, gzipKb: 30, files: ["/css/coder.css", "/css/trust.css"] },
};

for (const [route, budget] of Object.entries(CSS_BUDGETS)) {
  const sizes = await cssSizesForRoute(route);
  assert.ok(sizes.rawKb <= budget.rawKb);
  assert.ok(sizes.gzipKb <= budget.gzipKb);
}
```

- 📊 预期收益：让 CSS 拆分的收益可量化，避免把样式从一个文件移到另一个文件后失去总体预算视角。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/module-reviews/layout-responsive-print-review.md`

---

## 📌 CSS-OWN-06：生产验证脚本只列核心文件，未覆盖页面级 CSS 与生成页面资源

- 📍 位置：`scripts/validate-production.mjs:50-62`、`tests/performance.test.mjs:54-65`
- 📝 当前状况描述：生产验证脚本的 required 文件包含 `css/coder.css`、`index.html`、`robots.txt` 等核心资产，但没有覆盖 `css/tools.css`、`css/trust.css` 这类页面级资源。链接测试虽然会扫描 HTML 中的 CSS 引用，但它读取的是当前文件系统；如果生成产物未引用页面级 CSS，或者未跟踪文件只存在本地，生产验证并不能形成完整闭环。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：生产验证不应手写页面级资源列表，而应从渲染后的 HTML 或 `PAGE_ASSETS` manifest 收集资源，再同时校验“存在、被引用、被 Git 跟踪”。

```js
async function checkPageAssets() {
  const htmlFiles = await committedHtmlFiles();
  const referenced = await collectCssAndJsRefs(htmlFiles);
  const tracked = await gitTrackedFiles();

  for (const asset of referenced) {
    assert.ok(await fileExists(asset), `missing referenced asset: ${asset}`);
    assert.ok(tracked.has(asset), `asset is not committed: ${asset}`);
  }
}
```

- 📊 预期收益：降低静态站点发布时的资源 404 风险，并让页面级 CSS 拆分可以放心继续推进。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/build-artifact-synchronization.md`、`docs/suggestions/module-reviews/trust-page-launch-readiness.md`

---

## 优先级待办

1. 中优先级：明确 `coder.css`、`tools.css`、`trust.css` 的选择器归属边界，逐步移除重复规则。
2. 中优先级：继续将 AI 助手浮层样式和工具页基础样式从 core CSS 中拆出。
3. 中优先级：让生产验证脚本也从 `PAGE_ASSETS` 或 HTML 扫描中收集页面级资源。

## 本轮健康度评分

CSS 资源治理健康度：4.0 / 5。
优势是模板、资源 manifest、生成产物和测试已经覆盖工具页/信任页页面级 CSS，并且有路由级 raw/gzip 预算和 Git 跟踪校验；风险在于选择器归属边界和生产验证脚本的资源收集仍需继续收紧。
