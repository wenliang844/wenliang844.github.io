# SEO、Feed 与结构化数据专题分析

生成时间：2026-07-03

分析范围：`sitemap.xml`、`robots.txt`、全站 RSS、博客目录 RSS、时间归档 RSS、canonical / Open Graph / Twitter Card、JSON-LD、SEO/feed 相关测试。

本轮验证：

- `node --test tests/build.test.mjs tests/build-extra.test.mjs tests/integration.test.mjs tests/format.test.mjs tests/performance.test.mjs`：82/82 通过。
- 扩展组合验证已修复此前 `renderTrustPage()` class 字面量断言脆弱问题；当前聚焦模板/构建/性能/工作流测试 `node --test tests/css.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/performance.test.mjs tests/build.test.mjs tests/workflows.test.mjs` 111/111 通过，完整 `npm run test:coverage` 792/792 通过。
- 只读扫描当前 `sitemap.xml`、`index.xml`、`robots.txt`、构建脚本和 SEO 相关模板。
- 本轮只新增 `/docs/suggestions/module-reviews/seo-feed-and-structured-data.md`。

## 总览

当前 SEO 基础覆盖面较完整：构建脚本生成 sitemap、robots、全站 RSS、博客 RSS、时间归档 RSS、搜索索引；生成页和手写页都具备 JSON-LD；模板统一输出 canonical、OG 和 Twitter Card；测试覆盖了 sitemap 关键路径、image sitemap、RSS 基础结构、JSON-LD schema.org 上下文、404 noindex、canonical 和 OG 标签。

剩余优化点主要是“信号精度”和“订阅可发现性”。sitemap 中所有 `withDate` 静态页共用最新文章日期，RSS item 只输出最小字段，HTML 头部没有 RSS `rel="alternate"` 自动发现，Article JSON-LD 的 `headline` 使用短标题而不是完整标题。对个人博客来说这些不是致命问题，但它们会影响搜索引擎、RSS 阅读器、社交分享和后续多语言内容的长期质量。

严重程度分布：

- 高：0
- 中：5
- 低：3

## 建议清单

### 📌 MR-SEO-FEED-01：sitemap 静态页 `lastmod` 全部使用最新文章日期，更新信号不够精确

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:20-36`
- `scripts/build.mjs:415-435`
- `src/lib/format.mjs:14-44`
- `sitemap.xml:3-21`

📝 当前状况描述

`buildSitemap()` 先取 `posts[0].date` 作为 `siteLastmod`，所有 `withDate` 静态页都使用同一个日期。当前 sitemap 中首页、关于、工具箱、AI、Trust、赞助等页面的 `lastmod` 都是 `2026-06-16T09:30:00+08:00`，这其实是最新文章日期，而不是这些页面自身内容的更新时间。`/categories/` 又因为 `withDate=false` 没有 `lastmod`。这种统一日期简单稳定，但会向搜索引擎传递“所有静态页都随最新文章更新”的弱信号。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

为静态页配置显式 `lastmod` 或构建时从源文件/模板依赖中推导。短期可以在 `STATIC_PAGES` 增加可选字段；长期可用页面 manifest 记录页面所有权和更新时间。

```js
export const STATIC_PAGES = [
  { path: "/tools/", withDate: true, lastmod: "2026-06-10", priority: "0.6" },
  { path: "/trust/", withDate: true, lastmod: "2026-07-03", priority: "0.5" }
];

const date = page.lastmod || posts[0].date;
if (page.withDate) row += `<lastmod>${sitemapDate(date)}</lastmod>`;
```

📊 预期收益

- 搜索引擎获得更准确的页面更新时间。
- 避免每次发新文章都让所有静态页看起来被更新。
- 为发布审计和内容新鲜度报告提供更可信的数据源。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`
- `/docs/suggestions/module-reviews/build-artifact-synchronization.md`

