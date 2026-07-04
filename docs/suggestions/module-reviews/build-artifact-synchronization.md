# 构建产物同步与漂移治理专题分析

生成时间：2026-07-03

分析范围：`package.json` 脚本、`scripts/build.mjs`、`scripts/validate-production.mjs`、构建/工作流测试、提交的 HTML/RSS/sitemap/search 产物以及手写页面维护边界。

本轮验证：

- `node --test tests/build.test.mjs tests/build-deep.test.mjs tests/build-extended.test.mjs tests/build-extra.test.mjs tests/workflows.test.mjs tests/validate-posts.test.mjs`：137 项测试全部通过。
- 只读扫描构建入口、CI 门禁、临时目录构建测试和已提交 HTML 文件清单。
- 未运行 `npm run build`，因为它默认会覆盖根目录生成产物；本轮遵守“只写 /docs”的约束。
- 本轮只新增 `/docs/suggestions/module-reviews/build-artifact-synchronization.md`。

## 总览

当前构建系统的基础质量不错：`scripts/build.mjs --out <dir>` 支持临时目录输出；构建测试会在 `temp/` 下生成页面、sitemap、RSS 和搜索索引并做结构断言；生产验证脚本也已经改为临时目录构建；CI 会运行 lint、测试、文章校验、build、HTTP smoke、生产验证、覆盖率和 audit。

剩余风险集中在“源文件和已提交产物是否一致”。仓库同时提交 `src/templates`、`src/posts`、构建脚本和生成后的 `post/*/index.html`、`tools/index.html`、`ai/index.html`、`sitemap.xml`、`search-index.json` 等文件。`npm run build` 会直接覆盖根目录产物；测试能证明“可以构建”，但还没有一个只读门禁证明“当前提交的产物就是由当前源码生成的”。这类漂移会让本地预览、GitHub Pages 产物、测试产物和代码评审看到的内容不一致。

严重程度分布：

- 高：0
- 中：4
- 低：2

## 建议清单

### 📌 MR-BUILD-SYNC-01 [已修复]：增加只读构建产物漂移检查，比较临时构建输出与已提交产物

📍 位置（文件路径 + 行号范围）

- `scripts/check-generated-drift.mjs`
- `scripts/build.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `tests/workflows.test.mjs`

📝 当前状况描述

已新增 `scripts/check-generated-drift.mjs` 和 `npm run check:generated`。脚本只写入 `temp/generated-drift-check`，运行 `scripts/build.mjs --out` 生成临时站点子集，再递归比较临时输出和仓库根目录的对应文件；发现缺失或字节不一致时会提示运行 `npm run build` 并提交更新产物。`check:generated` 还会运行 `scripts/check-generated-artifact-manifest.mjs`，校验生成/手写产物所有权清单；`check:pwa-precache` 也会复用该清单，要求离线预缓存 URL 有明确归属。`check:readonly` 已纳入 `check:generated`，CI 也在 `npm run build` 覆盖根目录产物前运行它，避免后续 build 掩盖漂移。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已落地：`scripts/check-generated-drift.mjs` 只写入临时目录，比较后删除临时目录。CI 和本地只读检查运行它，而不是直接依赖根目录 build 的副作用。

```js
const GENERATED_OUTPUTS = [
  "post/index.html",
  "post/manage-system/index.html",
  "tags/index.html",
  "categories/index.html",
  "ai/index.html",
  "tools/index.html",
  "appreciation/index.html",
  "sponsor/index.html",
  "sitemap.xml",
  "robots.txt",
  "index.xml",
  "post/index.xml",
  "categories/index.xml",
  "search-index.json"
];

await execFile("node", ["scripts/build.mjs", "--out", tempDir]);

