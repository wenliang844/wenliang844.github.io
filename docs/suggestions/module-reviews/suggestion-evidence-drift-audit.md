# 建议证据漂移审计

分析日期：2026-07-03
分析范围：`docs/suggestions` 历史验证数字、当前 `npm run lint:check` / `npm test` / `npm run test:coverage`、工作区跟踪状态、建议库治理文档。

## 本轮验证

- `npm run lint:check`：通过，当前没有 ESLint warning 输出。
- `npm test`：788/788 通过。
- `npm run test:coverage`：788/788 通过；all files line 96.76%、branch 83.95%、funcs 96.30%。
- 只读文档扫描发现建议库中同时存在多代测试数字，例如 731/731、742/742、752/752、769/769、773/773、788/788。
- 本轮提交前测试曾依赖若干未跟踪文件：`src/page-assets.mjs`、`css/tools.css`、`css/trust.css`、`src/templates/trust.mjs`、`src/trust-data.mjs`、`trust/index.html`。这些资源已在 `1a9370d` 中进入 Git 跟踪集合，但该过程暴露出证据需要记录工作区范围。

## 结论摘要

建议库已经记录了大量高质量证据，但证据本身开始出现“时间层”问题：早期审计的 731/731、77 warnings、94% coverage 是当时事实，后续 788/788、0 warnings、96.76% coverage 是当前事实。两者都真实，但如果缺少时间戳、commit、dirty-worktree 标记和机器可读快照，读者很难知道某个数字是历史基线、当前 HEAD，还是包含未跟踪文件的本地工作区结果。

---

## 📌 EVD-01 [部分修复]：测试总数和覆盖率数字散落在多份文档，缺少当前基线单一来源

- 📍 位置：`docs/suggestions/full-browser-audit-2026-07-03.md:30-36`、`docs/suggestions/full-browser-audit-2026-07-03.md:268-274`、`docs/suggestions/current-worktree-verification-2026-07-03.md:9-12`、`docs/suggestions/module-reviews/test-coverage-risk-map.md:4-10`
- ✅ 已完成：新增 `scripts/write-quality-baseline.mjs`、`npm run quality:baseline` 和 `docs/suggestions/evidence/current-quality-baseline.json`，把命令结果、覆盖率、耗时和 git dirty 状态写成机器可读基线。
- 📝 剩余状况描述：历史报告记录了 731/731、752 passed、line 94.27% 等当时基线；近期报告记录 788/788、line 96.76%。这些数字都可作为时间点证据。当前已具备 JSON 单一来源，但 README、健康评分、工作报告和模块评审仍是人工同步，后续应改为自动引用或由脚本更新。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：让 README/健康评分从 `docs/suggestions/evidence/current-quality-baseline.json` 派生摘要；CI 可继续上传同一 JSON 作为 artifact。

```json
{
  "generatedAt": "2026-07-03T00:00:00+08:00",
  "commit": "HEAD",
  "dirtyWorktree": true,
  "commands": [
    { "command": "npm run lint:check", "status": "pass", "warnings": 0 },
    { "command": "npm test", "status": "pass", "passed": 786, "failed": 0 },
    {
      "command": "npm run test:coverage",
      "status": "pass",
      "passed": 786,
      "coverage": { "lines": 96.76, "branches": 83.95, "functions": 96.30 }
    }
  ]
}
```

