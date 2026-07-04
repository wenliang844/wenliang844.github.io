# 内容新鲜度与信任信号专题分析

生成时间：2026-07-03
分析范围：文章 front matter 日期模型、`modified` 归一化、Article JSON-LD、sitemap/RSS/search index、文章页可见元信息、反馈与源码入口。
本轮验证：`node --test tests/templates.test.mjs tests/build-extra.test.mjs tests/links.test.mjs tests/ai-tabs.test.mjs`，51/51 通过。
落地补充：2026-07-04 已执行优先级 1-6，新增 sitemap `modified` lastmod、文章可见更新时间、搜索索引/结果更新日期信号、RSS `majorUpdate` 显式更新策略、旧文状态/复核提示、文章源码/反馈入口；验证 `node --test tests/build-extra.test.mjs tests/templates-extended.test.mjs tests/search-behavior.test.mjs tests/feedback.test.mjs tests/css.test.mjs` 通过，`node --test tests/performance.test.mjs` 18/18 通过。

## 总览

项目已经具备不错的内容可信基础：front matter 日期会被严格规范化，`modified` 不能早于发布日期，Article JSON-LD 会输出 `dateModified`，文章页也有 canonical、OG、阅读时间、相关内容和评论入口。但“内容新鲜度”目前还没有形成统一产品体验：搜索索引、sitemap、文章 UI 和 RSS 仍主要使用 `date`，读者看不到最后更新日期，搜索结果也无法基于更新日期排序或展示。随着项目文章偏“作品集/项目讲解/技术方案”而非短新闻，公开可见的更新信号会直接影响可信度。

严重程度分布：

- 高：0
- 中：4
- 低：2

## 建议清单

### 1. Sitemap `lastmod` 使用发布日期，未跟随 `modified`

- ✅ 落地状态：已完成。`buildSitemap()` 已改为对文章使用 `sitemapDate(post.modified || post.date)`，并通过 `buildSitemap()` 回归测试锁定带 `modified` 的文章输出更新日期。
- 📌 问题/建议标题：让 sitemap 文章 `lastmod` 对齐 `post.modified`
- 📍 位置：`scripts/build.mjs:63-70`、`scripts/build.mjs:289-304`、`scripts/build.mjs:416-434`、`tests/build.test.mjs:99-106`
- 📝 当前状况描述：构建脚本已经通过 `normalizeModifiedDate()` 支持 `modified` 字段，并在读取文章时保存到 `post.modified`。但 `buildSitemap()` 给每篇文章输出 `<lastmod>${sitemapDate(post.date)}</lastmod>`，仍使用发布日期。这样一篇 2022 年发布、2026 年更新的技术文章，在 JSON-LD 中是新鲜的，但 sitemap 仍告诉搜索引擎它最后修改于 2022 年。现有测试只断言 sitemap 中存在 `lastmod`，没有断言它与 `modified` 对齐。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function postLastmod(post) {
  return sitemapDate(post.modified || post.date);
}

rows.push(
  `  <url><loc>${loc}</loc><lastmod>${postLastmod(post)}</lastmod><priority>${POST_SITEMAP_PRIORITY}</priority>${images}</url>`,
);
```

测试层补一个带 `modified` 的临时文章，断言 sitemap 使用更新日期。

```js
assert.match(
  sitemap,
  /<loc>https:\/\/wenliang844\.github\.io\/post\/test-post\/<\/loc><lastmod>2024-06-20<\/lastmod>/
);
```

- 📊 预期收益：让搜索引擎更准确识别内容更新，避免“结构化数据新、sitemap 旧”的信号分裂。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md`、`docs/suggestions/module-reviews/content-publishing-quality-gates.md`、`docs/suggestions/competitive-analysis.md#comp-12-文章页可借鉴文档站的最后更新--反馈入口`。

### 2. 文章页 UI 只展示发布日期，读者看不到最后更新

