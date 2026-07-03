# 质量基线 Artifact 与发布证据治理评审

分析范围：`scripts/write-quality-baseline.mjs`、`docs/suggestions/evidence/current-quality-baseline.json`、`package.json`、`tests/workflows.test.mjs`、`docs/suggestions/module-reviews/suggestion-evidence-drift-audit.md`。

## 本轮验证

- 只读读取 `scripts/write-quality-baseline.mjs`，确认脚本会顺序运行 lint、test、coverage、HTTP smoke、browser smoke 和 production validation，并新增 `--require-clean` 的 clean-commit 发布模式。
- 运行 `npm run quality:baseline` 刷新 `docs/suggestions/evidence/current-quality-baseline.json`，当前 artifact 记录 `scope: "working-tree"`、`dirty: true`、798/798 通过、coverage line 96.80%、branch 83.45%、functions 96.51%、HTTP smoke 7 条路由、production 35/35。
- 只读读取 `tests/workflows.test.mjs`，当前测试主要通过源码正则断言脚本包含关键命令、coverage parser、dirty scope 和 untracked 文件记录。

## 结论摘要

质量基线 artifact 是本轮建议库治理中最关键的进展之一：它把散落在报告里的测试数量、覆盖率、smoke、production gate 和 dirty worktree 统一成机器可读 JSON。剩余问题集中在“证据如何保持新鲜、如何进入发布门禁、失败时如何追溯，以及脚本自身如何测试”。如果这些边界补齐，README、健康评分、小时报告和最终报告就可以引用同一份可信证据。

## 📌 QBG-01 [部分修复]：当前 artifact 记录的是 working-tree 快照，不能直接替代 clean release baseline

- 📌 问题/建议标题：区分 working-tree baseline 与 clean-commit baseline
- 📍 位置：`scripts/write-quality-baseline.mjs:175-181`、`docs/suggestions/evidence/current-quality-baseline.json:1-18`
- 📝 当前状况描述：脚本默认输出 `scope: "working-tree"`，并记录 `git status --porcelain --untracked-files=all`。这对本地分析很好，能解释 dirty scope；但它不等价于发布基线。当前已新增 `--require-clean` / `quality:baseline:clean`，在 dirty worktree 下会提前失败，并在干净工作树中输出 `scope: "clean-commit"`。剩余问题是 CI 还没有把 clean baseline artifact 作为正式发布产物上传。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：CI/release 默认运行 `npm run quality:baseline:clean` 并上传 artifact；本地分析继续允许 dirty，但 README 必须明确标注。

```js
const requireClean = argv.includes("--require-clean");
const git = await gitInfo();
if (requireClean && git.dirty) {
  throw new Error(`Quality baseline requires clean worktree:\n${git.status.join("\n")}`);
}
baseline.scope = requireClean ? "clean-commit" : "working-tree";
```

- 📊 预期收益：避免把本地脏工作树结果误读为可发布证据，同时保留分析阶段对 dirty scope 的透明记录。
- 🔗 相关建议引用：`module-reviews/suggestion-evidence-drift-audit.md`、`final-analysis-report-2026-07-03.md#-final-01把当前质量基线-artifact-纳入正式发布门禁`

## 📌 QBG-02：质量基线命令会重复运行全量测试，时间成本会随浏览器和生产验证增长放大

- 📌 问题/建议标题：为质量基线增加 quick/full 分层，避免重复执行同一测试套件
- 📍 位置：`scripts/write-quality-baseline.mjs:14-21`、`package.json:15-28`、`docs/suggestions/module-reviews/ci-release-automation-review.md:20-50`
- 📝 当前状况描述：`COMMANDS` 会依次运行 `npm test`、`npm run test:coverage` 和 `npm run validate:production`。而生产验证脚本内部也会运行测试组；再叠加 browser smoke，完整基线适合发布前或 nightly，但作为每次本地文档更新的默认命令会偏重。当前 artifact 的 durations 已显示 coverage、production 和 browser smoke 是主要耗时。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：提供 `--quick`、`--full`、`--reuse <coverage-log>` 三种模式。默认本地 quick 只跑 lint、test 或 coverage、HTTP smoke；release full 再跑 browser smoke 和 production。

