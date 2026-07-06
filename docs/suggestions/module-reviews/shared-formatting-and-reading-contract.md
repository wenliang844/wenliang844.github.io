# 共享格式化与阅读指标契约评审

分析范围：`src/lib/format.mjs`、`src/lib/reading.mjs`、`js/utils.js`、`scripts/build.mjs`、`src/templates/post.mjs`、`tests/format.test.mjs`、`tests/build-extended.test.mjs`、`tests/utils.test.mjs`。

## 本轮验证

- `node --test tests/format.test.mjs tests/utils-deep.test.mjs tests/build-extended.test.mjs`：78/78 通过。
- 本轮已落地第一阶段：`format.mjs` 对 `YYYY-MM-DD` 做严格格式与日历合法性校验；`tests/utils-deep.test.mjs` 用同一组 fixture 对比 Node 共享 helper 与 JSDOM `CWLUtils` 的 `readingMinutes()` / `escapeHtml()` 输出。
- `node --test tests/format.test.mjs tests/build-extended.test.mjs tests/coder.test.mjs tests/editor.test.mjs tests/utils.test.mjs tests/utils-deep.test.mjs`：131/131 通过。
- 只读扫描确认：构建端阅读时间已从 `src/lib/reading.mjs` 复用，浏览器端 `CWLUtils.readingMinutes` 仍保留一份手写实现；日期/RSS/sitemap 工具现在已具备本地非法日期断言，不再只依赖上游 `normalizeDate()`。
- 当前工作树在本轮文档写入前已有外部脏文件：`docs/suggestions/module-reviews/css-resource-ownership-and-page-styles.md`、`tests/performance.test.mjs`。本报告不依赖也不修改这些文件。

## 结论摘要

共享格式化和阅读指标模块整体质量稳定，测试覆盖了主要正常路径和 XSS 转义基础行为。剩余风险不是“立即会坏”的单点问题，而是契约隐性较强：日期工具默认收到合法 `YYYY-MM-DD`，阅读时间在 Node 与浏览器各维护一份同算法，RSS/sitemap 使用固定发布时间，HTML/XML/属性转义分布在多个运行时。随着站点继续增加新页面、英文内容和发布自动化，建议把这些隐性约定升级为可验证的契约。

## 📌 FMT-01 [已修复第一阶段]：日期格式化 helper 缺少输入边界保护，未来直接复用时可能输出无效日期

- 📌 问题/建议标题：为 `format.mjs` 增加显式日期契约或复用 `normalizeDate()`
- 📍 位置：`src/lib/format.mjs:14-85`、`scripts/build.mjs:39-64`、`tests/format.test.mjs:13-72`
- 📝 当前状况描述：第一阶段已修复。`format.mjs` 的日期解析会先要求 `YYYY-MM-DD`，再用 UTC round-trip 校验真实日历日期；`isoDate()`、`longDate()`、`rfc822()`、`sitemapDate()` 都复用该校验。`tests/format.test.mjs` 已覆盖空字符串、非补零格式、非法月份、2 月 30 日和普通非日期字符串。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已落地轻量断言函数供格式化 helper 复用，保留合法输入的输出不变。

```js
function assertIsoDate(value, source = "date") {
  const dateStr = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid ${source}: expected YYYY-MM-DD.`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid ${source}: impossible calendar date.`);
  }
  return dateStr;
}

export function sitemapDate(dateStr) {
  return `${assertIsoDate(dateStr, "sitemap date")}T${FIXED_TIME}+08:00`;
}
```

- 📊 实际收益：减少共享工具被新调用方误用的概率，让非法日期在构建期失败，而不是进入 RSS、sitemap、JSON-LD 或页面元信息。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`、`docs/suggestions/module-reviews/seo-feed-and-structured-data.md`

## 📌 FMT-02：RSS、sitemap 和 lastBuildDate 使用固定 09:30 +0800，发布时刻语义不够透明

- 📌 问题/建议标题：将固定发布时间升级为显式站点/文章时间策略
- 📍 位置：`src/lib/format.mjs:22-45`、`scripts/build.mjs:417-435`、`scripts/build.mjs:489-528`
- 📝 当前状况描述：`rfc822()` 和 `sitemapDate()` 固定输出 `09:30:00 +0800` / `09:30:00+08:00`。这让 RSS 与 sitemap 稳定可预测，也避免了 `new Date("YYYY-MM-DD")` 的时区漂移；但语义上所有文章、静态页和 feed build 时间都像是在同一时刻发布。对于个人站当前规模问题不大，但如果后续引入定时发布、重大更新、自动内容同步或多时区协作，固定时刻会让发布证据和真实更新时间脱节。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：保留当前默认值，同时在 `SITE` 或文章 front matter 中显式声明时间策略，构建时统一生成 RSS/sitemap 日期。

```js
// src/config.mjs
export const SITE = {
  publishTime: "09:30:00",
  timezoneOffset: "+08:00",
};

