# 测试覆盖率风险地图

生成时间：2026-07-03  
分析范围：`npm run test:coverage` 输出、Node 原生覆盖率、JSDOM 客户端脚本测试、relay 数据脚本测试与 CI 覆盖率门禁。  
本轮验证：`npm run test:coverage`，769/769 通过；总体 line 94.44%、branch 78.33%、functions 91.84%。  
约束说明：本轮仅新增 `/docs/suggestions/module-reviews/test-coverage-risk-map.md`，未修改源码、配置或测试。

## 总览

测试体系总体很强，且覆盖率阈值已经进入 CI。但当前覆盖率报告主要覆盖被 Node 作为 ESM 模块导入的 `scripts/` 与 `src/`，大量真实浏览器运行的 `js/*.js` 是通过 JSDOM `eval()` 加载，行为测试很多，却没有进入文件级覆盖率表。因此“总体 94.44%”更像构建/模板层覆盖率，而不是全站客户端脚本覆盖率。后续应把覆盖率从全局指标升级为风险地图：关键发布脚本、数据同步脚本、浏览器交互脚本分别有自己的可见指标和门槛。

严重程度分布：

- 高：0
- 中：4
- 低：2

## 建议清单

### 1. Node 覆盖率报告没有展示 `js/*.js` 客户端脚本的文件级覆盖率

- 📌 问题/建议标题：JSDOM `eval()` 加载的浏览器脚本需要映射到真实文件名
- 📍 位置：`package.json:16-16`、`tests/coder.test.mjs:19-24`、`tests/blog.test.mjs:84-87`、`tests/tools.test.mjs:78-143`、`tests/assistant.test.mjs:11-47`
- 📝 当前状况描述：本轮覆盖率报告只列出 `scripts/` 和 `src/` 下的 ESM 模块，例如 `build.mjs`、`parse-relay.mjs`、模板文件等；但 `js/coder.js`、`js/blog.js`、`js/tools.js`、`js/assistant.js` 等客户端主脚本没有出现在覆盖率表。它们确实有大量 JSDOM 行为测试，但由于测试通过 `dom.window.eval(code)` 执行，Node 原生覆盖率无法稳定归因到源文件。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
import vm from "node:vm";

