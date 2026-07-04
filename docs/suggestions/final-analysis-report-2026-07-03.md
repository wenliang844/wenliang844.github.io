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
| 单元/行为测试 | `npm test` 889/889 通过 |
| 覆盖率 | `npm run test:coverage` 889/889 通过；line 91.37%、branch 79.31%、funcs 90.39% |
| i18n 覆盖 | `npm run check:i18n` 通过；21 个 HTML、971 个引用、259 个唯一 key、0 个缺失 |
| HTTP smoke | `node scripts/http-smoke.mjs` 7/7 路由通过 |
| SEO/feed | `npm run check:seo-feed` 通过；21 个 HTML、19 个 sitemap URL、3 个 RSS feed、21 个 feed alternate、20 个 JSON-LD block、0 违规 |
| Service Worker 生成 | `npm run check:service-worker` 通过；根目录 `service-worker.js` 和 `build --out` 产物均由 `src/service-worker-template.mjs` 生成 |
| PWA 预缓存 | `npm run check:pwa-precache` 通过；19 个预缓存 URL、19 个 Service Worker URL、2 个页面资源覆盖、0 生成物所有权缺口、0 缺失、0 额外、0 不可缓存 |
| 生产/浏览器证据 | 质量基线记录显示 HTTP smoke、browser smoke、PWA smoke 和 production gate 均通过；PWA smoke 已覆盖搜索索引未缓存/已缓存离线矩阵和 Service Worker 版本升级清理；搜索弹窗已覆盖离线未缓存、索引损坏、正文命中片段、文章章节命中、静态页章节命中、命中字段原因和成功渲染行为；browser smoke 已覆盖 `BPMN` 文章章节搜索跳转、`Cron` 工具箱章节搜索跳转、搜索结果命中原因可见、相关文章推荐原因可见与英文切换，以及 `/post/` 列表页 `ESClient` / `Web Worker` 正文长尾词过滤；full HTTP/browser smoke 已覆盖完整静态路由 |

## 总体判断

项目已经从一个普通静态博客，演进成带 AI 助手、开发工具箱、内容索引、信任中心、真实浏览器 smoke、发布验证和较厚测试网的静态站点系统。主路径稳定性很好，当前问题更多集中在“治理层”：资源/证据/缓存/多语言/发布产物如何避免随着功能增长而漂移。

综合健康度建议保持在 **3.9 / 5（良好）**：

| 维度 | 评分 | 说明 |
| --- | ---: | --- |
| 代码质量 | 4.1 / 5 | 核心脚本测试充分，仍有 `assistant.js`、工具箱和 CSS 大模块拆分压力 |
| 安全性 | 3.7 / 5 | 默认 key、弱随机、XSS 主风险已处理；API key endpoint 信任、PWA 缓存升级边界和供应链 manifest 仍需继续治理 |
| 性能 | 3.9 / 5 | 路由级 CSS 预算和按需工具面板已推进；JS/CSS 包、模型冷启动、PWA 缓存策略仍是重点 |
| SEO / 内容可信 | 4.0 / 5 | JSON-LD、canonical、sitemap、RSS 基础完整；lastmod、RSS auto-discovery、内容新鲜度可继续增强 |
| UX / 可访问性 | 4.2 / 5 | 真实浏览器 smoke、按钮名称、编辑器标签、QR 稳定性、搜索离线错误态、搜索索引缓存状态、章节命中解释和模型资源状态可视化已补；模型自托管进度仍可增强 |
| 工程化 | 4.25 / 5 | 889 项测试、覆盖率门禁、HTTP/browser/PWA smoke、SW 生成检查和生产验证均较强；clean quality baseline 与浏览器失败 artifact 已接入 CI，trace/video 和 CI 体积仍需收敛 |
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

### 📌 FINAL-01 [已修复第二阶段]：把当前质量基线 artifact 纳入正式发布门禁