for (const file of GENERATED_OUTPUTS) {
  const expected = await readFile(join(tempDir, file), "utf8");
  const actual = await readFile(join(root, file), "utf8");
  assert.equal(actual, expected, `${file} is stale; run npm run build`);
}
```

📊 预期收益

- 在不修改工作树的前提下发现提交产物过期。
- 防止评审看到的 HTML 与模板源码不一致。
- 让 `check:readonly` 真正覆盖“构建可复现”和“产物已同步”两件事。

🧪 验证

- `npm run check:generated`：通过，比较 83 个文件，并校验生成产物所有权 manifest。
- `npm run check:pwa-precache`：通过，19 个预缓存 URL 均可归属到 generated/manual/copied asset 清单，生成物所有权缺口 0。
- `npm run check:readonly`：通过，包含 lint、全量测试、文章校验和生成产物漂移检查。
- `node --test tests/workflows.test.mjs tests/build.test.mjs`：13/13 通过。

🔗 相关建议引用

- `docs/suggestions/module-reviews/ci-release-automation-review.md`
- `docs/suggestions/devex-improvements.md`
- `docs/suggestions/module-reviews/browser-visual-smoke-testing.md`

### 📌 MR-BUILD-SYNC-02：将“会改文件”的命令与“只读门禁”明确拆开

📍 位置（文件路径 + 行号范围）

- `package.json:20-28`
- `scripts/build.mjs:6-8`
- `scripts/validate-production.mjs:226-261`
- `tests/workflows.test.mjs:118-125`

📝 当前状况描述

`lint` 当前会执行 `eslint js/*.js --fix`，`validate` 会运行 `npm run lint` 和 `npm run build`，`precommit` 又指向 `npm run validate`。这些命令适合“修复并生成”，但不适合作为只读审计或 CI 前的安全检查。项目已有 `check:readonly`，且现在已包含生成产物漂移检查；剩余可优化点是进一步把 `format` / `check` 命名边界做得更显式。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

把命令命名按副作用分层：`format` / `build` 可以写文件；`check` / `check:generated` / `validate:production` 保持只读。

```json
{
  "scripts": {
    "format": "eslint js/*.js --fix",
    "build": "node scripts/build.mjs",
    "check:lint": "eslint js/*.js",
    "check:generated": "node scripts/check-generated-drift.mjs",
    "check": "npm run check:lint && npm test && npm run validate:posts && npm run check:generated",
    "validate": "npm run format && npm test && npm run validate:posts && npm run build"
  }
}
```

📊 预期收益

- 开发者能从命令名判断是否会修改工作树。
- CI 和审计场景可以使用全只读门禁，避免隐藏生成副作用。
- 生成产物同步问题能在提交前被明确提示，而不是靠人工看 `git status`。

🔗 相关建议引用

- `docs/suggestions/bugs-and-risks.md`
- `docs/suggestions/module-reviews/test-coverage-risk-map.md`
- `docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`

### 📌 MR-BUILD-SYNC-03：手写 HTML 页面仍是与公共模板并行维护的同步面

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:568-610`
- `src/templates/layout.mjs:30-51`
- `src/templates/layout.mjs:90-100`
- `tests/build-extra.test.mjs:281-315`
- `tests/integration.test.mjs:201-220`

📝 当前状况描述

构建脚本会生成文章页、博客列表、标签、归档、AI、工具箱、鉴赏、赞助、RSS、sitemap 和搜索索引；但 `index.html`、`404.html`、`about/index.html`、`contact/index.html`、`editor/index.html`、`overleaf/index.html` 等仍是手写 HTML。现有测试已经覆盖手写页 JSON-LD、CSP、基础结构和链接，这是很好的防线；但公共导航、resource hints、CSP、订阅块、脚本顺序、语言切换属性等仍需要靠手写页同步维护。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

短期继续增强手写页契约测试；中期把手写页迁移为模板入口，让 `renderPage()` 统一产出公共头尾。

```js
const STATIC_TEMPLATE_PAGES = [
  { out: "about/index.html", render: renderAboutPage },
  { out: "contact/index.html", render: renderContactPage },
  { out: "editor/index.html", render: renderEditorPage },
  { out: "overleaf/index.html", render: renderOverleafPage },
  { out: "404.html", render: renderNotFoundPage }
];

for (const page of STATIC_TEMPLATE_PAGES) {
  await writeFileEnsured(page.out, page.render() + "\n");
}
```

若暂不迁移，可先加公共片段一致性测试：

```js
for (const html of committedHtmlFiles) {
  assert.match(html, /<a class="skip-link" href="#main-content"/);
  assert.match(html, /src="\/js\/assistant-loader\.js" defer/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
}
```

📊 预期收益

- 降低公共导航、CSP、订阅块和脚本顺序的重复维护成本。
- 避免生成页已修复而手写页遗漏同类修复。
- 后续新增 Trust Center、隐私页或状态页时，可以直接走统一模板。

🔗 相关建议引用

- `docs/suggestions/module-reviews/html-pages.md`
- `docs/suggestions/full-browser-audit-2026-07-03.md`
- `docs/suggestions/module-reviews/privacy-and-trust-center.md`

### 📌 MR-BUILD-SYNC-04 [已修复]：生成产物缺少所有权清单，评审时不容易判断哪些文件应手改

📍 位置（文件路径 + 行号范围）

- `data/generated-artifact-manifest.json`
- `scripts/check-generated-artifact-manifest.mjs`
- `tests/generated-artifact-manifest.test.mjs`
- `tests/workflows.test.mjs`

📝 当前状况描述

已新增 `data/generated-artifact-manifest.json`，集中说明“哪些文件由 build 生成、哪些文件允许手写维护、哪些源文件会影响哪些产物”。manifest 覆盖动态文章页、静态生成页、RSS/sitemap/search/service-worker 产物、手写 HTML 页（含 PWA `offline.html`）、手写静态文件（含 `manifest.webmanifest`）和复制的静态资源目录。`scripts/check-generated-artifact-manifest.mjs` 会从 `scripts/build.mjs` 解析静态 `writeFileEnsured()` 输出，从 `src/posts/*.md` 派生动态文章页，并扫描所有已提交 HTML，要求每个 HTML 都归类为 generated 或 manual；它还导出路径归属判断，供 PWA 预缓存检查复用。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已落地生成产物清单，供文档、漂移检查和 PR 模板引用。

```json
{
  "generated": {
    "post/index.html": ["src/templates/post.mjs", "src/posts/*.md"],
    "post/*/index.html": ["src/templates/post.mjs", "src/posts/*.md"],
    "tools/index.html": ["src/templates/tools.mjs", "src/templates/layout.mjs"],
    "ai/index.html": ["src/templates/ai.mjs", "src/templates/relay.mjs"],
    "search-index.json": ["src/config.mjs", "src/posts/*.md"]
  },
  "manual": [
    "index.html",
    "404.html",
    "about/index.html",
    "contact/index.html",
    "editor/index.html",
    "overleaf/index.html"
  ]
}
```

🧪 验证

- `node scripts/check-generated-artifact-manifest.mjs`：通过，覆盖 build 输出、手写 HTML 页、手写静态文件和复制静态资源目录。
- `npm run check:generated`：通过，先比较 83 个临时构建输出文件，再校验 manifest。
- `node --test tests/generated-artifact-manifest.test.mjs tests/workflows.test.mjs`：当前聚焦测试通过，并覆盖 PWA 预缓存资源所有权归属。

📊 实际收益

- 让代码评审能快速识别“应该改源码还是产物”。
- 漂移检查可以复用同一份清单，不必在脚本里维护重复数组。
- 生成页迁移计划更清晰，避免长期混淆。

🔗 相关建议引用

- `docs/suggestions/module-reviews/search-and-seo-pipeline.md`
- `docs/suggestions/module-reviews/content-publishing-quality-gates.md`
- `docs/suggestions/module-reviews/ci-release-automation-review.md`

### 📌 MR-BUILD-SYNC-05 [已修复]：生产验证的临时构建只检查关键文件存在，尚未复用 HTTP smoke 路由契约

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs`
- `scripts/validate-production.mjs`
- `scripts/http-smoke.mjs`
- `tests/build.test.mjs`
- `tests/workflows.test.mjs`

📝 当前状况描述

`scripts/http-smoke.mjs` 已支持 `--root <dir>` 和 `SMOKE_ROOT`，默认仍检查仓库根目录。`scripts/build.mjs --out <dir>` 现在会复制部署所需的静态资产和手写页（`css/`、`js/`、`images/`、`webfonts/`、`data/`、`index.html`、`404.html`、About/Contact/Editor/Overleaf），再写入生成页、RSS、sitemap 和搜索索引。`validate-production.mjs` 在构建到 `temp/production-validate` 后，会对这个临时目录运行同一套 HTTP smoke，覆盖 `/`、`/post/`、`/tools/`、`/contact/`、`/ai/`、`/trust/` 和 `/404.html` 的可达性、H1/main、本地脚本与 404 恢复入口。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已落地：HTTP smoke 支持 `--root` / `SMOKE_ROOT`，生产验证在临时构建目录上复用同一套路由契约。

```js
// scripts/http-smoke.mjs
const root = process.env.SMOKE_ROOT || process.cwd();
startStaticServer({ root });
```

```js
// scripts/validate-production.mjs
await execFileAsync("node", ["scripts/build.mjs", "--out", BUILD_CHECK_OUT], { cwd: ROOT });
await execFileAsync("node", ["scripts/http-smoke.mjs", "--root", BUILD_CHECK_DIR], { cwd: ROOT });
```

📊 预期收益

- `validate:production` 可以独立验证临时构建是否可被真实路由访问。
- HTTP smoke 规则不需要在 CI 和生产验证中重复维护。
- 避免只检查文件存在却漏掉路由、脚本、H1 或主内容结构问题。

🧪 验证

- `node --test tests/build.test.mjs tests/workflows.test.mjs`：12/12 通过。
- `npm run validate:production`：35/35 通过，包含“临时构建 HTTP smoke 通过”。

🔗 相关建议引用

- `docs/suggestions/module-reviews/browser-visual-smoke-testing.md`
- `docs/suggestions/module-reviews/ci-release-automation-review.md`
- `docs/suggestions/devex-improvements.md`

### 📌 MR-BUILD-SYNC-06：构建测试覆盖“能生成”，但缺少“生成产物体积变化趋势”的发布信号

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:568-610`
- `tests/performance.test.mjs:184-203`
- `tests/integration.test.mjs:18-76`
- `docs/suggestions/performance-bottlenecks.md:11-18`

📝 当前状况描述

性能测试已经检查 `search-index.json` 和 `sitemap.xml` 的体积预算，性能建议文档也记录了 `tools/index.html`、`post/index.html`、`css/coder.css` 等体积热点。构建测试本身主要验证产物存在和结构正确，不会在每次构建后生成“本轮产物体积变化”摘要。随着工具页、博客列表和搜索索引继续增长，体积变化更适合作为发布信号，而不是等超过硬阈值才暴露。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

在只读构建检查中输出简短体积表，并可选择写入临时 JSON 供 CI artifact 使用，不提交到仓库。

```js
const SIZE_TRACKED_OUTPUTS = [
  "tools/index.html",
  "post/index.html",
  "search-index.json",
  "css/coder.css"
];

for (const file of SIZE_TRACKED_OUTPUTS) {
  const bytes = (await stat(join(root, file))).size;
  console.log(`${file}\t${(bytes / 1024).toFixed(1)} KiB`);
}
```

📊 预期收益

- 更早发现工具页、博客列表或搜索索引的增长趋势。
- 让性能预算从“超线失败”升级为“持续可见”。
- 为最终健康度评分和每小时报告提供可复用数据。

🔗 相关建议引用

- `docs/suggestions/performance-bottlenecks.md`
- `docs/suggestions/module-reviews/test-coverage-risk-map.md`
- `docs/suggestions/module-reviews/content-discovery-and-object-search.md`

## 下一步优先级

1. 中优先级：进一步明确 `format` / `check` 命名边界，减少会写文件命令和只读门禁混用。
2. 中优先级：拆分会写文件的 `validate` 和纯只读的 `check` 命令命名。
3. 中优先级：逐步把手写静态页纳入 `renderPage()` 统一模板，或补公共片段一致性测试。
4. 低优先级：把生成产物所有权 manifest 摘要接入 PR 模板或发布说明。
5. 低优先级：输出临时构建产物体积摘要。