function runClientScript(dom, file, code) {
  const script = new vm.Script(`${code}\n//# sourceURL=${file}`, {
    filename: file,
  });
  script.runInContext(dom.getInternalVMContext());
}
```

如果 Node 原生覆盖率仍无法收集 JSDOM VM 上下文，可引入 `c8` 或 Istanbul 作为覆盖率后处理，并把 `js/*.js` 明确纳入 include 列表。

- 📊 预期收益：让客户端交互脚本从“有行为测试但不可见”变成可量化覆盖率，便于发现某个浏览器模块测试不足。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md` 的覆盖率 artifact 建议、`docs/suggestions/devex-improvements.md#de-02-部分修复-测试运行无-watch-模式下的增量反馈`。

### 2. 全局覆盖率达标会掩盖关键数据脚本低覆盖

- 📌 问题/建议标题：为高风险脚本设置单文件或分组覆盖率阈值
- 📍 位置：`package.json:16-16`、`scripts/parse-relay.mjs:1-593`、`scripts/update-commercial-relay.mjs:1-226`、`tests/relay.test.mjs:1-134`
- 📝 当前状况描述：本轮整体 line 94.44%、branch 78.33%、functions 91.84%，满足 CI 阈值。但 `parse-relay.mjs` line 77.23%、branch 46.58%，`update-commercial-relay.mjs` line 68.14%、branch 64.91%。这两个脚本负责把外部 relay 数据清洗进公开 AI 排行榜，属于数据质量和敏感信息边界比较关键的路径。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "coverageBudgets": {
    "scripts/build.mjs": { "lines": 90, "branches": 75 },
    "scripts/parse-relay.mjs": { "lines": 85, "branches": 70 },
    "scripts/update-commercial-relay.mjs": { "lines": 85, "branches": 70 }
  }
}
```

短期可以先不阻断 CI，只在报告中输出低于预算的文件；补齐测试后再把预算改为强制门禁。

- 📊 预期收益：避免全局高覆盖率掩盖关键脚本缺口，让公开数据同步链路有更明确的质量标准。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md#p-15-测试覆盖率总体达标但-relay-同步脚本覆盖率明显低于整体水平`、`docs/suggestions/module-reviews/relay-data-quality-and-sync.md`。

### 3. Relay 测试仍偏“成功路径 + 基础清洗”，异常分支覆盖不足

- 📌 问题/建议标题：为 relay 导入和商业同步补充异常矩阵
- 📍 位置：`scripts/parse-relay.mjs:17-45`、`scripts/parse-relay.mjs:81-121`、`scripts/update-commercial-relay.mjs:118-128`、`scripts/update-commercial-relay.mjs:180-219`、`tests/relay.test.mjs:11-134`
- 📝 当前状况描述：现有 relay 测试覆盖 SQL 导入敏感字段清洗、生成数据不含 secret marker、多个商业源合并和失败源跳过。但覆盖率显示许多异常分支仍未走到，例如 CLI 参数错误、`--out` 越界、畸形 SQL token、`RELAY_COMMERCIAL_HEADERS` 不是合法 JSON、`RELAY_COMMERCIAL_REQUIRED=1` 但缺少 source、最低数量门禁失败、主函数写文件失败等。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
test("commercial relay sync rejects malformed custom headers", async () => {
  process.env.RELAY_COMMERCIAL_SOURCE_URL = "https://one.example/data";
  process.env.RELAY_COMMERCIAL_HEADERS = "{not-json";
  await assert.rejects(fetchCommercialProviders(), /JSON|Unexpected/);
});

test("parse relay cli rejects output outside workspace", async () => {
  await assert.rejects(
    () => parseArgs(["node", "parse", "dump.sql", "--out", "../outside.json"]),
    /只能写入项目内路径/
  );
});
```

- 📊 预期收益：把外部数据源、环境变量和 CLI 误用导致的失败变成可预期错误，减少自动同步时的隐性数据质量风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/module-reviews/content-publishing-quality-gates.md`。

### 4. 工具箱相关测试耗时最高，但缺少单测耗时预算和趋势记录

- 📌 问题/建议标题：为慢测试增加耗时预算和拆分策略
- 📍 位置：`tests/tools.test.mjs:517-536`、`tests/tools.test.mjs:695-735`、`tests/tools.test.mjs:737-849`、`tests/tools.test.mjs:938-1278`
- 📝 当前状况描述：本轮覆盖率输出中，部分工具箱测试耗时在 1 到 3 秒级，例如工具 tab 键盘测试、英文动态状态测试、扩展工具全量动作测试、Mini API Tester 系列。它们都在通过，但当 CI 已经重复执行全量测试时，这些慢测试会显著影响反馈时间。当前没有测试耗时预算，也没有把慢测试趋势写入 CI 摘要。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
test("expanded tools page runs all new tool actions locally", { timeout: 5000 }, async () => {
  const started = performance.now();
  // existing assertions
  assert.ok(performance.now() - started < 3500, "tools all-actions test exceeded budget");
});
```

也可以把“全量动作测试”拆成按工具类别的子套件，让失败定位更小，CI 并行化时也更容易分片。

- 📊 预期收益：测试变慢时更早发现，工具箱继续扩展时不会让 CI 时间无声增长。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md#1-ci-中全量测试被重复执行反馈时间和日志噪声会随测试增长放大`、`docs/suggestions/module-reviews/tools-core-runtime-safety.md`。

### 5. 覆盖率报告只在控制台出现，没有持久化为可比较数据

- 📌 问题/建议标题：把覆盖率摘要保存为文档化 artifact 或 JSON
- 📍 位置：`package.json:16-16`、`.github/workflows/ci.yml:44-45`、`tests/workflows.test.mjs:25-37`
- 📝 当前状况描述：`npm run test:coverage` 会在控制台输出覆盖率表，但 CI 没有上传 artifact，也没有生成 JSON/Markdown 摘要。历史文档中已有 752/752、731/731 等旧数字，本轮已经达到 769/769；如果没有自动化记录，很难判断覆盖率变化来自新增测试、删除测试还是覆盖目标变化。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```yaml
- name: Capture coverage
  run: |
    npm run test:coverage | tee temp/coverage.txt
    awk '/all files/ { print }' temp/coverage.txt >> "$GITHUB_STEP_SUMMARY"

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: coverage-report
    path: temp/coverage.txt
```

后续可再把文本解析成 `docs/suggestions/generated/coverage-history.json`，但自动化生成文件应和人工建议文档分开。

- 📊 预期收益：覆盖率变化可追踪，测试数量和慢测试趋势也能被纳入工程健康度。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md#6-ci-缺少机器可读测试覆盖率产物和失败摘要`。

### 6. JSDOM 行为测试很充分，但仍缺少少量真实浏览器覆盖

- 📌 问题/建议标题：为高交互页面增加最小浏览器冒烟集
- 📍 位置：`tests/tools.test.mjs:78-143`、`tests/assistant.test.mjs:1-120`、`tests/blog.test.mjs:84-87`、`package.json:12-20`
- 📝 当前状况描述：JSDOM 测试覆盖了大量 DOM 行为，但摄像头权限、动态 `import()`、Worker、实际 CSS 布局、滚动位置、`loading=lazy`、打印媒体等浏览器行为仍只能被近似模拟。当前没有 Playwright 或类似浏览器冒烟入口。考虑到工具箱、助手、博客列表和文章阅读交互都比较重，建议只增加少量高价值真实浏览器用例。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
test("tools page opens first panel without console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tools/");
  await page.getByRole("tab", { name: /JSON/ }).click();
  await expect(page.locator("#tool-json")).toBeVisible();
  expect(errors).toEqual([]);
});
```

优先覆盖 `/tools/`、`/post/`、`/ai/` 和 `/sponsor/` 的桌面/移动冒烟，不必一开始追求全量视觉回归。

- 📊 预期收益：弥补 JSDOM 对布局、浏览器 API 和真实资源加载的盲区，减少“单元测试全绿但页面体验退化”的风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/layout-responsive-print-review.md#7-缺少真实视口的视觉溢出回归测试`。

## 后续优先级

1. 先让 `js/*.js` 客户端脚本进入文件级覆盖率报告，明确真实覆盖基线。
2. 为 `parse-relay.mjs` 和 `update-commercial-relay.mjs` 补异常矩阵，再设置分组覆盖率预算。
3. 在 CI 中保存覆盖率摘要，避免测试数量和覆盖率历史只散落在人工报告里。
4. 给工具箱慢测试设预算或拆分，配合 CI 去重降低反馈时间。
5. 增加极小浏览器冒烟集，先覆盖工具箱和文章页。

