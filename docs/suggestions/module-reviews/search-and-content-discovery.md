# 搜索与内容发现链路专题分析

生成时间：2026-07-03

分析范围：全局搜索弹窗、搜索懒加载、`search-index.json` 构建、博客列表筛选、标签云、时间归档、相关文章、结构化数据和搜索相关测试。

本轮验证：

- `node --test tests/search-loader-behavior.test.mjs tests/blog.test.mjs tests/security.test.mjs tests/build.test.mjs tests/build-extra.test.mjs tests/templates-extended.test.mjs`：107/107 通过。
- 抽样当前 `search-index.json`：18 条记录，其中 6 篇文章、12 个页面；文件约 27KB；6 篇文章 `body` 均截断为 600 字。
- 抽样关键词：`ESClient`、`Web Worker`、`Rete` 在源文章中存在，但当前搜索索引没有命中；`BPMN`、`Maven` 可命中。
- 本轮只新增 `/docs/suggestions/module-reviews/search-and-content-discovery.md`。

## 总览

项目的内容发现基础很扎实：全局搜索通过 `search-loader.js` 懒加载，不阻塞首屏；`search.js` 使用 Fuse.js，支持中英文 i18n、键盘快捷键、ARIA combobox、结果高亮和加载失败降级；文章列表页有本地搜索、标签筛选、URL 同步、移动端目录浮层和 J/K 快捷键；标签页与时间归档页也都有结构化数据。

主要可优化点集中在“召回率”和“解释力”。当前搜索索引为了轻量，只保留文章正文前 600 字，静态页面只有摘要和标签；文章列表页的本地搜索也只看标题、摘要和标签。这样对当前 6 篇文章和少量页面已经可用，但随着长文、工具页、Trust Center、AI 榜单和商业化内容变多，用户会遇到“明明页面里有这个词，全局搜索搜不到”的情况。下一步建议是在体积预算内引入分块索引、页面正文摘要、统一搜索口径和更清晰的匹配解释。

严重程度分布：

- 高：0
- 中：5
- 低：3

## 建议清单

### 📌 MR-DISCOVERY-01：搜索索引正文固定截断 600 字，长文深处关键词不可发现

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:343-345`
- `scripts/build.mjs:383-390`
- `scripts/build.mjs:393-412`
- `src/posts/finance-saas-backend.md:67-67`
- `src/posts/lowcode-schema-codegen.md:57-57`

📝 当前状况描述

构建脚本把文章 HTML 去标签后写入 `search-index.json`，但 `body` 固定 `slice(0, 600)`。当前索引中 6 篇文章的 `bodyLen` 都是 600，说明所有文章正文都被截断。抽样发现 `ESClient`、`Web Worker` 等正文中真实存在的技术词没有进入搜索索引，用户全局搜索这些词时无法找到对应文章。这个选择能保持索引约 27KB，很轻，但随着长文变多，召回率会明显下降。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

把“单篇 600 字”升级为“标题/摘要/标签 + 关键段落分块”。可以按标题附近、代码块前后、关键词密度或固定窗口提取 2-4 个短 chunk，并记录 `section`，仍然控制总大小。

```js
function buildBodyChunks(post, maxChunks = 4) {
  const text = stripHtml(post.contentHtml);
  const sections = splitByHeadings(post.contentHtml);
  return sections
    .map((section) => ({
      heading: section.heading,
      text: stripHtml(section.html).slice(0, 280),
    }))
    .filter((chunk) => chunk.text.length >= 40)
    .slice(0, maxChunks);
}

{
  type: "post",
  title: post.title,
  summary: post.summary,
  body: stripHtml(post.contentHtml).slice(0, 600),
  chunks: buildBodyChunks(post)
}
```

前端搜索可把 `chunks.text` 加入 Fuse keys，打开结果时跳转到 `path#heading-id`。

📊 预期收益

- 长文深处的技术名词、模块名和实践细节可被搜索到。
- 保持索引体积可控，不必直接索引整篇正文。
- 搜索结果可以定位到文章内具体段落，提升阅读效率。

🔗 相关建议引用

- `/docs/suggestions/performance-bottlenecks.md`
- `/docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`

