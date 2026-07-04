# 📊 项目分析工作报告

> 报告时间：2026-06-18 01:30 | 工作时长：~1.5 小时 | 分析轮次：3 轮

---

## 2026-07-04 手势视觉资源状态可视化推进

### 已完成

- `src/templates/tools.mjs` 在手势工具第三方资源确认区新增 7 项远程视觉资源治理状态，区分“版本锁定”“上游 latest”和“待自托管”。
- `css/tools.css` 为 `.gesture-resource-status` / `.gesture-resource-item` 增加紧凑列表样式，并突出 watch 状态资源。
- `scripts/browser-smoke.mjs` 在 `/tools/` 真实浏览器交互中断言资源状态列表可见、7 项渲染且 3 项处于 watch 状态。
- 扩展 `tests/templates.test.mjs`、`tests/css.test.mjs`、`tests/vendor-manifest.test.mjs` 和 `tests/workflows.test.mjs`，防止资源状态 UI、manifest 覆盖和 browser smoke 断言漂移。
- 运行 `npm run build` 刷新 `tools/index.html`，并更新 README、最终路线图、静态资产专题和安全审计。

### 本轮验证

- `node --test tests/templates.test.mjs tests/css.test.mjs tests/vendor-manifest.test.mjs`：53/53 通过。
- `node --test tests/performance.test.mjs tests/templates.test.mjs tests/css.test.mjs tests/vendor-manifest.test.mjs`：71/71 通过。
- `node --test tests/workflows.test.mjs`：16/16 通过。
- `npm run check:generated`、`npm run check:i18n`、`npm run check:vendor`：通过。
- `npm run test:browser-smoke`：通过。

---

## 2026-07-04 质量基线失败日志追溯推进

### 已完成

- `scripts/quality-baseline-core.mjs` 新增 `--log-dir` 参数解析、失败日志文件名规范、敏感输出脱敏和 `outputTail()` 截断工具。
- `scripts/write-quality-baseline.mjs` 在命令失败时写入 `temp/quality-baseline/logs/<command>.log`，并在 command JSON 中记录 `logPath`、脱敏 `outputTail` 和可选 `artifactPaths`。
- `browser-smoke` 命令失败时会在质量基线中关联 `temp/browser-smoke/`，与浏览器截图/DOM/JSON 失败证据打通。
- `validateQualityBaseline()` 要求失败 command 必须带 `logPath` 和 `outputTail`，避免失败证据退化成只有一行 error。
- GitHub Actions 的 clean quality baseline artifact 上传范围扩展为 `temp/quality-baseline/`，并使用 `always() && hashFiles(...)`，目录存在时即上传，目录不存在时不制造额外噪音。
- 扩展 `tests/quality-baseline.test.mjs` 和 `tests/workflows.test.mjs`，覆盖日志参数、脱敏、失败日志字段校验和 CI artifact 上传路径。
- 更新 README、最终路线图和质量基线治理专题，将 QBG-04 / FINAL-01 第二阶段推进为已修复。

### 本轮验证

- `node --test tests/quality-baseline.test.mjs tests/workflows.test.mjs`：25/25 通过。
- `npm run check:quality-baseline`：通过，当前 working-tree artifact 新鲜且关键指标完整。

---

## 2026-07-04 搜索索引缓存状态可视化推进

### 已完成

- `js/search.js` 在全局搜索弹窗中新增 `.search-modal-status`，用 `role="status"` 和 `aria-live="polite"` 呈现搜索索引状态。
- 状态条覆盖索引待加载、加载中、已就绪、离线可搜索、离线未加载、索引异常和暂时不可用等状态，并监听 `online` / `offline` / 语言切换事件刷新文案。
- `css/coder.css` 为状态条补充稳定高度、边界和不同状态圆点，避免搜索弹窗结果区布局跳动。
- `search.js` 保留懒加载英文状态文案 fallback；中文继续由 `search.js` fallback 和初始 DOM 文案提供，避免增加核心 `js/i18n.js` 体积。
- `scripts/browser-smoke.mjs` 在真实浏览器搜索交互中断言状态条进入“搜索索引已就绪 / Search index ready”状态后再继续搜索。
- 扩展 `tests/search-behavior.test.mjs` 和 `tests/css.test.mjs`，覆盖中英文离线未缓存状态、索引异常状态、成功加载状态和加载后离线仍可搜索。
- 更新 README、最终路线图、PWA 离线缓存专题和 UX 建议，将搜索缓存状态面板推进为已修复。

### 本轮验证

- `node --test tests/search-behavior.test.mjs tests/css.test.mjs tests/js-behavior.test.mjs`：85/85 通过。
- `node --test tests/workflows.test.mjs`：16/16 通过。
- `npm run test:browser-smoke`：通过，关键桌面/移动路由、工具箱交互、文章列表搜索、相关文章原因和全局搜索交互均通过。

---

## 2026-07-04 PWA 预缓存资源所有权治理推进

### 已完成

- `data/generated-artifact-manifest.json` 新增 `manualStaticFiles`，将根目录 `manifest.webmanifest` 纳入手写静态文件所有权清单。
- `scripts/check-generated-artifact-manifest.mjs` 新增路径归属判断，支持 generated output、manual HTML、manual static file、dynamic post 和 copied asset directory 分类。
- `scripts/check-pwa-precache.mjs` 现在会反查生成物所有权 manifest，新增 `Managed precache URL gaps` 指标；预缓存 URL 若没有归属会直接失败。
- `scripts/quality-baseline-core.mjs` 将 PWA 预缓存所有权缺口写入质量基线并要求为 0。
- 扩展 `tests/generated-artifact-manifest.test.mjs`、`tests/pwa-precache.test.mjs`、`tests/quality-baseline.test.mjs` 和 `tests/workflows.test.mjs`，锁定 PWA 预缓存与生成物所有权 manifest 的联动。
- 更新 README、最终路线图、构建产物同步专题和 PWA 离线缓存专题，将 FINAL-03 / FINAL-04 的资源 manifest 联动继续向前推进。

### 本轮验证

- `node --test tests/generated-artifact-manifest.test.mjs tests/pwa-precache.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs`：33/33 通过。
- `npm run check:generated`：通过，比较 83 个文件并校验 manifest。
- `npm run check:pwa-precache`：通过；19 个预缓存 URL / 19 个 Service Worker URL / 0 生成物所有权缺口 / 2 个页面资源覆盖 / 0 缺失 / 0 额外 / 0 不可缓存。

---

## 2026-07-04 当前质量基线刷新

### 已完成

- 重新运行 `npm run quality:baseline`，刷新 `docs/suggestions/evidence/current-quality-baseline.json`，把新增生成物 manifest 测试后的测试数量和覆盖率写入机器证据。
- 同步更新 README 当前快照、最终路线图和质量基线治理专题中的当前基线数字，避免报告继续引用 879/879 的旧口径。

### 本轮验证

- `npm run quality:baseline`：通过；当前质量基线 14/14 命令通过，889/889 测试通过，coverage line 91.37% / branch 79.31% / funcs 90.39%，PWA 预缓存资源所有权缺口 0，production 75/75 通过。
- `npm run check:quality-baseline`：通过，当前 working-tree artifact 新鲜且关键指标完整。

---

## 2026-07-04 生成产物所有权 Manifest 推进

### 已完成

- 新增 `data/generated-artifact-manifest.json`，集中记录动态文章页、静态生成页、RSS/sitemap/search/service-worker 产物、手写 HTML 页和复制静态资源目录的所有权。
- 新增 `scripts/check-generated-artifact-manifest.mjs`，从 `scripts/build.mjs` 解析静态 `writeFileEnsured()` 输出，从 `src/posts/*.md` 派生动态文章页，并扫描所有提交的 HTML，要求每个 HTML 都归类为 generated 或 manual。
- `offline.html` 作为 PWA 离线兜底页被归入手写静态页，避免离线入口游离在构建所有权之外。
- `npm run check:generated` 现在会先运行字节级生成产物漂移检查，再运行产物所有权 manifest 检查。
- 新增 `tests/generated-artifact-manifest.test.mjs`，并扩展 `tests/workflows.test.mjs`，锁定 manifest 覆盖、build 输出对齐和 npm 脚本串联。
- 更新 README、最终路线图和构建产物同步专题，将 FINAL-04 / MR-BUILD-SYNC-04 推进为已修复；PR 摘要引用和体积趋势输出保留为后续项。

### 本轮验证

- `node scripts/check-generated-artifact-manifest.mjs`：通过。
- `node --test tests/generated-artifact-manifest.test.mjs tests/workflows.test.mjs`：19/19 通过。
- `npm run check:generated`：通过，比较 83 个文件并校验 manifest。

---

## 2026-07-04 Clean Quality Baseline CI Artifact 推进

### 已完成

- 将 `npm run quality:baseline:clean -- --out temp/quality-baseline/clean-quality-baseline.json` 接入 GitHub Actions，在 build 前生成 clean-commit 发布证据。
- CI 生成后立即运行 `npm run check:quality-baseline -- --file temp/quality-baseline/clean-quality-baseline.json --require-head --require-clean-scope`，要求 artifact commit 等于 HEAD、scope 为 `clean-commit` 且 `git.dirty` 为 false。
- 新增 `Upload clean quality baseline` 步骤，使用 `actions/upload-artifact@v5` 上传 `clean-quality-baseline`，保留 14 天。
- `scripts/check-quality-baseline.mjs` 新增 `--require-clean-scope`，`scripts/quality-baseline-core.mjs` 对 clean scope 和 dirty 状态执行强校验。
- 扩展 `tests/quality-baseline.test.mjs` 和 `tests/workflows.test.mjs`，覆盖 clean artifact 校验、CI 顺序、上传路径和保留策略。
- 更新 README、最终路线图和质量基线治理专题，将 FINAL-01 / QBG-01 标记为第一阶段已修复；失败日志追溯、release 摘要注入和 quick/full 分层保留为后续项。

### 本轮验证

- `node --test tests/quality-baseline.test.mjs tests/workflows.test.mjs`：22/22 通过。
- `npm run check:quality-baseline`：通过，当前 working-tree artifact 新鲜且关键指标完整。
- `npm run test:browser-smoke:full`：通过，桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互均通过。
- `npm test`：879/879 通过。
- `npm run quality:baseline`：通过；当前质量基线 14/14 命令通过，coverage line 91.81% / branch 80.36% / funcs 90.37%。

---

## 2026-07-04 Browser Smoke CI Artifact 推进

### 已完成

- 将 `npm run test:browser-smoke` 接入 GitHub Actions 主 CI，在 HTTP smoke 通过并完成站点构建后运行真实 Chromium 关键路径冒烟。
- 新增 `Upload browser smoke artifacts` 步骤，CI 失败时使用 `actions/upload-artifact@v5` 上传 `temp/browser-smoke/`，保留截图、DOM HTML 和 JSON 元数据。
- 上传步骤设置 `if-no-files-found: ignore` 与 7 天保留期，避免非浏览器失败场景产生额外噪音。
- 扩展 `tests/workflows.test.mjs`，锁定 browser smoke CI 顺序、artifact action、目录、保留期和失败触发条件。
- 更新 README、最终路线图和浏览器视觉 smoke 专题，将 FINAL-08 标记为第二阶段已修复；trace/video 仍保留为后续增强。

### 本轮验证

- `node --test tests/workflows.test.mjs`：15/15 通过。
- `npm run test:browser-smoke`：通过，覆盖 critical 桌面/移动关键路径和工具/搜索交互。
- `npm test`：879/879 通过。
- `npm run quality:baseline`、`npm run check:quality-baseline`：通过；当前质量基线 14/14 命令通过，coverage line 91.81% / branch 80.36% / funcs 90.37%。

