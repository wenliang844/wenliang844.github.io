# CSS 资源归属与页面级样式评审

分析日期：2026-07-03
分析范围：公共布局模板、工具箱/信任页页面级 CSS、AI 助手懒加载 CSS、样式测试、链接完整性测试、生产验证脚本、当前生成产物。

## 本轮验证

- `node --test tests/css.test.mjs tests/performance.test.mjs tests/templates-extended.test.mjs tests/pwa-precache.test.mjs tests/workflows.test.mjs`：113/113 通过。
- `node --test tests/service-worker-generation.test.mjs tests/pwa-precache.test.mjs`：8/8 通过。
- `npm run lint:check`、`npm run check:pwa-precache`、`npm run check:service-worker` 和 `node --test tests/performance.test.mjs` 均已通过。
- 当前 `src/templates/tools.mjs` 与 `src/templates/trust.mjs` 已通过 `styles` 注入页面级 CSS，`tools/index.html` 引用 `/css/tools.css`，`trust/index.html` 引用 `/css/trust.css`；工具页 shell/面板基础样式已迁入 `/css/tools.css`；AI 助手面板样式迁入 `/css/assistant.css`，由 `js/assistant-loader.js` 首次打开时注入。

## 结论摘要

项目正在从“所有样式集中在 `css/coder.css`”过渡到“公共 CSS + 页面级 CSS + 交互按需 CSS”。这个方向对性能和维护性都有价值，本轮已经完成工具页/信任页的页面级样式落地，把工具页 shell/面板基础样式迁入 `css/tools.css`，并把 AI 助手浮层样式拆到按需加载的 `css/assistant.css`。`src/page-assets.mjs`、PWA 预缓存、路由级 raw/gzip CSS 预算、“本地 CSS/JS 引用必须被 Git 跟踪”和“生产验证扫描 HTML + PAGE_ASSETS 本地资源”的发布护栏已经覆盖主要拆包路径。剩余主要是更细的共享组件归属边界。

---

## 📌 CSS-OWN-01 [已修复]：页面级 CSS 缺少统一资源清单，模板和产物容易漂移

- 📍 位置：`src/templates/layout.mjs:116-119`、`src/templates/layout.mjs:254-256`、`src/templates/tools.mjs:1058-1067`、`src/templates/trust.mjs:136-145`、`tools/index.html:15-16`、`trust/index.html:15-16`
- ✅ 修复状态：公共模板已经提供 `renderStyles(styles)`，并在全站固定加载 `/css/fontawesome-all.min.css` 与 `/css/coder.css` 后追加页面级样式。新增 `src/page-assets.mjs` 作为页面级资源清单，工具箱和信任页模板通过 `stylesForRoute("/tools/")` / `stylesForRoute("/trust/")` 读取样式；当前生成产物中 `tools/index.html` 和 `trust/index.html` 均已引用对应页面级 CSS，`tests/templates-extended.test.mjs` 会校验 manifest 与模板输出一致。
- 📝 当前状况描述：生产验证脚本已直接从 HTML 和 `pageAssetUrls()` 收集本地 CSS/JS 资源并检查存在性；性能测试仍覆盖已提交 HTML 的本地 CSS/JS 引用存在性和 Git 跟踪状态。
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

## 📌 CSS-OWN-03 [已修复核心]：`coder.css` 与页面级 CSS 的选择器边界仍需继续收紧

- 📍 位置：`css/coder.css`、`css/tools.css`、`css/trust.css`、`css/assistant.css`
- ✅ 修复状态：`css/tools.css` 已承载工具页 shell、tab、面板、字段、输出、QR/时间/UUID 预览、手势、星河和对象捕获等工具箱专属样式；`css/trust.css` 承载信任页专属规则；`css/assistant.css` 承载助手浮层和消息面板规则。`css/coder.css` 保留 reset/token、导航、布局、文章、编辑器工具按钮等全站或跨页面共享规则。
- 📝 剩余状况描述：核心工具页大块选择器边界已清晰；后续仍可继续审查更细的共享组件，例如编辑器嵌入、AI 导航页工具卡和少量按钮变体，避免未来新增页面时重新把页面专属规则写回 core。
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

css/assistant.css
  - only lazy-loaded assistant widget, panel, messages and settings
  - injected by js/assistant-loader.js, not referenced from the base HTML
```

```css
/* css/tools.css */
.tools-page .gesture-controls { ... }