### 📌 MR-DISCOVERY-02：静态页面只索引摘要和标签，工具箱与信任页的细粒度内容不可搜索

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:38-78`
- `scripts/build.mjs:393-412`
- `src/templates/tools.mjs:1-120`
- `src/templates/trust.mjs:95-131`
- `tests/build.test.mjs:146-155`

📝 当前状况描述

`SEARCH_PAGES` 为静态页提供标题、摘要、路径、标签和英文 i18n，这是轻量且可控的做法；测试也覆盖了 `/tools/`、`/ai/`、`/trust/` 等页面是否进入索引。但静态页面的页面内功能项不会自动进入索引。例如工具箱有 31 个工具，信任页列出 Buttondown、Giscus、Web3Forms、本地数据和第三方服务；当前能搜到这些内容主要取决于摘要和 tags 是否手工覆盖。页面内容越复杂，手工摘要越难长期保持完整。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

为静态页面增加可选 `searchSections`，或者从已生成 HTML 的 `<main>` 中提取受控文本。对工具箱、信任页这类信息密集页面，建议使用显式章节清单，避免索引掉按钮噪音。

```js
export const SEARCH_PAGES = [
  {
    title: "在线工具箱",
    path: "/tools/",
    tags: ["工具", "JSON", "JWT"],
    searchSections: [
      { title: "API Tester", body: "发送请求、保存历史、敏感 Header 脱敏" },
      { title: "Galaxy", body: "星空 Canvas、速度、密度、指针引力" },
      { title: "Gesture", body: "手势识别、第三方模型、摄像头确认" }
    ]
  }
];
```

📊 预期收益

- 用户能直接搜索工具名、第三方服务名、隐私概念并找到正确页面。
- 静态页面扩展后，不必依赖越来越长的 summary 和 tags。
- 可以为搜索结果展示章节标题，提高解释力。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/trust-page-launch-readiness.md`
- `/docs/suggestions/module-reviews/product-info-pages-and-rankings.md`

### 📌 MR-DISCOVERY-03：文章列表页本地搜索与全局搜索口径不一致

📍 位置（文件路径 + 行号范围）

- `js/blog.js:63-80`
- `js/blog.js:90-94`
- `js/blog.js:136-149`
- `src/templates/post.mjs:393-398`
- `js/search.js:108-125`

📝 当前状况描述

全局搜索使用 Fuse.js，并检索标题、短标题、标签、摘要、正文和路径；文章列表页的本地搜索只构建标题、摘要、标签和标签展示文案的 `haystack`，不看正文，也不复用 Fuse 权重或搜索索引。结果是 `/post/` 页面内搜索与全站搜索的召回口径不同：用户在全局搜索里能找到的词，进入文章页列表后可能搜不到；反过来，本地搜索的 URL 参数 `?q=` 也不能复用全局搜索结果的分词和评分。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

让文章列表页复用同一个轻量搜索数据：可以在构建时给每个 `article` 输出 `data-search-body` 的短文本，也可以让 `blog.js` 懒加载 `search-index.json` 后筛选 `type === "post"`。

```js
async function loadPostSearchData() {
  const index = await fetch("/search-index.json").then((r) => r.json());
  return index.filter((item) => item.type === "post");
}

function matchesPost(item, query, tag) {
  const target = [item.title, item.summary, item.body, item.tags.join(" ")].join(" ").toLowerCase();
  return (!query || target.includes(query)) && (!tag || item.tags.includes(tag));
}
```

如果担心额外请求，可以只在用户输入超过 2 个字符时加载。

📊 预期收益

- 全局搜索和文章页搜索对用户表现一致。
- 文章列表页能匹配正文摘要或后续 chunk。
- 后续只需维护一套搜索质量测试。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/build-artifact-synchronization.md`
- `/docs/suggestions/devex-improvements.md`

### 📌 MR-DISCOVERY-04：搜索结果使用 Fuse matches，但渲染解释仍以原始 query 为主

📍 位置（文件路径 + 行号范围）

- `js/search.js:108-125`
- `js/search.js:257-269`
- `js/search.js:301-365`
- `tests/security.test.mjs:40-47`

📝 当前状况描述

Fuse 配置开启了 `includeMatches: true`，但结果渲染没有使用 `r.matches` 的字段和范围信息，而是用原始 query 对标题、标签和摘要做简单正则高亮。对于模糊匹配、大小写差异、英文/中文混合、命中 tags 而 snippet 来自 summary 的场景，用户可能看不到“为什么这条结果排在前面”。现有安全测试已经保证高亮用 DOM 节点构造，这是很好的基础，但解释力还可以增强。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

基于 `r.matches` 展示命中字段徽标，并优先选中命中字段生成 snippet。

```js
function bestMatch(result) {
  return result.matches?.find((m) => ["title", "summary", "body", "tags"].includes(m.key));
}

