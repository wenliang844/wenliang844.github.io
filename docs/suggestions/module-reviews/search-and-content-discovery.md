# 搜索与内容发现链路专题分析

生成时间：2026-07-03

分析范围：全局搜索弹窗、搜索懒加载、`search-index.json` 构建、博客列表筛选、标签云、时间归档、相关文章、结构化数据和搜索相关测试。

本轮验证：

- `node --test tests/blog.test.mjs tests/workflows.test.mjs tests/search-behavior.test.mjs tests/build-extra.test.mjs tests/js-behavior.test.mjs`：113/113 通过。
- `node --test tests/search-behavior.test.mjs tests/js-behavior.test.mjs tests/workflows.test.mjs`：58/58 通过。
- `npm run test:browser-smoke`：通过，真实浏览器覆盖搜索结果命中原因、`BPMN` 文章章节跳转、`Cron` 工具箱章节跳转、相关文章推荐原因和 `/post/` 正文长尾词过滤。
- 抽样当前 `search-index.json`：80 条记录，其中 6 篇文章、51 个文章章节、11 个静态页章节、12 个页面；文件 120,551 bytes（约 117.7KiB）；文章 `body` 预算为 3200 字，文章章节 `body` 预算为 560 字，静态页章节 `body` 预算为 72 字。
- 抽样关键词：`ESClient`、`Web Worker`、`Galaxy`、`BPMN`、`Maven`、`Cron` 均已进入搜索索引，并由回归测试锁定；文章章节路径均校验能在生成文章页找到对应 `#toc-*` heading，静态页章节路径均校验能在生成静态页找到对应锚点；文章列表页本地搜索也已能匹配正文和章节文本。
- 本轮只新增 `/docs/suggestions/module-reviews/search-and-content-discovery.md`。

## 总览

项目的内容发现基础很扎实：全局搜索通过 `search-loader.js` 懒加载，不阻塞首屏；`search.js` 使用 Fuse.js，支持中英文 i18n、键盘快捷键、ARIA combobox、结果高亮和加载失败降级；文章列表页有本地搜索、标签筛选、URL 同步、移动端目录浮层和 J/K 快捷键；标签页与时间归档页也都有结构化数据。

主要可优化点集中在“召回率”和“解释力”。当前文章搜索索引已经把正文预算从 600 字提升到 3200 字，并新增 `post-section` 章节条目，让正文命中可以显示具体章节并跳转到文章 heading；结果摘要也会优先显示包含查询词的字段。静态页面已完成第一阶段显式章节索引，覆盖工具箱、Trust Center 和 AI 页面内的高价值功能区；文章列表页本地搜索也已纳入文章正文、章节标题和 slug，让 `ESClient`、`Web Worker` 等全局搜索长尾词在 `/post/` 内保持可发现。Fuse matches 命中解释也已完成第一阶段，结果会显示“命中正文/命中章节/Matched body”等字段原因，并优先用匹配字段生成片段。相关文章评分信号已完成第一阶段，从单一中文标签重叠扩展为中文标签、英文标签、系列、领域、技术栈和主题信号，并在卡片中显示推荐原因。

严重程度分布：

- 高：0
- 中：5
- 低：3

## 建议清单

### 📌 MR-DISCOVERY-01 [已修复第二阶段]：搜索索引正文固定截断 600 字，长文深处关键词不可发现

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:343-345`
- `scripts/build.mjs:383-390`
- `scripts/build.mjs:393-412`
- `src/posts/finance-saas-backend.md:67-67`
- `src/posts/lowcode-schema-codegen.md:57-57`

📝 当前状况描述

构建脚本此前把文章 HTML 去标签后写入 `search-index.json`，但 `body` 固定 `slice(0, 600)`。当前已新增 `SEARCH_BODY_LIMIT = 3200`、`extractSearchSections()` 和显式静态页 `searchSections` 展开，根索引 120,551 bytes（约 117.7KiB），低于 125KB 质量预算；索引包含 6 篇文章、51 个文章章节、11 个静态页章节和 12 个页面。`ESClient`、`Web Worker`、`Galaxy`、`Maven`、`BPMN`、`Cron` 均已进入索引并由 `tests/build-extra.test.mjs` 回归保护，章节路径也会校验到生成页面的真实锚点。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

第一阶段已把“单篇 600 字”升级为“单篇 3200 字预算”，第二阶段已进一步生成“标题/摘要/标签 + H2/H3 章节条目”：每个章节记录 `sectionTitle`、560 字正文片段和 `#toc-*` 路径，搜索弹窗会显示章节标题并跳转到具体 heading。

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
  body: stripHtml(post.contentHtml).slice(0, SEARCH_BODY_LIMIT),
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