### 📌 MR-SEO-FEED-02：HTML 头部缺少 RSS `rel="alternate"`，阅读器不易自动发现订阅源

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:214-258`
- `scripts/build.mjs:534-560`
- `index.xml:1-50`
- `post/index.xml:1-50`
- `categories/index.xml:1-50`

📝 当前状况描述

构建脚本已经生成全站、博客目录和时间归档三个 RSS feed，每个 RSS 内也有 `atom:link rel="self"`。但 HTML 页面头部没有 `<link rel="alternate" type="application/rss+xml">`，扫描 `index.html`、`post/index.html`、`categories/index.html` 和 `src/templates` 未发现 `application/rss+xml`。这意味着浏览器扩展、RSS 阅读器和一些爬虫无法从页面自动发现订阅入口，只能靠用户猜测 `/index.xml` 或站内链接。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

在 `renderPage()` 增加 `feeds` 选项，并给首页、文章列表页和时间归档页输出合适的 alternate link。全站默认可以输出 `index.xml`，专题页可覆盖。

```js
function renderFeedLinks(feeds = [{ href: "/index.xml", title: "CWLBlog RSS" }]) {
  return feeds.map((feed) =>
    `  <link rel="alternate" type="application/rss+xml" title="${escapeAttr(feed.title)}" href="${escapeAttr(feed.href)}">`
  ).join("\n");
}

renderPage({
  page: "posts",
  feeds: [
    { href: "/index.xml", title: "CWLBlog" },
    { href: "/post/index.xml", title: "Posts on CWLBlog" }
  ]
});
```

📊 预期收益

- RSS 阅读器能从页面自动发现订阅源。
- 用户分享 `/post/` 或 `/categories/` 时，阅读器可以识别更精准的 feed。
- 与现有 RSS 生成能力形成闭环。

🔗 相关建议引用

- `/docs/suggestions/new-features.md`
- `/docs/suggestions/module-reviews/search-and-content-discovery.md`

### 📌 MR-SEO-FEED-03：RSS item 字段偏基础，缺少 category、enclosure 和正文摘要增强

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:485-498`
- `scripts/build.mjs:515-531`
- `src/posts/manage-system.md:13-15`
- `tests/build-extra.test.mjs:119-178`
- `tests/integration.test.mjs:123-153`

📝 当前状况描述

RSS item 当前包含 `title`、`link`、`pubDate`、`guid`、`description`，足以被阅读器识别；测试也覆盖了基础结构和 item 数量。但文章 front matter 已经有 `tags`、`cover`、`descriptionEn`、正文 HTML 和图片，RSS 没有输出 `<category>`、`<enclosure>` 或 `content:encoded`。这会让阅读器缺少分类信息和封面图，也无法在订阅流中展示更丰富的摘要。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

扩展 RSS namespace，并在 item 中输出 tags 与封面图。正文可以先输出安全截断的 HTML 摘要，不必一开始提供全文。

