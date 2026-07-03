# 建议库治理与索引一致性专题分析

生成时间：2026-07-03
分析范围：`docs/suggestions` 全量 Markdown、README 索引、健康评分、工作报告、模块评审链接、建议字段完整性。
本轮只读盘点：

- `docs/suggestions` 下共有 50 个 Markdown 文件。
- 其中 `module-reviews/` 下共有 32 个模块评审文件。
- 建议库总大小约 578KB。
- 简单 Markdown 文件链接检查发现 1 个文件级断链。
- 约束说明：本轮仅新增 `/docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`，未修改源码、配置或既有文档。

## 总览

当前 `/docs/suggestions` 已经从“几份分析报告”演进为一个小型知识库。它的价值很高：问题、风险、功能建议、测试证据、修复状态和模块深挖都被系统化沉淀下来。但规模增长后，人工维护 README、健康评分、已修复状态、模块索引和交叉引用会越来越容易漂移。接下来应把建议库当作产品资产来治理：给每条建议稳定 ID、状态、证据、优先级和来源；用轻量脚本生成索引和健康摘要；用链接检查与字段完整性检查防止文档腐化。

严重程度分布：

- 高：0
- 中：5
- 低：1

## 建议清单

### 1. README 索引与实际文档规模开始出现人工维护压力

- 📌 问题/建议标题：为建议库建立自动索引数据源
- 📍 位置：`docs/suggestions/README.md:96-124`、`docs/suggestions/work-report.md:222-237`、`docs/suggestions/module-reviews/:1-32`
- 📝 当前状况描述：当前建议库已有 50 个 Markdown、32 个模块评审。README 需要手工维护文档清单、发现数量、优先级、健康评分和待办列表；工作报告也在追加新增文档。随着每轮新增模块评审，README 很容易漏掉新文档或数量不一致。例如近期新增的覆盖率、浏览器 smoke、内容新鲜度、竞争分析等都需要人工同步到多个位置。这个维护成本会随着文档数量线性增长。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```yaml
---
id: MR-DOCGOV
title: 建议库治理与索引一致性专题分析
category: devex
priority: medium
status: open
severity:
  high: 0
  medium: 5
  low: 1
generatedAt: 2026-07-03
---
```

后续可新增只读脚本扫描这些 front matter，并生成 README 的模块表：

```js
const docs = await scanSuggestionDocs("docs/suggestions");
const rows = docs
  .sort(byPriorityThenCategory)
  .map((doc) => `| ${doc.priority} | ${doc.title} | [${doc.path}](${doc.relative}) | ${doc.counts.total} |`);
```

短期不必立刻重写所有旧文档，可先从新增文档开始带元数据。

- 📊 预期收益：README 从“手写快照”升级为“生成索引”，减少漏项、重复统计和人工同步成本。
- 🔗 相关建议引用：`docs/suggestions/hourly-report-2026-07-03-04.md`、`docs/suggestions/competitive-analysis.md`、`docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`。

### 2. 建议字段格式在历史文档中不完全一致

- 📌 问题/建议标题：建立建议字段完整性检查
- 📍 位置：`docs/suggestions/competitive-analysis.md:19-212`、`docs/suggestions/bugs-and-risks.md:9-233`、`docs/suggestions/module-reviews/seo-analysis.md:1-140`
- 📝 当前状况描述：用户要求每条建议包含 📌、📍、📝、⚠️、💡、📊、🔗。新近模块评审基本按这个结构编写，但历史文档存在不同格式：有些“已修复”条目缺少影响程度或方案，有些老模块评审统计中 📌 数量多于 📍/⚠️/💡/🔗 数量。盘点显示这不是内容缺失一定严重，而是格式演进后没有统一校验。后续如果要自动生成优先级列表或健康评分，字段不一致会让解析不稳定。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const REQUIRED_FIELDS = ["📌", "📍", "📝", "⚠️", "💡", "📊", "🔗"];

for (const item of parseSuggestionItems(markdown)) {
  const missing = REQUIRED_FIELDS.filter((field) => !item.body.includes(field));
  if (missing.length) {
    warnings.push(`${file}:${item.line} missing ${missing.join(", ")}`);
  }
}
```

对历史“已修复”条目可允许 `status: fixed` 降级为 warning；对新增文档改为 error。

- 📊 预期收益：保证新建议可被机器读取，后续生成待办、优先级和健康评分时不需要人工猜字段。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/test-coverage-risk-map.md`、`docs/suggestions/module-reviews/browser-visual-smoke-testing.md`、`docs/suggestions/devex-improvements.md`。

### 3. 建议库已经出现相对链接断链

- 📌 问题/建议标题：为 `/docs/suggestions` 增加 Markdown 内链检查
- 📍 位置：`docs/suggestions/module-reviews/resource-analysis.md:37-37`、`docs/suggestions/module-reviews/resource-analysis.md:120-120`
- 📝 当前状况描述：只读链接检查发现 1 个文件级断链：`docs/suggestions/module-reviews/resource-analysis.md:37` 中的 `[P-04](performance-bottlenecks.md#p-04)` 位于 `module-reviews/` 目录内，会被解析到不存在的 `docs/suggestions/module-reviews/performance-bottlenecks.md`；同文件后文 `../performance-bottlenecks.md#p-04` 才是正确相对路径。这类断链在 Markdown 渲染器中通常不会报错，但会降低建议之间的可追踪性。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
for (const link of markdownLinks(file)) {
  if (!link.href.endsWith(".md") && !link.href.includes(".md#")) continue;
  const target = resolve(dirname(file), link.href.split("#")[0]);
  assert.ok(await exists(target), `${file}:${link.line} broken link ${link.href}`);
}
```

可以先只检查文件是否存在，后续再扩展到 heading anchor 是否存在。

- 📊 预期收益：防止模块评审之间的证据链断裂，提升最终总览和阅读体验。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/resource-analysis.md`、`docs/suggestions/performance-bottlenecks.md#p-04`。