- 📌 问题/建议标题：质量证据需要单一来源，而不是散落在报告文字中
- 📍 位置：`docs/suggestions/evidence/current-quality-baseline.json:1-112`、`scripts/write-quality-baseline.mjs:1-160`、`docs/suggestions/module-reviews/suggestion-evidence-drift-audit.md:20-151`
- 📝 当前状况描述：第二阶段已完成。质量基线脚本和 JSON artifact 能记录 lint、test、coverage、HTTP smoke、browser smoke、PWA smoke、production gate 与 dirty scope，解决历史报告中测试数量和覆盖率数字漂移的问题。CI 现在会在 build 前运行 `npm run quality:baseline:clean -- --out temp/quality-baseline/clean-quality-baseline.json`，再用 `check:quality-baseline --require-head --require-clean-scope` 验证 clean artifact 的 commit、scope 和 `git.dirty === false`。失败命令会写入 `temp/quality-baseline/logs/<command>.log`，JSON 记录 `logPath`、脱敏 `outputTail` 和可选 `artifactPaths`；CI 会在目录存在时上传整个 `temp/quality-baseline/`。仓库内的 `current-quality-baseline.json` 继续作为 dirty working-tree 分析证据。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：已保留 `scope: "working-tree"` 本地分析模式，并增加 CI clean artifact：`quality:baseline:clean` 输出 `scope: "clean-commit"`；`check:quality-baseline --require-clean-scope` 要求该 artifact 为干净提交证据；失败时保存脱敏日志路径和尾部输出。后续可继续把 clean artifact summary 注入发布摘要或 release note。

```js
const baseline = await collectQualityBaseline({ requireClean: process.env.CI === "true" });
assert.equal(baseline.summary.status, "pass");
assert.equal(baseline.git.dirty, false, "release baseline must be clean");
```

- 📊 实际收益：本地分析证据、CI 发布证据和失败诊断日志已经分层，README、健康度评分和小时报告可以引用同一类机器可读证据，减少人工更新错误，也减少 CI 失败后的复盘成本。
- 🔗 相关建议引用：`module-reviews/suggestion-evidence-drift-audit.md`、`module-reviews/test-coverage-risk-map.md`、`module-reviews/ci-release-automation-review.md`

### 📌 FINAL-02 [已修复第二阶段]：PWA 前先定义缓存安全矩阵

- 📌 问题/建议标题：Service Worker 可能扩大 API key、API Tester 和动态数据缓存风险
- 📍 位置：`src/templates/layout.mjs:248-264`、`js/search.js:207-224`、`js/relay.js:271-286`、`js/tools.js:1166-1180`、`js/assistant.js:600-633`
- 📝 当前状况描述：站点已新增 `manifest.webmanifest`、`/offline.html`、`/service-worker.js` 和 `/js/pwa-register.js`，具备保守 PWA 外壳。搜索索引、relay 数据、助手请求、API Tester 请求和表单提交具有不同的新鲜度与隐私边界，不能用同一个 cache-first 策略处理。当前已新增 `src/pwa-cache-policy.mjs`，用 `PWA_CACHE_POLICY_MATRIX` 和 `classifyPwaRequest()` 固化策略，并用单元测试校验 Service Worker 镜像策略一致；`service-worker.js` 也已由 `src/service-worker-template.mjs` 生成并用 `check:service-worker` 防漂移。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：当前 Service Worker 已由源码模板生成并镜像缓存策略矩阵，默认只缓存 same-origin GET 的导航/静态资源/搜索索引；非 GET、跨域、含 token/key/signature 查询串、relay/API/未知 endpoint、带敏感 header 的请求全部 network-only。预缓存清单已由 `src/pwa-precache.mjs` 作为源码契约维护，并由 `check:service-worker` 和 `check:pwa-precache` 校验整文件生成、Service Worker、文件存在性、生成物所有权归属、Font Awesome 字体引用和缓存策略一致。

```js
classifyPwaRequest("/css/coder.css").strategy; // cache-first
classifyPwaRequest("/search-index.json").strategy; // stale-while-revalidate
classifyPwaRequest("/tools/?api_key=secret").strategy; // network-only
```

- 📊 预期收益：让离线能力提升 UX 的同时，不引入新的本地敏感数据留存层。
- 🔗 相关建议引用：`module-reviews/pwa-offline-cache-readiness.md`、`module-reviews/local-data-retention-map.md`、`security-audit.md`

