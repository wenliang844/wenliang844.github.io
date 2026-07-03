# CWLBlog 完整分析报告与优先级路线图

生成时间：2026-07-04 04:45（Asia/Shanghai）  
分析目标：对当前项目进行自主分析、自主测试，并只向 `/docs` 输出建议文档。

## 当前质量基线

| 项目 | 当前结果 |
| --- | --- |
| 分支 | `codex/autonomous-optimization` |
| 建议库规模 | 66 个 `/docs/suggestions` 文档，其中 45 个模块专题 |
| 当前工作树 | 存在本轮源码、测试和文档改动；质量基线以 dirty scope 记录当前证据范围 |
| Lint | `npm run lint:check` 通过，0 warnings |
| 单元/行为测试 | `npm test` 789/789 通过 |
| 覆盖率 | `npm run test:coverage` 789/789 通过；line 96.76%、branch 83.95%、funcs 96.30% |
| HTTP smoke | `node scripts/http-smoke.mjs` 6/6 路由通过 |
| 生产/浏览器证据 | 外部质量基线记录显示 smoke、production gate 和 browser smoke 均通过；dirty scope 已记录 |

## 总体判断

项目已经从一个普通静态博客，演进成带 AI 助手、开发工具箱、内容索引、信任中心、真实浏览器 smoke、发布验证和较厚测试网的静态站点系统。主路径稳定性很好，当前问题更多集中在“治理层”：资源/证据/缓存/多语言/发布产物如何避免随着功能增长而漂移。

综合健康度建议保持在 **3.9 / 5（良好）**：

| 维度 | 评分 | 说明 |
| --- | ---: | --- |
| 代码质量 | 4.1 / 5 | 核心脚本测试充分，仍有 `assistant.js`、工具箱和 CSS 大模块拆分压力 |
| 安全性 | 3.7 / 5 | 默认 key、弱随机、XSS 主风险已处理；API key endpoint 信任、PWA 缓存边界和供应链 manifest 仍需治理 |
| 性能 | 3.9 / 5 | 路由级 CSS 预算和按需工具面板已推进；JS/CSS 包、模型冷启动、PWA 缓存策略仍是重点 |
| SEO / 内容可信 | 4.0 / 5 | JSON-LD、canonical、sitemap、RSS 基础完整；lastmod、RSS auto-discovery、内容新鲜度可继续增强 |
| UX / 可访问性 | 4.1 / 5 | 真实浏览器 smoke、按钮名称、编辑器标签、QR 稳定性已补；离线和错误态仍有提升空间 |
| 工程化 | 4.2 / 5 | 788 项测试、覆盖率门禁、HTTP/browser smoke、生产验证均较强；证据 artifact 和 CI 体积仍需收敛 |
| 可维护性 | 3.6 / 5 | 文档体系很丰富，但索引、状态、证据数字和“已修复”口径需要自动化 |

## 问题清单索引

| 主题 | 代表文档 | 当前风险 |
| --- | --- | --- |
| 潜在 Bug / 运行时风险 | `bugs-and-risks.md`、`module-reviews/tools-core-runtime-safety.md`、`module-reviews/runtime-observability-and-error-resilience.md` | 中 |
| 安全与隐私 | `security-audit.md`、`module-reviews/local-data-retention-map.md`、`module-reviews/assistant-loader-and-llm-runtime.md`、`module-reviews/pwa-offline-cache-readiness.md` | 中 |
| 性能与资源 | `performance-bottlenecks.md`、`module-reviews/static-assets-and-third-party-resources.md`、`module-reviews/css-resource-ownership-and-page-styles.md` | 中 |
| SEO / 内容 / Feed | `module-reviews/seo-feed-and-structured-data.md`、`module-reviews/content-freshness-and-trust-signals.md`、`module-reviews/search-and-seo-pipeline.md` | 中 |
| i18n / a11y / UX | `module-reviews/i18n-coverage-and-content-consistency.md`、`module-reviews/browser-visual-smoke-testing.md`、`ux-improvements.md` | 中 |
| 工程化 / 证据治理 | `module-reviews/ci-release-automation-review.md`、`module-reviews/suggestion-evidence-drift-audit.md`、`module-reviews/suggestions-knowledge-base-governance.md` | 中 |
| 功能演进 | `new-features.md`、`competitive-analysis.md`、`module-reviews/pwa-offline-cache-readiness.md` | 低到中 |