- ✅ 落地状态：已完成。`renderPostPage()` 与文章列表面板会在 `modified !== date` 时渲染 `.updated-time`，包含机器可读 `datetime` 和内联英文文案；未设置真实 `modified` 的现有文章不会伪造更新时间。
- 📌 问题/建议标题：在文章元信息中展示 `modified !== date` 的最后更新日期
- 📍 位置：`src/templates/post.mjs:171-186`、`src/templates/post.mjs:229-246`、`src/templates/post.mjs:336-345`、`tests/templates-extended.test.mjs:330-351`
- 📝 当前状况描述：Article JSON-LD 已输出 `dateModified`，测试也验证了 `"dateModified":"2024-06-20"`。但单篇页和文章列表页的可见 `.article-meta` 只渲染 `post.date` 与阅读时间，读者无法知道文章是否被更新过。对项目经历、技术方案和工具说明类内容来说，“最后更新”是判断可信度的重要信号。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function renderUpdatedTime(post) {
  if (!post.modified || post.modified === post.date) return "";
  return `<span>·</span>
    <time class="updated-time" datetime="${isoDate(post.modified)}"
      data-i18n="post.meta.updated"
      data-i18n-en="Updated ${longDate(post.modified)}">更新于 ${longDate(post.modified)}</time>`;
}
```

单篇页建议显示完整更新日期；列表页可以只在 hover/title 或短文案中展示，避免元信息过长。

- 📊 预期收益：增强读者对内容维护状态的判断，降低旧项目文章被误解为“长期未维护”的概率。
- 🔗 相关建议引用：`docs/suggestions/competitive-analysis.md#comp-12-文章页可借鉴文档站的最后更新--反馈入口`、`docs/suggestions/ux-improvements.md`。

### 3. 搜索索引缺少 `modified`，无法按新鲜度解释或排序

- ✅ 落地状态：已完成。文章和文章章节搜索条目已包含 `modified` 与 `freshness`；搜索结果日期徽标会显示“更新 YYYY.MM.DD / 发布 YYYY.MM.DD”，英文模式显示 “Updated / Published”。
- 📌 问题/建议标题：搜索索引增加 `modified`、`freshness` 和内容类型权重
- 📍 位置：`scripts/build.mjs:387-404`、`js/search.js:100-115`、`js/search.js:301-351`
- 📝 当前状况描述：`buildSearchIndex()` 当前为文章写入 `date`、tags、path、slug 和正文摘要，但没有写入 `modified`。运行时 Fuse 搜索主要按匹配分数排序，结果 UI 可以展示标签，但不能展示“最近更新”或按新鲜度做轻量加权。随着文章数量增加，旧项目文章、近期复盘、工具说明、AI/Relay 页面会混在一起，用户难以判断结果是否仍新。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
{
  type: "post",
  title: p.title,
  date: p.date,
  modified: p.modified || p.date,
  freshness: p.modified && p.modified !== p.date ? "updated" : "published",
  path: `/post/${p.slug}/`,
}
```

结果渲染时增加可见元信息：

```js
const dateText = item.modified && item.modified !== item.date
  ? `更新 ${item.modified}`
  : `发布 ${item.date}`;
meta.appendChild(el("span", "search-result-date", dateText));
```

若后续迁移到章节级索引，也可以把同一篇文章的章节命中继承文章级 `modified`。

- 📊 预期收益：搜索结果更可解释，用户能优先判断“这篇内容是否近期维护过”。
- 🔗 相关建议引用：`docs/suggestions/competitive-analysis.md#comp-07-搜索体验可向-pagefindalgolia-的可解释发现靠拢`、`docs/suggestions/module-reviews/search-and-seo-pipeline.md`。

### 4. RSS 只表达发布日期，缺少更新类订阅信号

- ✅ 落地状态：已完成。`buildRssItems()` 支持 `majorUpdate: true` 时使用 `post.modified` 作为 `pubDate`；未显式标记重大更新的文章仍保留发布日期，避免普通复核把旧文章推到订阅器顶部。
- 📌 问题/建议标题：为重大更新提供可选 RSS 更新标记
- 📍 位置：`scripts/build.mjs:482-496`、`scripts/build.mjs:514-529`
- 📝 当前状况描述：RSS item 当前使用 `<pubDate>${rfc822(post.date)}</pubDate>`，这符合“发布订阅”的基础语义。但如果某篇项目文章被大幅更新，订阅读者不会在 feed 中看到更新信号。直接把 `pubDate` 改成 `modified` 可能会让旧文章反复浮到订阅器顶部，因此更适合提供显式的重大更新策略。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```yaml
---
date: 2022-02-01
modified: 2026-07-03
majorUpdate: true
---
```

```js
const feedDate = post.majorUpdate ? post.modified : post.date;
return `<pubDate>${rfc822(feedDate)}</pubDate>`;
```

或新增一个 `updates/index.xml`，专门订阅重大更新，避免打扰只关心新文章的读者。

- 📊 预期收益：让重要修订有机会触达订阅者，同时避免所有小改动都扰动 RSS。
- 🔗 相关建议引用：`docs/suggestions/new-features.md#f-09`、`docs/suggestions/module-reviews/content-publishing-quality-gates.md`。