/* css/trust.css */
.trust-page .trust-service-facts { ... }
```

- 📊 实际收益：`coder.css` 回落到 103,446 bytes / 4,783 行；`tools.css` 扩展到 21,902 bytes / 1,169 行但只在 `/tools/` 加载。普通页面不再解析工具箱 shell 和面板基础样式，路由级 CSS 预算仍保持通过。
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

## 📌 CSS-OWN-06 [已修复]：生产验证脚本只列核心文件，未覆盖页面级 CSS 与生成页面资源

- 📍 位置：`scripts/validate-production.mjs:50-62`、`tests/performance.test.mjs:54-65`
- ✅ 修复状态：`validate:production` 新增 `checkLocalResourceReferences()`，递归扫描所有 HTML 中的本地 CSS/JS 引用是否存在，并额外读取 `pageAssetUrls()` 检查 `PAGE_ASSETS` 派生资源。当前生产验证会检查 21 个 HTML 页面和 2 个 manifest 资源；`tests/workflows.test.mjs` 已锁定该检查。
- ⚠️ 影响程度：中
- 💡 已采用方案：生产验证从渲染后的 HTML 和 `PAGE_ASSETS` manifest 收集资源，校验文件存在；Git 跟踪状态仍由 `tests/performance.test.mjs` 的发布护栏覆盖。

```js
async function checkPageAssets() {
  const htmlFiles = await committedHtmlFiles();
  const referenced = await collectCssAndJsRefs(htmlFiles);

  for (const asset of referenced) {
    assert.ok(await fileExists(asset), `missing referenced asset: ${asset}`);
  }
}
```

- 📊 预期收益：降低静态站点发布时的资源 404 风险，并让页面级 CSS 拆分可以放心继续推进。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/build-artifact-synchronization.md`、`docs/suggestions/module-reviews/trust-page-launch-readiness.md`

---

## 📌 CSS-OWN-07 [已修复]：AI 助手浮层样式仍随 core CSS 全站解析

- 📍 位置：`css/coder.css`、`css/assistant.css`、`js/assistant-loader.js`、`src/pwa-precache.mjs`
- ✅ 修复状态：助手浮层、消息列表、配置面板、隐私控件和移动端适配规则已迁入 `css/assistant.css`；`coder.css` 只保留导航 AI 按钮的基础入口样式。`assistant-loader.js` 在首次点击 `[data-assistant-toggle]` 或 `?assistant=fullscreen` 深链时注入 `<link rel="stylesheet" href="/css/assistant.css">` 和 `/js/assistant.js`，并在样式与脚本都完成后重放首次点击。
- 🧪 验证：`tests/assistant-loader.test.mjs` 覆盖默认不加载 CSS/JS、首次点击注入样式与运行时并重放、fullscreen 深链主动加载；`tests/css.test.mjs` 锁定 `coder.css` 不再包含助手面板/消息/隐私样式；`check:pwa-precache` 现在覆盖 19 个预缓存 URL，其中包括 `/css/assistant.css`。
- 📊 实际收益：普通页面首屏不再解析约 18KB 的助手面板样式，`coder.css` 回落到 112,956 bytes / 5,311 行；离线打开助手时新样式也能由 Service Worker 预缓存提供。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md#-p-17-已修复核心-全站统一加载-codercss工具箱和助手样式成本扩散到所有页面`、`docs/suggestions/module-reviews/pwa-offline-cache-readiness.md`

---

## 📌 CSS-OWN-08 [已修复]：工具页 shell/面板基础样式仍随 core CSS 全站解析

- 📍 位置：`css/coder.css`、`css/tools.css`、`tests/css.test.mjs`、`tests/performance.test.mjs`
- ✅ 修复状态：`.tools-page`、`.tools-shell`、`.tools-tabs`、`.tool-tab`、`.tool-panel`、`.tool-field`、`.tool-output`、`.tool-actions`、QR/时间/UUID 预览和移动端工具页布局规则已从 `css/coder.css` 迁入 `css/tools.css`。`coder.css` 只保留编辑器工具栏仍会用到的 `.tool-btn` / `.tool-sep` 基础样式。
- 🧪 验证：`tests/css.test.mjs` 锁定 `coder.css` 不再包含工具页 shell/面板/字段样式，并确认 `tools.css` 包含工具页 shell、浏览器 API 工具和移动端规则；`tests/performance.test.mjs` 路由级 CSS raw/gzip 预算通过。
- 📊 实际收益：`coder.css` 从 112,956 bytes 降到 103,446 bytes；非工具页无需解析工具箱基础面板规则，工具页自身仍通过 `/css/tools.css` 获得完整样式。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md#-p-17-已修复核心-全站统一加载-codercss工具箱和助手样式成本扩散到所有页面`

---

## 优先级待办

1. 中优先级：继续审查更细的共享组件归属，避免新增页面把专属规则写回 core。
2. 中优先级：推进工具页 JS 单包和模型资源加载体验治理。
3. 已完成：让生产验证脚本从 `PAGE_ASSETS` 和 HTML 扫描中收集页面级资源。
4. 已完成：将 AI 助手浮层样式从 core CSS 中拆到按需加载 CSS。
5. 已完成：将工具页 shell/面板基础样式从 core CSS 中拆到页面级 CSS。

## 本轮健康度评分

CSS 资源治理健康度：4.3 / 5。
优势是模板、资源 manifest、生成产物、测试、PWA 预缓存和生产验证已经覆盖工具页/信任页页面级 CSS 与助手按需 CSS，并且有路由级 raw/gzip 预算、Git 跟踪校验和本地资源存在性校验；主要风险转为更细的共享组件归属、工具页 JS 单包和模型资源加载体验。
