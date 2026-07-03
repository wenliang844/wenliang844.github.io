# 当前工作树验证报告

> 分析时间：2026-07-03 第六轮 | 验证范围：当前未提交工作树、完整质量门禁、建议文档一致性

## 验证摘要

| 项目 | 结果 |
|------|------|
| Lint | `npm run lint:check` 通过，0 warnings |
| 全量测试 | `npm run validate:production` 内部测试通过；`npm run test:coverage` 792/792 通过；`npm run test:http-smoke` 6/6 路由通过；`npm run test:browser-smoke` 通过 |
| 覆盖率 | `npm run test:coverage` 通过，line 96.82% / branch 83.51% / funcs 96.50% |
| 生产验证 | `npm run validate:production` 34/34 通过 |
| 依赖审计 | `npm audit --registry=https://registry.npmjs.org --audit-level=moderate` 0 vulnerabilities |
| 空白检查 | `git diff --check` 通过，仅 CRLF 工作区提示 |

## WV-01 [已处理]: 未提交修复已经通过完整门禁

- **位置**：`js/assistant.js`, `js/tools.js`, `js/editor.js`, `css/coder.css`, `scripts/validate-production.mjs`, `tests/*.mjs`, `docs/suggestions/*.md`
- **当前状态**：当前工作树包含 AI 助手安全边界、SSE 尾包、预览语义、Markdown 输入可访问名称、QR 图片尺寸、404 JSON-LD、工具页面板按需挂载和生产验证输出缓冲等修复；完整门禁已通过。
- **提交策略**：本轮按“修复 + 回归测试 + 文档记录”一起提交，保证行为变更和对应验证记录在同一个可追溯提交中。
- **收益**：避免源码行为已变更但报告仍停留在旧状态，后续继续优化时可以从干净基线出发。

## WV-02 [已处理]: README 与工作报告验证基线已同步

- **位置**：`docs/suggestions/README.md`, `docs/suggestions/work-report.md`, `docs/suggestions/health-score.md`
- **修复状态**：README 快照、健康度评分和工作报告已更新为 792/792 测试、96.82% 行覆盖率、0 漏洞、生产验证 34/34。
- **收益**：建议索引反映最新验证基线，减少后续分析时重复确认测试数量。

## WV-05 [已处理]: 生产验证脚本在大输出测试套件下误报失败

- **位置**：`scripts/validate-production.mjs:16`, `scripts/validate-production.mjs:130-136`, `tests/workflows.test.mjs:103-108`
- **当前状态**：`npm run validate:production` 首次在内部测试阶段误报失败；直接运行 `node --test tests/*.test.mjs` 和覆盖率套件均通过，确认是校验脚本输出缓冲不足。
- **修复方案**：为测试执行设置 `TEST_OUTPUT_MAX_BUFFER = 32 * 1024 * 1024`，并新增静态回归测试锁定该保护。
- **验证**：`node --test tests/workflows.test.mjs` 9/9 通过；`npm run validate:production` 34/34 通过；`npm run test:coverage` 792/792 通过。
- **收益**：生产门禁不再因测试输出增长而假红，后续自主循环能继续依赖该命令作为部署前质量信号。

## WV-03 [已处理]: Cron 不可能日期表达式已短路

- **位置**：`js/tools-core.js:938-980`, `tests/tools-core-deep.test.mjs:258-266`
- **修复状态**：`parseCronExpression()` 已提前识别“月份中没有任何可匹配 day-of-month，且 day-of-week 为通配”的不可能日期表达式，避免两年分钟粒度扫描。
- **验证**：`npm test` 792/792 通过；`tests/tools-core-deep.test.mjs` 新增 `<50ms` 性能预算断言和 `0 0 31 2 mon` OR 语义保护用例。

## WV-06 [已处理]: 公开站点缺少隐私与信任入口

- **位置**：`src/trust-data.mjs`, `src/templates/trust.mjs`, `src/config.mjs`, `src/templates/layout.mjs`, `trust/index.html`
- **当前状态**：新增 `/trust/` 页面，集中说明本机数据、第三方服务、用户控制和安全摘要，并接入导航、页脚、站内搜索、sitemap、robots、HTTP smoke 和 browser smoke。
- **验证**：`node --test tests/templates-extended.test.mjs tests/css.test.mjs tests/build.test.mjs tests/workflows.test.mjs` 通过；`npm run test:http-smoke` 6/6 通过；`npm run test:browser-smoke` 通过。
- **收益**：把工程侧已有安全/隐私策略转成访问者可发现的信任信号，降低订阅、评论、AI 助手和工具箱使用前的信息不对称。

## WV-07 [已处理]: Trust Center 样式曾触发 CSS 体积预算回归

- **位置**：`css/coder.css`, `tests/performance.test.mjs`
- **当前状态**：初版 Trust Center 样式让 `coder.css` 超过 140KB 预算；已恢复公共模板的页面级 `styles` 注入，将工具箱重型样式迁移到 `css/tools.css`，并将信任页增量样式放入 `css/trust.css`。
- **验证**：`node --test tests/css.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/performance.test.mjs tests/build.test.mjs tests/workflows.test.mjs` 111/111 通过；当前 `coder.css` 为 129,973 bytes，保持在 140KB 预算内；新增 `src/page-assets.mjs`、路由级 CSS raw/gzip 预算和本地 CSS/JS Git 跟踪校验，约束 `/`、`/tools/`、`/trust/` 的实际样式引用。
- **收益**：新增信任页面没有扩大全站 CSS 单包成本，工具页/信任页也具备继续按路由拆样式的基础。
- **影响程度**：中
- **后续建议**：
  ```javascript
  // 更泛化的稀疏表达式仍可继续优化为按字段跳跃。
  cursor = jumpToNextAllowedMinuteOrHour(cursor);
  ```
  当前核心慢路径已修复；后续可继续优化“可匹配但非常稀疏”的表达式。
- **相关建议引用**：[P-16](performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度), [MR-CORE-01](module-reviews/tools-core.md#mr-core-01-cron-解析器需要避免主线程百万次扫描)

## WV-04 [已修复]: UUID 弱随机 fallback 仍被测试视为可接受行为

- **位置**：`js/tools-core.js:204-228`, `tests/tools.test.mjs:236-258`
- **修复状态**：当前测试已改为要求 Web Crypto 被阻断时返回 `uuidCrypto` 错误，工具页不生成也不复制弱随机 UUID。
- **当前状况描述**：原测试曾包含 “UUID generation survives blocked crypto access”，会把 Web Crypto 被阻断时仍生成格式正确 UUID 固化为契约；本轮已改为 `uuidCrypto` 失败断言，避免弱随机伪装成安全随机。
- **影响程度**：低
- **建议方案**：已采用明确失败策略：缺少安全随机数时返回 `uuidCrypto`，不输出弱随机 UUID；普通随机数工具也已补非加密用途提示。后续可选新增 Web Crypto 安全随机整数模式。
- **相关建议引用**：[S-15](security-audit.md#s-15-已修复-uuid-工具在-web-crypto-不可用时退化到-mathrandom), [TD-12](tech-debt.md#td-12-已修复核心边界-随机数能力边界需要产品和测试共同收敛)