---

## 2026-07-04 建议库治理预算门禁推进

### 已完成

- 扩展 `scripts/check-suggestions-index.mjs`，把当前 82 条待补建议和各缺失字段数量固化为建议治理预算。
- `npm run check:suggestions-index` 现在会在 README 生成索引、本地 Markdown 链接、heading anchors 和治理统计之外，额外阻断待补建议总数或任一缺失字段数量增长。
- `npm run generate:suggestions-index` 在写入 `docs/suggestions/evidence/current-suggestions-governance.json` 前也会检查预算，避免把新增不完整建议重新生成成“正常基线”。
- 治理报告 schema 升级到 2，并在报告中记录当前预算：incomplete 82；title 0、location 6、description 51、impact 56、solution 55、benefit 15、links 30。
- `tests/suggestions-index.test.mjs` 新增预算通过、待补总数超限和单字段超限测试。
- 更新 README、最终路线图和建议库治理专题，将 FINAL-12 标记为第五阶段已修复；历史建议字段补齐、预算下调和状态摘要展示保留为后续项。

### 本轮验证

- `npm run generate:suggestions-index`：已刷新治理报告。
- `node --test tests/suggestions-index.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs`：26/26 通过。
- `npm run check:suggestions-index`：通过，覆盖 README 生成索引、本地 Markdown 文件链接、heading anchors、治理统计和预算门禁。

---

## 2026-07-04 建议库 Heading Anchor 治理推进

### 已完成

- 扩展 `scripts/check-suggestions-index.mjs`，在原有 README 模块专题覆盖和本地 Markdown 文件级链接检查基础上，新增 `#heading-anchor` 校验。
- 检查器支持普通 GitHub 风格 heading slug、同文件 `#anchor`、跨文件 `.md#anchor`、建议短 ID（如 `#de-14`）和“建议 ID + 去状态标题”锚点，避免 `[已修复]` 状态文字变化造成假漂移。
- 修复 P-18、DE-14、UX-12、DE-12 等历史链接漂移，把易变的标题型链接收敛为稳定短 ID。
- 新增 `tests/suggestions-index.test.mjs`，锁定链接解析、行号、heading slug、短 ID 和去状态标题锚点生成。
- 更新 README、最终路线图和建议库治理专题，将 FINAL-12 标记为第二阶段已修复；README 自动生成已在后续阶段完成，建议字段完整性检查和状态统计保留为后续项。

### 本轮验证

- `node --test tests/suggestions-index.test.mjs`：2/2 通过。
- `npm run check:suggestions-index`：通过，覆盖模块索引、本地 Markdown 文件链接和 heading anchors。
- `npm test`：877/877 通过。
- `npm run quality:baseline`、`npm run check:quality-baseline`：通过；当前质量基线 14/14 命令通过，coverage line 91.95% / branch 80.35% / funcs 90.35%。

---

## 2026-07-04 README 建议库索引生成推进

### 已完成

- 为 `scripts/check-suggestions-index.mjs` 增加 `--write` 模式，并在 `package.json` 暴露 `npm run generate:suggestions-index`。
- README 的“机器校验模块索引”增加 `<!-- suggestions-index:start -->` / `<!-- suggestions-index:end -->` 标记，索引内容由脚本读取 `module-reviews/*.md` 首个标题生成。
- `npm run check:suggestions-index` 现在会比较 README 当前片段和脚本生成结果；新增专题、标题变化或手工改坏索引都会触发门禁失败。
- `tests/suggestions-index.test.mjs` 新增 README 片段替换和标题提取测试；`tests/workflows.test.mjs` 锁定生成脚本命令。
- 更新 README、最终路线图和建议库治理专题，将 FINAL-12 标记为第三阶段已修复；建议字段完整性检查和状态统计保留为后续项。

### 本轮验证

- `npm run generate:suggestions-index`：已更新 README 模块索引。
- `node --test tests/suggestions-index.test.mjs tests/workflows.test.mjs`：18/18 通过。
- `npm run check:suggestions-index`：通过，覆盖 README 生成片段、模块索引、本地 Markdown 文件链接和 heading anchors。
- `npm test`：877/877 通过。
- `npm run quality:baseline`、`npm run check:quality-baseline`：通过；当前质量基线 14/14 命令通过，coverage line 91.95% / branch 80.35% / funcs 90.35%。

---

## 2026-07-04 建议字段完整性与状态统计推进

### 已完成

- 扩展 `scripts/check-suggestions-index.mjs`，新增建议条目解析、字段完整性统计、状态分类和治理报告生成。
- `npm run generate:suggestions-index` 现在会同步生成 `docs/suggestions/evidence/current-suggestions-governance.json`。
- `npm run check:suggestions-index` 会校验治理报告未漂移，并继续覆盖 README 生成索引、本地 Markdown 文件链接和 heading anchors。
- 当前治理统计：70 个 Markdown、48 个模块专题、349 条建议；267 条字段完整、82 条待补；状态 fixed 119 / partial 56 / open 174；缺失字段主要为 description 51、impact 56、solution 55、links 30。
- `tests/suggestions-index.test.mjs` 新增字段缺失、状态分类和 JSON 格式化测试。
- 更新 README、最终路线图和建议库治理专题，将 FINAL-12 标记为第四阶段已修复；历史建议字段补齐和状态统计摘要展示保留为后续项。

### 本轮验证

- `node --test tests/suggestions-index.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs`：25/25 通过。
- `npm run check:suggestions-index`：通过，覆盖 README 生成索引、本地 Markdown 文件链接、heading anchors 和治理统计。

---

## 2026-07-04 共享格式化与阅读指标契约推进

### 已完成

- `src/lib/format.mjs` 新增严格日期解析：要求 `YYYY-MM-DD`，并通过 UTC round-trip 拒绝非法月份和不存在的日历日期。
- `isoDate()`、`longDate()`、`rfc822()`、`sitemapDate()` 统一复用该日期断言，合法日期输出保持不变，非法日期会在构建或测试阶段更早失败。
- `tests/format.test.mjs` 新增非法日期矩阵，覆盖空字符串、非补零格式、非法月份、2 月 30 日和普通非日期字符串。
- `tests/utils-deep.test.mjs` 新增跨运行时 fixture，对比 JSDOM `CWLUtils.readingMinutes()` / `CWLUtils.escapeHtml()` 与 Node 共享 `readingMinutes()` / `escapeHtml()` 的输出一致性。
- 更新 `docs/suggestions/module-reviews/shared-formatting-and-reading-contract.md`、最终路线图和 README，将 FINAL-10 / FMT-01 / FMT-03 标记为第一阶段已修复。

### 本轮验证

- `node --test tests/format.test.mjs tests/utils-deep.test.mjs tests/build-extended.test.mjs`：78/78 通过。
- `node --test tests/format.test.mjs tests/build-extended.test.mjs tests/coder.test.mjs tests/editor.test.mjs tests/utils.test.mjs tests/utils-deep.test.mjs`：131/131 通过。
- `npm test`：877/877 通过。
- `npm run lint:check`、`npm run check:generated`、`npm run test:browser-smoke`、`npm run quality:baseline`、`npm run check:quality-baseline`：通过；当前质量基线 14/14 命令通过，coverage line 91.95% / branch 80.35% / funcs 90.35%。
- `git diff --check`：退出码 0，仅输出当前工作树已有 LF/CRLF 提示。

---

## 2026-07-04 静态资产供应链 manifest 推进

### 已完成

- `data/vendor-manifest.json` 新增 `remoteResources`，记录手势工具 7 个远程 MediaPipe、face-api、Three.js、WASM 和模型 URL。
- 每个远程资源记录类型、包名、版本/路径、供应商、触发条件、用户确认要求、pinning 状态和后续本地化计划；upstream `latest` 模型路径必须写明自托管/hash pin 风险。
- `scripts/check-vendor-manifest.mjs` 扩展远程资源校验，检查 HTTPS、唯一 id/url、支持的资源类型、pinning 类型、显式用户确认和 `localFallbackPlanned`。
- `tests/vendor-manifest.test.mjs` 新增真实源码契约：从 `js/gesture.js` 抽取 jsDelivr / Google Storage 远程 URL，并要求 manifest 完整覆盖。
- 更新静态资产专题、最终路线图、README 和安全审计，将 FINAL-11 / MR-ASSET-07 标记为第一阶段已修复；模型自托管、hash pin 和 CSP 收敛仍保留为后续项。

### 本轮验证

- `node --test tests/vendor-manifest.test.mjs`：3/3 通过。
- `npm run check:vendor`：通过。

---

## 2026-07-04 建议库索引与内链治理推进

### 已完成

- 新增 `scripts/check-suggestions-index.mjs` 和 `npm run check:suggestions-index`，扫描 `docs/suggestions/module-reviews/*.md` 并要求 README 的“机器校验模块索引”覆盖每个专题文档。
- 同一脚本检查 `/docs/suggestions` 内本地 Markdown 文件级链接是否存在，先覆盖最容易漂移的相对 `.md` 链接。
- README 新增机器校验模块索引，集中列出当前 48 个模块专题入口。
- 修复 `docs/suggestions/module-reviews/resource-analysis.md` 中指向 `performance-bottlenecks.md` 的历史相对断链，并同步更新建议库治理专题描述。
- `check:suggestions-index` 已接入 `check:readonly`、GitHub Actions CI 和 `quality:baseline` 命令表；质量基线 required command id 同步增加 `suggestions-index`。
- 更新最终路线图、README 和建议库治理专题，将 FINAL-12 第一阶段标记为已修复；README 片段自动生成、heading anchor 检查和建议字段完整性检查保留为后续项。

### 本轮验证

- `npm run check:suggestions-index`：通过。
- `node --test tests/workflows.test.mjs tests/quality-baseline.test.mjs`：21/21 通过。

---

## 2026-07-04 Relay 商业源同步边界推进

### 已完成

- `scripts/update-commercial-relay.mjs` 新增商业源策略解析，`RELAY_COMMERCIAL_SOURCE_URL` 可用 `required:https://...` / `optional:https://...` 前缀声明源重要性；没有前缀时继续由 `RELAY_COMMERCIAL_REQUIRED` 决定默认策略。
- HTTP 失败现在会作为 rejected 结果进入同步汇总：可选源失败仍跳过，必需源失败会阻断同步并输出失败源摘要。
- 新增 `RELAY_COMMERCIAL_MIN_SUCCESSFUL_SOURCES`，当成功源数量低于最低要求时失败；GitHub Actions 商业同步 workflow 已设置为 `1`。
- 当存在 `RELAY_COMMERCIAL_TOKEN` 或自定义 `RELAY_COMMERCIAL_HEADERS` 时，多源同步必须全部属于同一 origin，否则在发起请求前失败，避免同一认证信息误发到多个域名。
- 更新 `docs/suggestions/module-reviews/relay-data-quality-and-sync.md`、最终路线图和 README，将 FINAL-09 / MR-RELAY-04 / MR-RELAY-05 标记为第一阶段已修复。

### 本轮验证

- `node --test tests/relay.test.mjs`：11/11 通过。

---

## 2026-07-04 AI 助手 API key 与 endpoint 信任边界推进

### 已完成

