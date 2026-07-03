# 布局、响应式与打印样式专题分析

生成时间：2026-07-03  
分析范围：`css/coder.css`、布局模板、CSS/性能测试，以及本地静态服务下的代表页面响应。  
本轮验证：

- `node --test tests/css.test.mjs tests/performance.test.mjs tests/performance-behavior.test.mjs tests/templates.test.mjs tests/build-extra.test.mjs`，107/107 通过。
- 短暂启动 `http-server` 后请求 `/`、`/post/`、`/ai/`、`/appreciation/`、`/sponsor/`、`/tools/`，均返回 200；观察到 `/post/` 约 109KB、`/tools/` 约 108KB。

约束说明：本轮仅新增 `/docs/suggestions/module-reviews/layout-responsive-print-review.md`，未修改源码、配置或测试。

## 总览

当前 CSS 基础覆盖较完整：选择器、移动端降级、体积预算和资源引用均有自动化测试保护。但测试大多是字符串级断言，缺少真实视口下的溢出、打印和可视回归验证。剩余风险主要集中在打印样式偏 Overleaf、长页面首屏外渲染成本、移动端固定面板对动态视口不敏感，以及 CSS 预算过于粗粒度。

严重程度分布：

- 高：0
- 中：5
- 低：2

## 建议清单

### 1. 打印样式主要服务 Overleaf，普通文章打印仍可能带入交互组件

- 📌 问题/建议标题：为文章页补充专用打印布局
- 📍 位置：`css/coder.css:5696-5748`、`src/templates/post.mjs:84-95`、`src/templates/post.mjs:142-149`、`src/templates/post.mjs:254-259`
- 📝 当前状况描述：`@media print` 已隐藏导航、页脚、光标特效，并重点处理 `.overleaf-*` 和 `.latex-preview-paper`。但普通文章页没有独立打印规则，`.post-share`、`.comments`、`.next-popup`、`.article-toc` 等阅读辅助或交互组件没有被明确排除。如果用户在文章底部触发下一篇浮层后打印，或直接打印带评论区的文章，纸面输出会混入非正文内容。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```css
@media print {
  @page {
    size: A4;
    margin: 14mm 16mm;
  }

  .post-share,
  .comments,
  .next-popup,
  .article-toc,
  .post-related,
  .assistant-widget {
    display: none !important;
  }

  .article,
  .article-content {
    max-width: none !important;
    color: #111 !important;
    background: #fff !important;
  }
}
```

- 📊 预期收益：提升文章打印/导出 PDF 的可读性，避免把分享、评论、浮层推荐等屏幕交互带进正式文档。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/module-reviews/editor-overleaf-authoring-workflows.md`。

### 2. CSS 打印测试只是“可选存在”，无法防止打印规则退化

- 📌 问题/建议标题：打印样式缺少行为级断言
- 📍 位置：`tests/css.test.mjs:345-350`、`css/coder.css:5696-5748`
- 📝 当前状况描述：当前测试只判断如果存在 `@media print` 就通过，没有断言打印时必须隐藏哪些组件、文章主体是否保留、A4 边距是否合理，也没有覆盖 Overleaf 与普通文章的差异。也就是说，打印规则被删到只剩空块时测试仍可能通过。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
test("coder.css print rules hide screen-only widgets", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  const printBlock = css.match(/@media print\s*{([\s\S]+?)\n}/)?.[1] || "";

  for (const selector of [".navigation", ".footer", ".post-share", ".comments", ".next-popup"]) {
    assert.match(printBlock, new RegExp(selector.replace(".", "\\.")));
  }

  assert.match(printBlock, /@page\s*{[\s\S]*?margin:\s*(?!0;)/);
});
```

- 📊 预期收益：把打印体验从“人工约定”变成可回归检查，避免后续 CSS 重排时误删关键规则。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-analysis.md`、`docs/suggestions/devex-improvements.md`。

### 3. 长页面缺少 `content-visibility`，首屏外卡片仍会参与初始渲染

- 📌 问题/建议标题：为长列表和卡片区域引入首屏外渲染延迟策略
- 📍 位置：`css/coder.css:1400-1424`、`css/coder.css:1518-1548`、`css/coder.css:1571-1588`、`css/coder.css:3910-4233`
- 📝 当前状况描述：AI 工具网格、Relay 卡片、鉴赏榜单、工具箱多面板都使用网格和卡片布局；本轮服务观察中 `/post/` 和 `/tools/` HTML 体积均超过 108KB。CSS 扫描未发现 `content-visibility`、`contain-intrinsic-size` 或类似延迟渲染策略。页面加载时，首屏外的大量卡片和表单仍可能参与样式计算与布局。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```css
@supports (content-visibility: auto) {
  .ai-category,
  .relay-site,
  .rank-board,
  .tools-panel,
  .post-related,
  .comments {
    content-visibility: auto;
    contain-intrinsic-size: 1px 32rem;
  }
}
```

落地时建议先对非首屏区域开启，并用真实设备或性能面板比较 LCP、CLS 和滚动首次进入区域的抖动。

- 📊 预期收益：减少长页面初始布局和绘制压力，尤其对移动端工具箱、榜单页和文章详情页更明显。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/module-reviews/product-info-pages-and-rankings.md`。

### 4. CSS 预算只有单文件原始体积，缺少 gzip 和路由级预算

