# 搜索与 SEO 生成链路专题审查

生成时间：2026-07-03

审查范围：

- `scripts/build.mjs`
- `scripts/validate-posts.mjs`
- `src/config.mjs`
- `js/search-loader.js`
- `js/search.js`
- `search-index.json`
- `sitemap.xml`
- `index.xml`

本轮只做只读分析与文档写入，未修改任何站点代码或配置。当前线上产物中 `search-index.json` 约 26 KB，`js/vendor/fuse.min.js` 约 24 KB，搜索链路在当前内容规模下总体可用；以下建议主要面向内容增长、发布流程和搜索体验的长期稳定性。

## 📌 MR-SEARCH-01：文章构建缺少草稿和未来发布时间门禁

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:255-332`
- `scripts/validate-posts.mjs:74-102`

📝 当前状况描述

构建脚本会读取 `src/posts/*.md` 下所有 Markdown 文件，完成 front matter 校验后直接进入文章页、列表页、RSS、sitemap 和搜索索引。校验脚本会拦截 `TODO`、`SECRET`、`TOKEN` 等公开内容标记，但没有识别 `draft: true`、`published: false` 或未来 `date`。一旦有人把内部草稿、不完整文章或定时发布内容放入 `src/posts`，只要没有触发敏感词规则，就会在下一次构建中被公开。

⚠️ 影响程度（高/中/低）

高。它同时影响内容泄露、未完成内容上线、搜索索引暴露和 RSS 订阅推送，属于发布流程层面的高优先级风险。

💡 建议方案（含伪代码或示例片段）

为文章 front matter 增加发布状态，并让构建与校验共享同一套判断逻辑。默认构建只包含已发布且发布日期不晚于当前日期的文章，预览环境可显式使用 `--include-drafts`。

```js
function isPublishablePost(data, now = new Date()) {
  if (data.draft === true || data.published === false) return false;
  const publishedAt = normalizeDate(data.date);
  const today = now.toISOString().slice(0, 10);
  return publishedAt <= today;
}

// loadPosts()
if (!includeDrafts && !isPublishablePost(data)) {
  continue;
}
```

同时建议新增测试：

```js
test("build excludes draft and future-dated posts by default", async () => {
  // 构造 draft: true、published: false、未来 date 三类文章
  // 断言 post 页面、RSS、sitemap、search-index 均不包含这些 slug
});
```

📊 预期收益

- 避免草稿和未来发布内容被静态产物公开。
- 让编辑器生成的 `draft` 字段具备实际保护作用。
- 降低 RSS、搜索索引和 sitemap 的误发布风险。

🔗 相关建议引用

- `security-audit.md` 中关于公开内容与敏感信息泄露的建议。
- `devex-improvements.md` 中关于构建校验前置的建议。

## 📌 MR-SEARCH-02：`modified` 已解析但未进入 sitemap/RSS 新鲜度信号

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:289-304`
- `scripts/build.mjs:414-434`
- `scripts/build.mjs:483-525`
- `src/templates/post.mjs:171-182`

📝 当前状况描述

构建阶段会解析并保存 `modified`，文章 JSON-LD 也会输出 `dateModified`。但 sitemap 中单篇文章的 `<lastmod>` 仍使用 `post.date`，RSS 的 `<lastBuildDate>` 也使用最新文章的发布日期。也就是说，旧文章大修后结构化数据会更新，但 sitemap/RSS 仍表现为“没有新变化”。

⚠️ 影响程度（高/中/低）

中。不会导致页面崩溃，但会降低搜索引擎重新抓取和订阅端感知更新的准确性。

💡 建议方案（含伪代码或示例片段）

sitemap 的文章 `<lastmod>` 使用 `post.modified || post.date`；RSS 的 `lastBuildDate` 使用所有文章中最大的 `modified/date`。`pubDate` 建议继续表示首次发布日期，避免订阅端把旧文更新误判为新文章。

```js
function postFreshnessDate(post) {
  return post.modified || post.date;
}

const latestContentDate = posts
  .map(postFreshnessDate)
  .sort()
  .at(-1);

// sitemap
`<lastmod>${sitemapDate(postFreshnessDate(post))}</lastmod>`

// RSS channel
`<lastBuildDate>${rfc822(latestContentDate)}</lastBuildDate>`
```

📊 预期收益

- 搜索引擎能更准确地发现旧文大幅更新。
- RSS 聚合器能感知站点内容整体有更新，同时保持文章 `pubDate` 语义稳定。
- `modified` 字段从“仅 JSON-LD 使用”升级为全链路新鲜度信号。

🔗 相关建议引用

- `module-reviews/seo-analysis.md` 中关于结构化数据和抓取信号的建议。
- `architecture-review.md` 中关于生成链路单一事实源的建议。

## 📌 MR-SEARCH-03：空闲预加载会把搜索数据变成每页默认下载成本

📍 位置（文件路径 + 行号范围）

- `js/search-loader.js:23-28`
- `js/search-loader.js:47-55`
- `js/search.js:201-218`

📝 当前状况描述

`search-loader.js` 在页面空闲时加载 `/js/search.js`。当不是用户主动打开搜索时，`script.onload` 会调用 `window.cwlPreloadSearch()`，进而继续加载 Fuse 和 `/search-index.json`。当前文件体量不大：`search.js` 约 15 KB、`fuse.min.js` 约 24 KB、`search-index.json` 约 26 KB。但内容增长后，每个带导航的页面都会为未使用搜索的访问者付出额外请求和解析成本。

⚠️ 影响程度（高/中/低）

低到中。当前规模影响较小，文章数量和正文索引增长后会更明显，尤其在移动网络和首次访问场景。

💡 建议方案（含伪代码或示例片段）

把空闲阶段拆成两档：默认只预热轻量脚本，Fuse 和索引数据等用户首次打开搜索或满足更保守条件后再加载。可结合 `saveData`、网络类型和站点规模阈值。

```js
function shouldDeepPreloadSearch() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return false;
  return document.visibilityState === "visible";
}

script.onload = function () {
  if (queuedOpen && window.cwlOpenSearch) {
    window.cwlOpenSearch();
  } else if (shouldDeepPreloadSearch() && window.cwlPreloadSearch) {
    window.cwlPreloadSearch().catch(function () {});
  }
};
```

📊 预期收益

- 保留搜索首开速度，同时降低未使用搜索用户的默认网络和解析成本。
- 为未来文章数量增长预留性能空间。
- 对省流量模式和弱网用户更友好。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于资源懒加载和首屏成本的建议。
- `module-reviews/visual-interactions.md` 中关于运行时脚本加载竞态的建议。

## 📌 MR-SEARCH-04：正文索引只截取前 600 字，长文后半段无法被搜索命中

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:382-408`
- `js/search.js:108-122`
- `js/search.js:267-268`

📝 当前状况描述

搜索索引会把每篇文章的纯文本正文截取为前 600 个字符。Fuse 的搜索字段包含 `body`，但实际只能覆盖文章开头部分。对于项目复盘类长文，用户搜索后半段出现的技术名词、故障场景或方案细节时，可能无法命中文章。

⚠️ 影响程度（高/中/低）

中。不会影响页面可用性，但会降低站内搜索的召回率，内容越长越明显。

💡 建议方案（含伪代码或示例片段）

改为生成“段落/标题分片索引”，每篇文章可以拆成多个轻量结果，结果指向文章路径或标题锚点。这样既不需要把整篇正文塞进一个超大字段，也能覆盖长文后半段。

```js
function buildSearchChunks(post) {
  return extractSections(post.contentHtml).map((section, index) => ({
    type: "post-section",
    title: post.title,
    sectionTitle: section.heading,
    summary: section.text.slice(0, 180),
    body: section.text.slice(0, 500),
    path: `/post/${post.slug}/#${section.id || ""}`,
    slug: post.slug,
    chunk: index,
  }));
}
```

📊 预期收益

- 长文后半段内容可以被搜索命中。
- 搜索结果片段更接近用户查询位置。
- 后续可按章节锚点直接跳转，提高阅读效率。

🔗 相关建议引用

- `ux-improvements.md` 中关于站内搜索体验的建议。
- `new-features.md` 中关于文章阅读增强的建议。

## 📌 MR-SEARCH-05：搜索页元数据与静态页清单分散维护，容易发生索引漂移

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:20-35`
- `src/config.mjs:37-116`
- `scripts/build.mjs:392-408`

📝 当前状况描述

静态页 sitemap 由 `STATIC_PAGES` 维护，搜索索引的静态页由 `SEARCH_PAGES` 维护，页面本身的 title/description 又分散在各模板或手写 HTML 中。当前清单基本完整，但新增页面时需要同时记得更新 sitemap、搜索索引、模板元数据和测试，存在“页面已上线但搜不到”或“搜索索引仍指向旧摘要”的维护风险。

⚠️ 影响程度（高/中/低）

低到中。当前问题不是功能缺陷，而是页面数量增加后的工程化风险。

💡 建议方案（含伪代码或示例片段）

建立单一页面注册表，统一声明路径、导航状态、SEO 元数据、搜索标签、是否进入 sitemap。构建脚本从该注册表派生 sitemap 和搜索页条目。

```js
export const PAGES = [
  {
    path: "/tools/",
    title: "在线工具箱",
    description: "浏览器本地运行的开发工具箱。",
    tags: ["工具", "JSON", "Markdown"],
    sitemap: { priority: "0.6", withDate: true },
    search: true,
  },
];

export const STATIC_PAGES = PAGES.filter(p => p.sitemap).map(toSitemapEntry);
export const SEARCH_PAGES = PAGES.filter(p => p.search).map(toSearchEntry);
```

📊 预期收益

- 新增页面时减少重复配置点。
- sitemap、搜索索引和页面 SEO 元数据更容易保持一致。
- 测试可以围绕单一注册表做覆盖率校验。

🔗 相关建议引用

- `architecture-review.md` 中关于配置单一事实源的建议。
- `devex-improvements.md` 中关于生成链路自动化校验的建议。