- `js/assistant.js` 的 LLM 配置新增 endpoint 摘要和信任确认框，展示协议、host 与 path；发送消息和测试连接前必须确认 endpoint，未确认时不会携带 API key 发起 `fetch`。
- 新增“记住 API key（仅保存在本机浏览器）”复选框，默认关闭；`saveConfig()` 仅在用户勾选时把 key 写入 `cwl.assistant.llmConfig`，否则只用于当前输入框里的本次请求。
- 兼容旧配置：历史上已经保存过 `apiKey` 的配置会读取为 `rememberApiKey: true`，避免升级后误删用户显式保存的 key。
- 新增 `assistant.js` 懒加载英文 fallback，避免把这批只在助手打开后才需要的长文案继续塞进全站 `js/i18n.js`，从而保持文章页 JS 预算不超线。
- `css/assistant.css` 为 endpoint summary、trust checkbox、remember key checkbox 增加样式，并把 endpoint/key 跨栏布局从 `nth-child` 改为显式类。
- 更新助手运行时专题、最终路线图、README 和安全审计，将 FINAL-07 标记为第一阶段已修复。

### 本轮验证

- `node --test tests/assistant.test.mjs tests/assistant-deep.test.mjs tests/assistant-loader.test.mjs`：52/52 通过。
- `node --test tests/performance.test.mjs tests/assistant.test.mjs tests/css.test.mjs`：94/94 通过，文章页 JS 预算仍在线内。
- `npm run lint:check`、`npm run check:i18n`：通过。

---

## 2026-07-04 浏览器 smoke 失败证据推进

### 已完成

- `scripts/browser-smoke.mjs` 新增失败 artifact 捕获：每个路由和交互用例失败时，在关闭页面/上下文前保存截图、当前 DOM HTML 和 JSON 元数据。
- artifact 默认写入 `temp/browser-smoke/`，支持通过 `BROWSER_SMOKE_ARTIFACT_DIR` 指定目录；JSON 记录 label、URL、捕获时间、失败错误和 runtime errors。
- `tests/workflows.test.mjs` 新增源码契约断言，锁定截图、HTML、JSON 元数据和失败日志提示，防止 browser smoke 回退到只有一行错误。
- 更新 `docs/suggestions/module-reviews/browser-visual-smoke-testing.md`、`docs/suggestions/final-analysis-report-2026-07-03.md` 和 README，将 FINAL-08 标记为第一阶段已修复；CI 上传 artifact 和 trace/video 仍作为后续增强。

### 本轮验证

- `node --test tests/workflows.test.mjs`：15/15 通过。
- `npm run test:browser-smoke`：通过，正常通过路径不产生失败 artifact 噪音。

---

## 2026-07-04 内容新鲜度信号推进

### 已完成

- `scripts/build.mjs` 的文章 sitemap `lastmod` 已改为优先使用 `post.modified || post.date`，避免 Article JSON-LD 与 sitemap 更新时间信号分裂。
- `src/templates/post.mjs` 新增 `.updated-time` 渲染：单篇页和文章列表面板仅在 `modified !== date` 时显示“更新于 ...”，并通过内联英文文案支持语言切换。
- `search-index.json` 的文章和文章章节条目新增 `modified` 与 `freshness` 字段；`js/search.js` 搜索结果日期徽标会显示“更新/发布”语义，英文模式显示 “Updated / Published”。
- 补充 `dyn.search.date.updated` / `dyn.search.date.published` 英文字典，并刷新根目录静态构建产物。
- 更新 `docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`，将优先级 1-3 标记为已落地；现有文章未声明真实 `modified` 时不伪造更新时间。
- `buildRssItems()` 新增 `majorUpdate: true` 显式策略，仅重大更新才使用 `modified` 作为 RSS `pubDate`，普通复核不打扰订阅器排序。
- 构建期新增 `status` / `reviewed` / `contextNote` 内容状态模型；`lowcode-schema-codegen`、`activiti-workflow-engine`、`finance-saas-backend` 已标记为 `historical` 并显示复核提示。
- 单篇文章页新增 `.post-maintenance`，提供 GitHub 源码链接和携带 slug 的反馈入口；`feedback.js` 会从 `?topic=post&slug=...` 预填文章反馈上下文。

### 本轮验证

- `node --test tests/build-extra.test.mjs tests/templates-extended.test.mjs tests/search-behavior.test.mjs`：83/83 通过。
- `node --test tests/build-extra.test.mjs tests/templates-extended.test.mjs tests/feedback.test.mjs tests/css.test.mjs`：132/132 通过。
- `node --test tests/performance.test.mjs`：18/18 通过。
- `npm run build`：通过，刷新 6 篇文章、sitemap 和 search-index。

---

## 2026-07-04 生产验证页面资源护栏推进

### 已完成

- `scripts/validate-production.mjs` 新增 `checkLocalResourceReferences()`，扫描所有 HTML 中的本地 CSS/JS 引用是否存在。
- 生产验证额外读取 `src/page-assets.mjs` 的 `pageAssetUrls()`，把 `PAGE_ASSETS` 中的页面级资源也纳入存在性检查。
- 当前生产验证会检查 21 个 HTML 页面和 2 个 manifest 资源；通过项从 74 增加到 75。
- 扩展 `tests/workflows.test.mjs`，锁定 `validate:production` 对 HTML 引用、`PAGE_ASSETS` 和检查调用顺序的覆盖。

### 本轮验证

- `node --test tests/workflows.test.mjs`：15/15 通过。
- `npm run validate:production`：75/75 通过，新增“本地 CSS/JS 资源完整：21 个页面和 2 个 manifest 资源已检查”。
- `npm run quality:baseline`：通过，当前 13/13 命令通过、861/861 测试通过、coverage line 94.21% / branch 79.23% / funcs 92.11%。

---

## 2026-07-04 页面资源派生 PWA 预缓存推进

### 已完成

- `src/page-assets.mjs` 新增 `pageAssetUrls()`，统一拉平页面级 `styles`、`scripts` 和额外 `assets`，并去重返回本地资源 URL。
- `src/pwa-precache.mjs` 新增 `PWA_PRECACHE_PAGE_ASSETS`，从 `PAGE_ASSETS` 自动派生页面级离线资源；当前预缓存从 16 个 URL 扩展到 19 个 URL，新增 `/css/tools.css`、`/css/trust.css` 和按需助手样式 `/css/assistant.css`。
- `scripts/check-pwa-precache.mjs` 现在报告 `Page asset URLs covered` 和 `Missing page asset URLs`，并在页面资源未进入预缓存时失败。
- `scripts/quality-baseline-core.mjs` 解析并校验页面资源覆盖指标，防止质量基线缺少该字段。
- Service Worker 版本递增到 `2026-07-04-2`，并重新生成根目录 `service-worker.js`。
- 扩展 PWA 预缓存、模板资源、工作流和质量基线测试，锁定页面资源 manifest 到 PWA 预缓存的派生关系。

### 本轮验证

- `node --test tests/pwa-precache.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs tests/templates-extended.test.mjs tests/service-worker-generation.test.mjs tests/pwa-cache-policy.test.mjs`：72/72 通过。
- `npm run check:pwa-precache`：通过，19 个预缓存 URL / 19 个 Service Worker URL / 2 个页面资源覆盖 / 0 缺失页面资源 / 0 不可缓存。

---

## 2026-07-04 单篇文章离线阅读状态推进

### 已完成

- 单篇文章页新增默认隐藏的 `.post-offline-status` 状态徽标，由 `data-pwa-article-status` 标记。
- `js/pwa-register.js` 在 Service Worker 控制页面后显示“此文章已可离线阅读”，离线打开已缓存文章时显示“正在离线阅读此文章”。
- 状态文案响应 `online`、`offline`、`controllerchange` 和 `cwl:langchange`，英文模式显示 “This article is available offline” / “Reading this article offline”。
- 补充 `dyn.pwa.articleReady` / `dyn.pwa.articleOffline` 英文字典和 `.post-offline-status` 样式。
- 扩展 PWA smoke，真实浏览器访问 `/post/manage-system/`，验证在线文章状态、英文切换、离线缓存文章状态和既有离线 fallback/network-only 边界。
- 扩展模板、CSS、PWA artifact、质量基线和工作流测试，防止状态节点或 smoke 覆盖被移除。

### 本轮验证

- `node --test tests/templates.test.mjs tests/css.test.mjs tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs`：76/76 通过。
- `npm run lint:check`：通过。
- `npm run build`：通过，刷新 6 篇单篇文章页。
- `npm run check:generated`、`npm run check:i18n`、`npm run check:service-worker`：通过。
- `npm run test:pwa-smoke`：通过，新增 `article offline status visible after online visit` 和 `cached article shows offline reading status`。

---

## 2026-07-04 相关文章推荐原因推进

### 已完成

- 扩展 `scripts/build.mjs` 的 `relatedPosts()`：从中文标签重叠扩展为中文标签、英文标签、可选 `series/domains/stack` 元数据和 `eyebrow` 主题信号综合计分。
- 推荐结果新增 `relatedReason` / `relatedReasonEn`，保留共同标签优先、同分按日期更新优先的原有排序直觉。
- 调整 `src/templates/post.mjs`，在相关文章卡片中展示推荐原因，并通过内联 `data-i18n-en` 支持英文模式。
- 为 `.related-reason` 增加紧凑徽标样式；构建后的单篇文章页已输出“共同标签：Java、Spring Boot / Shared tags: Java, Spring Boot”等原因。
- 扩展 `tests/build-extra.test.mjs`、`tests/templates.test.mjs`、`tests/css.test.mjs` 和 `tests/workflows.test.mjs`，锁定评分信号、模板渲染、样式选择器和 browser smoke 覆盖。
- 更新搜索专题与 README，MR-DISCOVERY-05 标记为第一阶段已完成。

### 本轮验证

- `node --test tests/build-extra.test.mjs tests/build-deep.test.mjs tests/build-extended.test.mjs tests/templates.test.mjs tests/css.test.mjs`：169/169 通过。
- `node --test tests/build-extra.test.mjs tests/templates.test.mjs tests/css.test.mjs`：86/86 通过。
- `npm run build`：通过，刷新单篇文章页相关文章推荐原因。
- `npm run check:generated`：通过。
- `npm test`：848/848 通过。
- `npm run quality:baseline`：通过，13/13 命令通过；848/848 测试通过；coverage line 94.25% / branch 79.60% / funcs 92.26%。

---

## 2026-07-04 搜索结果命中解释力推进

### 已完成

- 调整 `js/search.js`，开始消费 Fuse `matches`，为搜索结果展示“命中正文 / 命中章节 / Matched body”等命中字段原因。
- 搜索摘要片段优先来自实际匹配字段，并使用 Fuse 返回的范围信息高亮；没有 matches 的降级路径会回退到精确字段扫描。
- 补充 `dyn.search.reason` 和字段名称英文 i18n 文案，保持中英文搜索弹窗解释一致。
- 为 `.search-result-reason` 增加轻量样式，和现有结果类型、日期徽标保持一致。
- 扩展 `tests/search-behavior.test.mjs` 和 `scripts/browser-smoke.mjs`，锁定正文、章节与英文模式下的命中原因显示。
- 更新搜索专题与 README，MR-DISCOVERY-04 标记为第一阶段已完成。

### 本轮验证

- `node --test tests/search-behavior.test.mjs tests/js-behavior.test.mjs tests/workflows.test.mjs`：58/58 通过。
- `npm run lint:check`：通过。
- `npm run test:browser-smoke`：通过，真实浏览器覆盖搜索结果命中原因。

---

## 2026-07-04 文章列表页搜索口径对齐推进

### 已完成

- 扩展 `js/blog.js` 的本地搜索 haystack：除标题、摘要、标签外，新增文章正文、H2/H3 章节标题和 `data-post-slug`。
- 保持既有 `?q=` URL 同步、标签筛选、年份分组计数、空状态和 J/K 导航逻辑不变。
- 扩展 `tests/blog.test.mjs`，覆盖 `ESClient` 和 `Web Worker` 这类只出现在正文/章节中的长尾词。
- 扩展 `scripts/browser-smoke.mjs`，真实浏览器访问 `/post/` 后输入长尾词，确认文章列表过滤和 URL 查询参数同步生效。
- 更新搜索专题与 README，MR-DISCOVERY-03 标记为第一阶段已完成。