## 优先级待办建议

### 📌 FINAL-01：把当前质量基线 artifact 纳入正式发布门禁

- 📌 问题/建议标题：质量证据需要单一来源，而不是散落在报告文字中
- 📍 位置：`docs/suggestions/evidence/current-quality-baseline.json:1-112`、`scripts/write-quality-baseline.mjs:1-160`、`docs/suggestions/module-reviews/suggestion-evidence-drift-audit.md:20-151`
- 📝 当前状况描述：外部并发改动已经新增质量基线脚本和 JSON artifact，能记录 lint、test、coverage、HTTP smoke、browser smoke、production gate 与 dirty scope。这正好解决历史报告中 731/742/786/788 和 94.x/96.x 覆盖率数字漂移的问题。但该脚本与 artifact 当前仍是脏工作树内容，需要纳入正式 CI/文档流程并约定更新时机。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：保留 `scope: "working-tree"`，再增加 `scope: "clean-commit"` 模式；CI 在 release gate 后写 artifact，并把 summary 注入 README。

```js
const baseline = await collectQualityBaseline({ requireClean: process.env.CI === "true" });
assert.equal(baseline.summary.status, "pass");
assert.equal(baseline.git.dirty, false, "release baseline must be clean");
```

- 📊 预期收益：README、健康度评分和小时报告引用同一份证据，减少人工更新错误。
- 🔗 相关建议引用：`module-reviews/suggestion-evidence-drift-audit.md`、`module-reviews/test-coverage-risk-map.md`、`module-reviews/ci-release-automation-review.md`

### 📌 FINAL-02：PWA 前先定义缓存安全矩阵

- 📌 问题/建议标题：Service Worker 可能扩大 API key、API Tester 和动态数据缓存风险
- 📍 位置：`src/templates/layout.mjs:248-264`、`js/search.js:207-224`、`js/relay.js:271-286`、`js/tools.js:1166-1180`、`js/assistant.js:600-633`
- 📝 当前状况描述：站点目前没有 manifest 和 Service Worker；PWA 是明确的功能方向。但搜索索引、relay 数据、助手请求、API Tester 请求和表单提交具有不同的新鲜度与隐私边界，不能用同一个 cache-first 策略处理。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：先写缓存策略矩阵，默认只缓存 same-origin GET 静态资源；非 GET、跨域、含 token/key/signature 查询串、助手/API Tester 请求全部 network-only。

```js
if (request.method !== "GET") return fetch(request);
if (url.origin !== location.origin) return fetch(request);
if (/(token|api_key|signature|secret)=/i.test(url.search)) return fetch(request);
```

- 📊 预期收益：让离线能力提升 UX 的同时，不引入新的本地敏感数据留存层。
- 🔗 相关建议引用：`module-reviews/pwa-offline-cache-readiness.md`、`module-reviews/local-data-retention-map.md`、`security-audit.md`

### 📌 FINAL-03：从资源 manifest 驱动生产验证和 PWA 预缓存

- 📌 问题/建议标题：页面级 CSS/JS、生成产物和离线缓存需要同一份资源归属清单
- 📍 位置：`src/page-assets.mjs:1-80`、`src/templates/layout.mjs:65-73`、`tests/performance.test.mjs:260-290`、`scripts/validate-production.mjs:51-73`
- 📝 当前状况描述：项目已经新增页面级 CSS 和路由级预算，`/tools/`、`/trust/` 有独立样式入口。但生产验证和未来 PWA 预缓存如果继续手写资源列表，仍会出现模板、HTML、缓存和 Git 跟踪状态漂移。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：把 `PAGE_ASSETS` 扩展成页面资源 manifest，生产验证、性能预算、链接检查、PWA 预缓存都从它派生。

```js
for (const route of Object.keys(PAGE_ASSETS)) {
  const expected = coreAssets.concat(PAGE_ASSETS[route].styles, PAGE_ASSETS[route].scripts || []);
  assert.deepEqual(extractAssets(renderedHtml(route)), expected);
}
```

- 📊 预期收益：新增页面、拆分 CSS 或接入 PWA 时只维护一处资源契约。
- 🔗 相关建议引用：`module-reviews/css-resource-ownership-and-page-styles.md`、`module-reviews/build-artifact-synchronization.md`

