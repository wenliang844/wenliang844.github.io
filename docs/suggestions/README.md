# 📋 CWLBlog 项目分析报告索引

> 生成日期：2026-06-18 | 分析工具：Claude Code 自主分析

---

## 2026-07-03 自主复查快照（第 5 轮更新）

| 项目 | 结果 |
|------|------|
| 当前分支 | `codex/autonomous-optimization` |
| 工作区注意事项 | 本轮包含源码、测试与文档修复；生产验证脚本已修复大测试输出假失败和根目录构建写入副作用 |
| 质量门禁 | `npm run quality:baseline` 通过；14/14 命令通过；`npm test` / `npm run test:coverage` 889/889 通过；`npm run check:vendor`、`npm run check:generated`、`npm run check:i18n`、`npm run check:seo-feed`、`npm run check:service-worker`、`npm run check:pwa-precache`、`npm run check:suggestions-index` 与 `npm run check:quality-baseline` 通过；`check:suggestions-index` 已覆盖 README 生成索引、Markdown 文件链接、heading anchors 和建议字段/状态统计/预算门禁；`npm run test:http-smoke` 7/7 路由通过；`npm run test:http-smoke:full` 14/14 路由通过；`npm run test:browser-smoke` 已覆盖全局搜索文章章节、工具箱章节命中、搜索命中原因、相关文章推荐原因和文章列表页正文长尾词过滤，并已接入 CI 失败 artifact 上传；`npm run test:browser-smoke:full` 与 `npm run test:pwa-smoke` 通过 |
| 生产验证 | `npm run validate:production` 75/75 通过 |
| 依赖审计 | `npm audit --registry=https://registry.npmjs.org --audit-level=moderate` 0 漏洞 |
| 覆盖率 | 总体 lines 91.37%、branches 79.31%、functions 90.39%，通过阈值 |
| 本地服务冒烟 | `/`、`/tools/`、`/post/`、`/search-index.json` 均返回 200 |
| 第 2 轮深挖 | `js/assistant.js`、`js/tools-core.js`、`tests/assistant*.mjs`、`tests/tools*.mjs` |
| 第 2 轮行为探测 | Cron 无解表达式 `0 0 31 2 *` 约 127.57ms；普通表达式约 0.19-1.52ms |
| 第 3 轮 DOM 审计 | 19 个非临时 HTML 页面；description/main/h1/skip link/OG image 全部具备 |
| 第 3 轮新增例外 | 404 JSON-LD、`markdown-input` label、`qr-image` 尺寸/加载属性均已修复 |
| 第 3-5 轮资源测量 | `coder.css` 6,130 行 / 129,973 bytes；`tools.css` 12,287 bytes；`trust.css` 854 bytes；新增 `src/page-assets.mjs` 和路由级 CSS raw/gzip 预算；工具页首屏约 310 个元素、1 个真实面板、30 个按需 template |

## 2026-07-04 最终收口快照

| 项目 | 结果 |
|------|------|
| 完整分析报告 | [final-analysis-report-2026-07-03.md](final-analysis-report-2026-07-03.md) |
| 小时报告 | 已生成第 2-6 小时工作报告；第 6 小时报告见 [hourly-report-2026-07-03-06.md](hourly-report-2026-07-03-06.md) |
| 建议库规模 | 66 个建议文档，其中 45 个模块专题 |
| 当前质量基线 | 14/14 命令通过；`npm test` / `npm run test:coverage` 889/889 通过；`npm run check:vendor`、`npm run check:generated`、`npm run check:i18n`、`npm run check:seo-feed`、`npm run check:service-worker`、`npm run check:pwa-precache`、`npm run check:suggestions-index` 与 `npm run check:quality-baseline` 通过；CI 会额外生成并校验 `clean-quality-baseline` artifact，要求 `--require-head --require-clean-scope`；建议库治理统计覆盖 70 个 Markdown、349 条建议、267 条字段完整、82 条待补，状态 fixed 119 / partial 56 / open 174，并已设置 82 条待补和各缺失字段数量不增长预算；i18n 覆盖 21 个 HTML / 971 个引用 / 259 个唯一 key / 0 缺失；SEO/feed 覆盖 21 个 HTML / 19 个 sitemap URL / 3 个 RSS feed / 0 违规；Service Worker 已由 `src/service-worker-template.mjs` 生成并接入 build/CI/基线；PWA 预缓存 19 个 URL / 2 个页面资源覆盖 / 0 生成物所有权缺口 / 0 缺失 / 0 额外 / 0 不可缓存；PWA smoke 覆盖搜索索引离线矩阵、单篇文章在线/离线阅读状态、离线兜底、network-only 数据边界和 Service Worker 版本升级清理；搜索弹窗已区分离线未缓存、索引损坏和临时不可用错误态，展示搜索索引状态条和命中字段原因；相关文章已展示推荐原因；搜索索引已覆盖 6 篇文章、51 个文章章节、11 个静态页章节、12 个页面，123,287 字符 / 216,563 bytes，并锁定 `ESClient`、`Web Worker`、`Galaxy`、`Maven`、`BPMN`、`Cron` 等关键词；`npm run test:coverage` line 91.37%、branch 79.31%、funcs 90.39%；HTTP smoke 7/7；full HTTP smoke 14/14；browser smoke 已覆盖文章章节、工具箱章节、搜索索引状态条、搜索命中原因、相关文章推荐原因和文章列表页正文搜索交互，并会在失败时输出截图/DOM/JSON artifact，CI 失败时上传该目录；full browser smoke 与 PWA smoke 通过；生产验证 75/75 |
| 综合健康度 | 3.9 / 5（良好） |
| 最高优先级 | CSS/JS 拆包、模型资源预缓存治理、发布摘要自动化、质量基线 quick/full 分层 |
| 工作树说明 | 当前存在外部并发修改；最终报告按 dirty scope 标注证据，不把外部源码/测试改动计入 docs-only 提交 |

### 新增高优先级发现