### 本轮验证

- `node --test tests/blog.test.mjs tests/workflows.test.mjs`：32/32 通过。
- `npm run lint:check`：通过。
- `npm run test:browser-smoke`：通过，新增 `/post/ search interactions`。

---

## 2026-07-04 静态页面章节级搜索推进

### 已完成

- 为 `SEARCH_PAGES` 增加显式 `searchSections` 数据，构建时生成 `page-section` 搜索条目，第一阶段覆盖工具箱、Trust Center 和 AI 页面内高价值功能区。
- `search-index.json` 当前包含 6 篇文章、51 个文章章节、11 个静态页章节和 12 个页面，当前为 123,287 字符 / 216,563 UTF-8 bytes，低于 500KB 文件性能预算。
- 搜索 UI 将 `page-section` 与 `post-section` 统一显示为“章节/Section”，并展示页面标题、章节标题和 hash 路径。
- 工具箱支持 `/tools/#tool-tab-*` 深链接，页面加载或 hashchange 时自动激活对应工具面板；`/ai/#nav` 已补真实锚点。
- Browser smoke 新增 `Cron` 搜索交互，确认从全局搜索跳转 `/tools/#tool-tab-cron` 后 Cron 面板已激活。

### 本轮验证

- `node --test tests/build-extra.test.mjs tests/search-behavior.test.mjs tests/js-behavior.test.mjs tests/workflows.test.mjs`：95/95 通过。
- `npm run lint:check`：通过。
- `npm run build`、`npm run check:generated`、`npm run check:i18n`：通过。
- `npm test`：847/847 通过。
- `npm run test:browser-smoke`：通过，覆盖文章章节 `BPMN` 和工具箱章节 `Cron` 搜索跳转。
- `npm run quality:baseline`：通过，13/13 命令通过；847/847 测试通过；coverage line 94.37% / branch 79.92% / funcs 92.11%。

---

## 2026-07-04 Service Worker 生成化治理推进

### 已完成

- 新增 `src/service-worker-template.mjs`，从 `src/pwa-precache.mjs` 和 `src/pwa-cache-policy.mjs` 渲染根作用域 `service-worker.js`，保留现有 `VERSION`、预缓存、缓存策略和离线 fallback 行为。
- 新增 `scripts/generate-service-worker.mjs`，提供 `npm run generate:service-worker` 写入模式和 `npm run check:service-worker` 只读漂移检查。
- 调整 `scripts/build.mjs`：`build --out` 不再复制根目录 SW，而是用同一模板生成输出产物，避免临时构建和根目录产物分叉。
- 将 `check:service-worker` 接入 `check:readonly`、GitHub Actions CI、`quality:baseline` 和质量基线完整性校验。
- 新增 `tests/service-worker-generation.test.mjs`，并扩展 `tests/workflows.test.mjs` / `tests/quality-baseline.test.mjs`，锁定生成器、CI 顺序和基线 parser。

### 本轮验证

- `npm run generate:service-worker`：通过，刷新根目录 `service-worker.js`。
- `node --test tests/service-worker-generation.test.mjs tests/pwa-cache-policy.test.mjs tests/pwa-precache.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs`：36/36 通过。
- `npm run check:service-worker`：通过，根目录 SW 与模板一致。
- `npm run check:pwa-precache`：通过，16 个预缓存 URL / 16 个 Service Worker URL / 0 缺失 / 0 额外 / 0 不可缓存。
- `npm run build` 与 `npm run check:generated`：通过，81 个临时构建产物无漂移。
- `npm test`：847/847 通过。
- `npm run quality:baseline`：通过，当前质量基线 13/13 命令通过、847/847 测试通过、coverage line 94.37% / branch 79.92% / funcs 92.11%。

---

## 2026-07-04 搜索离线错误态体验推进

### 已完成

- 调整 `js/search.js` 的搜索索引加载失败处理，区分离线且索引未缓存、索引 JSON 结构异常、HTTP 暂时不可用和通用加载失败。
- 补充 `dyn.search.offlineUncached`、`dyn.search.indexInvalid`、`dyn.search.indexUnavailable` 英文 i18n 文案。
- 新增 `tests/search-behavior.test.mjs`，用 JSDOM 覆盖中英文离线未缓存提示、异常索引提示，以及索引成功加载后的结果渲染路径。
- 刷新 `docs/suggestions/evidence/current-quality-baseline.json`，质量基线现记录 12/12 命令通过、837/837 测试通过。

### 本轮验证

- `node --test tests/search-behavior.test.mjs tests/search-loader-behavior.test.mjs tests/js-behavior.test.mjs`：51/51 通过。
- `npm run lint:check`：通过。
- `npm run check:i18n`：通过，21 个 HTML / 965 个引用 / 258 个唯一 key / 0 缺失。
- `npm test`：837/837 通过。
- `npm run quality:baseline`：通过，刷新当前质量基线 evidence。
- `npm run check:readonly`：通过，837/837 测试通过，所有只读质量门禁通过。
- `npm run test:http-smoke:full`：14/14 路由通过。
- `npm run test:browser-smoke:full`：桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互通过。

---

## 2026-07-04 搜索索引召回率与解释力推进

### 已完成

- 将 `scripts/build.mjs` 的文章搜索正文预算从硬编码 600 字提升为集中常量 `SEARCH_BODY_LIMIT = 3200`，覆盖长文中更靠后的技术关键词。
- 重新构建根目录 `search-index.json`，当前已扩展到 6 篇文章、51 个文章章节、11 个静态页章节和 12 个页面，包含 `ESClient`、`Web Worker`、`Galaxy`、`Maven`、`BPMN`、`Cron` 等此前容易漏召回的长尾词。
- 调整 `js/search.js` 的结果摘要选择逻辑：当查询词只出现在正文或 path 中时，摘要片段优先展示包含命中词的字段，而不是始终显示文章 summary。
- 扩展 `tests/build-extra.test.mjs`，锁定搜索索引体积 < 125KB、长尾关键词存在、单篇正文不超过 3200 字且不再全部截断在 600 字。
- 扩展 `tests/search-behavior.test.mjs`，覆盖正文命中时结果 snippet 展示命中词。

### 本轮验证

- `node --test tests/search-behavior.test.mjs tests/build-extra.test.mjs tests/performance.test.mjs`：59/59 通过。
- `npm run build`：通过，根目录生成产物已更新。
- `npm run lint:check`：通过。
- `npm run check:generated`：通过，81 个生成产物无漂移。
- `npm test`：837/837 通过。
- `npm run quality:baseline`：通过，当前质量基线 12/12 命令通过、837/837 测试通过、coverage line 94.43% / branch 81.07% / funcs 92.29%。

---

## 2026-07-04 PWA 预缓存一致性治理推进

### 已完成

- 新增 `src/pwa-precache.mjs`，把 `/`、`/offline.html`、manifest、favicon、核心 CSS、Font Awesome 字体和公共布局核心脚本统一为 16 个保守预缓存 URL。
- 将 `src/templates/layout.mjs` 的 `CORE_SCRIPTS` 导出给预缓存契约复用，减少布局脚本和 Service Worker 预缓存脚本双写漂移。
- 新增 `scripts/check-pwa-precache.mjs` 与 `npm run check:pwa-precache`，加载 `service-worker.js` 暴露的 `PRECACHE_URLS`，校验源码契约、Service Worker、文件存在性、Font Awesome 字体引用和缓存策略一致。
- 新增 `tests/pwa-precache.test.mjs`，并收紧 `tests/pwa-cache-policy.test.mjs`，要求 Service Worker 预缓存清单等于源码清单。
- 将 `check:pwa-precache` 接入 `check:readonly`、GitHub Actions CI、质量基线 artifact 和质量基线完整性校验。

### 本轮验证

- `npm run check:pwa-precache`：通过，16 个预缓存 URL / 16 个 Service Worker URL / 0 缺失文件 / 0 缺失 SW 条目 / 0 额外 SW 条目 / 0 不可缓存 URL / 2 个字体 URL 覆盖。
- `node --test tests/pwa-precache.test.mjs tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs`：31/31 通过。
- `npm run quality:baseline`：通过，刷新 `docs/suggestions/evidence/current-quality-baseline.json`，当前 12/12 命令通过。
- `npm run check:readonly`：通过，837/837 测试通过。
- `npm run test:http-smoke:full`：14/14 路由通过。
- `npm run test:browser-smoke:full`：桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互通过。
- `npm run test:pwa-smoke`：通过，验证 SW 控制、缓存导航离线可用、未缓存导航回退 `/offline.html`、relay 数据离线不从缓存返回。

---

## 2026-07-04 PWA 离线搜索与缓存清理回归推进

### 已完成

- 扩展 `scripts/pwa-smoke.mjs`，在真实浏览器中验证 `/search-index.json` 未缓存时离线请求失败、在线加载后离线请求可从 Service Worker 缓存返回，并通过临时 bumped `VERSION` 的 Service Worker 验证浏览器级升级清理旧缓存。
- 扩展 `tests/pwa-cache-policy.test.mjs`，用 Service Worker activate 事件 fixture 验证旧 `cwlblog-*` 缓存会清理，当前版本 precache/runtime 和其他应用缓存不会被删除。
- 扩展 `parsePwaSmokeOutput()` 与质量基线校验，要求 PWA smoke artifact 记录 `searchIndexUncached`、`searchIndexCached` 和 `serviceWorkerUpgrade` 为 true。
- 更新 `tests/workflows.test.mjs`，防止 PWA smoke 未来丢失搜索索引离线矩阵。

### 本轮验证

- `node --test tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs`：27/27 通过。
- `npm run test:pwa-smoke`：通过，验证 SW 控制、搜索索引未缓存离线失败、搜索索引已缓存离线可用、缓存导航离线可用、未缓存导航回退 `/offline.html`、relay 动态数据离线不从缓存返回，以及浏览器级 Service Worker 升级清理旧 `cwlblog-*` 缓存。
- `npm run quality:baseline`：通过，刷新 `docs/suggestions/evidence/current-quality-baseline.json`，当前 12/12 命令通过。
- `npm run check:readonly`：通过，837/837 测试通过。
- `npm run test:http-smoke:full`：14/14 路由通过。
- `npm run test:browser-smoke:full`：重跑通过，覆盖桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互；首次运行曾在移动 `/post/` load 等待上出现一次 30s 超时，重跑未复现。

---

## 2026-07-04 SEO/feed 质量报告推进

### 已完成

- 新增 `scripts/check-seo-feed.mjs` 与 `npm run check:seo-feed`，统一扫描 sitemap、3 个 RSS feed、committed HTML、canonical、Open Graph、Twitter Card、JSON-LD 和 RSS 自动发现信号。
- 新增 `npm run seo:report`，输出机器可读证据到 `docs/suggestions/evidence/current-seo-feed-report.json`。
- 在公共模板中输出 RSS `rel="alternate"`；默认全站 `/index.xml`，文章列表页额外输出 `/post/index.xml`，时间归档页额外输出 `/categories/index.xml`。
- 为手写页 `/`、`/about/`、`/contact/`、`/editor/`、`/overleaf/` 补齐全站 RSS 自动发现。
- 将 `check:seo-feed` 接入 `check:readonly`、GitHub Actions CI 和质量基线 artifact。

### 本轮验证