const match = bestMatch(r);
const reason = document.createElement("span");
reason.className = "search-result-reason";
reason.textContent = match ? `Matched ${match.key}` : labelFor(item);

const sourceText = match && typeof match.value === "string" ? match.value : bestText(item);
appendHighlightedRanges(snippetDiv, sourceText, match?.indices || []);
```

📊 预期收益

- 用户能理解结果排序，减少“搜索看起来随机”的感觉。
- 模糊匹配和标签命中更容易被看见。
- 为未来搜索质量调参提供可观察反馈。

🔗 相关建议引用

- `/docs/suggestions/ux-improvements.md`
- `/docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 📌 MR-DISCOVERY-05：相关文章只按中文标签重叠，缺少系列、主题和英文标签辅助信号

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:369-380`
- `scripts/build.mjs:301-319`
- `tests/build-deep.test.mjs:270-324`
- `src/templates/post.mjs:128-183`

📝 当前状况描述

`relatedPosts()` 只用 `post.tags` 的精确重叠计分，再按日期排序。测试覆盖了共享标签数、日期排序、空 tags 和不变性，说明算法稳定。但当前文章有中英文 tags、项目系列、技术栈、场景和年份等多维信号。只靠中文 tags 会让一些语义接近但标签不同的文章无法互相推荐，也无法解释“为什么推荐”。英文模式下页面展示英文标签，但推荐算法仍基于中文 tags。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

扩展 front matter 或构建阶段派生推荐特征：`series`、`domain`、`stack`、`tagsEn`、`year`，并在推荐卡片里显示共同原因。

```js
function relatedScore(current, candidate) {
  const zhTags = overlap(current.tags, candidate.tags) * 3;
  const enTags = overlap(current.tagsEn, candidate.tagsEn) * 2;
  const sameSeries = current.series && current.series === candidate.series ? 5 : 0;
  const sameDomain = overlap(current.domains || [], candidate.domains || []) * 2;
  return zhTags + enTags + sameSeries + sameDomain;
}
```

推荐结果可以带上 `reason: "同属低代码 / React"`，模板显示为小标签。

📊 预期收益

- 推荐从“标签碰巧相同”升级为“主题相关”。
- 英文模式和中文模式下推荐质量更一致。
- 相关文章卡片更有解释力，能提高继续阅读率。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`
- `/docs/suggestions/new-features.md`

### 📌 MR-DISCOVERY-06：搜索索引缺少质量预算和召回回归用例

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:393-412`
- `tests/build.test.mjs:146-155`
- `tests/build-extra.test.mjs:220-260`
- `search-index.json:1-1`

📝 当前状况描述

测试已经确认搜索索引包含 6 篇文章、关键静态页、i18n 元数据和正斜杠路径。但没有锁定索引体积预算、每篇文章 body/chunk 长度、关键关键词召回、页面项目数量、空 body 比例或路径可访问性。现在 `search-index.json` 约 27KB，很轻；后续如果增加 chunk，需要防止索引突然膨胀，也要防止为了控体积又把关键术语裁掉。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

新增 `tests/search-index-quality.test.mjs`，把大小预算和抽样召回同时纳入。

```js
const raw = await readFile(join(outDir, "search-index.json"));
assert.ok(raw.byteLength < 120_000, "search index should stay lightweight");

const index = JSON.parse(raw);
for (const term of ["ESClient", "Web Worker", "Buttondown", "Galaxy"]) {
  assert.ok(
    index.some((item) => JSON.stringify(item).toLowerCase().includes(term.toLowerCase())),
    `${term} should be discoverable`,
  );
}