```js
const QUICK_COMMANDS = ["lint", "coverage", "http-smoke"];
const FULL_COMMANDS = COMMANDS.map((item) => item.id);
const selected = argv.includes("--full") ? FULL_COMMANDS : QUICK_COMMANDS;
```

- 📊 预期收益：降低开发者生成证据的摩擦，同时保留发布前完整门禁。
- 🔗 相关建议引用：`module-reviews/ci-release-automation-review.md`、`module-reviews/test-coverage-risk-map.md`

## 📌 QBG-03：覆盖率和测试数量解析依赖控制台文本，遇到 reporter 或语言变化时容易失真

- 📌 问题/建议标题：改用结构化 reporter 或保存原始日志并校验 parser 命中
- 📍 位置：`scripts/write-quality-baseline.mjs:42-64`、`scripts/write-quality-baseline.mjs:74-85`、`tests/workflows.test.mjs:160-179`
- 📝 当前状况描述：`parseNodeTestOutput()` 通过 `/\btests\s+(\d+)/`、`/\bpass\s+(\d+)/` 解析 Node test 输出；`parseCoverageOutput()` 通过 `all files | ...` 解析覆盖率表。当前能工作，但它依赖 Node 控制台格式。若未来改 reporter、输出语言、表格空白或 Node 版本格式，脚本可能仍返回 `status: pass`，但 `tests` 或 coverage 为 `undefined`。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：优先使用结构化 reporter；短期至少要求关键 parser 字段必须命中，否则把该 command 标成 `incomplete`。

```js
function requireParsed(command, parsed, fields) {
  const missing = fields.filter((field) => parsed[field] === undefined || parsed[field] === null);
  if (missing.length) throw new Error(`${command} parser missed: ${missing.join(", ")}`);
}
```

- 📊 预期收益：避免生成“命令通过但指标为空”的半可信 artifact。
- 🔗 相关建议引用：`module-reviews/suggestion-evidence-drift-audit.md`、`module-reviews/quality-baseline-artifact-governance.md#-qbg-06质量基线脚本测试偏静态正则缺少fixture级解析回归`

## 📌 QBG-04：失败时 artifact 只保留摘要，不保留可追溯日志路径和关键错误片段

- 📌 问题/建议标题：为每个 command 保存截断日志、stderr 摘要和 artifact 路径
- 📍 位置：`scripts/write-quality-baseline.mjs:87-110`、`scripts/write-quality-baseline.mjs:132-151`
- 📝 当前状况描述：`run()` 会把 stdout/stderr 拼接给 parser，但最终 JSON 只保留解析后的数字和 error message。命令失败时，报告读者可能知道 `coverage` fail，却看不到哪个测试失败、哪个路由 404、browser smoke 截图在哪里。当前 browser smoke 也正在向 artifact 方向演进，质量基线应该能引用这些证据。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为每个命令写 `docs/suggestions/evidence/logs/<id>.log` 或 CI artifact，并在 JSON 中保留 `logPath`、`tail`、`artifactPaths`。注意对可能包含 token 的输出做脱敏。

```js
const tail = output.split(/\r?\n/).slice(-80).join("\n");
results.push({ id, status, logPath, tail: redactSecrets(tail) });
```

- 📊 预期收益：失败报告可复盘，最终 README 也能链接到具体证据，而不是只记录一个失败数字。
- 🔗 相关建议引用：`module-reviews/browser-visual-smoke-testing.md`、`module-reviews/ci-release-automation-review.md`

## 📌 QBG-05：artifact 新鲜度需要被检查，否则提交后很容易引用旧 commit 的结果