- `npm run check:seo-feed`：通过，21 个 HTML / 19 个 indexable 页面 / 19 个 sitemap URL / 3 个 RSS feed / 每个 feed 6 个 item / 21 个 feed alternate / 20 个 JSON-LD block / 0 违规。
- `node --test tests/seo-feed.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs tests/templates-extended.test.mjs`：56/56 通过。
- `npm run check:generated`：通过，比较 81 个临时构建产物文件。
- `npm run seo:report`：通过并刷新 SEO/feed evidence。

---

## 2026-07-04 i18n 覆盖治理推进

### 已完成

- 新增 `scripts/check-i18n-coverage.mjs` 与 `npm run check:i18n`，扫描 committed HTML 的 `data-i18n`、`data-i18n-html`、`data-i18n-aria`、`data-i18n-ph`、`data-i18n-title` 和 `body[data-i18n-page]` head key。
- 检查器复用真实 `js/i18n.js` 运行时判断英文词典是否命中，并把 `data-i18n-en*` 内联英文视为该元素的显式覆盖来源。
- 补齐 `head.title.offline` / `head.desc.offline`、`toc.aria` / `toc.toggle` / `toc.title`、`trust.stats.aria` 英文字典。
- 调整鉴赏页模板，让 Codex、Claude、AI、Java、Python 等“英文同原文”的专有名词也显式输出 `data-i18n-en`，避免和真实漏翻混淆。
- 将 `check:i18n` 接入 `check:readonly`、GitHub Actions CI 和质量基线 artifact，当前基线记录 21 个 HTML、965 个 i18n 引用、258 个唯一 key、0 个缺失。

### 本轮验证

- `npm run check:i18n`：通过，21 个 HTML / 965 个引用 / 258 个唯一 key / 0 缺失。
- `node --test tests/i18n-coverage.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs tests/templates.test.mjs`：31/31 通过。
- `npm run check:generated`：通过，比较 81 个临时构建产物文件。
- `npm run quality:baseline`：通过，刷新 `docs/suggestions/evidence/current-quality-baseline.json`。
- `npm run check:quality-baseline`：通过。
- `npm run check:readonly`：通过，837/837 测试通过。

---

## 2026-07-04 质量基线证据治理推进

### 已完成

- 新增 `scripts/check-quality-baseline.mjs`，只读校验 `docs/suggestions/evidence/current-quality-baseline.json` 的生成时间、结构、必需命令、release gate 状态、测试数量、覆盖率、HTTP/browser smoke 和 production 指标。
- 在 `scripts/quality-baseline-core.mjs` 中抽出 `validateQualityBaseline()`，并为新鲜 artifact、过期 artifact、缺少命令和缺失 parser 指标补充可执行单元测试。
- 新增 `npm run check:quality-baseline`，并接入 `check:readonly` 与 GitHub Actions CI 的 build 前门禁。
- 更新质量基线治理专题与 README 索引，将 QBG-05 标记为第一阶段部分修复。

### 本轮验证

- `node --test tests/quality-baseline.test.mjs tests/workflows.test.mjs`：16/16 通过。
- `npm run check:quality-baseline`：通过，当前 artifact 新鲜且关键指标完整。

---

## 2026-07-04 Full Smoke 分层覆盖推进

### 已完成

- 在 `src/config.mjs` 中新增 `FULL_SMOKE_ROUTES`，由 `STATIC_PAGES` 自动派生完整静态页集合。
- 为 `scripts/http-smoke.mjs` 和 `scripts/browser-smoke.mjs` 增加 `--scope critical|full` / `SMOKE_SCOPE=full`，默认保持 critical 快速覆盖，full 覆盖完整静态页。
- 新增 `npm run test:http-smoke:full` 与 `npm run test:browser-smoke:full`，并补 `tests/workflows.test.mjs` 契约守卫。
- 为 `SEARCH_PAGES` 增加链接反查测试，验证搜索索引页面路径真实存在，并保护 `/ai/#nav` hash route 对应到 AI 导航 Tab。

### 本轮验证

- `npm run test:http-smoke:full`：14/14 路由通过，覆盖 13 个静态页和 `/404.html`。
- `npm run test:browser-smoke:full`：桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互通过。
- `node --test tests/links.test.mjs`：6/6 通过。

---

## 2026-07-04 Vendor 供应链清单推进

### 已完成

- 新增 `data/vendor-manifest.json`，记录 5 个 `js/vendor/*.js` 文件的来源、许可证、浏览器版本、字节数和 SHA-256。
- 新增 `scripts/check-vendor-manifest.mjs` 与 `npm run check:vendor`，只读校验 vendor 文件集合、大小和哈希。
- 将 `check:vendor` 接入 `check:readonly`、GitHub Actions CI 和 `quality:baseline` release gate。
- 新增 `tests/vendor-manifest.test.mjs`，验证 manifest 覆盖所有本地 vendor 脚本，并明确 `marked` 浏览器期/构建期版本差异与 `qrcode.min.js` 无版本 banner 状态。

### 本轮验证

- `npm run check:vendor`：通过。
- `node --test tests/vendor-manifest.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs`：18/18 通过。

---

## 2026-07-04 生产验证图片策略推进

### 已完成

- 扩展 `scripts/validate-production.mjs`，从只检查首页/文章列表图片 alt，升级为递归扫描全站 HTML。
- 新增图片策略：检查 `alt`、非 SVG/非隐藏图片 `width`/`height`、显式 `loading` 策略和 `decoding="async"`，并允许首屏关键图使用 `fetchpriority="high"`。
- 补充 `tests/workflows.test.mjs` 守卫，防止生产验证回退到只扫描 `index.html`。

### 本轮验证

- `node --check scripts/validate-production.mjs`：通过。
- `node --test tests/workflows.test.mjs`：11/11 通过。
- `npm run validate:production`：72/72 通过，0 失败、0 警告。

---

## 2026-07-04 Robots 公开资源抓取策略推进

### 已完成

- 调整 `scripts/build.mjs` 的 `buildRobots()`，移除 `Disallow: /js/vendor/` 和 `Disallow: /css/fontawesome/`。
- 在 `robots.txt` 中显式允许 `/js/`、`/css/` 和 `/webfonts/`，避免公开渲染资源被遵守 robots 的爬虫阻断。
- 更新 `tests/build-extra.test.mjs`，断言公开渲染资源不再被屏蔽。
- 运行 `npm run build` 刷新根目录 `robots.txt`。

### 本轮验证

- `node --test tests/build-extra.test.mjs tests/build.test.mjs`：38/38 通过。
- `npm run test:http-smoke`：7/7 路由通过。
- `npm run check:generated`：通过，比较 78 个临时构建产物文件。

---

## 2026-07-04 第三方资源提示按需化推进

### 已完成

- 将 `src/templates/layout.mjs` 中的第三方资源提示拆成全站低成本 `dns-prefetch` 与页面能力型 `preconnect`。
- 为文章页和文章列表页设置 `resourceHintCapabilities: ["comments"]`，只在实际加载 Giscus 评论脚本的页面预连 `https://giscus.app`。
- 从手写静态页移除无条件 Giscus/Buttondown `preconnect`，保留 DNS 预解析。
- 在 `js/subscribe.js` 中改为订阅邮箱获得焦点、订阅弹窗打开或提交前动态插入一次 `https://buttondown.com` preconnect。
- 更新模板、性能和订阅行为测试，防止回退到“所有页面静态预连所有第三方”的旧策略。

### 本轮验证

- `node --test tests/performance.test.mjs tests/templates.test.mjs tests/share-subscribe-feedback-deep.test.mjs`：49/49 通过。
- `npm run check:generated`：通过，比较 78 个临时构建产物文件。
- `npm run lint:check`：通过。

---

## 2026-07-04 路由级资源预算推进

### 已完成

- 在 `tests/performance.test.mjs` 中新增 `routeBudget()`，从真实 HTML 抽取本地 CSS、JS 和图片引用，统计 HTML + 本地资源的 raw/gzip 体积。
- 为 `/`、`/post/rule-engine-alerts/` 和 `/tools/` 设置页面类型预算，覆盖总 raw/gzip、JS raw/gzip 和本地资源数量。
- 保留既有 CSS 路由预算，新预算补上“单文件都达标但路由总成本膨胀”的回归防线。

### 本轮验证

- `node --test tests/performance.test.mjs`：18/18 通过。
- `npm run lint:check`：通过。

---

## 2026-07-04 静态路由构建产物完整性推进

### 已完成

- 在 `tests/build.test.mjs` 中新增 `temporary build output covers every registered static page`。
- 测试会运行 `node scripts/build.mjs --out <temp>`，并从 `STATIC_PAGES` 推导每个静态路由的 `index.html` 输出路径逐一检查。
- 与既有“已提交静态页 index artifact”测试形成双层保护：一个管提交产物，一个管源码临时构建产物。

### 本轮验证

- `node --test tests/build.test.mjs`：4/4 通过。
- `npm run check:generated`：通过，比较 78 个临时构建产物文件。

---

## 2026-07-04 PWA 缓存安全矩阵推进

### 已完成

- 新增 `src/pwa-cache-policy.mjs`，定义 `PWA_CACHE_POLICY_MATRIX` 和 `classifyPwaRequest()`。
- 策略覆盖导航、静态资源、搜索索引、动态数据、敏感/外部请求五类：导航 `network-first`、静态资源 `cache-first`、搜索索引 `stale-while-revalidate`、relay/API/未知 endpoint `network-only`。
- 默认拒绝缓存非 GET、跨域请求、敏感 query、敏感 header 和未知同源请求，为后续 Service Worker 注册提供安全边界。
- 新增 `tests/pwa-cache-policy.test.mjs`，把 PWA-03/PWA-05 的缓存矩阵和禁止缓存范围测试化。

### 本轮验证

- `node --test tests/pwa-cache-policy.test.mjs tests/workflows.test.mjs`：16/16 通过。
- `npm run lint:check`：通过。

---

## 2026-07-04 PWA 离线兜底与保守 Service Worker 推进

### 已完成

- 新增 `/offline.html`，作为 noindex 的离线 fallback，保留主导航、搜索入口、订阅页脚和回到首页/文章列表的恢复路径。
- 新增根作用域 `/service-worker.js`，采用 `network-first` 导航、`cache-first` 静态资源、`stale-while-revalidate` 搜索索引和 `network-only` 敏感/外部/动态请求的保守策略。
- 新增 `/js/pwa-register.js`，仅在 HTTPS 或 localhost/127.0.0.1/::1 下注册 Service Worker，避免非安全上下文噪声。
- `scripts/build.mjs` 会把 `offline.html` 和 `service-worker.js` 复制到临时构建输出，公共模板和手写页都引用 PWA 注册脚本。
- `scripts/http-smoke.mjs` 增加 PWA artifact 检查，验证 `/offline.html`、`/service-worker.js` 和 `/js/pwa-register.js` 可达。
- `tests/pwa-cache-policy.test.mjs` 会在 VM 中加载 Service Worker，断言 SW 策略与 `src/pwa-cache-policy.mjs` 对同一批请求的分类完全一致。

### 本轮验证

- `node --test tests/pwa-cache-policy.test.mjs tests/templates.test.mjs tests/build.test.mjs tests/workflows.test.mjs`：32/32 通过。
- `npm test`：837/837 通过。
- `npm run check:readonly`：通过；质量基线已纳入 `npm run test:pwa-smoke`。
- `npm run test:http-smoke:full`：14/14 路由通过，并检查 PWA offline/SW artifact。
- `npm run test:browser-smoke:full`：桌面 14 条路由、移动 13 个静态页和 `/tools/` 核心交互通过。

---

## 2026-07-03 22:40 第一轮自主复查报告

### 已分析的模块