### 📌 FINAL-03 [部分修复]：从资源 manifest 驱动生产验证和 PWA 预缓存

- 📌 问题/建议标题：页面级 CSS/JS、生成产物和离线缓存需要同一份资源归属清单
- 📍 位置：`src/page-assets.mjs:1-80`、`src/pwa-precache.mjs`、`src/templates/layout.mjs:65-73`、`tests/performance.test.mjs:260-290`、`scripts/validate-production.mjs:51-73`
- 📝 当前状况描述：项目已经新增页面级 CSS、路由级预算和 `src/pwa-precache.mjs` 预缓存契约，`/tools/`、`/trust/` 有独立样式入口，Service Worker 的 19 个预缓存 URL 已被只读检查守卫，并覆盖 2 个页面资源；整份 `service-worker.js` 也已由 `src/service-worker-template.mjs` 生成。当前 `check:pwa-precache` 还会反查 `data/generated-artifact-manifest.json`，要求每个预缓存 URL 都属于 generated output、manual HTML、manual static file 或 copied asset directory。剩余风险是生产验证、页面级脚本/样式和未来新增离线路由尚未完全由同一份资源 manifest 派生。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：继续把 `PAGE_ASSETS` 扩展成页面资源 manifest，让生产验证、性能预算、链接检查、PWA 预缓存和未来离线路由清单都从它派生。

```js
for (const route of Object.keys(PAGE_ASSETS)) {
  const expected = coreAssets.concat(PAGE_ASSETS[route].styles, PAGE_ASSETS[route].scripts || []);
  assert.deepEqual(extractAssets(renderedHtml(route)), expected);
}
```

- 📊 预期收益：新增页面、拆分 CSS 或接入 PWA 时只维护一处资源契约。
- 🔗 相关建议引用：`module-reviews/css-resource-ownership-and-page-styles.md`、`module-reviews/build-artifact-synchronization.md`

### 📌 FINAL-04 [已修复第二阶段]：让生成产物漂移检查成为只读门禁

- 📌 问题/建议标题：源码、模板和已提交 HTML/RSS/sitemap/search 产物仍可能不一致
- 📍 位置：`scripts/check-generated-drift.mjs`、`scripts/check-generated-artifact-manifest.mjs`、`data/generated-artifact-manifest.json`、`scripts/build.mjs`
- 📝 当前状况描述：第二阶段已完成。`npm run check:generated` 会先临时构建到 `temp/generated-drift-check` 并比较 83 个输出文件与仓库根目录是否字节一致，再运行 `scripts/check-generated-artifact-manifest.mjs` 校验 `data/generated-artifact-manifest.json`。manifest 区分动态文章页、静态生成页、RSS/sitemap/search/service-worker 产物、手写 HTML 页（含 `offline.html`）、手写静态文件（含 `manifest.webmanifest`）和复制的静态资源目录；所有已提交 HTML 都必须归类为 generated 或 manual。CI 和 `check:readonly` 都在 `npm run build` 覆盖根目录产物前运行该门禁，PWA 预缓存检查也会复用该 manifest 阻断未归属离线资源。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已落地只读漂移检查和产物所有权 manifest。后续可继续把 manifest 用于 PR 模板或发布摘要，提示评审者应修改源码还是生成产物。

```powershell
node scripts/build.mjs --out temp/build-check
git diff --no-index -- post temp/build-check/post
git diff --no-index -- sitemap.xml temp/build-check/sitemap.xml
```

- 📊 实际收益：避免 GitHub Pages 部署内容、源码模板和测试构建内容出现三套真相；评审时也能明确哪些文件由 build 生成、哪些页面允许手写维护。
- 🔗 相关建议引用：`module-reviews/build-artifact-synchronization.md`、`module-reviews/trust-page-launch-readiness.md`

### 📌 FINAL-05 [已修复第一阶段]：补 i18n 覆盖率报告并要求 missing 为 0