function sitemapDate(dateStr, options = SITE) {
  return `${assertIsoDate(dateStr)}T${options.publishTime}${options.timezoneOffset}`;
}
```

- 📊 预期收益：保留稳定输出，同时让“为什么是 09:30 +0800”成为可维护配置；后续支持 `publishedAt`、`modifiedAt` 或发布审计报告时不用重写所有格式化调用。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`、`docs/suggestions/module-reviews/suggestion-evidence-drift-audit.md`

## 📌 FMT-03 [已修复第一阶段]：阅读时间算法在构建端和浏览器端重复维护，缺少跨运行时同源契约

- 📌 问题/建议标题：为 Node 共享实现和 `CWLUtils.readingMinutes` 增加同算法快照测试
- 📍 位置：`src/lib/reading.mjs:1-12`、`js/utils.js:198-214`、`tests/build-extended.test.mjs:153-185`、`tests/utils.test.mjs:109-119`
- 📝 当前状况描述：第一阶段已修复。`tests/utils-deep.test.mjs` 加载真实 `js/utils.js` 到 JSDOM，用同一组空文本、纯标点、中文、英文、中英混合和代码样式文本 fixture，对比浏览器端 `CWLUtils.readingMinutes()` 与 `src/lib/reading.mjs` 输出一致。该文件也新增 `CWLUtils.escapeHtml()` 与服务端 `escapeHtml()` 的同 fixture 对照，覆盖纯文本、空值、数字、布尔值、中文混合和 XSS 片段。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已新增共享 fixture，Node 直接调用 `readingMinutes()`，JSDOM 加载 `js/utils.js` 后调用 `window.CWLUtils.readingMinutes()`，逐项比较。

```js
const cases = [
  ["", 1],
  ["中".repeat(700), 2],
  ["word ".repeat(400).trim(), 2],
  ["中文 content mixed ".repeat(80), 2],
];

for (const [text, expected] of cases) {
  assert.equal(sharedReadingMinutes(text), expected);
  assert.equal(dom.window.CWLUtils.readingMinutes(text), expected);
}
```

- 📊 实际收益：保证 SSR、文章列表、编辑器统计和语言切换后的动态文案使用同一阅读时间语义，避免用户看到同一篇文章在不同入口显示不同分钟数。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/module-reviews/test-coverage-risk-map.md`

## 📌 FMT-04：阅读时间输入口径在 SSR 与客户端更新之间不完全一致

- 📌 问题/建议标题：定义“可读正文文本”提取规则，避免代码、隐藏英文块和动态 TOC 影响分钟数
- 📍 位置：`scripts/build.mjs:318-344`、`js/coder.js:439-620`、`src/templates/post.mjs:19-23`
- 📝 当前状况描述：构建时用 `stripHtml(contentResult.html)` 计算 `post.readMinutes`；客户端语言切换后在 `coder.js` 中对当前 `.article-content` 的 `textContent` 重新估算。两条路径都合理，但口径不同：构建端会先渲染 Markdown 再用正则去标签，客户端会读取当前 DOM 文本。若未来正文中加入隐藏注释、交互式代码输出、折叠块、英文/中文双内容共存或自动生成的内联提示，两个入口可能计入不同文本，导致阅读时间跳变。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：给可读正文区定义排除选择器和数据属性，SSR 与客户端都围绕同一规则抽取文本；客户端至少跳过 `[hidden]`、`.article-toc`、`.code-copy` 和非正文辅助节点。

```js
function readableText(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("[hidden], .article-toc, .code-copy, [data-reading-ignore]").forEach((node) => node.remove());
  return clone.textContent || "";
}
```

- 📊 预期收益：让阅读时间成为稳定内容指标，而不是 DOM 结构副作用；后续增加折叠组件、交互式示例或多语言正文时更容易保持体验一致。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-coverage-and-content-consistency.md`、`docs/suggestions/module-reviews/core-reading-interactions.md`