| 模块 | 文件/范围 | 结果 |
|------|-----------|------|
| 项目结构与脚本 | `package.json`, `scripts/*.mjs`, `src/templates/*.mjs` | 确认 Node ESM 静态站点生成器，构建产物输出到根目录 |
| 安全热点 | `js/assistant.js`, `js/tools.js`, `js/gesture.js`, `src/templates/tools.mjs` | 发现 1 个高危 key 回归、2 个中危隐私/供应链问题 |
| 工具箱与手势模块 | `tools/index.html`, `js/tools.js`, `js/gesture.js` | 发现 runtime 加载竞态、模型冷启动和隐私文案问题 |
| 性能与体积 | `css/coder.css`, `css/tools.css`, `css/trust.css`, `tools/index.html`, `post/index.html`, `js/*.js` | `coder.css` 已拆回 129,973 bytes，工具箱/博客列表 HTML 均约 110KB，新增路由级 CSS raw/gzip 预算 |
| 测试与覆盖率 | `tests/*.test.mjs` | 731/731 通过，覆盖率总体 lines 94.32%、branches 76.28%、functions 91.70% |
| 依赖安全 | `npm audit`, `npm outdated` | 0 漏洞；ESLint 8.57.1 可升级到 9.39.4 |

### 发现的问题数量和等级分布

| 等级 | 数量 | 代表问题 |
|------|------|----------|
| 高 | 1 | `assistant.js` 仍在前端运行时拼接并使用默认体验 API Key |
| 中 | 9 | API Tester 保存敏感 header、手势 CDN 供应链、生产验证写产物、runtime 加载竞态、体积预算压力等 |
| 低 | 5 | ESLint warning、ESLint 9 迁移前置工作、relay 覆盖率缺口、模型状态面板等 |

### 新增/更新的建议文档

- `docs/suggestions/security-audit.md`
- `docs/suggestions/bugs-and-risks.md`
- `docs/suggestions/performance-bottlenecks.md`
- `docs/suggestions/code-quality.md`
- `docs/suggestions/devex-improvements.md`
- `docs/suggestions/tech-debt.md`
- `docs/suggestions/ux-improvements.md`
- `docs/suggestions/new-features.md`
- `docs/suggestions/module-reviews/tools-gesture-and-api.md`
- `docs/suggestions/README.md`
- `docs/suggestions/health-score.md`

### 当前进度

第一轮已完成“架构理解 → 只读验证 → 本地运行冒烟 → 核心模块安全/性能/工程化复查 → 文档落地”。后续轮次已开始按优先级落地源码、测试和文档修复。

### 下一步分析计划

1. 深挖 `assistant.js`：会话持久化、请求取消、流式解析、i18n 和默认 key 移除方案。
2. 深挖 `tools-core.js`：正则、JSONPath、diff、cron 等工具的边界输入与性能上限。
3. 深挖 CSS：核心 CSS 已拆回 129,973 bytes，继续识别助手样式、工具基础样式和路由级预算扩展机会。
4. 继续维护 README 索引与健康度评分。

---

## 2026-07-03 23:20 第二轮自主复查报告

### 已分析的模块

| 模块 | 文件/范围 | 结果 |
|------|-----------|------|
| AI 助手核心 | `js/assistant.js:31-1568` | 模式偏好不恢复、SSE 尾部事件丢失、超时/停止文案混淆、对话持久化核心风险均已修复并补测试 |
| AI 助手测试 | `tests/assistant.test.mjs`, `tests/assistant-deep.test.mjs` | 发现默认体验 key 行为被测试固化，但缺少模式恢复和 SSE 尾部事件测试 |
| 工具核心库 | `js/tools-core.js:204-1293` | UUID 弱随机 fallback 和随机数用途提示已修复；Cron 典型无解日期慢路径已短路 |
| 工具核心测试 | `tests/tools.test.mjs`, `tests/tools-core-deep.test.mjs`, `tests/templates.test.mjs` | 已补 Cron 无解表达式性能预算、OR 语义保护、UUID 安全随机失败路径和随机数普通伪随机提示测试 |
| 行为探测 | 直接调用 / 浏览器触发 `CWLToolsCore.parseCronExpression()` | 历史基线 `0 0 31 2 *` 约 127.57ms；当前 Playwright mobile 约 0.7ms |

### 发现的问题数量和等级分布

| 范围 | 高 | 中 | 低 | 总计 |
|------|----|----|----|------|
| 主建议文档新增/更新 | 0 | 7 | 3 | 10 |
| 模块深度分析新增 | 1 | 4 | 5 | 10 |
| **合计** | **1** | **11** | **8** | **20** |

### 新增/更新的建议文档

- `docs/suggestions/bugs-and-risks.md`
- `docs/suggestions/security-audit.md`
- `docs/suggestions/performance-bottlenecks.md`
- `docs/suggestions/ux-improvements.md`
- `docs/suggestions/new-features.md`
- `docs/suggestions/devex-improvements.md`
- `docs/suggestions/tech-debt.md`
- `docs/suggestions/module-reviews/assistant-deep-dive.md`
- `docs/suggestions/module-reviews/tools-core.md`
- `docs/suggestions/README.md`
- `docs/suggestions/health-score.md`

### 当前进度

第二轮已完成“AI 助手深挖 → 工具核心边界审计 → Cron 行为探测 → 文档落地”。本轮仍未修改任何源码或配置，计划只提交 `/docs/suggestions` 下的文档变更。

### 下一步分析计划

1. 深挖 `css/coder.css`、`css/tools.css` 和 `css/trust.css` 的选择器归属边界、页面级拆分机会和移动端样式成本。
2. 对 `tools/index.html` 与 `src/templates/tools.mjs` 做结构/可访问性复查，补充工具箱专题建议。
3. 继续检查生成 HTML 的 SEO、JSON-LD、图片尺寸和可访问性一致性。
4. 维护 README 索引、健康度评分和优先级待办列表。

---

## 2026-07-03 23:55 第三轮自主复查报告

### 已分析的模块

| 模块 | 文件/范围 | 结果 |
|------|-----------|------|
| CSS 资源结构 | `css/coder.css`, `src/templates/layout.mjs` | `coder.css` 6,617 行，全站统一加载；工具箱和助手样式成本扩散到所有页面 |
| 工具页 DOM | `tools/index.html`, `src/templates/tools.mjs` | 初始 DOM 约 1,199 个元素，31 个工具面板中 30 个 hidden 但仍会被解析 |
| 页面 SEO/a11y | 19 个非临时 HTML 页面 | description、main、h1、skip link、OG image 全部具备；404 JSON-LD 后续修复轮已补齐 |
| 编辑器无障碍 | `editor/index.html`, `tools/index.html`, `src/templates/tools.mjs` | `textarea#markdown-input` 缺 label/aria 名称 |
| 图片稳定性 | `tools/index.html#qr-image`, `src/templates/tools.mjs:559` | 已补 width/height/loading/decoding 与方形比例约束 |

### 发现的问题数量和等级分布

| 范围 | 高 | 中 | 低 | 总计 |
|------|----|----|----|------|
| 主建议文档新增/更新 | 0 | 5 | 1 | 6 |
| 模块深度分析新增 | 0 | 2 | 2 | 4 |
| **合计** | **0** | **7** | **3** | **10** |

### 新增/更新的建议文档

- `docs/suggestions/performance-bottlenecks.md`
- `docs/suggestions/ux-improvements.md`
- `docs/suggestions/architecture-review.md`
- `docs/suggestions/devex-improvements.md`
- `docs/suggestions/module-reviews/css-analysis.md`
- `docs/suggestions/module-reviews/seo-analysis.md`
- `docs/suggestions/module-reviews/html-pages.md`
- `docs/suggestions/module-reviews/editor.md`
- `docs/suggestions/README.md`
- `docs/suggestions/health-score.md`
- `docs/suggestions/work-report.md`

### 当前进度

第三轮已完成“CSS 资源测量 → 工具页 DOM 审计 → 页面级 SEO/a11y JSDOM 扫描 → 文档落地”。仍未修改源码或配置。

### 下一步分析计划

1. 深挖 `js/gesture.js` 和 `js/galaxy.js` 的动画循环、资源释放和 reduced-motion 行为。
2. 复查生成内容和搜索索引的隐私/SEO 边界，关注摘要、标签和 sitemap image。
3. 继续维护 README、健康度、优先级待办并按轮次提交。

---

## 2026-07-03 AI 助手安全修复轮报告

### 已完成内容

| 项目 | 修复方案 | 验证 |
|------|----------|------|
| 前端默认体验 key | 删除 `OPENAI_DEFAULT_API_KEY` / `LLM_EXPERIENCE_KEYS` 与自动注入逻辑；默认 preset 空 key 不再请求 | `npm run test:assistant` 35/35 通过 |
| 默认模式与隐私边界 | `readMode()` 读取 `cwl.assistant.mode`，无偏好时默认 `site`；LLM 文案改为用户自填 key | `tests/assistant.test.mjs` 新增模式恢复断言 |
| SSE 尾包丢失 | `postStream()` flush `TextDecoder` 并消费剩余 `buffer`，支持 CRLF 事件分隔 | 新增无尾随空行 SSE 流测试，消息完整包含尾部 delta |
| 安全回归测试 | 源码扫描禁止默认 key 机制；运行时断言空 key 不调用 `fetch`，自填 key 才请求 | `tests/assistant.test.mjs` / `tests/assistant-deep.test.mjs` 通过 |
| 助手运行时按需加载 | 公共页面改为先加载 `assistant-loader.js`，点击 AI 入口或 fullscreen 深链时再注入完整 `assistant.js` | `tests/assistant-loader.test.mjs` 与模板/链接/构建测试通过 |
| Markdown 输入可访问名称 | 独立编辑器与工具箱内嵌编辑器补 `.sr-only` label 和英文 i18n | 相关模板/CSS/i18n 测试 84/84 通过 |
| QR 预览稳定性 | QR 结果图片补 `width` / `height` / `loading` / `decoding`，CSS 补 `aspect-ratio: 1` | `tests/templates-extended.test.mjs` / `tests/css.test.mjs` 通过 |
| Cron 典型无解表达式 | 提前识别不可能日期，避免两年分钟粒度扫描，并保护 day-of-month/day-of-week OR 语义 | `tests/tools-core-deep.test.mjs` 新增 `<50ms` 性能预算和 OR 语义测试 |
| 生产验证假失败 | 为 `validate-production.mjs` 内部测试执行设置专用输出缓冲，避免全量测试输出触发默认 `execFile` 上限 | `tests/workflows.test.mjs` 通过；`npm run validate:production` 35/35 通过 |
| 生产验证只读化 | 构建检查改为 `node scripts/build.mjs --out temp/production-validate`，产物检查指向临时目录并在结束后清理 | `tests/workflows.test.mjs` 通过；`npm run validate:production` 35/35 通过；`temp/production-validate` 已清理 |
| Relay 数据同步边界 | 商业源 `isCurrent` 使用布尔清洗，自定义 header 非法 JSON 在请求前失败；SQL/CLI/多源异常矩阵补测试 | `tests/relay.test.mjs` 8/8 通过 |
| 博客列表标题语义 | 文章目录标题改为 `.post-tree-title`，页面保留单一可见 `h1`，移动/桌面 browser smoke 均通过 | a11y/templates/css/browser smoke 通过 |

### 最新验证结果