- 📊 预期收益：最终报告和 README 能引用同一个当前基线，历史审计仍保留原始价值，但不再和当前状态混淆。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`、`docs/suggestions/module-reviews/test-coverage-risk-map.md`

---

## 📌 EVD-02：同一历史报告中混有“旧基线”和“已修复后结果”，容易被误读为矛盾

- 📍 位置：`docs/suggestions/full-browser-audit-2026-07-03.md:30-36`、`docs/suggestions/full-browser-audit-2026-07-03.md:257-274`
- 📝 当前状况描述：完整浏览器审计顶部记录 `npm run lint:check` 当时为 0 errors / 77 warnings，底部又记录后续修复后 `0 warnings`，并列出 `731 passed -> 752 passed`。这类写法忠实记录了审计过程，但在索引或摘要中被截取时，容易被误读为当前仍有 77 warnings，或测试数仍停留在 731。
- ⚠️ 影响程度：低到中
- 💡 建议方案（含伪代码或示例片段）：为证据块增加 `phase` 和 `scope`，明确“initial audit”“post-fix verification”“current baseline”的边界。

```yaml
evidence:
  - phase: initial-audit
    command: npm run lint:check
    result: "0 errors / 77 warnings"
    commit: "audit-copy"
  - phase: post-fix
    command: npm run lint:check
    result: "0 warnings"
    commit: "fix-commit"
  - phase: current-baseline
    ref: docs/suggestions/evidence/current-quality-baseline.json
```

- 📊 预期收益：历史报告仍能讲清修复过程，索引和健康评分也能准确引用“当前”而不是“审计初始”。
- 🔗 相关建议引用：`docs/suggestions/full-browser-audit-2026-07-03.md`、`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`

---

## 📌 EVD-03 [已收口风险]: 测试通过曾依赖未跟踪文件，证据需要标注 dirty worktree 范围

- 📍 位置：`tests/templates-extended.test.mjs:23-29`、`tests/performance.test.mjs:242-246`、`src/page-assets.mjs:1-6`、`tests/css.test.mjs:123-132`、`tests/css.test.mjs:182-191`
- ✅ 已收口：`src/page-assets.mjs`、`css/tools.css`、`css/trust.css`、信任页模板/数据和 `trust/index.html` 已在 `1a9370d` 提交中进入 Git 跟踪集合。
- 📝 剩余状况描述：本轮 `npm test` 和 `npm run test:coverage` 曾在提交前依赖这些未跟踪资源，因此这些结果最初证明的是“当前本地工作区”可通过，不等同于“干净检出当前提交”可通过。当前 `quality:baseline` 已记录 `git status --porcelain --untracked-files=all`、dirty 状态、未跟踪文件数量和完整未跟踪文件列表，后续仍应避免把 dirty worktree 证据误当作 release baseline。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：每次质量证据都记录 `git status --short` 摘要和 untracked 计数；当测试引用未跟踪文件时，把证据标为 `scope: working-tree`，并阻止把它作为 release baseline。

```js
const tracked = new Set(execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split(/\r?\n/));
const referenced = await collectReferencedSourceAndAssets();
const untrackedReferences = referenced.filter((file) => !tracked.has(file));

baseline.scope = untrackedReferences.length ? "working-tree" : "tracked-head";
baseline.untrackedReferences = untrackedReferences;
```

- 📊 预期收益：避免“本地测试绿了”被误用为可发布证据；对长期自动分析和多人并发改动尤其关键。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/css-resource-ownership-and-page-styles.md`、`docs/suggestions/module-reviews/build-artifact-synchronization.md`

---

## 📌 EVD-04：覆盖率报告只存在于控制台输出，缺少可追溯 artifact

- 📍 位置：`package.json:18-18`、`.github/workflows/ci.yml:47-48`、`docs/suggestions/module-reviews/test-coverage-risk-map.md:118-137`
- 📝 当前状况描述：`npm run test:coverage` 能输出完整覆盖率表，当前结果为 788/788、line 96.76%、branch 83.95%、funcs 96.30%。但报告没有 JSON、Markdown summary 或 CI artifact。历史文档只能复制关键行，导致覆盖率趋势散落在人工报告中，且难以比较 file-level 变化，例如 `update-commercial-relay.mjs` 当前 line 76.65%、`parse-relay.mjs` branch 69.90%。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在 CI 中保存原始 coverage log，并提取 all files 和低覆盖文件到 `$GITHUB_STEP_SUMMARY`。

```yaml
- name: Capture coverage
  run: |
    mkdir -p temp
    npm run test:coverage | tee temp/coverage.txt
    awk '/all files|parse-relay|update-commercial-relay/' temp/coverage.txt >> "$GITHUB_STEP_SUMMARY"

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: coverage-report
    path: temp/coverage.txt
```