## 📌 FMT-05：HTML/XML/属性转义能力分散，缺少上下文命名规范和跨端对照表

- 📌 问题/建议标题：为转义函数建立上下文矩阵，避免把 HTML 文本转义误用于属性、XML 或 URL
- 📍 位置：`src/lib/format.mjs:48-73`、`js/utils.js:13-21`、`src/templates/layout.mjs:118-258`、`src/templates/post.mjs:29-244`、`tests/format.test.mjs:62-154`
- 📝 当前状况描述：构建端有 `escapeAttr()`、`escapeHtml()`、`escapeXml()`，浏览器端有 `CWLUtils.escapeHtml()`，工具箱内部还有局部 `escapeHtmlText()`。这些函数当前用得比较克制，测试也覆盖了常见特殊字符。但上下文约定主要靠函数名和人工判断：属性值、文本节点、XML 文本、URL、JSON-LD script 内容和 i18n HTML 片段需要不同处理策略。随着模板增多，最容易出现的不是完全未转义，而是“用了一个看起来安全但上下文不完全匹配的转义函数”。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在文档或测试中维护上下文矩阵，并增加模板扫描，要求敏感输出使用明确函数名。

```js
const escapingPolicy = {
  "html-text": "escapeHtml",
  "html-attr": "escapeAttr",
  "xml-text": "escapeXml",
  "json-script": "JSON.stringify + </script escape",
  "url-query": "URLSearchParams / encodeURIComponent",
};
```

- 📊 预期收益：降低模板扩展时的 XSS 和 XML 破坏风险；评审者可以快速判断每个输出点是否使用了正确上下文的编码策略。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/csp-resource-policy-review.md`、`docs/suggestions/security-audit.md`

## 📌 FMT-06：`stripHtml()` 使用正则剥离 HTML，适合当前构建但不适合承载更复杂摘要语义

- 📌 问题/建议标题：将搜索摘要/阅读时间的文本抽取升级为 DOM 或 token 级工具
- 📍 位置：`scripts/build.mjs:344-346`、`scripts/build.mjs:389-405`、`scripts/build.mjs:318-318`
- 📝 当前状况描述：`stripHtml()` 通过 `/<[^>]+>/g` 去标签，并用于阅读时间和搜索索引正文截断。对当前由 `marked` 生成、结构相对单纯的受信任 HTML，这个方案简单有效；但它无法理解 `script/style`、实体解码、图片 alt、代码块、表格语义、隐藏块和自定义组件。如果后续引入更丰富的 Markdown HTML、文章摘要质量评分或语义搜索，正则文本抽取会成为质量瓶颈。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：短期保留现状，同时把 `stripHtml()` 命名为内部轻量工具；中期使用 `jsdom` 或 `marked` token 遍历产出“搜索正文”“阅读正文”“摘要正文”三种不同文本。

```js
function extractReadableText(html) {
  const dom = new JSDOM(`<main>${html}</main>`);
  const root = dom.window.document.querySelector("main");
  root.querySelectorAll("script, style, [hidden], [data-search-ignore]").forEach((node) => node.remove());
  return root.textContent.replace(/\s+/g, " ").trim();
}
```

- 📊 预期收益：提升搜索索引摘要质量，避免未来复杂 HTML 进入索引后产生噪声；同时为阅读时间、站内搜索和 SEO description 的统一文本抽取打基础。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-content-discovery.md`、`docs/suggestions/module-reviews/content-publishing-quality-gates.md`

## 建议优先级

1. 中优先级：建立转义上下文矩阵，把模板输出安全从“经验判断”升级为可检查规则。
2. 低优先级：把固定发布时间变为显式配置，为后续定时发布或重大更新 feed 留出口。
3. 低优先级：统一可读文本抽取规则，再考虑 DOM/token 级文本抽取器。
4. 已完成：补 `format.mjs` 非法日期测试和输入断言，防止共享 helper 被新路径误用。
5. 已完成：增加 Node/browser 阅读时间同源 fixture，锁住 SSR 与客户端动态更新的一致性。

## 本轮健康度评分

- 共享契约健康度：4.1 / 5
- 当前强项：函数小、职责清晰、构建端复用已推进、主路径测试通过。
- 主要扣分：跨运行时重复实现、非法输入边界隐性、RSS/sitemap 时间策略和文本抽取语义仍靠约定维护。