| 编号 | 等级 | 建议 | 文档 |
|------|------|------|------|
| S-11 | 高 | `assistant.js` 仍在前端运行时拼接并使用默认体验 API Key | [security-audit.md](security-audit.md#s-11-assistantjs-仍在前端运行时拼接并使用默认体验-api-key) |
| S-14 | 中 | AI 助手对话和 LLM 上下文长期留存在 localStorage（核心风险已修复） | [security-audit.md](security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage) |
| S-12 | 中 | Mini API Tester 会把 Authorization 头和请求体持久化到 localStorage | [security-audit.md](security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage) |
| S-13 | 中 | 手势工具运行时加载 CDN 机器视觉脚本和模型（核心确认已补，自托管/hash 清单待推进） | [security-audit.md](security-audit.md#s-13-已修复核心治理-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束) |
| B-13 | 中 | 生产验证脚本默认会覆盖根目录构建产物（已修复） | [bugs-and-risks.md](bugs-and-risks.md#b-13-已修复-生产验证脚本默认会覆盖根目录构建产物) |
| B-14 | 中 | 工具箱按需脚本加载 Promise 过早 resolve，手势页存在初始化竞态（核心竞态已修复） | [bugs-and-risks.md](bugs-and-risks.md#b-14-已修复核心竞态-工具箱按需脚本加载-promise-过早-resolve手势页存在初始化竞态) |
| B-15 | 中 | AI 助手模式偏好写入后不会被恢复 | [bugs-and-risks.md](bugs-and-risks.md#b-15-ai-助手模式偏好写入后不会被恢复) |
| B-16 | 中 | AI 助手 SSE 流结束时可能丢失最后一个未闭合事件 | [bugs-and-risks.md](bugs-and-risks.md#b-16-ai-助手-sse-流结束时可能丢失最后一个未闭合事件) |
| P-13 | 中 | 关键静态产物体积已经接近当前性能预算 | [performance-bottlenecks.md](performance-bottlenecks.md#p-13-关键静态产物体积已经接近当前性能预算) |
| P-16 | 中 | Cron 无解表达式会在主线程同步扫描两年分钟粒度（主要慢路径已修复） | [performance-bottlenecks.md](performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度) |
| P-17 | 中 | 全站统一加载 `coder.css`，工具箱和助手样式成本扩散到所有页面（核心已修复） | [performance-bottlenecks.md](performance-bottlenecks.md#p-17-已修复核心-全站统一加载-codercss工具箱和助手样式成本扩散到所有页面) |
| P-18 | 中 | 工具页首屏一次性解析 31 个工具面板（DOM 已部分修复） | [performance-bottlenecks.md](performance-bottlenecks.md#p-18) |
| UX-13 | 中 | AI 助手默认模式与隐私文案需要重新对齐 | [ux-improvements.md](ux-improvements.md#ux-13-ai-助手默认模式与隐私文案需要重新对齐) |
| CQ-12 | 中 | 安全回归测试只检查连续 key 字面量，无法识别拼接型密钥 | [code-quality.md](code-quality.md#cq-12-安全回归测试只检查连续-key-字面量无法识别拼接型密钥) |

### 已落地修复补充

- 已完成：S-11 / CQ-12 移除 AI 助手前端默认体验 key 机制，并补“空 key 不请求、自填 key 才请求”的回归测试。
- 已完成：UX-14 为独立编辑器和工具箱内嵌 Markdown 编辑器补充屏幕阅读器 label、英文 i18n 和 `.sr-only` 样式。
- 已完成：UX-15 为 QR 结果图片补充 `width` / `height` / `loading` / `decoding`，并用 CSS `aspect-ratio` 稳定预览区域。
- 已完成：B-15 / UX-13 助手默认进入本地站点模式，并恢复用户保存的 `site` / `llm` 模式偏好。
- 已完成：B-16 / MR-AST-03 修复 SSE 流结束时未闭合最后事件被丢弃的问题。
- 已完成：B-14 / MR-TOOLS-02 修复工具箱按需 runtime 脚本加载 Promise 过早 resolve 的核心竞态。
- 已完成：P-16 / MR-CORE-01 为 Cron 不可能日期表达式增加短路和 `<50ms` 回归预算，保留 day-of-month/day-of-week OR 语义。
- 已完成：S-14 / F-13 为 AI 助手增加隐私模式、历史保留期限和清空全部对话入口，并补英文文案和样式测试。
- 已完成：B-17 / DE-15 为生产验证测试命令设置专用输出缓冲，避免全量测试输出导致 `validate:production` 假失败。
- 已完成：B-13 / DE-11 将生产验证构建检查改到 `temp/production-validate` 临时目录，验证后自动清理，避免覆盖根目录生成产物。
- 已完成：MR-BUILD-SYNC-05 让 `build --out` 输出可 smoke 的完整临时站点，并在 `validate:production` 中复用 HTTP smoke 验证临时构建。
- 已完成：MR-BUILD-SYNC-01 新增 `check:generated` 只读生成产物漂移检查，接入 `check:readonly` 和 CI build 前门禁；MR-BUILD-SYNC-04 新增 `data/generated-artifact-manifest.json` 和 manifest 校验，明确 generated/manual 文件边界，`check:generated` 现在同时覆盖字节漂移和产物所有权；PWA 预缓存 URL 也会反查该 manifest，阻断未归属离线资源。
- 已完成：FINAL-01 / QBG-01 第一阶段将 clean quality baseline 纳入 CI，build 前生成 `temp/quality-baseline/clean-quality-baseline.json`，用 `--require-head --require-clean-scope` 校验后上传 `clean-quality-baseline` artifact。
- 已完成：QBG-05 第一阶段新增 `check:quality-baseline` 只读质量基线新鲜度与完整性检查，接入 `check:readonly` 和 CI。
- 已完成：QBG-04 第一阶段新增失败命令日志追溯，`quality:baseline` 失败时会写入 `temp/quality-baseline/logs/<command>.log`，baseline JSON 记录 `logPath`、脱敏 `outputTail` 和可选 `artifactPaths`；CI 会在目录存在时上传整个 `temp/quality-baseline/`。
- 已完成：PWA-01 第一阶段新增 `manifest.webmanifest`、全站 manifest/theme-color head 入口，并让 HTTP smoke 校验 manifest 与图标可达。
- 已完成：PWA-03/PWA-05 第一阶段新增 `src/pwa-cache-policy.mjs`，把缓存策略矩阵和禁止缓存范围变成可执行测试契约。
- 已完成：PWA-01/PWA-04/PWA-05 第二阶段新增 `/offline.html`、`/service-worker.js` 与 `/js/pwa-register.js`，在保持非 GET、外站、敏感 query/header、relay/API/未知 endpoint network-only 的前提下提供保守离线兜底；HTTP smoke 会检查离线页和 SW 入口可达，单元测试会校验 SW 策略与源码策略一致。
- 已完成：PWA-04 第三阶段为搜索索引加载失败增加离线未缓存、索引损坏和临时不可用的差异化提示，并新增 `tests/search-behavior.test.mjs` 覆盖中英文离线提示、异常索引和成功渲染路径。
- 已完成：PWA-04 第四阶段在全局搜索弹窗增加搜索索引缓存/加载状态条，区分索引待加载、加载中、已就绪、离线可搜索、离线未加载和索引异常；`tests/search-behavior.test.mjs` 与 browser smoke 均已覆盖。
- 已完成：PWA-07 第一阶段为单篇文章页增加离线阅读状态徽标，在线显示“此文章已可离线阅读”，离线打开缓存文章时显示“正在离线阅读此文章”，英文模式同步更新；PWA smoke 覆盖在线、离线和英文状态。
- 已完成：MR-DISCOVERY-01 / MR-DISCOVERY-06 第一阶段将文章搜索正文预算从 600 字提升到 3200 字，并新增长尾关键词召回与体积预算测试；搜索结果摘要会优先展示包含查询词的字段。
- 已完成：MR-DISCOVERY-01 / MR-DISCOVERY-06 第二阶段新增文章章节级搜索条目，当前索引包含 51 个 `post-section` 深链接；搜索弹窗显示章节标题并跳转到 `#toc-*`，Playwright browser smoke 已覆盖 `BPMN` 章节命中。
- 已完成：MR-DISCOVERY-02 第一阶段新增 11 个 `page-section` 静态页章节，覆盖 `/tools/` 的 JSON/API/Cron/JSONPath/Markdown/Galaxy、`/trust/` 的本机数据/外部服务/安全说明、`/ai/` 的中转站榜单/AI 导航；工具箱 hash 深链接会自动激活对应工具面板，browser smoke 已覆盖 `Cron` 搜索跳转。
- 已完成：MR-DISCOVERY-03 第一阶段让文章列表页本地搜索纳入正文、章节标题和 slug，`/post/` 内可搜索 `ESClient`、`Web Worker` 等全局搜索长尾词；browser smoke 已覆盖正文词过滤和 URL `?q=` 同步。
- 已完成：MR-DISCOVERY-04 第一阶段使用 Fuse matches 展示搜索结果命中字段原因，正文/章节/标签/路径命中会显示“命中正文”“命中章节”或英文 “Matched body”等提示，并优先用匹配字段生成高亮片段；browser smoke 已覆盖命中原因可见。
- 已完成：MR-DISCOVERY-05 第一阶段扩展相关文章评分信号，综合中文标签、英文标签、可选系列/领域/技术栈和主题信号，并在相关文章卡片中展示“共同标签 / Shared tags”等推荐原因。
- 已完成：FINAL-05 / I18N-COV-01 新增 `npm run check:i18n`，扫描 21 个 HTML 中的 `data-i18n*` 与页面 head key，要求英文词典或内联英文覆盖且 missing 为 0；已接入 `check:readonly`、CI 和质量基线。
- 已完成：FINAL-06 / MR-SEO-FEED-02 / MR-SEO-FEED-08 第一阶段新增 `npm run check:seo-feed` 与 `npm run seo:report`，统一校验 sitemap、RSS、canonical、OG、JSON-LD 和 feed discovery；全站、文章列表和时间归档 RSS 已可被 HTML 自动发现。
- 已完成：FINAL-03 / PWA-02 第一阶段新增 `src/pwa-precache.mjs`、`scripts/check-pwa-precache.mjs` 和 `npm run check:pwa-precache`，校验预缓存 URL 与 Service Worker 一致、本地文件存在、Font Awesome 字体被覆盖且没有不可缓存条目；已接入 `check:readonly`、CI 和质量基线。
- 已完成：FINAL-03 / PWA-02 第二阶段新增 `src/service-worker-template.mjs` 与 `scripts/generate-service-worker.mjs`，根目录 `service-worker.js` 和 `build --out` 产物均由同一模板生成；`npm run check:service-worker` 已接入 `check:readonly`、CI、质量基线和工作流测试。
- 已完成：FINAL-03 / PWA-02 第三阶段让 `PWA_PRECACHE_PAGE_ASSETS` 从 `src/page-assets.mjs` 的 `pageAssetUrls()` 派生，并把按需助手样式 `/css/assistant.css` 纳入核心预缓存；当前 PWA 预缓存扩展到 19 个 URL，并覆盖 `/css/tools.css` 与 `/css/trust.css` 两个页面级 CSS；`check:pwa-precache` 会报告页面资源覆盖数和缺失数。
- 已完成：FINAL-03 / PWA-02 第四阶段让 `check:pwa-precache` 反查 `data/generated-artifact-manifest.json`，19 个预缓存 URL 必须属于 generated output、manual HTML、manual static file 或 copied asset directory；`manifest.webmanifest` 已纳入 `manualStaticFiles`，当前生成物所有权缺口为 0。
- 已完成：MR-RT-02 / MR-RT-03 修复 JSONPath 非法尾部部分解析，以及 API Tester 历史保存失败误报成功。
- 已完成：MR-RT-04 为 API Tester 增加本机/内网/非 HTTPS 请求显式允许开关和回归测试。
- 已完成：MR-RT-05 为 API Tester 增加请求超时、响应大小预算和大响应跳过/截断反馈。
- 已完成：MR-RT-01 将正则测试迁移到 Worker 优先执行，并增加 250ms 超时反馈。
- 已完成：FINAL-09 / MR-RELAY-04 / MR-RELAY-05 第一阶段为商业 Relay 同步增加必需/可选源策略、最低成功源数量和认证 header 同 origin 保护，避免关键源失败或 token 跨域误发时继续自动发布。
- 已完成：FINAL-10 / FMT-01 / FMT-03 第一阶段为共享格式化和阅读指标补契约。`format.mjs` 会拒绝非法 `YYYY-MM-DD`，JSDOM `CWLUtils.readingMinutes()` / `escapeHtml()` 与 Node 共享 helper 使用同 fixture 对照，减少 SSR、客户端和生成产物语义漂移。
- 已完成：FINAL-11 / MR-ASSET-07 第一阶段把手势工具远程 MediaPipe、face-api、Three.js、WASM 和模型 URL 纳入 `data/vendor-manifest.json`，`check:vendor` 和单测会校验 `js/gesture.js` 的远程 runtime 都被记录，并标出 upstream `latest` 模型仍需自托管/hash pin。
- 已完成：FINAL-11 / MR-ASSET-07 第二阶段在手势工具确认区展示 7 个远程视觉资源治理状态，区分版本锁定、upstream latest 和待自托管资源；browser smoke 已覆盖资源状态列表。
- 已完成：FINAL-12 第五阶段新增建议治理预算门禁，`npm run generate:suggestions-index` 会把当前 82 条待补建议和缺失字段基线写入 `docs/suggestions/evidence/current-suggestions-governance.json`；`check:suggestions-index` 会校验 README 生成索引、本地 Markdown 链接、heading anchors、治理统计和预算均未漂移，新增不完整建议或新增字段缺失会失败。
- 已完成：UX-12 / MR-AST-05 区分 AI 助手请求超时和用户手动停止文案，并补回归测试。
- 已完成：FINAL-07 第一阶段为 AI 助手 LLM 配置新增 endpoint host/path 信任确认和“记住 API key”显式选择；默认不再把用户 key 持久化到 localStorage，只有勾选 remember 后才保存。
- 已完成：S-13 / MR-TOOLS-01 / MR-VIS-01 / MR-VIS-02 为手势工具增加第三方视觉资源显式确认、启动门闩，并在页面隐藏时释放摄像头流。
- 已完成：MR-VIS-03 让 Galaxy canvas 遵守系统 reduced-motion 偏好，减少动态时只绘制静态星图、不持续排队 rAF。
- 已完成：P-14 第一阶段将手势启动状态拆为模型加载、摄像头初始化和视频流启动，弱网/授权等待时反馈更明确。
- 已完成：社交分享与评论专题第 1/2/3/4/6 项，分享相对 URL 优先使用 canonical 生产域，微博弹窗被拦截时有复制/二维码兜底；Giscus 外部脚本接近评论区才懒加载，加载失败会显示提示；评论 iframe 已跟随站内语言和主题同步。
- 已完成：S-15 / MR-CORE-02 删除 UUID 工具的 `Math.random()` 弱随机 fallback，缺少 Web Crypto 时明确失败。
- 已完成：内容发现专题 1-4 修复博客年份分组计数、空分组隐藏、`?q=` 搜索直达和移动目录焦点恢复。
- 已完成：内容发现专题 5 为搜索脚本加载失败增加按钮错误态、toast、日志和可重试路径。
- 已完成：新增真实浏览器与视觉冒烟专题，记录 Playwright/HTTP smoke、响应式截图、权限 API 和 CI artifact 后续落地路径。
- 已完成：新增 `test:browser-smoke`，用 Playwright Chromium 覆盖桌面关键路径、移动端关键路径和 `/tools/` JSON/随机数/Galaxy Canvas/UUID Clipboard/手势确认门闩交互，并修复博客列表双 `h1` 语义问题。
- 已完成：FINAL-08 第二阶段将 `test:browser-smoke` 接入 GitHub Actions 主 CI，并在失败时用 `actions/upload-artifact` 上传 `temp/browser-smoke/`；本地和 CI 都能保留截图、DOM 与 JSON 元数据用于复盘。
- 已完成：新增 `test:http-smoke`，把 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/` 的 HTTP 可达性、H1/main 和本地脚本引用检查接入 CI。
- 已完成：RRG-02 第一阶段新增 `test:http-smoke:full` 与 `test:browser-smoke:full`，可选覆盖 `STATIC_PAGES` 全量静态页。
- 已完成：RRG-03 为 `SEARCH_PAGES` 增加路径与 hash route 反查测试，保护 `/ai/#nav` 搜索结果能打开对应 Tab。
- 已完成：RRG-06 为 `STATIC_PAGES` 增加临时构建 route-to-output 完整性检查，防止页面注册后漏构建产物。
- 已完成：MR-ASSET-01 新增 `data/vendor-manifest.json` 与 `npm run check:vendor`，用 SHA-256 清单治理本地 vendor 文件来源、版本和完整性。
- 已完成：MR-ASSET-02 将第三方 `preconnect` 改为页面能力与用户动作触发，普通页面仅保留低成本 DNS hint。
- 已完成：MR-ASSET-03 调整 `robots.txt`，不再屏蔽公开 JS/CSS/webfonts 渲染资源，避免削弱搜索引擎渲染抓取。
- 已完成：MR-ASSET-05 为首页、文章页和工具页增加路由级 raw/gzip 总预算与 JS 子预算。
- 已完成：MR-ASSET-06 扩展 `validate:production` 图片检查，覆盖全站 HTML 的 alt、尺寸、loading 和 decoding 策略。
- 已完成：CSS-OWN-06 扩展 `validate:production` 本地 CSS/JS 资源检查，从 HTML 和 `PAGE_ASSETS` 派生资源存在性校验；当前生产验证 75/75 通过。
- 已完成：P-17 / CSS-OWN-07 将 AI 助手浮层样式拆到 `/css/assistant.css` 并由 `assistant-loader.js` 首次打开时注入；`coder.css` 回落到 112,956 bytes，`check:pwa-precache` 已覆盖 19 个 URL。
- 已完成：P-17 / CSS-OWN-08 将工具页 shell、tab、面板、字段、输出和移动端工具布局迁入 `/css/tools.css`；`coder.css` 进一步回落到 103,446 bytes，路由级 CSS 预算仍通过。
- 已完成：MR-TRUST-LAUNCH-01 将 HTTP/browser smoke 路由改为由 `STATIC_PAGES` 派生的 `SMOKE_ROUTES` / `MOBILE_SMOKE_ROUTES`，减少新增页面时的多处清单漂移。
- 已完成：HSG-01/HSG-02/HSG-03/HSG-06 补齐手写静态页 `/trust/` 导航、`footer-links`、公共脚本顺序 parity，并把 `/404.html` 的恢复入口纳入 HTTP/browser smoke。
- 已完成：新增 `/trust/` 隐私与信任中心，纳入导航、页脚、站内搜索、sitemap、robots、HTTP/browser smoke 和模板回归测试；第三方服务与本机数据说明集中由 `src/trust-data.mjs` 渲染。
- 已完成：内容新鲜度与信任信号专题 1-6 已落地，sitemap 文章 `lastmod` 优先使用 `modified`，文章元信息在真实更新时显示“更新于”，搜索索引/搜索结果展示 `modified` 与“更新/发布”日期信号；RSS 支持显式 `majorUpdate`，旧项目文章已有复核状态提示，单篇文章提供源码与带 slug 的反馈入口。
- 已完成：修复按钮可访问名称测试的静态正则盲区，改用 JSDOM 解析真实按钮名称。

### 当前健康度修正

| 维度 | 2026-06-18 | 2026-07-03 复查 | 说明 |
|------|------------|------------------|------|
| 安全性 | 3.5 / 5 | 3.5 / 5 | 前端默认体验 key、AI 对话保留、手势第三方资源确认、UUID 弱随机 fallback 和普通随机数用途提示已修复；模型自托管/hash 清单仍需治理 |
| 工程化 | 4.2 / 5 | 4.0 / 5 | assistant 默认 key、模式恢复、SSE 尾包、超时/停止语义、Cron 性能预算和生产验证缓冲/只读构建已补回归；通用 DOM 契约仍需推进 |
| 性能 | 4.2 / 5 | 4.1 / 5 | 工具页首屏 DOM 已拆到按需挂载，Cron 不可能日期已短路，助手 CSS 和工具基础 CSS 已拆包；工具页 JS 单包、模型加载体验和更泛化稀疏表达式优化仍需治理 |
| 用户体验 | 4.0 / 5 | 4.0 / 5 | AI 助手默认模式、隐私文案、超时反馈、内容筛选状态、编辑器标签和 QR 预览稳定性已处理；更细的错误国际化仍需推进 |
| 综合 | 3.9 / 5 | 4.0 / 5 | 项目整体可稳定运行，剩余高优先级集中在工具 JS 拆包、模型自托管、加载体验和 hash 清单 |

---

## 🏥 项目健康度总评

| 维度 | 评分 | 等级 |
|------|------|------|
| 代码质量 | 4.0 / 5 | 🟢 良好 |
| 安全性 | 3.5 / 5 | 🟡 中等 |
| 性能 | 4.2 / 5 | 🟢 良好 |
| 架构设计 | 4.3 / 5 | 🟢 优秀 |
| 工程化 | 4.2 / 5 | 🟢 良好 |
| 用户体验 | 4.0 / 5 | 🟢 良好 |
| 可维护性 | 3.7 / 5 | 🟢 良好 |
| **综合** | **3.9 / 5** | **🟢 良好** |

---

## 📊 问题统计

| 优先级 | 类别 | 文档 | 发现数量 |
|--------|------|------|----------|
| 🔴 第一 | Bug 与风险 | [bugs-and-risks.md](bugs-and-risks.md) | 17（中 5 / 已修复 12） |
| 🔴 第一 | 安全审计 | [security-audit.md](security-audit.md) | 16（高 1 / 中 2 / 低 7 / 已修复 6） |
| 🔴 第一 | 性能瓶颈 | [performance-bottlenecks.md](performance-bottlenecks.md) | 18（中 7 / 低 2 / 预防 1 / 部分 2 / 已修复 6） |
| 🟡 第二 | 代码质量 | [code-quality.md](code-quality.md) | 12（中 3 / 低 3 / 已修复 6） |
| 🟡 第二 | 架构评审 | [architecture-review.md](architecture-review.md) | 8（中 4 / 低 4） |
| 🟡 第二 | 技术债务 | [tech-debt.md](tech-debt.md) | 12（中 2 / 低 8 / 已修复 2） |
| 🟢 第三 | 新功能建议 | [new-features.md](new-features.md) | 13 |
| 🟢 第三 | UX 优化 | [ux-improvements.md](ux-improvements.md) | 15（中 3 / 低 2 / 已修复 10） |
| 🟢 第三 | 开发体验 | [devex-improvements.md](devex-improvements.md) | 15（中 3 / 低 4 / 部分 1 / 已修复 7） |
| 🔵 第四 | 模块分析-构建系统 | [module-reviews/build-system.md](module-reviews/build-system.md) | 5（低 2 / 已修复 3） |
| 🔵 第四 | 模块分析-客户端JS | [module-reviews/client-javascript.md](module-reviews/client-javascript.md) | 5（低 3 / 已修复 2） |
| 🔵 第四 | 模块分析-编辑器 | [module-reviews/editor.md](module-reviews/editor.md) | 6 |
| 🔵 第四 | 模块分析-Overleaf | [module-reviews/overleaf.md](module-reviews/overleaf.md) | 5 |
| 🔵 第四 | 模块分析-CSS | [module-reviews/css-analysis.md](module-reviews/css-analysis.md) | 7 |
| 🔵 第四 | SEO 与可访问性 | [module-reviews/seo-analysis.md](module-reviews/seo-analysis.md) | 7 |
| 🔵 第四 | 资源与内容分析 | [module-reviews/resource-analysis.md](module-reviews/resource-analysis.md) | 5 |
| 🔵 第四 | HTML 页面一致性 | [module-reviews/html-pages.md](module-reviews/html-pages.md) | 6 |
| 🔵 第四 | 工具箱手势与 API 测试器 | [module-reviews/tools-gesture-and-api.md](module-reviews/tools-gesture-and-api.md) | 5（中 3 / 低 2） |
| 🔵 第四 | AI 助手深度分析 | [module-reviews/assistant-deep-dive.md](module-reviews/assistant-deep-dive.md) | 5（高 1 / 中 3 / 低 1） |
| 🔵 第四 | tools-core 深度分析 | [module-reviews/tools-core.md](module-reviews/tools-core.md) | 5（中 1 / 低 4） |
| 🔵 第四 | 工具箱运行时安全专题 | [module-reviews/tools-core-runtime-safety.md](module-reviews/tools-core-runtime-safety.md) | 5（中 5） |
| 🔵 第四 | 视觉交互脚本深度分析 | [module-reviews/visual-interactions.md](module-reviews/visual-interactions.md) | 4（中 4） |
| 🔵 第四 | 社交分享与评论集成 | [module-reviews/social-comments-integrations.md](module-reviews/social-comments-integrations.md) | 6（中 4 / 低 2） |
| 🔵 第四 | 内容发现与视觉搜索入口 | [module-reviews/content-discovery-and-object-search.md](module-reviews/content-discovery-and-object-search.md) | 8（中 5 / 低 3） |
| 🔵 第四 | 产品信息页与排行榜 | [module-reviews/product-info-pages-and-rankings.md](module-reviews/product-info-pages-and-rankings.md) | 7（中 4 / 低 3） |
| 🔵 第四 | 内容新鲜度与信任信号 | [module-reviews/content-freshness-and-trust-signals.md](module-reviews/content-freshness-and-trust-signals.md) | 6（中 4 / 低 2） |
| 🔵 第四 | 竞品分析 | [competitive-analysis.md](competitive-analysis.md) | 6 |
| | **总计** | | **历史 141 条 + 复查新增/更新 88 条** |

---

## 🎯 按优先级排序的待办建议

### 🥇 高价值低成本（推荐立即实施）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| ~~S-11~~ | ~~移除前端可还原体验 API key，改走服务端限额代理或用户自填 key~~ ✅ 已完成 | 安全 | ~~⭐⭐~~ |
| ~~B-15~~ | ~~修复 AI 助手模式偏好读取逻辑，默认回到站点模式~~ ✅ 已完成 | Bug | ~~⭐~~ |
| ~~B-16~~ | ~~补齐 SSE 流结束 buffer flush，避免尾部 delta 丢失~~ ✅ 已完成 | Bug | ~~⭐~~ |
| ~~S-14~~ | ~~为 AI 助手增加隐私模式、历史保留期限和清除全部对话入口~~ ✅ 已完成 | 安全/功能 | ~~⭐⭐~~ |
| ~~P-16~~ | ~~优化 Cron 无解表达式，避免主线程百万次扫描~~ ✅ 主要慢路径已完成 | 性能 | ~~⭐⭐~~ |
| P-17 | 拆分全站 CSS，将工具箱和助手样式移出 core 包 | 性能/架构 | ⭐⭐⭐ |
| ~~UX-14~~ | ~~给 Markdown 主输入框补充 label/aria 名称并纳入 DOM 审计~~ ✅ 已完成 | UX | ~~⭐~~ |
| ~~UX-15~~ | ~~给 QR 结果图片补充尺寸和加载属性~~ ✅ 已完成 | UX | ~~⭐~~ |
| ~~F-04~~ | ~~主题跟随系统~~ ✅ 已优化 | 功能 | ~~⭐~~ |

已完成：S-00 移除前端硬编码 API key，并新增无 key 阻断和源码密钥扫描回归测试。
已完成：P-01 粒子动画空闲停止，并新增 fake canvas 回归测试。
已完成：B-06 构建期标题 ID 去重，并新增 TOC/正文锚点一致性回归测试。
已完成：UX-04 非文章页隐藏阅读进度条；B-11 替换废弃 `pageYOffset`。
已完成：CQ-01/B-12 统一快捷键编辑态判断到 `CWLUtils.isEditing()`。
已完成：CQ-10 构建期 TOC 与正文标题处理合并为单次遍历。
已完成：B-10 反馈时间格式化改用 `Number.isNaN()`。
已完成：B-09 性能监控改用 Navigation Timing Level 2。
已完成：CQ-07 应用源码 DOM 集合转换统一改用 `Array.from()`。
已完成：B-04 giscus 未配置占位提示改用 DOM API 渲染。
已完成：S-02 微信二维码弹窗改用 DOM API 渲染 i18n 文案。
已完成：B-03 搜索结果高亮改用 DOM API 渲染。
已完成：CQ-02 复制逻辑统一委托 `CWLUtils.copyText`。
已完成：CQ-03 移除 `search.js` 内联 `escapeHtml` 重复实现。
已完成：CQ-04 稳定业务模块统一委托 `CWLUtils.t`。
已完成：S-05 全站添加 meta CSP，并新增 HTML 扫描回归测试。
已完成：P-09 粒子动画移除 `shadowBlur`，改用双层绘制模拟辉光。
已完成：UX-01 移动端导航增加点击外部关闭遮罩，并新增模板/CSS/HTML 扫描回归测试。
已完成：SEO-03 修复 sitemap priority，首页/文章/静态页输出合理优先级。
已完成：SEO-01 首页补充 WebSite JSON-LD，并新增结构化数据解析测试。
已完成：MR-EDITOR-03 移除 marked 废弃 highlight 选项，改为渲染后调用 `hljs.highlightElement()`。
已完成：MR-EDITOR-01/02 清理编辑器重复 escape/copy 记录，并将 HTML 复制委托 `CWLUtils.copyText`。
已完成：MR-EDITOR-05 编辑器导出补齐 shortTitle、summary、description 必填 front matter。
已完成：DE-01 新增 GitHub Actions CI 质量门禁，并补充只检查不改写的 `lint:check`。
已完成：SEO-02 为生成静态页和手写工具页补充页面级 JSON-LD 结构化数据。
已完成：SEO-05 支持文章 `modified` front matter，并用于 Article JSON-LD 的 `dateModified`。
已完成：DE-09 声明 Node.js engines，并通过 workflow 测试与 CI Node 版本对齐。
已完成：DE-02 为 `test:coverage` 增加 Node 原生覆盖率阈值，CI 可阻断明显覆盖率回退。
已完成：F-04 主题模式支持 auto/light/dark，无本地偏好时跟随系统主题。
已完成：RES-02 为 6 篇文章补充 cover 和 1200×630 社交封面，并接入 OG、JSON-LD 与 image sitemap。
已完成：DE-03 新增 Dependabot 周期更新检查，覆盖 npm devDependencies 与 GitHub Actions。
已完成：DE-10 新增结构化 CHANGELOG.md，并用 workflow 测试守住标题、日期和分类。
已完成：P-12 移动端关闭高成本 `backdrop-filter`，降低小屏 GPU 合成压力。
已完成：DE-08 新增独立文章 front matter 校验命令，并接入本地 validate 与 CI。
已完成：P-06 搜索资源空闲预热，降低首次打开搜索的冷启动等待。
已完成：B-05/MR-EDITOR-04 统一阅读时间计算，消除构建端、文章页和编辑器算法漂移风险。
已完成：MR-BUILD-05 页面脚本合并去重，避免模板误传造成重复加载。
已完成：B-07 单篇页已有 SSR 目录时跳过动态 TOC 构建，避免重复目录。
已完成：B-02 粒子热路径使用 swap-and-pop 删除，并新增源码守卫防止回退到 `splice()`。
已完成：UX-10 返回顶部按钮初始化后再显示，避免页面加载时短暂闪烁。
已完成：MR-BUILD-02 提取 RSS channel renderer，三种 feed 共用同一套 XML 外壳逻辑。
已完成：UX-05 订阅邮箱无效时增加输入框错误态和 `aria-invalid` 反馈。
已完成：UX-02 导航搜索按钮增加本地化快捷键 tooltip 与 aria 提示。
已完成：TD-08 移除全局 `scroll-behavior: smooth`，由 JS 按需控制平滑滚动。
已完成：UX-08 移动端文章分享条改为紧凑换行布局。
已完成：MR-BUILD-03 扩展 `tidyHtml()` 的 HTML 块保护范围，避免压缩块内空行。
已完成：UX-06 反馈列表增加确认后清空全部本地留言能力。
已完成：S-09 `validate:posts` 增加公开内容敏感标记扫描，防止内部笔记进入搜索索引。
已完成：MR-JS-04 `blog.js` 启动期文章项缓存只构建一次，消除重复 DOM 查询。
已完成：S-10 JWT 解码工具增加常驻签名未验证警示，防止安全决策误用。
已完成：MR-JS-05 `giscus.js` observer 清理改用 `pagehide`，避免 `unload` 影响 bfcache。
已完成：P-10 全站补齐第三方 resource hints，并进一步将重成本 `preconnect` 收敛到评论页或用户订阅动作后。
部分完成：P-11 Markdown 正文图片构建期补齐 `loading="lazy"` 与 `decoding="async"`，图片尺寸注入留作后续。
已完成：P-08 `coder.js` resize 阅读进度更新改用独立 200ms throttle，避免复用 scroll 节流状态。
已完成：UX-09 全站新增跳过导航链接和 `#main-content` 目标，并用 HTML/CSS 扫描测试防回退。

### 🥈 高价值中成本（建议近期规划）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| P-02 | CSS 关键路径提取 | 性能 | ⭐⭐ |
| P-03 | JS 文件合并 | 性能 | ⭐⭐ |
| P-04 | ~~Font Awesome 按需加载~~ ✅ 已优化 | 性能 | ~~⭐⭐~~ |
| CQ-06 | coder.js 拆分 | 代码质量 | ⭐⭐ |
| CQ-05 | assistant.js i18n | 代码质量 | ⭐⭐ |
| UX-03 | 图片 Lightbox | UX | ⭐⭐ |
| F-06 | 标签云可视化 | 功能 | ⭐ |
| COMP-02 | 构建时代码高亮 | 竞品借鉴 | ⭐⭐ |

### 🥉 低优先级（长期改进方向）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| AR-03 | ES Modules 迁移 | 架构 | ⭐⭐⭐ |
| F-07 | PWA 离线支持 | 功能 | ⭐⭐ |
| F-02 | AI 助手接入 LLM | 功能 | ⭐⭐⭐ |
| F-09 | 文章系列/专栏 | 功能 | ⭐⭐ |
| DE-07 | 开发文档 | 工程化 | ⭐⭐ |
| TD-09 | TypeScript / JSDoc 类型 | 技术债务 | ⭐⭐⭐ |

---

## 📁 文档目录结构

```
docs/
└── suggestions/
    ├── README.md                           ← 本文件（索引总览）
    ├── final-analysis-report-2026-07-03.md ← 完整分析报告与最终路线图
    ├── health-score.md                     ← 项目健康度评分报告
    ├── work-report.md                      ← 工作报告
    ├── hourly-report-2026-07-03-06.md      ← 第 6 小时工作报告
    ├── evidence/                           ← 当前质量基线证据
    ├── bugs-and-risks.md                   ← 潜在 Bug 与崩溃风险
    ├── security-audit.md                   ← 安全漏洞与防护建议
    ├── performance-bottlenecks.md          ← 性能瓶颈与优化建议
    ├── code-quality.md                     ← 代码质量分析
    ├── architecture-review.md              ← 架构设计评审
    ├── tech-debt.md                        ← 技术债务清单
    ├── new-features.md                     ← 新功能建议
    ├── ux-improvements.md                  ← 用户体验优化
    ├── devex-improvements.md               ← 开发体验优化
    ├── competitive-analysis.md             ← 同类项目对比
    └── module-reviews/
        ├── build-system.md                 ← 构建系统模块分析
        ├── client-javascript.md            ← 客户端 JS 模块分析
        ├── editor.md                       ← Markdown 编辑器模块分析
        ├── overleaf.md                     ← Overleaf 简历编辑器模块分析
        ├── css-analysis.md                 ← CSS 样式系统分析
        ├── seo-analysis.md                 ← SEO 与可访问性专项分析
        ├── resource-analysis.md            ← 资源与内容深度分析
        ├── html-pages.md                   ← 手写 HTML 页面一致性分析
        ├── tools-gesture-and-api.md        ← 工具箱手势与 API 测试器复查
        ├── visual-interactions.md          ← 视觉交互脚本深度分析
        ├── tools-core-runtime-safety.md    ← 工具箱运行时安全专题
        ├── shared-formatting-and-reading-contract.md ← 共享格式化与阅读指标契约
        └── pwa-offline-cache-readiness.md  ← PWA 离线能力与缓存策略
```

### 机器校验模块索引

以下清单由 `npm run generate:suggestions-index` 生成，并由 `npm run check:suggestions-index` 校验；要求 `module-reviews/` 下每个专题文档都有入口，且 `/docs/suggestions` 内本地 Markdown 链接和 heading anchors 均可解析。

<!-- suggestions-index:start -->
- [AI 助手模块深度分析](module-reviews/assistant-deep-dive.md)
- [AI 助手加载器与 LLM 运行时评审](module-reviews/assistant-loader-and-llm-runtime.md)
- [真实浏览器与视觉冒烟测试风险分析](module-reviews/browser-visual-smoke-testing.md)
- [构建产物同步与漂移治理专题分析](module-reviews/build-artifact-synchronization.md)
- [🔍 模块深度分析：构建系统 (scripts/build.mjs + src/)](module-reviews/build-system.md)
- [CI 与发布自动化专题分析](module-reviews/ci-release-automation-review.md)
- [🔍 模块深度分析：客户端 JavaScript (js/)](module-reviews/client-javascript.md)
- [内容发现与视觉搜索入口分析](module-reviews/content-discovery-and-object-search.md)
- [内容新鲜度与信任信号专题分析](module-reviews/content-freshness-and-trust-signals.md)
- [内容发布质量门禁专题分析](module-reviews/content-publishing-quality-gates.md)
- [核心阅读交互模块深度分析](module-reviews/core-reading-interactions.md)
- [CSP 与第三方资源边界专题分析](module-reviews/csp-resource-policy-review.md)
- [🔍 模块深度分析：CSS 样式系统 (css/coder.css)](module-reviews/css-analysis.md)
- [CSS 资源归属与页面级样式评审](module-reviews/css-resource-ownership-and-page-styles.md)
- [依赖与供应链姿态专题分析](module-reviews/dependency-supply-chain-posture.md)
- [编辑器与 Overleaf 创作工作流分析](module-reviews/editor-overleaf-authoring-workflows.md)
- [🔍 模块深度分析：Markdown 编辑器 (js/editor.js)](module-reviews/editor.md)
- [手写静态页公共外壳治理评审](module-reviews/hand-authored-static-page-governance.md)
- [🔍 模块深度分析：手写 HTML 页面一致性](module-reviews/html-pages.md)
- [i18n 与可访问性模块评审](module-reviews/i18n-and-accessibility.md)
- [i18n 覆盖率与内容一致性评审](module-reviews/i18n-coverage-and-content-consistency.md)
- [布局、响应式与打印样式专题分析](module-reviews/layout-responsive-print-review.md)
- [本地数据留存地图专题分析](module-reviews/local-data-retention-map.md)
- [🔍 模块深度分析：Overleaf 简历编辑器 (js/overleaf.js)](module-reviews/overleaf.md)
- [隐私与信任中心专题分析](module-reviews/privacy-and-trust-center.md)
- [产品信息页与排行榜专题分析](module-reviews/product-info-pages-and-rankings.md)
- [PWA 离线能力与缓存策略就绪度评审](module-reviews/pwa-offline-cache-readiness.md)
- [质量基线 Artifact 与发布证据治理评审](module-reviews/quality-baseline-artifact-governance.md)
- [Relay 数据质量与同步可靠性专题分析](module-reviews/relay-data-quality-and-sync.md)
- [🔍 资源与内容深度分析](module-reviews/resource-analysis.md)
- [路由注册与内容发现治理评审](module-reviews/route-registry-and-discovery-governance.md)
- [运行时观测性与错误韧性专题分析](module-reviews/runtime-observability-and-error-resilience.md)
- [搜索与内容发现链路专题分析](module-reviews/search-and-content-discovery.md)
- [搜索与 SEO 生成链路专题审查](module-reviews/search-and-seo-pipeline.md)
- [🔍 SEO 与可访问性专项分析](module-reviews/seo-analysis.md)
- [SEO、Feed 与结构化数据专题分析](module-reviews/seo-feed-and-structured-data.md)
- [共享格式化与阅读指标契约评审](module-reviews/shared-formatting-and-reading-contract.md)
- [社交分享与评论集成韧性分析](module-reviews/social-comments-integrations.md)
- [静态资产与第三方资源专题审查](module-reviews/static-assets-and-third-party-resources.md)
- [建议证据漂移审计](module-reviews/suggestion-evidence-drift-audit.md)
- [建议库治理与索引一致性专题分析](module-reviews/suggestions-knowledge-base-governance.md)
- [测试覆盖率风险地图](module-reviews/test-coverage-risk-map.md)
- [工具箱运行时安全专题分析](module-reviews/tools-core-runtime-safety.md)
- [tools-core 模块深度分析](module-reviews/tools-core.md)
- [🔍 模块深度分析：工具箱手势与 API 测试器](module-reviews/tools-gesture-and-api.md)
- [信任页上线闭环与烟测治理专题分析](module-reviews/trust-page-launch-readiness.md)
- [用户数据入口专题审查](module-reviews/user-data-entrypoints.md)
- [视觉交互脚本深度分析](module-reviews/visual-interactions.md)
<!-- suggestions-index:end -->

---

## 📝 分析方法说明

### 分析范围
- **源码文件**：28 个 JS 文件（~10000 行，其中 assistant.js 1585 行为最大，含本地 vendor）、11 个构建模块（~1900 行）、1 个 CSS 文件（5801 行）、6 篇 Markdown 文章
- **配置文件**：package.json、.eslintrc.json、.gitignore
- **测试文件**：23 个测试文件（518 个测试用例，100% 通过）

### 分析方法
1. 逐文件阅读全部源码
2. 运行测试套件验证当前状态（518/518 通过）
3. 运行 ESLint 检查（0 错误）
4. 交叉引用模块间依赖关系
5. 对比行业最佳实践和同类项目

### 分析原则
- **不修改任何现有代码文件**
- **不修改任何配置文件**
- **只输出分析报告和建议文档**
- 每条建议包含：位置、现状、影响、方案、收益