- 📊 预期收益：覆盖率趋势可追溯，低覆盖文件不需要靠人工从长日志里查找，也能减少建议文档复制大段测试输出的需求。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/test-coverage-risk-map.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`

---

## 📌 EVD-05：建议库需要自动发现过期数字，而不是人工逐篇搜索

- 📍 位置：`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md:1-16`、`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md:136-162`
- 📝 当前状况描述：建议库治理文档已经提出 front matter、链接检查和 evidence 字段。本轮进一步确认，测试数字、lint warning、coverage 百分比和 CSS 体积都会快速变动；人工搜索容易漏掉 `731/731`、`77 warnings`、`line 94.27%` 这类仍有历史价值但不应作为当前状态的数字。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增一个 docs drift scanner，只报告不自动改旧文档；它按模式列出可能过期的数字，并要求文档显式标注 `historical` 或 `current`。

```js
const PATTERNS = [
  /\b\d{3}\/\d{3}\b/g,
  /\b\d+\s+warnings?\b/g,
  /line\s+\d+(?:\.\d+)?%/gi,
  /coder\.css.*?\d+(?:\.\d+)?\s*KB/gi,
];

for (const hit of scanDocs(PATTERNS)) {
  if (!nearbyText(hit).includes("历史") && !nearbyText(hit).includes("当前基线")) {
    warnings.push(hit);
  }
}
```

- 📊 预期收益：让建议库保持“历史可追溯、当前不误读”的状态，减少维护 README 和健康评分时的人工负担。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`、`docs/suggestions/README.md`

---

## 📌 EVD-06：质量证据需要区分文档审计、发布门禁和功能验证三种用途

- 📍 位置：`docs/suggestions/current-worktree-verification-2026-07-03.md:7-14`、`docs/suggestions/module-reviews/test-coverage-risk-map.md:4-10`、`docs/suggestions/work-report.md:171-176`
- 📝 当前状况描述：当前文档里常把 `npm test`、`test:coverage`、HTTP smoke、browser smoke、validate:production、audit 放在同一张“验证通过”表中。这对人工报告很清楚，但自动化使用时需要区分：文档审计可以在 dirty worktree 运行；发布门禁必须基于 tracked HEAD 或 PR；功能验证可以是局部测试。没有用途标签时，后续自动汇总会把不同强度的证据混在一起。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为每条 evidence 增加 `purpose`、`scope`、`blocking` 字段。

```yaml
evidence:
  - command: npm test
    purpose: release-gate
    scope: tracked-head
    blocking: true
  - command: node --test tests/i18n-a11y.test.mjs
    purpose: module-review
    scope: working-tree
    blocking: false
```

- 📊 预期收益：最终报告能清楚区分“可发布门禁已通过”和“分析过程中局部验证已通过”，证据可信度更高。
- 🔗 相关建议引用：`docs/suggestions/current-worktree-verification-2026-07-03.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`

---

## 优先级待办

1. 高优先级：证据快照记录 dirty worktree 和未跟踪引用，避免本地通过被误当作 release baseline。
2. 中优先级：让 README/健康评分从 `current-quality-baseline.json` 派生摘要，并在 CI 中上传同一 JSON。
3. 中优先级：覆盖率输出保存为 artifact，并在 summary 中列出 all files 与低覆盖文件。
4. 中优先级：增加 docs drift scanner，识别未标注历史/当前语义的测试数、warning 和 coverage 数字。
5. 低优先级：为历史审计文档补 `phase` 标签，保留“初始审计”和“修复后验证”的叙事价值。

## 本轮健康度评分

建议证据治理健康度：3.5 / 5。

证据量非常丰富，且当前质量门禁结果优秀；主要短板是证据没有机器可读的时间层和工作区范围，导致长期报告越写越多时，读者需要靠上下文判断哪些数字代表当前状态。