```js
function buildRssItems(posts) {
  return posts.map((post) => {
    const categories = post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n");
    const enclosure = post.cover
      ? `      <enclosure url="${escapeXml(absoluteUrl(post.cover, post.slug))}" type="image/png" />`
      : "";
    return `    <item>
      <title>${escapeXml(post.shortTitle)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${categories}
      ${enclosure}
      <description>${escapeXml(post.description)}</description>
    </item>`;
  }).join("\n");
}
```

📊 预期收益

- RSS 阅读器能展示标签、封面和更丰富的摘要。
- 订阅体验更接近现代博客，而不是只有标题和一句描述。
- 后续生成 tag feed 时可以复用 category 字段。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`
- `/docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`

### 📌 MR-SEO-FEED-04：Article JSON-LD 的 `headline` 使用短标题，完整标题只放在 `name`

📍 位置（文件路径 + 行号范围）

- `src/templates/post.mjs:171-203`
- `src/templates/post.mjs:266-282`
- `tests/build-extra.test.mjs:248-267`
- `tests/templates-extended.test.mjs:370-382`

📝 当前状况描述

文章 JSON-LD 中 `headline` 使用 `post.shortTitle`，`name` 使用完整 `post.title`。页面 `<h1>` 和 OG title 使用完整标题或短标题组合，结构化数据测试只断言 `headline` 存在，没有断言它是否等于完整文章标题。Schema.org 的 `headline` 更适合承载文章完整标题；短标题可以保留为 `alternateName` 或列表显示字段。当前做法不是错误，但会让搜索结果结构化摘要里的标题信息变短。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

把 `headline` 改为完整标题，短标题放到 `alternateName`。

```js
const data = {
  "@type": "Article",
  headline: post.title,
  alternateName: post.shortTitle,
  name: post.title,
  description: post.description,
};
```

配套测试断言 `ld.headline` 等于 front matter 的完整 `title`，并保留 `alternateName`。

📊 预期收益

- 结构化数据标题与页面主标题一致。
- 搜索引擎和富结果获得更完整的语义。
- 短标题仍可用于卡片和导航，不丢失现有体验。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/search-and-content-discovery.md`
- `/docs/suggestions/ux-improvements.md`

### 📌 MR-SEO-FEED-05：客户端英文切换没有 SEO 级语言 URL 或 `hreflang`

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:239-258`
- `src/templates/post.mjs:171-203`
- `js/i18n.js:835-852`
- `scripts/build.mjs:383-412`

📝 当前状况描述

生成页通过 `data-i18n-title-en`、`data-i18n-desc-en` 和英文正文块支持客户端中英切换；搜索索引也带有英文 i18n 元数据。这对用户体验很好，但 SEO 视角仍只有一套中文 URL，JSON-LD `inLanguage` 也固定为 `zh-CN`。如果未来希望英文内容被搜索引擎稳定收录，仅靠客户端切换不够；需要独立 URL、服务端生成英文 HTML 或明确不追求英文 SEO。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

明确策略二选一：

```js
// 方案 A：继续客户端双语，不追求英文 SEO
// 文档中注明英文切换是增强体验，不输出 hreflang。

// 方案 B：生成 /en/ 路径
await writeFileEnsured(`en/post/${post.slug}/index.html`, renderPostPage(post, nav, { lang: "en" }));
```

如果走方案 B，模板输出：

```html
<link rel="alternate" hreflang="zh-CN" href="https://wenliang844.github.io/post/example/">
<link rel="alternate" hreflang="en" href="https://wenliang844.github.io/en/post/example/">
```

📊 预期收益

- 避免“页面有英文但搜索引擎看不到英文 URL”的模糊状态。
- 为英文读者、分享卡片和搜索摘要提供清晰入口。
- 多语言 SEO 策略可测试、可维护。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/i18n-and-accessibility.md`
- `/docs/suggestions/module-reviews/search-and-content-discovery.md`

### 📌 MR-SEO-FEED-06：robots 直接屏蔽 vendor JS/CSS 目录，建议确认是否影响渲染型爬虫

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:447-463`
- `robots.txt:1-13`
- `tests/build-extra.test.mjs:226-240`

📝 当前状况描述

`robots.txt` 允许主要内容路径，屏蔽 `/js/vendor/` 和 `/css/fontawesome/`。屏蔽 vendor 目录能减少非内容资源被抓取，但现代搜索引擎会渲染页面；如果关键 UI 或内容依赖某个被屏蔽脚本/样式，渲染诊断可能受影响。当前 `/css/fontawesome/` 并不匹配实际 `/css/fontawesome-all.min.css`，`/js/vendor/` 主要是搜索、Markdown、二维码等增强功能，风险不高，但建议把 robots 策略从“屏蔽资源目录”升级为“只屏蔽确实不希望索引的非内容端点”。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

复核哪些资源真正需要屏蔽；如果没有明确收益，可以允许 CSS/JS 被抓取，同时依靠 sitemap 和 canonical 指向内容页。

```txt
User-agent: *
Allow: /

# 可选：只屏蔽临时、搜索参数或非公开目录
Disallow: /temp/

Sitemap: https://wenliang844.github.io/sitemap.xml
```

配套测试从“必须包含 vendor disallow”改为“必须不屏蔽关键渲染资源”。

📊 预期收益

- 降低渲染型爬虫因资源屏蔽而误判页面体验的概率。
- robots 策略更贴近内容治理，而不是静态资源目录治理。
- 测试更关注真正的 SEO 风险。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`
- `/docs/suggestions/performance-bottlenecks.md`

### 📌 MR-SEO-FEED-07：SEO 与模板测试大量使用正则，遇到 class 组合变化时容易误报

📍 位置（文件路径 + 行号范围）

- `tests/templates-extended.test.mjs:173-190`
- `tests/build-extra.test.mjs:248-267`
- `tests/build-extra.test.mjs:281-307`
- `tests/build-extra.test.mjs:338-353`

📝 当前状况描述

本轮扩展组合测试中，`renderTrustPage exposes local data...` 失败是因为测试精确匹配 `/class="trust-stats"/`，而当前工作区模板输出 `class="trust-stats timeline-stats"`。元素仍包含 `trust-stats` class，但正则只接受单一 class 字面量。SEO/模板测试中也有不少直接 regex 提取 JSON-LD、canonical、OG 标签的断言。正则适合快速 smoke，但对 class token、属性顺序、额外属性和格式化变化比较敏感。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

对 HTML 结构、class、meta 和 JSON-LD 使用 JSDOM 或专用解析函数，保留少量正则做源代码扫描。

```js
const dom = new JSDOM(renderTrustPage());
const doc = dom.window.document;

assert.ok(doc.querySelector(".trust-stats"));
assert.ok(doc.querySelector(".trust-service-list"));

const canonical = doc.querySelector('link[rel="canonical"]');
assert.equal(canonical.href, "https://wenliang844.github.io/trust/");
```

📊 预期收益

- 测试更接近浏览器理解 HTML 的方式。
- 减少 class 组合、属性顺序或格式化变化导致的误报。
- SEO 标签测试能更准确检查真实 DOM。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/test-coverage-risk-map.md`
- `/docs/suggestions/module-reviews/trust-page-launch-readiness.md`

### 📌 MR-SEO-FEED-08：Feed、sitemap 与结构化数据缺少统一质量报告

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:415-463`
- `scripts/build.mjs:485-560`
- `src/templates/layout.mjs:181-195`
- `src/templates/post.mjs:171-221`
- `tests/performance.test.mjs:198-218`

📝 当前状况描述

项目已经有多个测试分散检查 SEO 产物：sitemap 大小、RSS 大小、JSON-LD 基础结构、canonical 和 OG 标签。但没有一份构建后的 SEO/feed 质量报告，汇总 sitemap URL 数量、缺失 lastmod 的页面、RSS item 数、feed 大小、每类 JSON-LD 数量、缺少 `og:image` 的页面、缺少 alternate feed 的页面等。现在信息分散在测试输出和文件内容里，评审时不容易快速判断“本次发布 SEO 信号有没有退化”。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

新增只读报告脚本，默认输出到控制台；CI 可保存为 artifact，不必提交。

```js
const report = {
  sitemap: { urls: countUrls(sitemap), missingLastmod: findMissingLastmod(sitemap) },
  feeds: feeds.map((feed) => ({ path: feed.path, items: countItems(feed.xml), bytes: feed.bytes })),
  html: scanHtmlPages(root).map((page) => ({
    path: page.path,
    canonical: Boolean(page.doc.querySelector('link[rel="canonical"]')),
    ogImage: Boolean(page.doc.querySelector('meta[property="og:image"]')),
    feedAlternate: Boolean(page.doc.querySelector('link[type="application/rss+xml"]')),
  })),
};

console.table(report.feeds);
```

📊 预期收益

- 发布前快速看到 SEO/feed 健康状况。
- 将分散测试信号汇总成可读报告，方便长期趋势跟踪。
- 为最终项目健康度评分提供客观指标。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/build-artifact-synchronization.md`
- `/docs/suggestions/devex-improvements.md`

## 建议优先级

1. 中优先级：为静态页 sitemap 增加页面级 `lastmod`，避免统一使用最新文章日期。
2. 中优先级：在 HTML 头部输出 RSS `rel="alternate"`，让阅读器自动发现订阅源。
3. 中优先级：增强 RSS item，加入 category、封面和可控正文摘要。
4. 中优先级：明确英文内容的 SEO 策略，决定是否生成 `/en/` 与 `hreflang`。
5. 中优先级：把模板/SEO 测试从精确正则逐步迁移到 DOM 解析。
6. 低优先级：让 Article JSON-LD 的 `headline` 使用完整标题。
7. 低优先级：复核 robots 对 vendor JS/CSS 的屏蔽策略。
8. 低优先级：生成 SEO/feed 质量报告，支持发布评审和健康度评分。