### 4. 健康评分在不同文件中存在多处手写口径

- 📌 问题/建议标题：统一健康评分的单一来源
- 📍 位置：`docs/suggestions/health-score.md:12-18`、`docs/suggestions/health-score.md:30-30`、`docs/suggestions/README.md:72-91`
- 📝 当前状况描述：健康评分文档中综合评分表显示 `3.8 / 5`，同文件 ASCII 面板显示 `3.9 / 5`；README 中也同时出现“综合旧值/新值”和单独“综合 3.9 / 5”。这类多处手写评分不是代码问题，但会让最终报告口径不稳定：读者不知道应该引用哪个数字，也无法追溯评分是由哪些建议状态变化推导出来的。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "overall": 3.8,
  "dimensions": {
    "security": 3.5,
    "performance": 3.9,
    "architecture": 3.9,
    "test": 4.4,
    "seo": 4.2,
    "ux": 4.5
  },
  "updatedAt": "2026-07-03",
  "evidence": ["npm test 772/772", "coverage 94.44%", "npm audit 0 moderate+"]
}
```

README 和 `health-score.md` 都从同一份 JSON 或 front matter 块生成，避免手动重复输入。

- 📊 预期收益：最终健康度评分更可信，也方便每小时报告引用同一数据源。
- 🔗 相关建议引用：`docs/suggestions/health-score.md`、`docs/suggestions/README.md`、`docs/suggestions/hourly-report-2026-07-03-04.md`。

### 5. “已修复”状态需要绑定证据和提交范围

- 📌 问题/建议标题：为建议状态增加 commit/test/evidence 字段
- 📍 位置：`docs/suggestions/bugs-and-risks.md:9-102`、`docs/suggestions/devex-improvements.md:9-96`、`docs/suggestions/work-report.md:222-237`
- 📝 当前状况描述：很多建议已经标注“已修复”并附带测试说明，这对阅读很有帮助。但状态主要是自然语言，缺少稳定字段，例如修复提交、验证命令、最后验证时间、是否只修了核心风险、是否仍有后续项。近期工作区还出现过外部源码/测试改动与文档提交交错的情况，如果状态不绑定证据，后续很难判断某个“已修复”是当前 HEAD 已修、某个中间提交已修，还是文档计划中的修复。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```yaml
status: fixed-core
fixedBy:
  commit: f80e7ad
  files:
    - js/search-loader.js
    - tests/search-loader-behavior.test.mjs
verifiedBy:
  - command: node --test tests/search-loader-behavior.test.mjs
    result: pass
    date: 2026-07-03
remaining:
  - Add browser-level smoke test
```

对仅提出建议、尚未修复的条目使用 `status: open`；对已部分修复使用 `fixed-core` 或 `partial`。

- 📊 预期收益：让建议库从“叙述式报告”升级为可审计的变更台账，减少重复分析和状态误读。
- 🔗 相关建议引用：`docs/suggestions/current-worktree-verification-2026-07-03.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`。

### 6. 文档目标要求 docs-only，但工作区并发改动会增加提交风险

- 📌 问题/建议标题：沉淀 docs-only 提交流程检查清单
- 📍 位置：`docs/suggestions/hourly-report-2026-07-03-04.md:48-58`、`docs/suggestions/current-worktree-verification-2026-07-03.md:18-26`、`docs/suggestions/work-report.md:28-40`
- 📝 当前状况描述：当前长期目标明确要求“不修改现有代码/配置，只向 `/docs` 写入分析报告”。但工作区多次出现外部源码、测试和既有建议文档改动；第 4 小时报告也记录了 `browser-visual-smoke-testing.md` 被一个较大的非文档专用提交收录。后续若继续在同一工作区长时间循环，最容易出错的不是分析质量，而是把非本轮改动混入提交。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```text
docs-only 提交前检查：
1. git status --short
2. git diff --cached --name-status
3. git add -- docs/suggestions/<this-round>.md
4. git diff --cached --name-status -- docs/suggestions/<this-round>.md
5. git commit -m "docs: ..." -- docs/suggestions/<this-round>.md
6. git show --name-status --oneline HEAD
```

若完整暂存区出现非本轮文件，必须使用路径限定提交；若已有并发提交吞入本轮文档，记录在小时报告中，不回滚用户/外部改动。

- 📊 预期收益：降低长时间自主循环中的误提交概率，保护“只写 `/docs`”约束。
- 🔗 相关建议引用：`docs/suggestions/hourly-report-2026-07-03-04.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`。

## 建议落地顺序

1. 先修复 `resource-analysis.md` 的相对链接断链。
2. 为新增建议文档约定 front matter 元数据，不强制一次性改造旧文档。
3. 增加只读 Markdown 链接检查和新增文档字段完整性检查。
4. 把健康评分提取为单一数据源，再生成 README 和健康评分展示。
5. 为“已修复/部分修复”条目增加 commit/test/evidence 字段。
6. 把 docs-only 提交清单加入最终 README 或贡献说明。