### 📌 MR-DISCOVERY-02 [已修复第一阶段]：静态页面只索引摘要和标签，工具箱与信任页的细粒度内容不可搜索

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:38-78`
- `scripts/build.mjs:393-412`
- `src/templates/tools.mjs:1-120`
- `src/templates/trust.mjs:95-131`
- `tests/build.test.mjs:146-155`

📝 当前状况描述

`SEARCH_PAGES` 为静态页提供标题、摘要、路径、标签和英文 i18n，这是轻量且可控的做法；当前第一阶段已增加可选 `searchSections`，生成 `page-section` 条目。索引已覆盖 `/tools/#tool-tab-json`、`/tools/#tool-tab-api`、`/tools/#tool-tab-cron`、`/tools/#tool-tab-jsonpath`、`/tools/#tool-tab-markdown`、`/tools/#tool-tab-galaxy`、`/trust/#trust-local-title`、`/trust/#trust-services-title`、`/trust/#trust-security-title`、`/ai/#relay` 和 `/ai/#nav`。工具箱 hash 深链接会自动激活对应工具面板，避免用户落到页面后还要重新找工具。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

第一阶段已采用显式 `searchSections` 清单，避免从工具页按钮和模板噪音中自动提取。后续可继续补更多高价值工具或把页面章节清单拆到独立数据文件。

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

### 📌 MR-DISCOVERY-03 [已修复第一阶段]：文章列表页本地搜索与全局搜索口径不一致

📍 位置（文件路径 + 行号范围）

- `js/blog.js:63-80`
- `js/blog.js:90-94`
- `js/blog.js:136-149`
- `src/templates/post.mjs:393-398`
- `js/search.js:108-125`

📝 当前状况描述

全局搜索使用 Fuse.js，并检索标题、短标题、标签、摘要、正文和路径；文章列表页此前只构建标题、摘要、标签和标签展示文案的 `haystack`，不看正文，导致用户在全局搜索里能找到的正文长尾词，进入 `/post/` 页面后可能搜不到。当前第一阶段已把文章正文、H2/H3 章节标题和 slug 纳入本地 haystack，保留现有 `?q=` URL 同步、标签筛选、分组计数和 J/K 导航行为。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

第一阶段已利用 `/post/` 页面现有 DOM 内容，不增加额外请求：`blog.js` 在构建本地 item cache 时读取 `.article-content`、章节标题和 `data-post-slug`，并与标题、摘要、标签一起组成 haystack。后续如果文章数量显著增长，再考虑懒加载 `search-index.json` 或构建期输出短文本。

```js
const body = contentEl ? contentEl.textContent : "";
const headings = headingEls.map((heading) => heading.textContent || "").join(" ");
const haystack = [title, summary, headings, body, slug, tags.join(" "), tagLabels.join(" ")]
  .join(" ")
  .toLowerCase();
```

`tests/blog.test.mjs` 已覆盖 `ESClient` 和 `Web Worker` 正文/章节词过滤；`scripts/browser-smoke.mjs` 也会在真实浏览器中访问 `/post/`、输入这些长尾词并确认 URL 同步和文章列表过滤生效。

📊 预期收益