### 📌 FINAL-04：让生成产物漂移检查成为只读门禁

- 📌 问题/建议标题：源码、模板和已提交 HTML/RSS/sitemap/search 产物仍可能不一致
- 📍 位置：`scripts/build.mjs:536-616`、`scripts/validate-production.mjs:227-265`、`post/index.html:1-40`、`sitemap.xml:1-25`
- 📝 当前状况描述：构建脚本可以输出到临时目录，生产验证已避免覆盖根目录，这是很好的基础。剩余风险是仓库仍提交生成产物；评审时需要知道当前根目录 HTML、RSS、sitemap、search-index 是否由当前源码生成。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在 CI 中临时构建到 `temp/build-check`，与已提交产物做 path-limited diff。

```powershell
node scripts/build.mjs --out temp/build-check
git diff --no-index -- post temp/build-check/post
git diff --no-index -- sitemap.xml temp/build-check/sitemap.xml
```

- 📊 预期收益：避免 GitHub Pages 部署内容、源码模板和测试构建内容出现三套真相。
- 🔗 相关建议引用：`module-reviews/build-artifact-synchronization.md`、`module-reviews/trust-page-launch-readiness.md`

### 📌 FINAL-05：补 i18n 覆盖率报告并要求 missing 为 0

- 📌 问题/建议标题：1509 个 `data-i18n*` 绑定缺少常态化英文来源报告
- 📍 位置：`js/i18n.js:17-57`、`tests/i18n-a11y.test.mjs:163-212`、`tests/i18n-deep.test.mjs:18-47`、`src/templates/post.mjs:93-116`
- 📝 当前状况描述：当前中英切换能力完整，但扫描发现仍有 24 个绑定没有显式英文来源，主要集中在 TOC、观察家同名英文项和信任页统计区 aria。问题用户影响不高，但治理上需要把“有意沿用原文”和“遗漏英文”分开。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增 `check-i18n-coverage.mjs`，输出 dictionary/inline/same/missing 分布，CI 要求 `missing.length === 0`。

```js
assert.equal(report.missing.length, 0, report.missing.map((item) => item.key).join("\n"));
```

- 📊 预期收益：新增页面时立即发现翻译缺口，并为英文 SEO/OG/search 元信息打基础。
- 🔗 相关建议引用：`module-reviews/i18n-coverage-and-content-consistency.md`、`module-reviews/i18n-and-accessibility.md`

### 📌 FINAL-06：把 SEO/feed 质量报告固化为发布摘要

- 📌 问题/建议标题：sitemap、RSS、JSON-LD、canonical 和 feed discovery 信号分散在测试中
- 📍 位置：`scripts/build.mjs:417-528`、`src/templates/layout.mjs:154-176`、`sitemap.xml:1-25`、`index.xml:1-40`
- 📝 当前状况描述：项目 SEO 基础好，但静态页 lastmod、HTML RSS auto-discovery、RSS item category/cover 和 Article headline 仍有提升空间。当前测试能阻断明显缺失，但没有一份可读摘要告诉维护者本次发布 SEO 信号是否变好或退化。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：构建后生成 SEO/feed report，统计 sitemap URL 数、缺失 lastmod、RSS item、JSON-LD 类型、缺失 alternate feed 的页面。

```js
report.pages.push({
  path,
  canonical: Boolean(doc.querySelector('link[rel="canonical"]')),
  feedAlternate: Boolean(doc.querySelector('link[type="application/rss+xml"]')),
});
```

- 📊 预期收益：搜索引擎、RSS 阅读器和社交分享质量可回归、可比较。
- 🔗 相关建议引用：`module-reviews/seo-feed-and-structured-data.md`、`module-reviews/content-freshness-and-trust-signals.md`

### 📌 FINAL-07：助手与 API key 配置需要 endpoint 信任确认和“记住 key”显式选择

- 📌 问题/建议标题：用户 key 会发往预置或自填 endpoint，长期保存仍需更细边界
- 📍 位置：`js/assistant.js:600-633`、`js/assistant.js:1028-1066`、`js/assistant.js:1462-1528`、`src/templates/tools.mjs:900-980`
- 📝 当前状况描述：前端默认体验 key 已移除，助手默认站点模式也已对齐隐私最小外发原则。但用户自填 key 后，UI 仍应突出显示实际 endpoint host、协议和路径，并让“记住 API key”默认关闭。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：发送前弹出 endpoint trust summary；配置区增加 `rememberApiKey`，默认只保存在内存或 session。