- 📌 问题/建议标题：README/最终报告引用质量基线前先验证 commit 与 HEAD 一致
- 📍 位置：`docs/suggestions/evidence/current-quality-baseline.json:1-18`、`docs/suggestions/README.md:23-32`、`docs/suggestions/final-analysis-report-2026-07-03.md:5-20`
- 📝 当前状况描述：artifact 记录 `generatedAt`、`git.commit` 和 dirty status，但 README/最终报告目前是人工引用质量数字。只要生成 artifact 后又提交文档或代码，artifact 的 commit 就落后于 HEAD；只要继续修改工作树，dirty 列表也可能不再准确。这不是脚本 bug，而是证据生命周期需要明确。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增 `validate-quality-baseline.mjs`，检查 artifact commit、generatedAt 年龄和当前 `git status`。发布前要求 artifact fresh；分析报告允许 stale 但必须标注。

```js
const head = await git(["rev-parse", "--short", "HEAD"]);
if (baseline.git.commit !== head) {
  throw new Error(`Quality baseline is stale: ${baseline.git.commit} != ${head}`);
}
```

- 📊 预期收益：让质量数字具备时间和提交边界，避免最终报告引用“刚刚已经过期”的结果。
- 🔗 相关建议引用：`module-reviews/suggestion-evidence-drift-audit.md`、`module-reviews/suggestions-knowledge-base-governance.md`

## 📌 QBG-06 [部分修复]：质量基线脚本测试偏静态正则，缺少 fixture 级解析回归

- 📌 问题/建议标题：给 parser 和 git dirty scope 增加可执行单元测试
- 📍 位置：`tests/workflows.test.mjs:160-179`、`scripts/write-quality-baseline.mjs:42-85`、`scripts/write-quality-baseline.mjs:112-130`
- 📝 当前状况描述：`tests/quality-baseline.test.mjs` 已新增 fixture 级解析回归，覆盖 Node test、coverage、HTTP smoke、browser smoke、production 中文输出、参数解析和 summary 汇总；`tests/workflows.test.mjs` 仍保留脚本存在性守卫。剩余缺口是 `gitInfo()` 对 untracked/modified/staged 文件的分类尚未用临时 Git fixture 测试。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：下一步用临时 Git fixture 覆盖 dirty/untracked/staged 状态，并验证 `--require-clean` 在 dirty worktree 下提前失败。

```js
import { parseCoverageOutput } from "../scripts/quality-baseline-core.mjs";

test("coverage parser reads all files summary", () => {
  const parsed = parseCoverageOutput(fixtureCoverageOutput);
  assert.deepEqual(parsed.coverage, { lines: 96.76, branches: 83.95, functions: 96.3 });
});
```

- 📊 预期收益：质量证据生成器本身变成可信基础设施，而不是只靠字符串守卫。
- 🔗 相关建议引用：`module-reviews/test-coverage-risk-map.md`、`module-reviews/suggestion-evidence-drift-audit.md`

## 建议优先级

1. 高优先级：实现 clean-commit baseline / require-clean 模式，避免 release 证据和 dirty 分析证据混用。
2. 中优先级：增加 artifact 新鲜度校验，README 引用前检查 commit 是否等于 HEAD。
3. 中优先级：为 parser 增加 fixture 级单元测试，防止控制台格式变化导致数字缺失。
4. 中优先级：保存失败日志和 browser smoke artifact 路径，提升可追溯性。
5. 低到中优先级：将命令套件分 quick/full，降低本地生成证据成本。

## 本轮健康度评分

- 质量证据治理健康度：3.7 / 5
- 当前强项：覆盖核心质量门、记录 dirty scope、产出机器可读 JSON，并已通过工作流测试纳入脚本存在性守卫。
- 主要扣分：artifact 生命周期、新鲜度、失败日志和 parser 可执行测试仍需增强。
