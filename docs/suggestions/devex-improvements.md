# 🛠️ 开发体验与工程化优化

> 分析日期：2026-06-18 | 分析范围：构建流程、CI/CD、代码规范、测试策略

---

## 2026-07-03 复查补充

### 📌 DE-11: 把生产验证改造成真正只读的质量门禁

- **📍 位置**：`scripts/validate-production.mjs:222-254`, `package.json:20-24`
- **📝 当前状况描述**：项目已经有 `check:readonly`，但 `validate:production` 内部仍执行默认 `node scripts/build.mjs`，会写根目录产物。本轮验证后 Git 没有新增 diff，只是碰巧构建产物一致；脚本设计上仍然不是只读。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```json
  {
    "scripts": {
      "build:check": "node scripts/build.mjs --out temp/build-check",
      "validate:production": "node scripts/validate-production.mjs --readonly"
    }
  }
  ```
  `validate-production.mjs` 中所有产物检查都指向临时 outDir；结束后可清理临时目录，或保留到 `temp/` 供调试。
- **📊 预期收益**：让本地、CI、AI 自动分析都能安全运行完整验证，不污染工作区。
- **🔗 相关建议引用**：[B-13](bugs-and-risks.md#b-13-生产验证脚本默认会覆盖根目录构建产物)

### 📌 DE-12: `validate` / `precommit` 同时包含自动修复和构建写入，语义不够清晰

- **📍 位置**：`package.json:18-26`
- **📝 当前状况描述**：`lint` 使用 `eslint js/*.js --fix`，`validate` 执行 `npm run lint && npm test && npm run validate:posts && npm run build`，`precommit` 又指向 `npm run validate`。这意味着一个名为 validate/precommit 的命令会自动修改 JS 格式和生成站点产物。对自动化代理、CI 或多人协作来说，命令副作用不直观。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```json
  {
    "lint": "eslint js/*.js",
    "lint:fix": "eslint js/*.js --fix",
    "check": "npm run lint && npm test && npm run validate:posts",
    "build:site": "node scripts/build.mjs"
  }
  ```
  把“检查”“修复”“生成”拆成独立命令，precommit 默认只跑不写文件的检查。
- **📊 预期收益**：减少意外工作区变更，提升命令命名和实际行为的一致性。
- **🔗 相关建议引用**：[DE-11](#de-11-把生产验证改造成真正只读的质量门禁), [TD-11](tech-debt.md#td-11-eslint-8-迁移前应先清零当前-warning-债务)

### 📌 DE-13: 为 AI 助手和 Cron 边界行为补充回归测试

- **📍 位置**：`tests/assistant.test.mjs:1-562`, `tests/assistant-deep.test.mjs:1-335`, `tests/tools-core-deep.test.mjs:258-266`
- **📝 当前状况描述**：测试覆盖率总体很高，但第 2 轮发现的边界点没有被测试锁住：`readMode()` 固定返回 LLM、SSE 流结束未处理剩余 buffer、AbortError 无法区分超时和手动停止、Cron 无解表达式耗时无预算断言。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  test("assistant restores saved site mode", async () => {
    localStorage.setItem("cwl.assistant.mode", "site");
    await loadAssistant();
    assert.equal(document.querySelector("[data-mode='site']").classList.contains("active"), true);
  });

  test("cron impossible date returns within budget", () => {
    const started = performance.now();
    const result = core.parseCronExpression("0 0 31 2 *", now);
    assert.equal(result.code, "cronNoRuns");
    assert.ok(performance.now() - started < 20);
  });
  ```
  SSE 测试可用 mock ReadableStream 模拟最后一个事件不带尾随空行。
- **📊 预期收益**：把已发现的复杂边界变成可自动阻断的回归条件，减少后续重构 assistant 和工具核心时的行为漂移。
- **🔗 相关建议引用**：[B-15](bugs-and-risks.md#b-15-ai-助手模式偏好写入后不会被恢复), [B-16](bugs-and-risks.md#b-16-ai-助手-sse-流结束时可能丢失最后一个未闭合事件), [P-16](performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度)

---

## 📌 DE-01 [已修复]: 无自动化 CI/CD 流程

- **📍 位置**：`.github/workflows/ci.yml`、`package.json`
- **✅ 修复状态**：新增通用 CI workflow，覆盖 `push`、`pull_request` 和手动触发；权限限制为 `contents: read`；质量门禁包括 `npm ci`、`npm run lint:check`、`npm test`、`npm run build`、`npm run validate:production`、`npm run test:coverage` 和中高危依赖审计。
- **🧪 回归测试**：`tests/workflows.test.mjs` 解析 workflow YAML，验证触发分支、只读权限、Node/npm cache 配置和关键质量步骤。
- **📊 实际收益**：提交和 PR 会自动执行完整质量门禁，减少本地漏跑测试、构建或审计导致的回归风险。
- **🔗 相关建议**：[DE-02](#de-02)

---

## 📌 DE-02 [部分修复]: 测试运行无 watch 模式下的增量反馈

- **📍 位置**：`package.json` scripts
- **📝 当前状况**：
  ```json
  "test": "node --test tests/*.test.mjs",
  "test:watch": "node --test --watch tests/*.test.mjs",
  "test:coverage": "node --test --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=70 --test-coverage-functions=85 tests/*.test.mjs"
  ```
  测试使用 Node.js 内置测试运行器（`node:test`），并已具备 watch 模式和 CI 覆盖率阈值门禁；仍缺少：
  - 测试结果彩色输出
  - 测试覆盖率报告可视化
  - 与 CI 集成的 JUnit XML 输出
- **⚠️ 影响程度**：低
- **✅ 已完成**：`test:coverage` 增加 Node 原生覆盖率阈值：lines 90%、branches 70%、functions 85%，CI 会在覆盖率明显回退时失败。
- **🧪 回归测试**：`tests/workflows.test.mjs` 验证 CI 继续执行 `npm run test:coverage`，并锁定 package script 中的阈值参数。
- **💡 建议方案**：
  1. **短期**：保持 `node:test`（零依赖，轻量）
  2. **中期**：如需可视化报告，再引入覆盖率 HTML/JUnit 输出
  3. **长期**：项目规模继续增长时考虑迁移至 Vitest

- **📊 实际收益**：覆盖率门禁从“只记录指标”升级为“自动阻断明显回退”，同时保持零新增依赖。
- **🔗 相关建议**：[TD-10](tech-debt.md#td-10)

---

## 📌 DE-03 [已修复]: 无依赖安全审计和更新检查

- **📍 位置**：`package.json`、`.github/workflows/ci.yml`、`.github/dependabot.yml`
- **✅ 修复状态**：CI 已运行 `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`，Dependabot 每周检查 npm devDependencies 和 GitHub Actions 更新，并限制最多 5 个打开 PR。
- **🧪 回归测试**：`tests/workflows.test.mjs` 解析 CI 和 Dependabot YAML，验证依赖审计命令、npm 更新配置、GitHub Actions 更新配置和 devDependencies 分组。
- **📊 实际收益**：漏洞审计与依赖更新提醒均自动化，减少依赖过期或 workflow action 滞后带来的维护风险。
- **🔗 相关建议**：[TD-03](tech-debt.md#td-03)

---

## 📌 DE-04: 开发服务器使用 `http-server`，缺少热重载

- **📍 位置**：`package.json`
- **📝 当前状况**：
  ```json
  "serve": "npx --yes http-server . -p 8137 -c-1",
  "dev": "npm run build && npm run serve"
  ```
  `http-server` 是纯静态文件服务器，不支持：
  - 文件变更自动重载（live-reload）
  - CSS 热替换（HMR）
  - 构建后自动刷新
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  1. **短期**：保持 `http-server` + 手动刷新
  2. **中期**：使用 BrowserSync：
     ```json
     "dev": "npm run build && browser-sync start -s . -w --no-notify"
     ```
     BrowserSync 会在文件变更时自动刷新浏览器。
  3. **长期**：使用 Vite 作为开发服务器（支持 HMR）：
     ```json
     "dev": "vite --port 8137"
     ```

- **📊 预期收益**：开发效率提升，减少手动刷新
- **🔗 相关建议**：[AR-04](architecture-review.md#ar-04)

---

## 📌 DE-05: 构建产物与源码混在同一目录

- **📍 位置**：项目根目录
- **📝 当前状况**：构建产物（`post/*/index.html`、`sitemap.xml`、`index.xml`、`search-index.json`）直接生成在项目根目录，与源码混在一起。这意味着：
  - `.gitignore` 需要精确管理
  - `git diff` 包含生成文件的变更
  - 难以区分"手写文件"和"生成文件"
- **⚠️ 影响程度**：低（GitHub Pages 需要根目录部署）
- **💡 建议方案**：
  1. **当前方案可接受**：GitHub Pages 从根目录或 `docs/` 目录部署，当前设计是最简方案
  2. **改进**：在构建产物文件头部添加注释标记：
     ```html
     <!-- ⚠️ AUTO-GENERATED by scripts/build.mjs — DO NOT EDIT -->
     ```
  3. **进阶**：使用 `docs/` 目录作为部署目录，源码和产物分离

- **📊 预期收益**：减少误编辑生成文件的风险
- **🔗 相关建议**：[DE-01](#de-01)

---

## 📌 DE-06: 无代码格式化工具（Prettier）

- **📍 位置**：项目配置
- **📝 当前状况**：项目有 ESLint（代码质量检查）但没有 Prettier（代码格式化）。代码风格（缩进、引号、分号等）依赖开发者手动保持一致。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```bash
  npm install -D prettier
  ```
  添加 `.prettierrc`：
  ```json
  { "singleQuote": true, "trailingComma": "es5", "tabWidth": 2, "semi": true }
  ```
  添加 package.json scripts：
  ```json
  "format": "prettier --write \"**/*.{js,mjs,json,md}\"",
  "format:check": "prettier --check \"**/*.{js,mjs,json,md}\""
  ```
- **📊 预期收益**：代码风格一致性，减少 CR 中的格式讨论
- **🔗 相关建议**：[CQ-01](code-quality.md#cq-01)

---

## 📌 DE-07: 缺少 CONTRIBUTING.md 和开发文档

- **📍 位置**：项目根目录
- **📝 当前状况**：`readme.md` 主要是待办清单和 Git 操作备忘，缺少：
  - 项目架构说明
  - 如何添加新文章
  - 如何添加新页面
  - 构建流程说明
  - 测试运行说明
  - 部署流程说明
- **⚠️ 影响程度**：低（个人项目，主要维护者是自己）
- **💡 建议方案**：在 `docs/` 中添加开发文档：
  ```
  docs/
  ├── development.md      — 开发环境搭建
  ├── architecture.md     — 架构说明
  ├── adding-posts.md     — 如何写新文章
  ├── adding-pages.md     — 如何添加新页面
  ├── deployment.md       — 部署流程
  └── suggestions/        — 本分析报告
  ```
- **📊 预期收益**：降低未来维护的认知负担，便于 AI 辅助开发
- **🔗 相关建议**：[AR-01](architecture-review.md#ar-01)

---

## 📌 DE-08 [已修复]: Markdown 文章缺少 front-matter 校验工具

- **📍 位置**：`scripts/validate-posts.mjs`、`package.json`、`.github/workflows/ci.yml`
- **✅ 修复状态**：新增 `npm run validate:posts`，独立校验所有 Markdown 文章 front matter，不生成站点产物；本地 `validate` 和 CI 均在 build 前运行该命令。
- **🧪 回归测试**：`tests/validate-posts.test.mjs` 覆盖真实文章通过、重复 slug 失败和 `tags` / `tagsEn` 数量不一致失败；`tests/workflows.test.mjs` 锁定 CI 与 package scripts 集成。
- **📊 实际收益**：写文章时可更快发现必填字段、日期、slug、cover 和标签翻译问题，减少等完整构建后才定位 front matter 错误的成本。
- **🔗 相关建议**：[B-06](bugs-and-risks.md#b-06)

---

## 📌 DE-09 [已修复]: 建议添加 `package.json` 的 `engines` 字段

- **📍 位置**：`package.json`
- **✅ 修复状态**：新增 `"engines": { "node": "20 || >=22" }`，与当前 jsdom 依赖链和 CI Node 22 配置对齐，避开不受依赖支持的 Node 21。
- **🧪 回归测试**：`tests/workflows.test.mjs` 同时验证 CI 使用 Node 22，并确认 package engines 已声明。
- **📊 实际收益**：在不兼容 Node 版本上安装依赖时提前提示，减少低版本运行测试或构建时才失败的排查成本。
- **🔗 相关建议**：[TD-02](tech-debt.md#td-02)

---

## 📌 DE-10 [已修复]: 添加 CHANGELOG.md

- **📍 位置**：项目根目录 `CHANGELOG.md`
- **✅ 修复状态**：已新增结构化变更日志，按日期记录 Added / Changed / Fixed / Security 等分类，补充 Git 历史之外的人工可读发布轨迹。
- **🧪 回归测试**：`tests/workflows.test.mjs` 校验根目录 CHANGELOG 存在、包含标题、日期分组和关键变更分类。
- **📊 实际收益**：协作者或未来自己可快速了解项目阶段性演进，不必从几十个提交中反查功能、安全和工程化变更。
- **🔗 相关建议**：[DE-07](#de-07)

---

## 工程化成熟度评估

| 维度 | 当前状态 | 目标状态 | 差距 |
|------|----------|----------|------|
| 代码规范 | ESLint ✅ | + Prettier | 小 |
| 测试 | 41 个测试 ✅ | + E2E 测试 | 中 |
| CI/CD | precommit + GitHub Actions + 覆盖率阈值 ✅ | 部署自动化 | 小 |
| 文档 | readme.md | + 完整开发文档 | 中 |
| 依赖管理 | npm + Dependabot ✅ | 定期人工评估大版本 | 小 |
| 开发体验 | http-server | + 热重载 | 小 |
| 类型安全 | 无 | + JSDoc / TS | 大 |

> 综合评估：工程化基础扎实（ESLint + 测试 + 构建脚本 + GitHub Actions + 覆盖率阈值），主要差距在部署自动化和文档完整性上。