assert.ok(index.every((item) => item.path.startsWith("/")));
```

📊 预期收益

- 搜索质量变化能在 CI 中被看见。
- 扩大索引召回时仍能控制性能预算。
- 关键产品能力、工具名和隐私服务不会被索引裁剪遗漏。

🔗 相关建议引用

- `/docs/suggestions/performance-bottlenecks.md`
- `/docs/suggestions/module-reviews/test-coverage-risk-map.md`

### 📌 MR-DISCOVERY-07：搜索弹窗壳层仍依赖 `innerHTML` 拼接，建议与结果列表一样使用 DOM builder

📍 位置（文件路径 + 行号范围）

- `js/search.js:14-31`
- `js/search.js:52-67`
- `js/search.js:309-365`
- `tests/security.test.mjs:40-47`

📝 当前状况描述

搜索结果列表已经使用 DOM API 和 `textContent` 渲染，并有安全测试禁止标题、标签和摘要使用 `innerHTML`。弹窗壳层和底部快捷键文案仍使用固定字符串 `innerHTML` 拼接；当前输入源是硬编码和受控 i18n 文案，实际风险很低。但长期看，搜索模块已经形成两种渲染风格：结果区偏安全 DOM builder，壳层偏 HTML 字符串。后续如果把快捷键文案、图标或提示从外部配置接入，误用成本会升高。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

把壳层抽成小型 DOM builder，底部文案也用 `replaceChildren()` 更新。

```js
function renderFoot() {
  const foot = overlay.querySelector(".search-modal-foot");
  foot.replaceChildren(
    span(t("dyn.search.nav", "↑↓ 选择")),
    span(t("dyn.search.open", "Enter 打开")),
    span(t("dyn.search.shortcut", "Ctrl/⌘ K 搜索")),
  );
}

function span(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}
```

📊 预期收益

- 搜索模块的渲染风格更统一。
- 降低未来 i18n 或配置扩展时误把外部文案注入 HTML 的风险。
- 安全测试可以从结果区扩展到整个弹窗。

🔗 相关建议引用

- `/docs/suggestions/security-audit.md`
- `/docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 📌 MR-DISCOVERY-08：标签页当前只作为跳转入口，缺少可索引的标签主题页能力

📍 位置（文件路径 + 行号范围）

- `src/templates/tags.mjs:7-20`
- `src/templates/tags.mjs:40-56`
- `js/blog.js:250-259`
- `tests/templates-extended.test.mjs:448-472`

📝 当前状况描述

标签页会生成标签云，点击后跳转到 `/post/?tag=<标签>`，由 `blog.js` 在客户端激活筛选。这个体验对用户可用，测试也覆盖了标签链接和 JSON-LD。但从 SEO 和分享角度看，`/post/?tag=Java` 仍是同一个文章列表页的查询状态，没有独立标题、描述、canonical 或可索引的标签主题页。随着文章数量增加，`/tags/Java/` 这类静态标签页可以承载“该标签下有哪些文章、主题介绍、相关文章、RSS 链接”，也更适合外部分享。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

保留现有 `/post/?tag=` 快速筛选，同时为高频标签生成静态主题页。

```js
for (const tag of topTags) {
  await writeFileEnsured(
    `tags/${slugifyTag(tag.name)}/index.html`,
    renderTagDetailPage(tag, postsByTag[tag.name])
  );
}
```

标签云可以优先链接到静态页，静态页再提供“在文章列表中筛选”入口。

📊 预期收益

- 高频主题具备独立 SEO 页面和可分享 URL。
- 用户能在标签级别浏览文章、时间线和主题说明。
- 后续可自然扩展标签 RSS 或专题页。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`
- `/docs/suggestions/new-features.md`

## 建议优先级

1. 中优先级：为长文引入分块索引，避免 600 字截断导致关键术语不可发现。
2. 中优先级：为工具箱、信任页等静态页面增加章节级搜索数据。
3. 中优先级：统一全局搜索和文章列表页搜索口径。
4. 中优先级：扩展相关文章评分信号，加入系列、英文标签和推荐原因。
5. 中优先级：建立搜索索引质量预算与关键词召回测试。
6. 低优先级：使用 Fuse matches 提升结果解释力。
7. 低优先级：把搜索弹窗壳层改为 DOM builder，统一安全渲染风格。
8. 低优先级：为高频标签生成可索引的静态标签详情页。