- 📌 问题/建议标题：`data-i18n*` 绑定缺少常态化英文来源报告
- 📍 位置：`js/i18n.js:17-57`、`tests/i18n-a11y.test.mjs:163-212`、`tests/i18n-deep.test.mjs:18-47`、`src/templates/post.mjs:93-116`
- 📝 当前状况描述：已新增 `scripts/check-i18n-coverage.mjs` 和 `npm run check:i18n`，扫描 committed HTML 中的 `data-i18n`、`data-i18n-html`、`data-i18n-aria`、`data-i18n-ph`、`data-i18n-title` 与 `body[data-i18n-page]` head key，并复用真实 `js/i18n.js` 运行时判断英文词典是否覆盖。当前检查 21 个 HTML、971 个引用、259 个唯一 key，missing 为 0；该检查已接入 `check:readonly`、CI 和质量基线。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：第一阶段已要求 `missing.length === 0`。下一阶段可继续输出 dictionary/inline 分布，并把 head、OG、search、JSON-LD 的英文元信息纳入同一份一致性报告。

```js
assert.equal(report.missing.length, 0, report.missing.map((item) => item.key).join("\n"));
```

- 📊 预期收益：新增页面时立即发现翻译缺口，并为英文 SEO/OG/search 元信息打基础；已修复离线页 head、文章 TOC、信任页统计 aria 和鉴赏页专有名词显式英文来源。
- 🔗 相关建议引用：`module-reviews/i18n-coverage-and-content-consistency.md`、`module-reviews/i18n-and-accessibility.md`

### 📌 FINAL-06 [已修复第一阶段]：把 SEO/feed 质量报告固化为发布摘要

- 📌 问题/建议标题：sitemap、RSS、JSON-LD、canonical 和 feed discovery 信号分散在测试中
- 📍 位置：`scripts/build.mjs:417-528`、`src/templates/layout.mjs:154-176`、`sitemap.xml:1-25`、`index.xml:1-40`
- 📝 当前状况描述：已新增 `scripts/check-seo-feed.mjs`、`npm run check:seo-feed` 和 `npm run seo:report`，统一报告 sitemap URL、RSS feed/item、HTML canonical、OG/Twitter、JSON-LD 与 RSS 自动发现。当前检查 21 个 HTML、19 个 indexable 页面、19 个 sitemap URL、3 个 RSS feed、每个 feed 6 个 item、21 个 feed alternate、20 个 JSON-LD block，违规为 0。剩余增强是静态页 lastmod 精度、RSS item category/cover 和 Article headline 细化。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：第一阶段已固化 report 与 release gate；后续可继续扩展更多质量维度，例如 RSS category/enclosure、静态页页面级 lastmod、Article headline 完整标题策略。

```js
report.pages.push({
  path,
  canonical: Boolean(doc.querySelector('link[rel="canonical"]')),
  feedAlternate: Boolean(doc.querySelector('link[type="application/rss+xml"]')),
});
```

- 📊 预期收益：搜索引擎、RSS 阅读器和社交分享质量可回归、可比较；HTML 现在能自动发现全站、文章列表和时间归档 RSS。
- 🔗 相关建议引用：`module-reviews/seo-feed-and-structured-data.md`、`module-reviews/content-freshness-and-trust-signals.md`

### 📌 FINAL-07 [已修复第一阶段]：助手与 API key 配置需要 endpoint 信任确认和“记住 key”显式选择

- 📌 问题/建议标题：用户 key 会发往预置或自填 endpoint，长期保存仍需更细边界
- 📍 位置：`js/assistant.js:600-633`、`js/assistant.js:1028-1066`、`js/assistant.js:1462-1528`、`src/templates/tools.mjs:900-980`
- 📝 当前状况描述：前端默认体验 key 已移除，助手默认站点模式也已对齐隐私最小外发原则。本轮已补第一阶段：配置区显示实际 endpoint 协议、host 和 path；发送/测试前必须确认 endpoint 可信；“记住 API key”默认关闭，只有用户勾选后才把 key 持久化到 `cwl.assistant.llmConfig`。旧版已保存 key 的配置会迁移为 `rememberApiKey: true`，避免意外丢失用户显式保存过的配置。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已实现 endpoint trust summary 和 `rememberApiKey` 显式选择，默认只在当前输入框内用于本次请求，不写入 localStorage。