| 命令 | 结果 |
|------|------|
| `npm run lint:check` | 通过，0 warnings |
| `npm test` / 生产验证内部测试 | 877/877 通过 |
| `npm run check:vendor` | 通过，5 个本地 vendor 文件哈希与清单一致 |
| `npm run check:generated` | 通过，临时构建产物与根目录生成文件一致 |
| `npm run check:suggestions-index` | 通过，README 生成索引、模块专题覆盖、本地 Markdown 文件级链接与 heading anchors 一致 |
| `npm run check:service-worker` | 通过，根目录 `service-worker.js` 与 `src/service-worker-template.mjs` 生成结果一致 |
| `npm run check:pwa-precache` | 通过，19 个预缓存 URL / 19 个 Service Worker URL / 2 个页面资源覆盖 / 0 缺失 / 0 额外 / 0 不可缓存 |
| `npm run test:coverage` | 877/877 通过；line 91.95% / branch 80.35% / funcs 90.35% |
| `npm run test:http-smoke` | 7/7 路由通过，覆盖 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/`、`/404.html` |
| `npm run test:http-smoke:full` | 14/14 路由通过，覆盖完整静态页清单和 `/404.html` |
| `npm run test:browser-smoke` | 通过，覆盖桌面 7 个关键路径、移动端 4 个关键路径、搜索命中原因、相关文章推荐原因，以及 `/tools/` JSON/随机数/Galaxy Canvas/UUID Clipboard/手势确认门闩交互 |
| `npm run test:browser-smoke:full` | 通过，覆盖桌面 14 条路由、移动端 13 个静态页和 `/tools/` 核心交互 |
| `npm run test:pwa-smoke` | 通过，验证 SW 注册控制页面、离线访问已缓存 `/post/`、未缓存路由回退 `/offline.html`、relay 动态数据离线不从缓存返回，以及 Service Worker 版本升级清理 |
| `npm run validate:production` | 75/75 通过，包含临时构建 HTTP smoke、PWA artifact、本地 CSS/JS 资源和全站图片属性检查 |
| `npm audit --registry=https://registry.npmjs.org --audit-level=moderate` | 0 vulnerabilities |
| `git diff --check` | 通过，仅 CRLF 工作区提示 |

本轮补充：PWA-01/PWA-04/PWA-05 第二阶段已新增 `/offline.html`、`/service-worker.js` 和 `/js/pwa-register.js`，HTTP smoke 会校验 PWA artifact 可达，Service Worker 镜像 `src/pwa-cache-policy.mjs` 的 network-only 安全边界。PWA-02 第一阶段已新增 `src/pwa-precache.mjs` 和 `check:pwa-precache`；PWA-02 第二阶段已把 `service-worker.js` 生成化并接入 `check:service-worker`、CI、build 和质量基线；PWA-02 第三阶段已让页面资源从 `PAGE_ASSETS` 派生进预缓存，当前覆盖 `/css/tools.css` 与 `/css/trust.css`；PWA-06 第一阶段已补 Service Worker 旧缓存清理 fixture、搜索索引未缓存/已缓存离线矩阵和浏览器级版本升级 smoke；PWA-04 第三阶段已补搜索索引离线未缓存、索引损坏和临时不可用的差异化提示；MR-DISCOVERY-01 第一阶段已提升文章搜索索引召回。下一阶段重点是页面章节索引和文章离线阅读产品化。

本轮补充：MR-BUILD-SYNC-01 已新增 `npm run check:generated`，只读构建到 `temp/generated-drift-check` 并比较 78 个产物文件；`check:readonly` 和 CI 会在 build 覆盖根目录前运行它。

### 发现的问题

- 默认体验 key 被测试固化，原测试只验证“不显示/不存储”，没有验证“前端根本不携带可还原 key”。
- 助手模式保存和读取不对称，默认 LLM 与隐私最小外发原则冲突。
- SSE 流结束时未处理最后一个未闭合事件，部分代理实现会导致回答尾部缺失。
- Cron 典型无解日期表达式会触发同步百万级扫描，工具页输入反馈可能卡顿。
- 生产验证脚本收集完整测试输出时缓冲不足，导致测试已通过但门禁误报失败。
- 公开站点缺少面向访问者的隐私与信任入口，用户无法集中了解本机数据、第三方服务和清理方式。
- Trust Center 初版样式一度让 `coder.css` 超出 140KB 性能预算，已通过页面级 `css/tools.css` / `css/trust.css` 拆分和公共模板 `styles` 注入拉回预算。

### 下一步计划

1. 为工具箱 runtime 加载补充可见的加载中/失败重试状态。
2. 推进工具页 JS/CSS 拆包复测和更泛化的 Cron 稀疏表达式字段跳跃优化。
3. 继续补 AI 助手“导出/删除当前对话”和更细的错误态国际化。

---

## 2026-07-03 视觉交互脚本复查补充

### 已完成内容

| 模块 | 文件/范围 | 发现 |
|------|-----------|------|
| 手势摄像头 | `js/gesture.js` | 快速重复点击开始按钮时缺少 `starting` 门闩，可能并发申请摄像头 |
| 后台资源 | `js/gesture.js` | 页面隐藏时仍保持摄像头流占用，隐私感知和电量成本偏高 |
| Galaxy 动画 | `js/galaxy.js` | canvas 动画未遵守 `prefers-reduced-motion` |
| 工具 runtime | `js/tools.js` | 核心脚本加载竞态已修复，仍可补充加载中/失败重试 UI |

### 记录位置

- `docs/suggestions/module-reviews/visual-interactions.md`

### 下一步计划

1. 为 Galaxy/手势按需加载补充加载中、失败重试和不可用状态提示。
2. 给手势摄像头启动增加 `starting` 状态和重复点击回归测试。
3. 为 Galaxy 增加 reduced-motion 静态模式。

---

## 2026-07-04 工具运行时与隐私样式补充

### 已完成内容

| 项目 | 文件/范围 | 结果 |
|------|-----------|------|
| AI 助手隐私与保留策略 | `js/assistant.js`, `css/coder.css`, `tests/assistant.test.mjs`, `tests/css.test.mjs` | 增加隐私模式、历史保留期限、清空全部对话入口和对应样式/测试；隐私模式与 session 保留不再写入对话 localStorage |
| 工具箱运行时安全分析 | `docs/suggestions/module-reviews/tools-core-runtime-safety.md` | 新增正则 ReDoS、JSONPath 非法尾部、API 历史保存失败、私网/HTTP 边界、大响应预算 5 项后续治理建议 |
| 工具箱 P1 运行时修复 | `js/tools-core.js`, `js/tools.js`, `tests/tools.test.mjs` | JSONPath 严格拒绝非法尾部；API Tester 历史写入失败时显示失败反馈，不再误报保存成功 |
| API Tester 请求边界 | `src/templates/tools.mjs`, `js/tools.js`, `js/i18n.js`, `tests/tools.test.mjs` | 本机/内网/非 HTTPS 目标默认拦截，用户勾选显式允许后才发送 |
| API Tester 响应预算 | `js/tools.js`, `js/i18n.js`, `tests/tools.test.mjs` | 增加 15 秒超时、超时文案区分、响应正文 500000 字符预算和大响应跳过/截断反馈 |
| 正则 Worker 运行时隔离 | `js/regex-worker.js`, `js/tools.js`, `js/i18n.js`, `tests/tools.test.mjs` | 正则匹配优先在 Worker 中执行，主线程设置 250ms 超时，避免危险表达式卡住工具页 |
| UUID 安全随机边界 | `js/tools-core.js`, `js/tools.js`, `js/i18n.js`, `tests/tools.test.mjs` | 删除 `Math.random()` 弱随机 fallback；Web Crypto 不可用时返回 `uuidCrypto` 并在 UI 显示错误 |
| 随机数用途提示 | `src/templates/tools.mjs`, `tools/index.html`, `css/coder.css`, `js/i18n.js`, `tests/templates.test.mjs`, `tests/tools.test.mjs` | 随机数工具明确标注普通伪随机数仅适合抽样/演示，不应用作密码、令牌、验证码或安全凭据 |
| 手势供应链确认 | `src/templates/tools.mjs`, `js/gesture.js`, `css/coder.css`, `tests/tools.test.mjs`, `tests/templates.test.mjs` | 摄像头启动前必须确认第三方视觉资源来源，未确认不申请摄像头；启动过程增加 `starting` 门闩 |
| 手势后台摄像头释放 | `js/gesture.js`, `tests/tools.test.mjs`, `docs/suggestions/module-reviews/visual-interactions.md` | 页面隐藏且手势工具运行时立即停止摄像头，释放视频 track 并显示“页面已隐藏，摄像头已关闭”；增加防回退测试 |
| 手势冷启动阶段反馈 | `js/gesture.js`, `tests/tools.test.mjs`, `docs/suggestions/performance-bottlenecks.md` | 启动链路区分模型加载、摄像头初始化和视频流启动阶段，减少弱网或授权等待时的模糊状态 |
| Galaxy 减少动态偏好 | `js/galaxy.js`, `tests/js-behavior.test.mjs`, `docs/suggestions/module-reviews/visual-interactions.md` | 遵守 `prefers-reduced-motion: reduce`，减少动态时只绘制静态星图且不持续排队 rAF；偏好恢复时重新启动动画 |
| 浏览器 smoke 稳定性与文章列表 H1 | `css/coder.css`, `scripts/browser-smoke.mjs`, `tests/css.test.mjs`, `tests/workflows.test.mjs` | 文章列表页 H1 在桌面布局保持可见；browser smoke 可见性与搜索跳转等待提升到 10 秒，降低完整基线长跑抖动 |
| 分享与评论韧性 | `js/share.js`, `js/giscus.js`, `js/i18n.js`, `tests/share-subscribe-feedback-deep.test.mjs`, `tests/giscus-behavior.test.mjs` | 分享相对 URL 优先使用 canonical 生产域，避免本地/预览域误传播；Giscus 脚本失败或超时时显示评论加载失败提示并记录原因 |
| Giscus 懒加载 | `js/giscus.js`, `tests/giscus-behavior.test.mjs` | 支持 IntersectionObserver 时，评论区接近视口才注入 giscus.app 脚本；不支持时保持立即加载 fallback，switch 模式在加载后按当前激活文章绑定 discussion |
| Giscus 语言/主题同步 | `js/coder.js`, `js/giscus.js`, `tests/coder-deep.test.mjs`, `tests/giscus-behavior.test.mjs` | 主题切换派发 `cwl:themechange`；Giscus 初始脚本和已加载 iframe 均跟随站内语言与实际 light/dark 主题 |
| 微博分享弹窗兜底 | `js/share.js`, `tests/share-subscribe-feedback-deep.test.mjs` | `window.open` 被拦截时升级微博触发器为真实外链，并尝试复制微博分享 URL；复制也失败时显示二维码兜底 |
| Browser smoke 导航 abort 过滤 | `scripts/browser-smoke.mjs`, `tests/workflows.test.mjs` | 同源请求失败仍会报错，但忽略导航/关闭页面时浏览器正常产生的 `net::ERR_ABORTED`，避免搜索预热请求被主动跳转中止造成假失败 |
| AI 助手 CSS 按需加载 | `css/assistant.css`, `css/coder.css`, `js/assistant-loader.js`, `src/pwa-precache.mjs`, `tests/assistant-loader.test.mjs`, `tests/css.test.mjs` | 将助手浮层、消息、配置和移动端适配样式移出 core CSS；首次打开助手或 fullscreen 深链时注入样式和运行时；PWA 预缓存扩展到 19 个 URL |
| 工具页基础 CSS 页面级拆包 | `css/tools.css`, `css/coder.css`, `tests/css.test.mjs`, `tests/performance.test.mjs`, `src/service-worker-template.mjs` | 将工具页 shell、tab、面板、字段、输出、QR/时间/UUID 预览和移动端工具布局迁入页面级 CSS；`coder.css` 降至 103,446 bytes；Service Worker 版本递增并重新生成 |
| 社交分享与评论集成分析 | `docs/suggestions/module-reviews/social-comments-integrations.md` | 新增 canonical 分享、Giscus 懒加载/失败兜底、语言主题同步、strict 映射和微博弹窗兜底 6 项建议 |
| 内容发现与视觉搜索分析 | `docs/suggestions/module-reviews/content-discovery-and-object-search.md` | 新增博客筛选分组计数、搜索加载失败反馈、移动目录焦点和对象识别脚本去留等 8 项建议 |
| 内容发现体验修复 | `js/blog.js`, `tests/blog.test.mjs` | 年份分组计数按组更新，空年份自动隐藏；博客搜索支持 `?q=` 直达/同步；移动端目录打开/关闭时焦点可预测恢复 |
| 搜索加载失败反馈 | `js/search-loader.js`, `css/coder.css`, `js/i18n.js`, `tests/search-loader-behavior.test.mjs` | 搜索 bundle 加载失败时按钮进入错误态、弹出 toast、写入日志、移除失败脚本并允许重试 |
| 产品信息页与排行榜分析 | `docs/suggestions/module-reviews/product-info-pages-and-rankings.md` | 新增 AI 导航状态元数据、鉴赏页占位符/JSON-LD、赞助目标数据源和进度语义等 7 项建议 |
| 浏览器与视觉冒烟分析 | `docs/suggestions/module-reviews/browser-visual-smoke-testing.md` | 记录真实浏览器 smoke、HTTP smoke、响应式截图、权限 API 和 CI artifact 6 项建议；HTTP smoke 已接入 CI，Playwright smoke 已覆盖关键路径、Canvas、Clipboard 和手势确认门闩 |
| Relay 数据质量修复 | `scripts/update-commercial-relay.mjs`, `tests/relay.test.mjs` | 商业源布尔字段和 header 配置错误 fail-fast 已修复，relay 异常矩阵补齐到 8 个用例 |
| 隐私与信任中心落地 | `src/trust-data.mjs`, `src/templates/trust.mjs`, `trust/index.html`, `tests/templates-extended.test.mjs` | 新增公开 `/trust/` 页面，集中展示本机数据、第三方服务、用户控制和安全摘要，并纳入搜索、sitemap、robots、页脚、导航和 smoke 路由 |
| 内容新鲜度与信任信号分析/落地 | `docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`, `scripts/build.mjs`, `src/templates/post.mjs`, `js/search.js`, `js/feedback.js` | 新增 6 项建议，并已全部落地：sitemap 使用 `modified` lastmod、文章显示更新时间、搜索索引/结果展示更新日期信号、RSS `majorUpdate` 策略、旧文复核提示、源码与反馈入口 |
| 按钮可访问名称测试修复 | `tests/i18n-a11y.test.mjs`, `docs/suggestions/module-reviews/browser-visual-smoke-testing.md` | 用 JSDOM 解析按钮并计算 `aria-labelledby` / `aria-label` / `title` / 文本名称，替代空转的开始标签正则检查 |