```js
if (!trustedEndpoint(endpoint)) {
  showEndpointTrustDialog(new URL(endpoint).host);
  return;
}
```

- 📊 预期收益：降低共享电脑、浏览器扩展和误填 endpoint 带来的 key 泄露风险。
- 🔗 相关建议引用：`module-reviews/assistant-loader-and-llm-runtime.md`、`security-audit.md`

### 📌 FINAL-08：浏览器 smoke 下一步应输出截图和失败 artifact

- 📌 问题/建议标题：真实浏览器检查已覆盖关键路径，但失败证据还不够可追踪
- 📍 位置：`scripts/browser-smoke.mjs:9-288`、`scripts/http-smoke.mjs:9-140`、`.github/workflows/ci.yml:1-90`
- 📝 当前状况描述：Playwright smoke 已覆盖桌面/移动关键路由、横向溢出、Canvas 像素、Clipboard 和手势确认门闩。剩余风险是截图、trace、console log 和失败 DOM 快照没有作为 artifact 保存；CI 中也需要决定是主门禁、nightly 还是手动 job。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：失败时保存 screenshot、HTML、console/errors；CI 上传 artifact。

```js
await page.screenshot({ path: `temp/browser-smoke/${label}.png`, fullPage: true });
await writeFile(`temp/browser-smoke/${label}.html`, await page.content());
```

- 📊 预期收益：视觉/权限/布局问题失败后可复盘，而不是只看一行错误。
- 🔗 相关建议引用：`module-reviews/browser-visual-smoke-testing.md`、`module-reviews/layout-responsive-print-review.md`

### 📌 FINAL-09：Relay 数据同步需要关键源失败策略和单文件覆盖率预算

- 📌 问题/建议标题：外部 relay 数据进入公开排行榜，需要更强异常门禁
- 📍 位置：`scripts/parse-relay.mjs:45-134`、`scripts/update-commercial-relay.mjs:118-219`、`data/relay-providers.json:1-80`、`tests/relay.test.mjs:1-134`
- 📝 当前状况描述：relay 异常矩阵已有明显加强，覆盖率总体很高；但 `parse-relay.mjs` branch 69.90% 仍略低于 70%，`update-commercial-relay.mjs` line 76.65% 仍是低点。商业源失败策略也需要区分关键源和可选源。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为 relay 脚本设置单文件预算，并把商业源配置成 `required: true/false`。

```js
const SOURCE_POLICY = [{ url, required: true }, { url, required: false }];
if (source.required && result.status === "rejected") throw result.reason;
```

- 📊 预期收益：公开 AI 中转站数据更可靠，避免部分源失败但榜单仍看似正常。
- 🔗 相关建议引用：`module-reviews/relay-data-quality-and-sync.md`、`module-reviews/test-coverage-risk-map.md`

### 📌 FINAL-10：共享格式化和阅读指标需要跨端契约测试

- 📌 问题/建议标题：日期、转义、阅读时间被多个运行时复用，隐性约定应测试化
- 📍 位置：`src/lib/format.mjs:14-73`、`src/lib/reading.mjs:1-12`、`js/utils.js:198-214`、`scripts/build.mjs:318-346`
- 📝 当前状况描述：构建端和浏览器端阅读时间算法一致但重复；日期 helper 假设上游已归一化；HTML/XML/属性转义函数分散在多个运行时。当前主路径没问题，但未来新增模板时容易误用。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：增加跨端 fixture，Node helper 与 JSDOM `CWLUtils` 对同一输入输出一致；`format.mjs` 增加非法日期断言。

```js
assert.equal(serverReadingMinutes(text), dom.window.CWLUtils.readingMinutes(text));
assert.throws(() => sitemapDate("2026-13-99"), /Invalid/);
```

- 📊 预期收益：减少 SEO 日期、阅读时间和转义上下文随功能增长而悄悄漂移。
- 🔗 相关建议引用：`module-reviews/shared-formatting-and-reading-contract.md`、`module-reviews/content-publishing-quality-gates.md`

