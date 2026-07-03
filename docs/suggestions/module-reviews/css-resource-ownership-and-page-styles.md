# CSS 资源归属与页面级样式评审

分析日期：2026-07-03
分析范围：公共布局模板、工具箱/信任页页面级 CSS、样式测试、链接完整性测试、生产验证脚本、当前生成产物。

## 本轮验证

- `node --test tests/css.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/performance.test.mjs tests/links.test.mjs`：100/101 通过，唯一失败为 `trust.css` 的移动端 media query 正则断言。
- `git ls-files --error-unmatch css/tools.css css/trust.css src/templates/trust.mjs src/trust-data.mjs trust/index.html`：退出 1，说明这些当前工作区文件尚未进入 Git 跟踪集合。
- 当前 `src/templates/tools.mjs` 与 `src/templates/trust.mjs` 已通过 `styles` 注入页面级 CSS，但 `tools/index.html`、`trust/index.html` 的当前生成产物仍只引用 `/css/coder.css`。

## 结论摘要

项目正在从“所有样式集中在 `css/coder.css`”过渡到“公共 CSS + 页面级 CSS”。这个方向对性能和维护性都有价值，但当前处在半迁移阶段：模板、测试、生成产物、Git 跟踪状态和生产验证脚本还没有形成同一个事实来源。短期最需要补的是资源清单、干净检出校验和格式鲁棒的 CSS 测试。

---

## 📌 CSS-OWN-01：页面级 CSS 缺少统一资源清单，模板和产物容易漂移

- 📍 位置：`src/templates/layout.mjs:116-119`、`src/templates/layout.mjs:254-256`、`src/templates/tools.mjs:1058-1067`、`src/templates/trust.mjs:136-145`、`tools/index.html:15-16`、`trust/index.html:15-16`
- 📝 当前状况描述：公共模板已经提供 `renderStyles(styles)`，并在全站固定加载 `/css/fontawesome-all.min.css` 与 `/css/coder.css` 后追加页面级样式。工具箱模板声明 `styles: ["/css/tools.css"]`，信任页模板声明 `styles: ["/css/trust.css"]`。但当前生成产物扫描显示 `tools/index.html` 和 `trust/index.html` 仍只引用 `/css/coder.css`，页面级样式声明没有同步到根目录 HTML 产物。
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

## 📌 CSS-OWN-02：测试会读取未跟踪 CSS，本地通过不等于干净部署可用

- 📍 位置：`tests/css.test.mjs:123-132`、`tests/css.test.mjs:182-191`、`tests/performance.test.mjs:54-65`、`css/tools.css:1-60`、`css/trust.css:1-5`
- 📝 当前状况描述：样式测试直接读取 `css/tools.css` 和 `css/trust.css`，链接完整性测试只检查当前文件系统存在即可。当前工作区中这两个 CSS 文件存在，但 `git ls-files --error-unmatch` 证明它们还未被 Git 跟踪。这样本地测试可能因为未跟踪文件存在而通过，CI 或 GitHub Pages 干净检出时却缺少资源。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：对所有被 HTML 或模板引用的 CSS/JS 增加“必须被 Git 跟踪”的只读校验，或在 CI 中使用干净 clone 运行同一组测试。

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

- 📊 预期收益：能在提交前发现“本地有文件、仓库里没有”的部署缺口，尤其适合 GitHub Pages 这种直接发布静态文件的项目。
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

## 📌 CSS-OWN-04：CSS 断言对格式过于敏感，压缩写法会触发误报

- 📍 位置：`tests/css.test.mjs:182-191`、`css/trust.css:3-5`
- 📝 当前状况描述：本轮样式测试唯一失败来自 `trust.css contains trust center selectors`。`css/trust.css` 中确实存在 `@media(max-width:768px)` 和 `.trust-stats,.trust-card-grid,.trust-columns,.trust-service-facts{grid-template-columns:1fr}`，但测试用正则对 media query 与选择器串联方式较敏感，导致压缩后的 CSS 被判为不匹配。类似断言如果继续增加，会让格式化、压缩或选择器重排变成测试噪音。
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

## 📌 CSS-OWN-05：性能预算仍以 `coder.css` 原始体积为主，无法衡量路由级收益

- 📍 位置：`tests/performance.test.mjs:222-225`、`src/templates/layout.mjs:254-256`、`src/templates/tools.mjs:1066-1067`、`src/templates/trust.mjs:143-143`
- 📝 当前状况描述：现有性能测试只约束 `coder.css` 原始体积不超过 140KB。页面级 CSS 拆分后，单看 `coder.css` 变小并不等于首屏 CSS 成本下降；还需要统计每个路由实际加载的 CSS 总 raw/gzip 体积、请求数量和页面专属 CSS 是否只出现在对应路由。
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

1. 高优先级：补充“引用资源必须被 Git 跟踪”的测试，覆盖 CSS 和 JS。
2. 高优先级：让页面级 CSS 的模板声明、生成产物和生产验证脚本共享同一份资源清单。
3. 中优先级：修正 `trust.css` 测试为格式无关断言，避免压缩 CSS 误报。
4. 中优先级：明确 `coder.css`、`tools.css`、`trust.css` 的选择器归属边界，逐步移除重复规则。
5. 中优先级：新增按路由 raw/gzip CSS 预算，观察拆分后的真实加载成本。

## 本轮健康度评分

CSS 资源治理健康度：3.4 / 5。
优势是模板已经具备页面级样式注入能力，且现有测试覆盖了大量选择器和资源引用；风险在于当前拆分链路还没有跨模板、产物、Git 跟踪和生产验证形成闭环。