### 验证

- `node --test tests/css.test.mjs`：35/35 通过
- `node --test tests/assistant.test.mjs tests/assistant-deep.test.mjs`：47/47 通过
- `node --test tests/tools.test.mjs tests/tools-core-deep.test.mjs`：73/73 通过
- `node --test tests/tools.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/security-extended.test.mjs tests/css.test.mjs`：132/132 通过
- `node --test tests/i18n-a11y.test.mjs tests/performance.test.mjs tests/workflows.test.mjs`：35/35 通过
- `node --test tests/i18n-a11y.test.mjs`：16/16 通过
- `node --test tests/i18n-a11y.test.mjs tests/templates-extended.test.mjs tests/css.test.mjs tests/relay.test.mjs tests/workflows.test.mjs`：100/100 通过
- `npm run test:browser-smoke`：通过
- `node --test tests/share.test.mjs tests/subscribe.test.mjs tests/subscribe-deep.test.mjs tests/feedback.test.mjs tests/giscus-behavior.test.mjs tests/share-subscribe-feedback-deep.test.mjs`：70/70 通过
- `node --test tests/blog.test.mjs tests/search-loader-behavior.test.mjs tests/js-behavior.test.mjs tests/integration.test.mjs tests/links.test.mjs tests/workflows.test.mjs`：80/80 通过
- `node --test tests/ai-tabs.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/build-extra.test.mjs tests/css.test.mjs tests/i18n-a11y.test.mjs`：128/128 通过
- `node --test tests/css.test.mjs tests/assistant-loader.test.mjs tests/pwa-precache.test.mjs tests/service-worker-generation.test.mjs tests/workflows.test.mjs`：65/65 通过
- `node --test tests/css.test.mjs tests/performance.test.mjs tests/templates-extended.test.mjs tests/pwa-precache.test.mjs tests/workflows.test.mjs`：113/113 通过
- `node --test tests/service-worker-generation.test.mjs tests/pwa-precache.test.mjs`：8/8 通过
- `npm run check:pwa-precache`：19/19 URL 通过，页面资源缺失 0
- `npm run check:service-worker`、`npm run lint:check`、`node --test tests/performance.test.mjs`：通过

### 下一步计划

1. 继续评估 CSS/JS 拆包、模型自托管和 hash 清单。
2. 推进 AI 助手错误态国际化和更细的连接诊断。

---

## 已分析模块

| 模块 | 文件 | 行数 | 分析深度 |
|------|------|------|----------|
| 构建系统 | scripts/build.mjs + src/ | ~1500 | ✅ 完整 |
| 核心 JS | error-handler, utils, i18n, coder | ~1200 | ✅ 完整 |
| 博客功能 | blog, search, share, giscus, toc, post-next | ~1400 | ✅ 完整 |
| 工具箱 | tools-core, tools | ~385 | ✅ 完整 |
| 编辑器 | editor | 405 | ✅ 完整 |
| Overleaf | overleaf | 833 | ✅ 完整 |
| 订阅/反馈 | subscribe, feedback | ~383 | ✅ 完整 |
| 分享与评论 | share, giscus | ~390 | ✅ 专题分析 |
| 内容发现与视觉搜索 | blog, search-loader, object-search | ~650 | ✅ 专题分析 |
| 产品信息页 | ai, appreciation, sponsor | ~600 | ✅ 专题分析 |
| AI 助手 | assistant | 1568 | ✅ 完整（深度分析） |
| 性能监控 | performance-monitor, logger | ~293 | ✅ 完整 |
| CSS | coder.css | 4655 | ✅ 抽样分析 |
| Markdown 文章 | 6 篇 .md | 718 | ✅ 完整 |
| HTML 页面 | 13 个手写页 | — | ✅ 结构分析 |
| 测试文件 | 3 个测试 | — | ✅ 运行验证 |
| 配置文件 | package.json, eslintrc | — | ✅ 完整 |
| Vendor 依赖 | 5 个 .min.js | — | ✅ 大小分析 |

---

## 发现问题统计

| 等级 | 第一轮 | 第二轮 | 第三轮 | 总计 |
|------|--------|--------|--------|------|
| 🔴 高 | 0 | 0 | 1 | **1** |
| 🟡 中 | 10 | 4 | 1 | **15** |
| 🟢 低 | 18 | 8 | 3 | **29** |
| ℹ️ 信息 | 4 | 2 | 1 | **7** |
| ✅ 正面 | 5 | 3 | 2 | **10** |
| **建议总数** | **105** | **26** | **5** | **136** |

---

## 测试状态

```
✔ 587+ 测试通过（0 失败）
✔ ESLint 0 错误
✔ 构建成功（6 篇文章）
```

---

## 关键发现

### ✅ 项目做得好的地方
1. **XSS 防护全面**：所有用户输入都经过转义
2. **测试覆盖率高**：573+ 个测试通过，并有覆盖率阈值防回退
3. **Font Awesome 已优化**：使用子集版本，总计仅 7KB
4. **懒加载策略好**：搜索、代码高亮等按需加载
5. **i18n 设计优雅**：客户端切换无需路由，渐进增强
6. **构建脚本健壮**：完善的输入验证、独立文章校验和错误处理

### ⚠️ 需要关注的问题
1. **代码重复**：主要剩余 assistant 文案 i18n 与大型模块拆分问题；readingMinutes 已统一
2. **SEO 改进空间**：多语言 URL 策略、图片 alt 质量仍可继续补充
3. ✅ **文章无图片**：已通过文章 cover 与 1200×630 社交封面修复
4. **assistant.js 未接入 i18n**：英文用户看到中文
5. ✅ **CSS backdrop-filter 过度使用**：已在移动端关闭高成本毛玻璃背景
6. ✅ **搜索首次打开冷启动**：已通过 idle 预热搜索脚本、Fuse 和搜索索引优化
7. ✅ **单篇页目录重复构建**：已在 SSR TOC 存在时跳过动态目录构建
8. ✅ **粒子数组热路径删除**：已通过 swap-and-pop 和源码守卫避免 `splice()` 回退
9. ✅ **返回顶部按钮初始闪烁**：已通过 ready 门闩隐藏未初始化状态
10. ✅ **RSS 生成重复**：已提取 `buildRssFeed()`，三种 feed 共用 channel 外壳
11. ✅ **订阅输入错误态**：已为页脚和弹窗订阅输入增加视觉与 `aria-invalid` 反馈
12. ✅ **搜索快捷键提示**：已为导航搜索按钮增加本地化 tooltip 与 aria 提示
13. ✅ **CSP 缺失**：已通过全站 meta CSP 与 HTML 扫描测试修复
14. ✅ **全局平滑滚动冲突**：已移除 `html` 全局 `scroll-behavior: smooth`，交互滚动由 JS 按需控制
15. ✅ **移动端分享条拥挤**：已让窄屏分享按钮换行并等宽排列
16. ✅ **HTML 块空行压缩**：已扩展 `tidyHtml()` 保护范围，避免压缩 `details`、`div`、`table` 等块内空行
17. ✅ **反馈批量管理**：已为多条本地反馈增加确认后清空全部能力
18. ✅ **公开内容敏感标记**：已在 `validate:posts` 中阻断 TODO/SECRET 等标记进入文章和搜索索引
19. ✅ **博客启动重复扫描**：已让 `blog.js` 启动期文章项缓存只构建一次，避免重复 DOM 查询
20. ✅ **JWT 解码误用风险**：已在工具箱增加常驻签名未验证警示，提醒不可用于安全决策
21. ✅ **giscus 清理事件**：已将 observer 清理从 `unload` 改为 bfcache 友好的 `pagehide`
22. ✅ **第三方资源提示缺失/过宽**：已为评论、订阅和赞助域名补齐低成本 DNS hints，并将较重的 `preconnect` 收敛到评论页或用户订阅动作后
23. 🟨 **Markdown 正文图片加载提示**：已在构建期补齐 `loading="lazy"` 与 `decoding="async"`，尺寸属性仍待后续注入
24. ✅ **resize 更新复用 scroll 节流**：已为阅读进度 resize 路径拆出独立 200ms throttle，减少窗口拖拽时的重绘压力
25. ✅ **跳过导航链接缺失**：已为全站添加 skip link 和 `#main-content` 目标，改善键盘用户访问效率
26. ✅ **缺少结构化变更日志**：已新增根目录 CHANGELOG.md，并通过 workflow 测试约束标题、日期和分类结构

---

## 下一步分析计划

1. ✅ ~~深度分析剩余模板（ai.mjs, tools.mjs 等）~~ 已完成
2. ✅ ~~Markdown 文章内容质量分析~~ 已完成
3. ✅ ~~资源大小分析~~ 已完成
4. ✅ ~~测试覆盖率检查~~ 已完成
5. 🔄 继续分析手写 HTML 页面的结构一致性
6. 🔄 生成最终的项目健康度评分报告
7. 🔄 更新 README 索引