- 📌 问题/建议标题：把 CSS 预算从“全局文件大小”升级为“传输与页面成本”
- 📍 位置：`tests/performance.test.mjs:222-225`、`src/templates/layout.mjs:237`、`css/coder.css:1-6671`
- 📝 当前状况描述：测试只要求 `coder.css` 不超过 140KB，布局模板则让所有页面统一加载 `/css/coder.css`。这能防止文件无限增长，但无法反映 gzip 后体积、未使用规则比例、路由差异和首屏关键 CSS 成本。比如赞助页只需要很少组件样式，却仍会解析工具箱、Overleaf、助手等样式。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const budgets = {
  "css/coder.css": { rawKb: 140, gzipKb: 28 },
  "/sponsor/": { cssUsedRatioMin: 0.25 },
  "/tools/": { cssUsedRatioMin: 0.45 },
};

assert.ok(rawSizeKb <= budgets["css/coder.css"].rawKb);
assert.ok(gzipSizeKb <= budgets["css/coder.css"].gzipKb);
```

在不立刻拆分 CSS 的前提下，也可以先用构建报告记录各页面实际加载的 CSS/JS/HTML 体积。

- 📊 预期收益：更早发现“单页功能扩张拖慢全站”的趋势，为后续页面级 CSS 拆分提供量化依据。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-analysis.md#mr-css-07-复查发现-css-单包已增长到-6637-行`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`。

### 5. 移动端固定面板使用 `100vh`，对动态浏览器工具栏和安全区不够敏感

- 📌 问题/建议标题：固定浮层高度应兼容 `dvh` 和 safe area
- 📍 位置：`css/coder.css:5062-5083`、`css/coder.css:6002-6023`、`css/coder.css:6179-6192`、`css/coder.css:6324-6338`
- 📝 当前状况描述：AI 助手面板、文章 TOC、博客树浮层等固定区域大量使用 `calc(100vh - ...)` 或 `max-height: calc(100vh - 8rem)`。在移动端 Safari/Chrome 中，地址栏展开收起会改变可视区域；未使用 `100dvh`、`svh` 或 `env(safe-area-inset-bottom)` 时，底部输入框、关闭按钮或浮层边缘可能被浏览器工具栏/刘海安全区遮挡。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```css
:root {
  --viewport-height: 100vh;
}

@supports (height: 100dvh) {
  :root {
    --viewport-height: 100dvh;
  }
}

.assistant-panel {
  height: min(44rem, calc(var(--viewport-height) - var(--assistant-nav-height, 4.6rem) - 1.5rem - env(safe-area-inset-bottom, 0px)));
}
```

- 📊 预期收益：减少移动端浮层被系统 UI 遮挡的问题，提升助手输入、文章目录和博客树浮层的稳定性。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/assistant-loader-and-llm-runtime.md`、`docs/suggestions/module-reviews/core-reading-interactions.md`。

### 6. 工具箱移动端横向分类条使用 `100vw`，在滚动条/容器内可能产生轻微溢出

- 📌 问题/建议标题：横向滚动卡片宽度应以容器为基准
- 📍 位置：`css/coder.css:5955-5967`、`tests/css.test.mjs:107-119`
- 📝 当前状况描述：移动端 `.tools-tabs` 横向滚动，`.tool-category` 使用 `flex: 0 0 calc(100vw - 2rem)` 和 `max-width: calc(100vw - 2rem)`。由于 `.container` 本身也有 `width: min(100% - 2rem, 96rem)`，在存在垂直滚动条、系统缩放或嵌入式 WebView 时，`100vw` 可能比容器可用宽度略大，造成 1 到数像素的横向抖动。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```css
.tools-tabs {
  container-type: inline-size;
}

.tool-category {
  flex-basis: min(100%, 32rem);
  max-width: 100%;
}

@container (max-width: 36rem) {
  .tool-category {
    flex-basis: 100cqw;
  }
}
```

如果暂不使用容器查询，可以先改为 `flex-basis: min(100%, calc(100vw - 2rem))` 并加一个移动端横向溢出检测。

- 📊 预期收益：减少窄屏工具箱横向滚动之外的页面级横向溢出，让滚动行为只发生在分类条内部。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-core-runtime-safety.md`、`docs/suggestions/ux-improvements.md`。

### 7. 缺少真实视口的视觉/溢出回归测试

- 📌 问题/建议标题：CSS 测试应补充 Playwright 级别的布局冒烟检查
- 📍 位置：`package.json:12-20`、`tests/css.test.mjs:309-350`、`tests/performance.test.mjs:222-225`
- 📝 当前状况描述：当前 CSS 测试可以证明选择器和部分规则存在，但不能发现文本溢出、浮层遮挡、移动端横向滚动、打印预览异常、主题对比度退化等视觉问题。项目脚本里也没有浏览器级测试入口。对一个静态博客/工具站来说，JSDOM 测试覆盖逻辑，Playwright 覆盖布局，会更稳。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
for (const viewport of [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`no horizontal overflow at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/tools/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
```

建议先覆盖 `/post/`、`/tools/`、`/ai/`、`/sponsor/`，再增加 `page.emulateMedia({ media: "print" })` 的打印快照。

- 📊 预期收益：把“肉眼巡检”前移到 CI，降低布局回归流入生产页面的概率。
- 🔗 相关建议引用：`docs/suggestions/devex-improvements.md`、`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`。

## 后续优先级

1. 先补文章页打印规则和打印测试，因为这是成本低、收益明确的阅读体验改进。
2. 对 `/tools/`、`/post/` 这类长页面试点 `content-visibility`，并记录 LCP/CLS 对比。
3. 为移动端固定浮层抽象 `--viewport-height`，兼容 `100dvh` 与 safe area。
4. 将 CSS 预算扩展到 gzip 和路由级报告，保留现有 140KB 原始体积门禁。
5. 引入最小 Playwright 溢出冒烟测试，优先覆盖 375px 宽度和打印媒体。