```js
if (!trustedEndpoint(endpoint)) {
  showEndpointTrustDialog(new URL(endpoint).host);
  return;
}
```

- 📊 实际收益：降低共享电脑、浏览器扩展和误填 endpoint 带来的 key 泄露风险。
- 🔗 相关建议引用：`module-reviews/assistant-loader-and-llm-runtime.md`、`security-audit.md`

### 📌 FINAL-08 [已修复第二阶段]：浏览器 smoke 下一步应输出截图和失败 artifact

- 📌 问题/建议标题：真实浏览器检查已覆盖关键路径，但失败证据还不够可追踪
- 📍 位置：`scripts/browser-smoke.mjs:9-288`、`scripts/http-smoke.mjs:9-140`、`.github/workflows/ci.yml:1-90`
- 📝 当前状况描述：Playwright smoke 已覆盖桌面/移动关键路由、横向溢出、Canvas 像素、Clipboard 和手势确认门闩。第二阶段已将 `npm run test:browser-smoke` 接入 GitHub Actions 主 CI，并在失败时用 `actions/upload-artifact@v5` 上传 `temp/browser-smoke/`。失败时会保存 `temp/browser-smoke/<label>.png`、`.html` 和 `.json`，JSON 元数据记录 label、URL、捕获时间、失败错误和 runtime errors。剩余风险是 trace/video 仍未启用，后续可按噪声和存储成本决定是否扩展。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已实现失败时保存 screenshot、HTML、console/errors，并在 CI 失败时上传 artifact。下一步可只在失败重跑或 nightly 中启用 trace/video。

```js
await page.screenshot({ path: `temp/browser-smoke/${label}.png`, fullPage: true });
await writeFile(`temp/browser-smoke/${label}.html`, await page.content());
```

- 📊 实际收益：视觉/权限/布局问题失败后可在本地或 CI artifact 中复盘，而不是只看一行错误；本地 artifact 目录也可通过 `BROWSER_SMOKE_ARTIFACT_DIR` 改写。
- 🔗 相关建议引用：`module-reviews/browser-visual-smoke-testing.md`、`module-reviews/layout-responsive-print-review.md`

### 📌 FINAL-09 [已修复第一阶段]：Relay 数据同步需要关键源失败策略和单文件覆盖率预算

- 📌 问题/建议标题：外部 relay 数据进入公开排行榜，需要更强异常门禁
- 📍 位置：`scripts/parse-relay.mjs:45-134`、`scripts/update-commercial-relay.mjs:118-219`、`data/relay-providers.json:1-80`、`tests/relay.test.mjs:1-134`
- 📝 当前状况描述：relay 异常矩阵已有明显加强，覆盖率总体很高。本轮已补商业源失败策略第一阶段：`RELAY_COMMERCIAL_SOURCE_URL` 支持 `required:` / `optional:` 前缀，`RELAY_COMMERCIAL_REQUIRED=1` 可把全部源视为必需源；必需源 HTTP 失败会阻断同步，可选源失败仍跳过；`RELAY_COMMERCIAL_MIN_SUCCESSFUL_SOURCES` 可要求最低成功源数量。配置认证 header 时，多源同步必须同 origin，避免同一 token 被误发到不同域名。剩余增强是更细的单文件覆盖率预算和“低于上次数据量比例时保留旧数据”。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：第一阶段已把商业源配置成 `required: true/false` 策略；后续可继续为 relay 脚本设置单文件预算和上次数量对比。

```js
const SOURCE_POLICY = [{ url, required: true }, { url, required: false }];
if (source.required && result.status === "rejected") throw result.reason;
```

- 📊 实际收益：公开 AI 中转站数据更可靠，避免必需源失败或认证头跨域误发时榜单仍被自动覆盖。
- 🔗 相关建议引用：`module-reviews/relay-data-quality-and-sync.md`、`module-reviews/test-coverage-risk-map.md`

### 📌 FINAL-10 [已修复第一阶段]：共享格式化和阅读指标需要跨端契约测试