- 全局搜索和文章页搜索对用户表现更一致。
- 文章列表页能匹配正文、章节标题和 slug 中的长尾词。
- 后续只需维护一套搜索质量测试。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/build-artifact-synchronization.md`
- `/docs/suggestions/devex-improvements.md`

### 📌 MR-DISCOVERY-04 [已修复第一阶段]：搜索结果使用 Fuse matches，但渲染解释仍以原始 query 为主

📍 位置（文件路径 + 行号范围）

- `js/search.js:108-125`
- `js/search.js:257-269`
- `js/search.js:301-365`
- `tests/security.test.mjs:40-47`

📝 当前状况描述

Fuse 配置开启了 `includeMatches: true`。当前第一阶段已开始消费 `r.matches`：搜索结果顶部会显示命中字段原因，例如“命中正文”“命中章节”或英文模式的 “Matched section”；摘要片段也优先来自实际匹配字段，并使用 Fuse 返回的范围信息高亮。没有 matches 的测试/降级路径会回退到精确字段扫描，继续保证结果可解释。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

第一阶段已基于 `r.matches` 展示命中字段徽标，并优先选中命中字段生成 snippet；后续可继续把字段原因纳入搜索排序调参面板或埋点分析。

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
- 正文、章节、标签和路径命中更容易被看见。
- 为未来搜索质量调参提供可观察反馈。

🔗 相关建议引用

- `/docs/suggestions/ux-improvements.md`
- `/docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 📌 MR-DISCOVERY-05 [已修复第一阶段]：相关文章只按中文标签重叠，缺少系列、主题和英文标签辅助信号

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:369-380`
- `scripts/build.mjs:301-319`
- `tests/build-deep.test.mjs:270-324`
- `src/templates/post.mjs:128-183`

📝 当前状况描述

`relatedPosts()` 当前第一阶段已从只用 `post.tags` 精确重叠，扩展为综合中文标签、英文标签、可选 `series/domains/stack` front matter 和 `eyebrow` 主题信号计分；仍保留“共同标签优先、同分按日期更新优先”的既有直觉。返回结果会带上 `relatedReason` / `relatedReasonEn`，模板在相关文章卡片中展示“共同标签：Java、Spring Boot”或 “Shared tags: Java, Spring Boot” 等原因。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

第一阶段已兼容可选 front matter：`series`、`seriesEn`、`domains`、`domainsEn`、`stack`、`stackEn`，并在构建阶段派生推荐原因。后续可以继续为现有文章补充更细的系列/领域/技术栈元数据。

```js
function relatedScore(current, candidate) {
  const zhTags = overlap(current.tags, candidate.tags) * 4;
  const enTags = overlap(current.tagsEn, candidate.tagsEn) * 3;
  const sameSeries = current.series && current.series === candidate.series ? 6 : 0;
  const sameDomain = overlap(current.domains || [], candidate.domains || []) * 3;
  return zhTags + enTags + sameSeries + sameDomain;
}
```

推荐结果可以带上 `reason: "同属低代码 / React"`，模板显示为小标签。

📊 预期收益

- 推荐从“标签碰巧相同”升级为“主题相关”。
- 英文模式和中文模式下推荐质量更一致。
- 相关文章卡片会直接展示推荐原因，能提高继续阅读的确定感。

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

测试已经确认搜索索引包含 6 篇文章、51 个文章章节、11 个静态页章节、关键静态页、i18n 元数据和正斜杠路径。当前质量预算要求索引体积 < 125KB、每篇文章 body <= 3200、文章章节 body <= 560、静态页章节 body <= 72、至少存在 >600 字正文，并锁定 `ESClient`、`Web Worker`、`Galaxy`、`Maven`、`BPMN`、`Cron` 这些抽样关键词。章节路径也会逐一读取生成页面，确认文章 `#toc-*` 和静态页 hash anchor 真实存在。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

第一阶段已在 `tests/build-extra.test.mjs` 中把大小预算和抽样召回纳入；后续可拆出独立 `tests/search-index-quality.test.mjs` 承载更多页面章节质量断言。

```js
const raw = await readFile(join(outDir, "search-index.json"));
assert.ok(raw.byteLength < 125_000, "search index should stay lightweight");

const index = JSON.parse(raw);
for (const term of ["ESClient", "Web Worker", "Galaxy", "Maven", "BPMN"]) {
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

1. 已完成第二阶段：为文章引入章节/分块索引，让正文命中能显示具体章节并跳转到 `#toc-*`。
2. 已完成第一阶段：为工具箱、信任页和 AI 页增加静态页面章节级搜索数据，并让工具箱 hash 自动激活对应面板。
3. 已完成第一阶段：文章列表页本地搜索纳入正文、章节标题和 slug，真实浏览器 smoke 覆盖 `ESClient` / `Web Worker` 长尾词过滤。
4. 已完成第一阶段：扩展相关文章评分信号，加入系列、英文标签、领域/技术栈和推荐原因。
5. 已完成第二阶段：建立搜索索引体积预算、关键词召回测试、章节数量/长度/锚点质量断言和 browser smoke 章节搜索交互。
6. 已完成第一阶段：使用 Fuse matches 提升结果解释力，结果展示命中字段原因并基于匹配字段生成片段。
7. 低优先级：把搜索弹窗壳层改为 DOM builder，统一安全渲染风格。
8. 低优先级：为高频标签生成可索引的静态标签详情页。