### 5. 旧文章缺少“历史上下文/复核状态”提示

- ✅ 落地状态：已完成。构建期新增 `status` 枚举和 `reviewed` 日期校验，文章模板渲染 `.content-note`；2022/2023 三篇项目复盘已补 `status: historical`、`reviewed: 2026-07-04`、`contextNote`/`contextNoteEn`，并同步 `modified: 2026-07-04` 到 JSON-LD、sitemap 和搜索索引。
- 📌 问题/建议标题：为较旧项目文章增加 review/status 元数据
- 📍 位置：`src/posts/lowcode-schema-codegen.md:7-7`、`src/posts/activiti-workflow-engine.md:7-7`、`src/posts/finance-saas-backend.md:7-7`、`scripts/build.mjs:114-132`
- 📝 当前状况描述：当前文章中有 2022、2023 年的项目经历，也有 2025、2026 年的新内容。旧项目文章未必过时，反而可能是作品集资产；但缺少显式复核状态时，读者无法区分“历史项目回顾”“近期更新过的方案”“可能不再适用的技术判断”。构建校验当前关注 title/date/summary/description 等基础字段，没有内容状态模型。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```yaml
---
status: maintained # maintained | historical | archived
reviewed: 2026-07-03
contextNote: "本文是历史项目复盘，架构判断已按 2026 年视角补充。"
---
```

文章页渲染为轻量提示：

```html
<aside class="content-note" role="note">
  本文为历史项目复盘，最后复核于 2026-07-03。
</aside>
```

校验规则可以先只限制枚举值和日期格式，不要求所有旧文一次性补齐。

- 📊 预期收益：避免旧项目内容被误读为当前最佳实践，同时提升作品集叙事的专业可信度。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-publishing-quality-gates.md`、`docs/suggestions/competitive-analysis.md#comp-08-文章已有相关上下篇但缺少-docusaurusvitepress-式学习路径`。

### 6. 文章缺少就近反馈与源码入口

- ✅ 落地状态：已完成。单篇文章页新增 `.post-maintenance`，提供 GitHub Markdown 源码链接和 `/contact/?topic=post&slug=<slug>#feedback-title` 反馈入口；`feedback.js` 会读取该查询参数并预填文章链接上下文。
- 📌 问题/建议标题：为每篇文章增加“反馈问题/查看源码”轻入口
- 📍 位置：`src/templates/post.mjs:227-264`、`src/templates/post.mjs:328-362`、`contact/index.html:1-200`
- 📝 当前状况描述：文章页底部已有评论区，站点也有联系/反馈页面。但当读者发现某篇文章的错误、过时内容或链接问题时，没有携带文章 slug 的就近反馈入口；也没有“查看源码”链接让技术读者快速提交修改建议。文档站常见的 “Edit this page / Report an issue” 能把内容维护闭环放到页面上下文中。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```html
<nav class="post-maintenance" aria-label="内容维护">
  <a href="https://github.com/wenliang844/wenliang844.github.io/blob/master/src/posts/${post.slug}.md">
    查看源码
  </a>
  <a href="/contact/?topic=post&slug=${post.slug}">
    反馈本文问题
  </a>
</nav>
```

若担心 GitHub 链接暴露分支结构，可以先只做 `/contact/` 带查询参数，并在反馈表单中自动填充来源。

- 📊 预期收益：降低读者反馈成本，帮助项目从“发布内容”走向“持续维护内容”。
- 🔗 相关建议引用：`docs/suggestions/competitive-analysis.md#comp-12-文章页可借鉴文档站的最后更新--反馈入口`、`docs/suggestions/module-reviews/user-data-entrypoints.md`。

## 建议落地顺序

1. ✅ 已完成：先让 sitemap 文章 `lastmod` 使用 `post.modified || post.date`，并补回归测试。
2. ✅ 已完成：在单篇文章 UI 中仅当 `modified !== date` 时显示“最后更新”。
3. ✅ 已完成：搜索索引加入 `modified`，搜索结果显示“发布/更新”日期。
4. ✅ 已完成：为旧项目文章设计 `status/reviewed/contextNote`，先从 2022/2023 项目补起。
5. ✅ 已完成：增加带 slug 的反馈入口，并公开源码链接。
6. ✅ 已完成：实现重大更新 RSS 策略，采用 `majorUpdate: true` 显式触发，暂不新增独立 updates feed。