- 📌 问题/建议标题：日期、转义、阅读时间被多个运行时复用，隐性约定应测试化
- 📍 位置：`src/lib/format.mjs:14-85`、`src/lib/reading.mjs:1-12`、`js/utils.js:198-214`、`tests/format.test.mjs`、`tests/utils-deep.test.mjs`
- 📝 当前状况描述：第一阶段已补齐契约：`format.mjs` 现在会严格校验 `YYYY-MM-DD` 并拒绝非法月份、非法日期和错误格式，`isoDate()`、`longDate()`、`rfc822()`、`sitemapDate()` 都复用同一断言；`tests/utils-deep.test.mjs` 新增同一组 fixture，对比 Node 共享 `readingMinutes()` / `escapeHtml()` 与 JSDOM 中 `CWLUtils.readingMinutes()` / `CWLUtils.escapeHtml()` 的输出一致性。剩余增强是把固定发布时间策略、可读正文抽取规则和转义上下文矩阵继续产品化。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：第一阶段已落地跨端 fixture 和非法日期断言。后续可继续把 RSS/sitemap 固定时间变成显式配置，并为模板输出上下文建立扫描矩阵。

```js
assert.equal(serverReadingMinutes(text), dom.window.CWLUtils.readingMinutes(text));
assert.throws(() => sitemapDate("2026-13-99"), /Invalid/);
```

- 📊 实际收益：非法日期会在构建/测试期更早失败；SSR、文章页客户端、编辑器和工具侧的阅读时间/HTML 转义输出有了同 fixture 防漂移回归。
- 🔗 相关建议引用：`module-reviews/shared-formatting-and-reading-contract.md`、`module-reviews/content-publishing-quality-gates.md`

### 📌 FINAL-11 [已修复第二阶段]：静态资产供应链应建立 vendor / remote runtime manifest

- 📌 问题/建议标题：本地 vendor 与远程模型资源缺少来源、版本、hash 和升级责任人
- 📍 位置：`data/vendor-manifest.json`、`scripts/check-vendor-manifest.mjs`、`src/templates/tools.mjs`、`css/tools.css`、`scripts/browser-smoke.mjs`、`tests/vendor-manifest.test.mjs`
- 📝 当前状况描述：第二阶段已完成。本地 `js/vendor/*.js` 继续由 SHA-256、字节数、来源、许可证和版本清单校验；手势工具 7 个远程 MediaPipe、face-api、Three.js、WASM 和模型 URL 已加入同一份 `remoteResources` manifest，记录资源类型、包名、版本/路径、供应商、触发条件、用户确认要求、pinning 状态和本地化计划。手势工具确认区现在展示 7 个视觉资源治理状态，区分版本锁定、upstream latest 和待自托管资源；`check:vendor`、模板测试和 browser smoke 会共同守住 manifest 覆盖与用户可见状态。剩余风险是模型仍有 upstream `latest` 路径，尚未自托管和 hash pin。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已复用 `data/vendor-manifest.json` 管理本地 vendor 与远程 runtime；下一阶段下载视觉模型/WASM 到本地并记录 SHA-256，再收敛手势页 CSP。

```js
for (const item of manifest.vendor) {
  assert.equal(await sha256(item.path), item.sha256);
}
```

- 📊 实际收益：依赖升级可审计，远程视觉模型和本地 vendor 文件不再靠人工记忆维护；新增远程 URL 时会被单测/CLI 发现，用户授权摄像头前也能看到资源治理状态。
- 🔗 相关建议引用：`module-reviews/static-assets-and-third-party-resources.md`、`module-reviews/dependency-supply-chain-posture.md`

### 📌 FINAL-12 [已修复第五阶段]：README/建议库索引需要机器生成辅助