### 📌 FINAL-11：静态资产供应链应建立 vendor / remote runtime manifest

- 📌 问题/建议标题：本地 vendor 与远程模型资源缺少来源、版本、hash 和升级责任人
- 📍 位置：`js/vendor/fuse.min.js:1-20`、`js/vendor/marked.min.js:1-20`、`js/gesture.js:1-140`、`src/trust-data.mjs:60-120`
- 📝 当前状况描述：自托管 vendor 文件和手势工具远程运行时目前可工作，Trust Center 也说明了第三方资源触发时机。但供应链治理还缺少 manifest：版本、来源 URL、许可证、SHA-256、是否允许 source map 缺失、升级检查周期。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增 `docs/vendor-manifest.json` 或 `src/resource-manifest.mjs`，测试校验文件 hash 和 Trust Center 服务清单一致。

```js
for (const item of manifest.vendor) {
  assert.equal(await sha256(item.path), item.sha256);
}
```

- 📊 预期收益：依赖升级可审计，远程视觉模型和本地 vendor 文件不再靠人工记忆维护。
- 🔗 相关建议引用：`module-reviews/static-assets-and-third-party-resources.md`、`module-reviews/dependency-supply-chain-posture.md`

### 📌 FINAL-12：README/建议库索引需要机器生成辅助

- 📌 问题/建议标题：建议文档数量已较大，人工索引和状态同步成本上升
- 📍 位置：`docs/suggestions/README.md:1-280`、`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md:25-187`、`docs/suggestions/module-reviews/suggestion-evidence-drift-audit.md:124-151`
- 📝 当前状况描述：建议库已经达到 66 个文档、45 个模块专题。README 仍是手写长索引，容易漏掉新专题、保留旧测试数字或把“已修复/剩余风险”混在一起。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为建议文档增加轻量 front matter 或标题扫描脚本，自动生成目录、状态统计、最近更新和证据引用。

```js
const docs = await scanSuggestionDocs("docs/suggestions");
await writeFile("docs/suggestions/README.md", renderSuggestionIndex(docs, baseline));
```

- 📊 预期收益：让最终报告、README、健康度评分和小时报告保持一致，减少建议库自身成为技术债。
- 🔗 相关建议引用：`module-reviews/suggestions-knowledge-base-governance.md`、`module-reviews/suggestion-evidence-drift-audit.md`

## 按阶段执行建议

| 阶段 | 时间 | 建议 |
| --- | --- | --- |
| P0 | 立即 | FINAL-01、FINAL-02、FINAL-03、FINAL-04 |
| P1 | 近期 | FINAL-05、FINAL-06、FINAL-07、FINAL-08 |
| P2 | 中期 | FINAL-09、FINAL-10、FINAL-11、FINAL-12 |

## 功能建议收口

| 功能 | 当前建议 | 风险前置条件 |
| --- | --- | --- |
| PWA / 离线阅读 | 建议继续推进，但必须先做缓存安全矩阵和 offline smoke | FINAL-02、FINAL-03 |
| 文章内容新鲜度 | 展示 `modified`、sitemap lastmod 对齐、搜索按更新信号排序 | FINAL-06 |
| RSS 订阅增强 | HTML alternate discovery、RSS category/cover/摘要增强 | FINAL-06 |
| AI 助手增强 | endpoint 信任确认、记住 key opt-in、错误态 i18n、导出/删除当前对话 | FINAL-07 |
| 工具箱体验 | 模型缓存状态、API Tester 更清晰的隐私模式、工具 JS/CSS 拆包 | FINAL-03、FINAL-11 |

## 最终结论

当前项目基础已经很结实：测试通过率、覆盖率、静态验证、浏览器 smoke、CSP、结构化数据、信任页和文档库都明显优于普通个人静态站。下一阶段最值得投入的不是继续堆功能，而是把“增长后的复杂度”变成自动化契约：资源 manifest、质量基线、生成产物漂移检查、i18n 覆盖率、SEO/feed 报告、PWA 缓存矩阵和建议库机器索引。

只要这些治理线补齐，后续做 PWA、内容系列、AI 助手增强或更丰富工具箱时，项目会更像一个可长期维护的小型产品，而不是不断变重的静态页面集合。