- 📌 问题/建议标题：建议文档数量已较大，人工索引和状态同步成本上升
- 📍 位置：`scripts/check-suggestions-index.mjs`、`docs/suggestions/README.md`、`package.json`、`.github/workflows/ci.yml`、`scripts/write-quality-baseline.mjs`
- 📝 当前状况描述：第五阶段已完成。`npm run generate:suggestions-index` 会从 `docs/suggestions/module-reviews/*.md` 的首个标题生成 README 的“机器校验模块索引”，并生成 `docs/suggestions/evidence/current-suggestions-governance.json`；报告现在包含建议治理预算：待补建议不得超过 82 条，缺失字段不得超过 title 0、location 6、description 51、impact 56、solution 55、benefit 15、links 30。`npm run check:suggestions-index` 会校验该片段、治理统计和预算未漂移，并继续检查 `/docs/suggestions` 内本地 Markdown 文件级链接和 `#heading-anchor` 是否存在。当前统计覆盖 70 个 Markdown、349 条建议、267 条字段完整、82 条待补，状态 fixed 119 / partial 56 / open 174。检查器支持建议库短 ID 约定（如 `#de-14`）以及“建议 ID + 去状态标题”锚点，避免 `[已修复]` 状态文字变化造成假漂移。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：已落地 README 索引生成、只读索引校验、文件链接、heading anchor 检查、建议字段完整性统计、状态统计和不增长预算门禁。下一阶段可分批补齐 82 条历史建议缺失字段，并把预算上限随补齐结果逐步下调。

```js
const docs = await scanSuggestionDocs("docs/suggestions");
await writeFile("docs/suggestions/README.md", renderSuggestionIndex(docs, baseline));
```

- 📊 实际收益：新增模块专题时 README 漏链会被 CI 阻断，历史相对断链也会被及时发现；新增不完整建议或新增字段缺失会被预算门禁拦住，建议库自身不再完全靠人工巡检。
- 🔗 相关建议引用：`module-reviews/suggestions-knowledge-base-governance.md`、`module-reviews/suggestion-evidence-drift-audit.md`

## 按阶段执行建议

| 阶段 | 时间 | 建议 |
| --- | --- | --- |
| P0 | 立即 | FINAL-02、FINAL-03；FINAL-01 后续仅保留 release 摘要注入和 quick/full 成本分层；FINAL-04 后续仅保留 PR 摘要引用和体积趋势输出 |
| P1 | 近期 | FINAL-07、FINAL-08；FINAL-05 后续仅保留页面元信息一致性与 HTML 型 i18n 白名单增强；FINAL-06 后续保留 lastmod/RSS item 细化 |
| P2 | 中期 | FINAL-09 后续保留 relay 单文件覆盖率和旧数据保留策略；FINAL-10 后续保留发布时间策略、可读文本抽取和转义上下文矩阵；FINAL-11 后续保留视觉模型自托管、hash pin 和 CSP 收敛；FINAL-12 后续保留历史建议字段补齐、预算下调和状态统计摘要展示 |

## 功能建议收口

| 功能 | 当前建议 | 风险前置条件 |
| --- | --- | --- |
| PWA / 离线阅读 | 已具备保守 Service Worker、离线 fallback、SW 生成检查、搜索索引离线矩阵、升级清理 smoke、搜索错误态和搜索索引状态条；下一步应推进更多离线内容策略和模型资源预缓存边界 | FINAL-02、FINAL-03 |
| 文章内容新鲜度 | 展示 `modified`、sitemap lastmod 对齐、搜索按更新信号排序 | FINAL-06 |
| RSS 订阅增强 | HTML alternate discovery、RSS category/cover/摘要增强 | FINAL-06 |
| AI 助手增强 | endpoint 信任确认、记住 key opt-in、错误态 i18n、导出/删除当前对话 | FINAL-07 |
| 工具箱体验 | 模型资源状态已可见；下一步保留模型自托管/hash pin、API Tester 更清晰的隐私模式、工具 JS/CSS 拆包 | FINAL-03、FINAL-11 |

## 最终结论

当前项目基础已经很结实：测试通过率、覆盖率、静态验证、浏览器 smoke、CSP、结构化数据、信任页和文档库都明显优于普通个人静态站。下一阶段最值得投入的不是继续堆功能，而是把“增长后的复杂度”变成自动化契约：资源 manifest、质量基线、生成产物漂移检查、i18n 覆盖率、SEO/feed 报告、PWA 缓存矩阵和建议库机器索引。

只要这些治理线补齐，后续做 PWA、内容系列、AI 助手增强或更丰富工具箱时，项目会更像一个可长期维护的小型产品，而不是不断变重的静态页面集合。
