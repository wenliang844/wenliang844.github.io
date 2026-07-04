# 当前工作树验证报告

> 分析时间：2026-07-03 第六轮 | 验证范围：当前未提交工作树、完整质量门禁、建议文档一致性

## 验证摘要

| 项目 | 结果 |
|------|------|
| Lint | `npm run lint:check` 通过，0 warnings |
| 全量测试 | `npm run quality:baseline` 通过；13/13 命令通过；`npm test` / `npm run test:coverage` 861/861 通过；`npm run check:vendor`、`npm run check:generated`、`npm run check:i18n`、`npm run check:seo-feed`、`npm run check:service-worker`、`npm run check:pwa-precache` 与 `npm run check:quality-baseline` 通过；`npm run test:http-smoke` 7/7 路由通过；`npm run test:http-smoke:full` 14/14 路由通过；`npm run test:browser-smoke` 已覆盖全局搜索文章章节、工具箱章节命中、搜索命中原因、相关文章推荐原因和文章列表页正文搜索；`npm run test:browser-smoke:full` 与 `npm run test:pwa-smoke` 通过 |
| i18n 覆盖 | `npm run check:i18n` 通过，21 个 HTML / 965 个引用 / 258 个唯一 key / 0 缺失 |
| SEO/feed 覆盖 | `npm run check:seo-feed` 通过，21 个 HTML / 19 个 indexable 页面 / 19 个 sitemap URL / 3 个 RSS feed / 21 个 feed alternate / 20 个 JSON-LD block / 0 违规 |
| Service Worker 生成 | `npm run check:service-worker` 通过，根目录 `service-worker.js` 与源码模板一致；`build --out` 也由同一模板生成 SW |
| PWA 预缓存 | `npm run check:pwa-precache` 通过，19 个 URL / 19 个 Service Worker URL / 2 个页面资源覆盖 / 0 缺失 / 0 额外 / 0 不可缓存 |
| 覆盖率 | `npm run test:coverage` 通过，line 94.21% / branch 79.23% / funcs 92.11% |
| 生产验证 | `npm run validate:production` 75/75 通过 |
| 依赖审计 | `npm audit --registry=https://registry.npmjs.org --audit-level=moderate` 0 vulnerabilities |
| 空白检查 | `git diff --check` 通过，仅 CRLF 工作区提示 |

## WV-01 [已处理]: 未提交修复已经通过完整门禁

- **位置**：`js/assistant.js`, `js/tools.js`, `js/editor.js`, `css/coder.css`, `scripts/validate-production.mjs`, `tests/*.mjs`, `docs/suggestions/*.md`
- **当前状态**：当前工作树包含 AI 助手安全边界、SSE 尾包、预览语义、Markdown 输入可访问名称、QR 图片尺寸、404 JSON-LD、工具页面板按需挂载和生产验证输出缓冲等修复；完整门禁已通过。
- **提交策略**：本轮按“修复 + 回归测试 + 文档记录”一起提交，保证行为变更和对应验证记录在同一个可追溯提交中。
- **收益**：避免源码行为已变更但报告仍停留在旧状态，后续继续优化时可以从干净基线出发。

## WV-02 [已处理]: README 与工作报告验证基线已同步

- **位置**：`docs/suggestions/README.md`, `docs/suggestions/work-report.md`, `docs/suggestions/health-score.md`
- **修复状态**：README 快照、健康度评分和工作报告已更新为 861/861 测试、94.21% 行覆盖率、0 漏洞、vendor manifest、生成产物漂移、i18n 覆盖、SEO/feed 覆盖、Service Worker 生成检查、PWA 预缓存、PWA smoke、文章/静态页章节搜索、搜索命中原因、相关文章推荐原因和文章列表页正文搜索 browser smoke、质量基线检查通过、生产验证 75/75。
- **收益**：建议索引反映最新验证基线，减少后续分析时重复确认测试数量。

## WV-08 [已处理]: i18n 覆盖缺口已纳入只读门禁

- **位置**：`scripts/check-i18n-coverage.mjs`, `js/i18n.js`, `src/templates/appreciation.mjs`, `tests/i18n-coverage.test.mjs`, `package.json`, `.github/workflows/ci.yml`
- **当前状态**：新增 `npm run check:i18n`，扫描 committed HTML 中的 `data-i18n*` 与 `body[data-i18n-page]` head key，要求英文词典或内联英文覆盖。当前检查 21 个 HTML、965 个引用、258 个唯一 key，缺失 0。
- **修复方案**：补齐离线页、文章目录和信任页统计区公共 key；鉴赏页专有名词显式输出 `data-i18n-en`；将检查接入 `check:readonly`、CI 和质量基线。
- **验证**：`npm run check:i18n` 通过；`node --test tests/i18n-coverage.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs tests/templates.test.mjs` 31/31 通过；`npm run check:readonly` 通过。
- **收益**：英文模式不会因新增页面或模板 key 漂移而悄悄回退中文，且“同名英文”和“真实漏翻”被机器区分。

## WV-09 [已处理]: SEO/feed 信号已纳入统一报告和只读门禁

- **位置**：`scripts/check-seo-feed.mjs`, `src/templates/layout.mjs`, `src/templates/post.mjs`, `src/templates/categories.mjs`, `docs/suggestions/evidence/current-seo-feed-report.json`
- **当前状态**：新增 `npm run check:seo-feed`，扫描 sitemap、RSS、HTML canonical、OG/Twitter、JSON-LD 和 RSS feed discovery。当前检查 21 个 HTML、19 个 indexable 页面、19 个 sitemap URL、3 个 RSS feed、每个 feed 6 个 item、21 个 feed alternate、20 个 JSON-LD block，违规 0。
- **修复方案**：公共模板默认输出全站 RSS alternate，文章列表和时间归档输出栏目 RSS；手写页补全站 RSS 自动发现；`seo:report` 生成 JSON evidence。
- **验证**：`npm run check:seo-feed` 通过；`node --test tests/seo-feed.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs tests/templates-extended.test.mjs` 56/56 通过；`npm run check:generated` 通过。
- **收益**：发布前能快速看见 sitemap、RSS、结构化数据和分享信号是否退化，RSS 阅读器也能从 HTML 自动发现订阅入口。

## WV-10 [已处理]: PWA 预缓存清单已纳入一致性门禁

- **位置**：`src/pwa-precache.mjs`, `scripts/check-pwa-precache.mjs`, `tests/pwa-precache.test.mjs`, `scripts/quality-baseline-core.mjs`, `scripts/write-quality-baseline.mjs`, `package.json`, `.github/workflows/ci.yml`
- **当前状态**：新增 `PWA_PRECACHE_URLS` 源码契约，复用公共布局的 `CORE_SCRIPTS`，并把 app shell、manifest、favicon、核心 CSS、按需助手 CSS、Font Awesome 字体、页面级 CSS 和核心脚本统一为 19 个保守预缓存 URL。
- **修复方案**：`npm run check:pwa-precache` 会加载 `service-worker.js` 暴露的 `PRECACHE_URLS`，比对源码契约、检查本地文件存在、Font Awesome CSS 字体引用覆盖，并确认所有预缓存 URL 都是缓存策略允许的资源；该检查已接入 `check:readonly`、CI 和质量基线 artifact。
- **验证**：`npm run check:pwa-precache` 通过；`node --test tests/pwa-precache.test.mjs tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs` 31/31 通过；`npm run check:readonly`、`npm run test:http-smoke:full`、`npm run test:browser-smoke:full` 与 `npm run test:pwa-smoke` 均通过。
- **收益**：新增核心脚本、字体或 Service Worker 预缓存条目时会在发布前暴露漂移，降低“在线可用、离线缺资源”的回归概率。

## WV-17 [已处理]: AI 助手浮层样式已从 core CSS 拆出

- **位置**：`css/assistant.css`, `css/coder.css`, `js/assistant-loader.js`, `src/pwa-precache.mjs`, `tests/assistant-loader.test.mjs`, `tests/css.test.mjs`, `tests/assistant.test.mjs`
- **当前状态**：`coder.css` 只保留导航 AI 入口基础样式；助手面板、消息、配置、隐私控件和移动端适配迁入 `/css/assistant.css`。`assistant-loader.js` 在首次点击 AI 入口或 fullscreen 深链时注入样式和 `/js/assistant.js`，并等待两者完成后重放首次点击。
- **验证**：`node --test tests/css.test.mjs tests/assistant-loader.test.mjs tests/pwa-precache.test.mjs tests/service-worker-generation.test.mjs tests/workflows.test.mjs` 65/65 通过；`npm run quality:baseline` 通过，13/13 命令、853/853 测试、PWA 19/19、生产验证 75/75。
- **收益**：普通页面首屏不再解析约 18KB 的助手浮层样式，`coder.css` 回落到 112,956 bytes / 5,311 行，同时离线模式仍能从 Service Worker 预缓存拿到助手样式。

## WV-18 [已处理]: 工具页基础样式已从 core CSS 拆出

- **位置**：`css/tools.css`, `css/coder.css`, `tests/css.test.mjs`, `tests/performance.test.mjs`, `src/service-worker-template.mjs`, `service-worker.js`
- **当前状态**：工具页 shell、tab、面板、字段、输出、QR/时间/UUID 预览和移动端工具页布局已迁入 `/css/tools.css`；`coder.css` 只保留编辑器工具栏仍使用的 `.tool-btn` / `.tool-sep` 共享样式。由于 `/css/tools.css` 是 PWA 预缓存资源，Service Worker 版本递增到 `2026-07-04-4` 并重新生成。
- **验证**：`node --test tests/css.test.mjs tests/performance.test.mjs tests/templates-extended.test.mjs tests/pwa-precache.test.mjs tests/workflows.test.mjs` 113/113 通过；`node --test tests/service-worker-generation.test.mjs tests/pwa-precache.test.mjs` 8/8 通过；`npm run check:service-worker` 与 `npm run check:pwa-precache` 通过。
- **收益**：`coder.css` 进一步回落到 103,446 bytes / 4,783 行；普通页面不再解析工具箱基础面板规则，工具页仍通过页面级 CSS 获得完整样式。

## WV-23 [已处理]: 页面隐藏时手势摄像头已释放

- **位置**：`js/gesture.js`, `tests/tools.test.mjs`, `docs/suggestions/module-reviews/visual-interactions.md`
- **当前状态**：手势工具运行中进入隐藏标签页时，`visibilitychange` 会调用 `stopCamera()`，释放摄像头 track、清空视频引用，并显示“页面已隐藏，摄像头已关闭”。
- **验证**：`node --test tests/tools.test.mjs` 44/44 通过；`npm run lint:check` 通过；`node --test tests/tools.test.mjs tests/workflows.test.mjs tests/performance.test.mjs` 77/77 通过；`npm run test:browser-smoke` 通过；`npm run quality:baseline` 通过，13/13 命令、853/853 测试、生产验证 75/75。
- **收益**：后台标签页不再继续占用摄像头流，降低隐私感知风险和电量/视频资源占用。

## WV-24 [已处理]: Galaxy canvas 已遵守减少动态偏好

- **位置**：`js/galaxy.js`, `tests/js-behavior.test.mjs`, `docs/suggestions/module-reviews/visual-interactions.md`
- **当前状态**：Galaxy 在 `(prefers-reduced-motion: reduce)` 下只绘制一帧静态星图，不持续排队 rAF；系统偏好恢复、页面恢复或面板显示时会按可见性重新启动动画。
- **验证**：`node --test tests/js-behavior.test.mjs` 37/37 通过；`node --test tests/js-behavior.test.mjs tests/tools.test.mjs tests/performance.test.mjs` 99/99 通过；`npm run lint:check` 与 `npm run test:browser-smoke` 通过。
- **收益**：高动态视觉工具尊重系统无障碍偏好，减少眩晕风险和后台/前台无意义动画成本。

## WV-25 [已处理]: 手势冷启动阶段反馈已拆分

- **位置**：`js/gesture.js`, `tests/tools.test.mjs`, `docs/suggestions/performance-bottlenecks.md`
- **当前状态**：手势启动链路在模型加载后继续显示“初始化摄像头…”与“启动视频流…”，区分远程模型下载、摄像头授权和视频播放阶段。
- **验证**：`node --test tests/tools.test.mjs tests/js-behavior.test.mjs` 82/82 通过；`npm run lint:check` 通过；`npm run quality:baseline` 通过，13/13 命令、853/853 测试、coverage line 94.20% / branch 79.49% / funcs 92.09%。
- **收益**：弱网或授权等待时用户能看到当前卡在哪个阶段，后续模型自托管和预缓存治理也有更清晰的 UI 状态基础。

## WV-26 [已处理]: 文章列表桌面 H1 与 browser smoke 稳定性已修复

- **位置**：`css/coder.css`, `scripts/browser-smoke.mjs`, `tests/css.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：文章列表页顶部 H1 在桌面布局保持可见，侧栏继续使用非 H1 标题；browser smoke 的通用可见性等待和搜索跳转等待提升到 10 秒，减少完整质量基线长跑时的偶发抖动。
- **验证**：`node --test tests/css.test.mjs tests/workflows.test.mjs` 54/54 通过；`npm run test:browser-smoke` 通过，确认 desktop `/post/` H1 可见；`npm run quality:baseline` 通过。
- **收益**：真实浏览器 smoke 不再被隐藏 H1 语义问题卡住，文章列表在桌面和移动端都有可见页面主标题。

## WV-27 [已处理]: 分享 canonical 与评论失败降级已补齐

- **位置**：`js/share.js`, `js/giscus.js`, `js/i18n.js`, `tests/share-subscribe-feedback-deep.test.mjs`, `tests/giscus-behavior.test.mjs`, `docs/suggestions/module-reviews/social-comments-integrations.md`
- **当前状态**：分享相对 URL 优先读取页面 canonical 的 origin，避免本地预览或镜像环境把非生产域传播出去；Giscus 外部脚本注入增加 `onerror` 和超时兜底，失败时评论区显示可理解提示，并记录 `script-error` 或 `timeout` 原因。
- **验证**：`node --test tests/share.test.mjs tests/share-subscribe-feedback-deep.test.mjs tests/giscus-behavior.test.mjs tests/js-behavior.test.mjs tests/templates-extended.test.mjs tests/workflows.test.mjs` 133/133 通过；`npm run test:browser-smoke`、`npm test`、`npm run validate:production`、`npm run quality:baseline` 和 `npm run check:quality-baseline` 通过，当前基线 13/13 命令、855/855 测试、生产验证 75/75。
- **收益**：分享、复制链接、二维码和评论区在预览环境、第三方脚本失败或网络拦截时都有更稳定的生产指向与可恢复反馈。

## WV-28 [已处理]: Giscus 第三方脚本已改为视口懒加载

- **位置**：`js/giscus.js`, `tests/giscus-behavior.test.mjs`, `docs/suggestions/module-reviews/social-comments-integrations.md`
- **当前状态**：配置完整时，`giscus.js` 不再在脚本执行后立刻注入 `https://giscus.app/client.js`；支持 `IntersectionObserver` 的浏览器会等评论区接近视口后加载，旧环境仍立即加载。文章列表 switch 模式会在懒加载触发时读取当前 active slug，之后继续支持文章切换 postMessage。
- **验证**：`node --test tests/giscus-behavior.test.mjs tests/js-behavior.test.mjs tests/share-subscribe-feedback-deep.test.mjs` 71/71 通过；`node --test tests/performance.test.mjs tests/giscus-behavior.test.mjs tests/templates-extended.test.mjs tests/workflows.test.mjs` 81/81 通过。
- **收益**：大多数只阅读正文、不触达评论区的访问不再提前连接和执行第三方评论脚本，降低首段阅读路径的性能成本与隐私暴露。

## WV-29 [已处理]: Giscus 已跟随站内语言和主题同步

- **位置**：`js/coder.js`, `js/giscus.js`, `tests/coder-deep.test.mjs`, `tests/giscus-behavior.test.mjs`, `docs/suggestions/module-reviews/social-comments-integrations.md`
- **当前状态**：`coder.js` 应用主题时派发 `cwl:themechange`，携带用户模式和实际 light/dark 主题；`giscus.js` 初次注入脚本时读取当前语言与 body 主题类，已加载 iframe 后监听 `cwl:langchange` / `cwl:themechange` 并发送 giscus `setConfig`。
- **验证**：`node --test tests/giscus-behavior.test.mjs tests/coder-deep.test.mjs tests/js-behavior.test.mjs tests/performance.test.mjs` 98/98 通过；`npm test` 858/858 通过；`npm run quality:baseline` 13/13 命令通过。
- **收益**：评论区不再在英文模式下保持中文 UI，也不会在站点手动切换浅色/深色后保持旧主题，减少跨 iframe 的割裂感。

## WV-30 [已处理]: Browser smoke 已忽略导航产生的正常 aborted 请求

- **位置**：`scripts/browser-smoke.mjs`, `tests/workflows.test.mjs`
- **当前状态**：browser smoke 仍记录同源 HTTP 4xx/5xx 和真实请求失败，但会忽略浏览器在页面跳转或关闭时主动产生的 `net::ERR_ABORTED`。本轮确认搜索交互中空闲预热 `/js/vendor/fuse.min.js` 被主动导航中止时，不再误判为运行时错误。
- **验证**：`npm run test:browser-smoke` 通过；`node --test tests/workflows.test.mjs tests/performance.test.mjs tests/giscus-behavior.test.mjs tests/coder-deep.test.mjs` 76/76 通过；`npm run quality:baseline` 通过。
- **收益**：真实浏览器 smoke 对搜索预热和快速跳转更稳定，同时不放过真正的本地资源缺失或脚本失败。

## WV-31 [已处理]: 微博分享弹窗拦截已有可恢复兜底

- **位置**：`js/share.js`, `tests/share-subscribe-feedback-deep.test.mjs`, `docs/suggestions/module-reviews/social-comments-integrations.md`
- **当前状态**：微博分享成功打开窗口时会清空 `opener`；`window.open` 返回空值时，链接触发器会升级为真实微博分享外链，同时尝试复制微博分享 URL；复制也失败时显示现有二维码兜底。
- **验证**：`node --test tests/share.test.mjs tests/share-subscribe-feedback-deep.test.mjs tests/js-behavior.test.mjs tests/performance.test.mjs tests/coder-deep.test.mjs` 120/120 通过；`npm test` 861/861 通过；`npm run test:browser-smoke` 和 `npm run quality:baseline` 通过。
- **收益**：强隐私浏览器、WebView 或企业策略拦截弹窗时，微博分享不再点击后无反馈，仍可通过外链重试、复制分享页或二维码继续分享。

## WV-32 [已处理]: 内容新鲜度信号已接入 sitemap、文章 UI 和搜索

- **位置**：`scripts/build.mjs`, `src/templates/post.mjs`, `js/search.js`, `js/i18n.js`, `search-index.json`, `sitemap.xml`, `tests/build-extra.test.mjs`, `tests/templates-extended.test.mjs`, `tests/search-behavior.test.mjs`, `docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`
- **当前状态**：文章 sitemap `lastmod` 优先使用 `post.modified || post.date`；单篇页和文章列表面板在 `modified !== date` 时显示 `.updated-time`；文章和文章章节搜索索引条目包含 `modified` 与 `freshness`，搜索结果日期徽标区分“更新/发布”并支持英文模式。
- **验证**：`node --test tests/build-extra.test.mjs tests/templates-extended.test.mjs tests/search-behavior.test.mjs` 83/83 通过；`node --test tests/performance.test.mjs` 18/18 通过；`npm run build` 通过。
- **收益**：搜索引擎、文章读者和站内搜索都能看到同一套更新日期信号；现有文章未声明真实 `modified` 时不会伪造最后更新时间。

## WV-33 [已处理]: 内容维护闭环已补 RSS 策略、旧文复核和反馈入口

- **位置**：`scripts/build.mjs`, `src/templates/post.mjs`, `js/feedback.js`, `js/i18n.js`, `css/coder.css`, `src/posts/lowcode-schema-codegen.md`, `src/posts/activiti-workflow-engine.md`, `src/posts/finance-saas-backend.md`, `tests/build-extra.test.mjs`, `tests/templates-extended.test.mjs`, `tests/feedback.test.mjs`, `tests/css.test.mjs`
- **当前状态**：RSS item 支持 `majorUpdate: true` 时使用 `modified` 作为 `pubDate`，普通复核仍保留发布日期；2022/2023 三篇项目复盘已增加 `status: historical`、`reviewed: 2026-07-04`、`contextNote`/`contextNoteEn`，页面显示 `.content-note`；单篇页新增源码链接和 `/contact/?topic=post&slug=<slug>#feedback-title`，反馈页会自动预填文章上下文。
- **验证**：`node --test tests/build-extra.test.mjs tests/templates-extended.test.mjs tests/feedback.test.mjs tests/css.test.mjs` 132/132 通过；`npm run build`、`npm run check:generated`、`npm run check:i18n`、`npm run check:seo-feed`、`npm run lint:check` 通过。
- **收益**：旧项目内容不再只有发布日期，读者能看见复核状态、查看源码并带上下文反馈问题；RSS 更新行为保持显式可控，不会因普通维护打扰订阅者。

## WV-14 [已处理]: Service Worker 文件已由源码契约生成

- **位置**：`src/service-worker-template.mjs`, `scripts/generate-service-worker.mjs`, `service-worker.js`, `scripts/build.mjs`, `scripts/quality-baseline-core.mjs`, `scripts/write-quality-baseline.mjs`, `tests/service-worker-generation.test.mjs`, `tests/workflows.test.mjs`, `package.json`, `.github/workflows/ci.yml`
- **当前状态**：根目录 `service-worker.js` 已由 `src/service-worker-template.mjs` 渲染，模板复用 `src/pwa-precache.mjs` 和 `src/pwa-cache-policy.mjs` 的预缓存与缓存策略契约，并保留现有版本声明、离线 fallback、network-only 安全边界和 PWA smoke 升级测试兼容性。
- **修复方案**：新增 `npm run generate:service-worker` 写入生成产物，新增 `npm run check:service-worker` 只读比较模板输出和根目录文件；`scripts/build.mjs --out` 也用同一模板输出 SW，避免临时构建与根目录产物双写。该检查已接入 `check:readonly`、CI、质量基线和工作流测试。
- **验证**：`node --test tests/service-worker-generation.test.mjs tests/pwa-cache-policy.test.mjs tests/pwa-precache.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs` 36/36 通过；`npm run check:service-worker`、`npm run check:pwa-precache`、`npm run build`、`npm run check:generated`、`npm test` 和 `npm run quality:baseline` 通过，当前基线 13/13 命令、847/847 测试通过。
- **收益**：后续修改缓存策略、预缓存清单或 SW 版本时会在发布前发现整文件漂移，降低手写 Service Worker 与源码契约不一致的维护风险。

## WV-11 [已处理]: PWA 搜索索引离线矩阵和旧缓存清理已纳入回归

- **位置**：`scripts/pwa-smoke.mjs`, `tests/pwa-cache-policy.test.mjs`, `scripts/quality-baseline-core.mjs`, `tests/quality-baseline.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：PWA smoke 现在验证 `/search-index.json` 未缓存时离线请求失败、在线加载后离线请求可用，并通过临时升级 Service Worker `VERSION` 验证旧 `cwlblog-*` 缓存清理、新版本缓存存在；质量基线会记录 `searchIndexUncached`、`searchIndexCached` 和 `serviceWorkerUpgrade`。Service Worker activate fixture 也会验证旧缓存清理，当前版本缓存和其他应用缓存保留。
- **验证**：`node --test tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs` 27/27 通过；`npm run test:pwa-smoke` 通过；`npm run quality:baseline` 通过，847/847 测试通过；`npm run test:browser-smoke:full` 重跑通过。
- **收益**：PWA 离线能力不再只验证导航 fallback，也覆盖搜索索引的可用边界和真实浏览器 Service Worker 升级清理核心逻辑。

## WV-20 [已处理]: 单篇文章离线阅读状态已产品化第一阶段

- **位置**：`src/templates/post.mjs`, `js/pwa-register.js`, `js/i18n.js`, `css/coder.css`, `scripts/pwa-smoke.mjs`, `tests/pwa-cache-policy.test.mjs`, `tests/quality-baseline.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：单篇文章页输出 `.post-offline-status` 状态徽标。Service Worker 控制页面后，在线显示“此文章已可离线阅读”，离线打开已缓存文章时显示“正在离线阅读此文章”；英文模式显示 “This article is available offline” / “Reading this article offline”。
- **验证**：`node --test tests/templates.test.mjs tests/css.test.mjs tests/pwa-cache-policy.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs` 76/76 通过；`npm run build`、`npm run check:generated`、`npm run check:i18n`、`npm run check:service-worker` 通过；`npm run test:pwa-smoke` 通过并覆盖在线文章状态、英文切换和离线缓存文章状态。
- **收益**：文章离线阅读不再只是隐式缓存行为，用户能看到当前文章是否已经可离线访问，以及离线时正在读取缓存内容。

## WV-21 [已处理]: 页面资源 manifest 已派生进 PWA 预缓存

- **位置**：`src/page-assets.mjs`, `src/pwa-precache.mjs`, `src/service-worker-template.mjs`, `service-worker.js`, `scripts/check-pwa-precache.mjs`, `scripts/quality-baseline-core.mjs`, `tests/pwa-precache.test.mjs`, `tests/templates-extended.test.mjs`, `tests/quality-baseline.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：`pageAssetUrls()` 会从 `PAGE_ASSETS` 拉平页面级 `styles`、`scripts` 和额外 `assets` 并去重；`PWA_PRECACHE_PAGE_ASSETS` 直接复用该 helper，当前把 `/css/tools.css` 与 `/css/trust.css` 纳入 Service Worker 预缓存。
- **验证**：`node --test tests/pwa-precache.test.mjs tests/quality-baseline.test.mjs tests/workflows.test.mjs tests/templates-extended.test.mjs tests/service-worker-generation.test.mjs tests/pwa-cache-policy.test.mjs` 72/72 通过；`npm run check:pwa-precache` 通过，19 个预缓存 URL / 19 个 Service Worker URL / 2 个页面资源覆盖 / 0 缺失页面资源。
- **收益**：工具页和信任页 CSS 拆包后不再只对在线首访友好；页面级资源新增或拆分时，会通过 PWA 预缓存检查和质量基线暴露漏配。

## WV-22 [已处理]: 生产验证已覆盖 HTML 与页面 manifest 的本地 CSS/JS 资源

- **位置**：`scripts/validate-production.mjs`, `src/page-assets.mjs`, `tests/workflows.test.mjs`
- **当前状态**：`validate:production` 新增 `checkLocalResourceReferences()`，递归扫描 21 个 HTML 页面中的本地 CSS/JS 引用，并额外检查 `pageAssetUrls()` 派生的 manifest 资源；当前会检查 21 个页面和 2 个 manifest 资源。
- **验证**：`node --test tests/workflows.test.mjs` 15/15 通过；`npm run validate:production` 75/75 通过；`npm run quality:baseline` 通过，当前 13/13 命令、853/853 测试通过。
- **收益**：页面级 CSS/JS 拆包后，发布前不仅依赖性能测试发现缺文件，生产验证也会直接阻断 HTML 或 `PAGE_ASSETS` 指向不存在资源的回归。

## WV-19 [已处理]: 相关文章推荐已展示评分原因

- **位置**：`scripts/build.mjs`, `src/templates/post.mjs`, `css/coder.css`, `post/*/index.html`, `scripts/browser-smoke.mjs`, `tests/build-extra.test.mjs`, `tests/templates.test.mjs`, `tests/css.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：`relatedPosts()` 已从单一中文标签重叠扩展为中文标签、英文标签、可选系列/领域/技术栈和主题信号综合计分。推荐结果带有 `relatedReason` / `relatedReasonEn`，单篇文章页相关文章卡片会展示“共同标签：Java、Spring Boot”或英文 “Shared tags: Java, Spring Boot”。
- **验证**：`node --test tests/build-extra.test.mjs tests/build-deep.test.mjs tests/build-extended.test.mjs tests/templates.test.mjs tests/css.test.mjs` 169/169 通过；`npm run build` 和 `npm run check:generated` 通过；browser smoke 已增加 `smokeRelatedPostReasons()` 覆盖推荐原因可见与英文切换。
- **收益**：相关文章不再只像“标签碰巧相同”，用户能看到推荐关系，英文模式下推荐解释也保持一致。

## WV-18 [已处理]: 搜索结果已展示命中字段原因

- **位置**：`js/search.js`, `js/i18n.js`, `css/coder.css`, `scripts/browser-smoke.mjs`, `tests/search-behavior.test.mjs`
- **当前状态**：全局搜索结果现在会基于 Fuse `matches` 展示命中原因，例如“命中正文”“命中章节”或英文模式的 “Matched section”。摘要片段优先来自实际匹配字段，并使用 matches 范围高亮；没有 matches 时回退到精确字段扫描。
- **验证**：`node --test tests/search-behavior.test.mjs tests/js-behavior.test.mjs tests/workflows.test.mjs` 58/58 通过；`npm run lint:check` 通过；`npm run test:browser-smoke` 通过，真实浏览器确认搜索结果命中原因可见。
- **收益**：搜索召回扩大后，用户能直接看到结果为什么命中，减少正文/章节/标签/路径混合结果带来的不确定感。

## WV-12 [已处理]: 搜索索引加载失败已区分离线、损坏和临时不可用

- **当前状态**：`js/search.js` 现在会在 `/search-index.json` 加载失败时区分 `navigator.onLine === false` 的离线未缓存状态、非数组 JSON 的索引损坏状态、HTTP 非 2xx 的临时不可用状态和通用失败状态。
- **修复方案**：新增 `dyn.search.offlineUncached`、`dyn.search.indexInvalid`、`dyn.search.indexUnavailable` 英文文案，并新增 `tests/search-behavior.test.mjs` 覆盖中文离线提示、英文离线提示、异常索引提示和成功搜索结果渲染。
- **验证**：`node --test tests/search-behavior.test.mjs tests/search-loader-behavior.test.mjs tests/js-behavior.test.mjs` 51/51 通过；`npm test` 847/847 通过；`npm run quality:baseline` 通过。
- **收益**：PWA 搜索体验不再把未缓存离线、资源损坏和服务端短暂异常都显示为同一条“稍后重试”，用户能更快理解失败原因。

## WV-13 [已处理]: 搜索索引召回率和正文命中解释已补第一阶段

- **当前状态**：文章搜索正文预算从 600 字提升到 3200 字，根目录 `search-index.json` 已包含 `ESClient`、`Web Worker`、`Galaxy`、`Maven`、`BPMN` 等长尾关键词，并进一步扩展到文章章节和静态页章节。
- **修复方案**：新增搜索索引质量预算和抽样关键词回归测试；搜索结果摘要现在会优先选择包含查询词的 summary/body/path 字段，正文命中时能展示命中片段。
- **验证**：`node --test tests/search-behavior.test.mjs tests/build-extra.test.mjs tests/performance.test.mjs` 59/59 通过；`npm run check:generated` 通过；`npm test` 847/847 通过；`npm run quality:baseline` 通过。
- **收益**：长文中段的技术词不再因为 600 字截断而不可发现，搜索结果也更容易解释命中原因。

## WV-15 [已处理]: 全局搜索已支持文章章节级命中和锚点跳转

- **位置**：`scripts/build.mjs`, `js/search.js`, `css/coder.css`, `js/i18n.js`, `search-index.json`, `scripts/browser-smoke.mjs`, `tests/build-extra.test.mjs`, `tests/search-behavior.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：根目录 `search-index.json` 现在包含 6 篇文章、51 个 `post-section` 文章章节、11 个 `page-section` 静态页章节和 12 个页面，当前为 123,287 字符 / 216,563 UTF-8 bytes，低于 500KB 文件性能预算。每个文章章节条目包含 `sectionTitle`、受控长度正文片段、文章标签和 `/post/<slug>/#toc-*` 深链接。
- **修复方案**：构建期从渲染后的 H2/H3 heading 中提取章节，正文片段限制为 560 字符；搜索弹窗将 `sectionTitle` 纳入 Fuse 权重和摘要选择，结果中显示“章节/Section”与章节标题，并支持英文标题和英文锚点本地化。Browser smoke 新增 `BPMN` 搜索交互，确认章节结果可见并跳转到文章 heading hash。
- **验证**：`node --test tests/workflows.test.mjs tests/search-behavior.test.mjs tests/build-extra.test.mjs` 58/58 通过；`npm test` 847/847 通过；`npm run check:generated`、`npm run check:i18n`、`npm run test:browser-smoke` 和 `npm run quality:baseline` 通过。

## WV-16 [已处理]: 静态页面章节级搜索和工具箱 hash 激活已落地

- **位置**：`src/config.mjs`, `scripts/build.mjs`, `js/search.js`, `js/tools.js`, `src/templates/ai.mjs`, `scripts/browser-smoke.mjs`, `tests/build-extra.test.mjs`, `tests/search-behavior.test.mjs`, `tests/js-behavior.test.mjs`
- **当前状态**：`SEARCH_PAGES` 现在支持显式 `searchSections`，构建时生成 11 个 `page-section` 条目，覆盖工具箱 JSON/API/Cron/JSONPath/Markdown/Galaxy、信任页本机数据/外部服务/安全说明、AI 页中转站榜单/AI 导航。`/ai/#nav` 已有真实锚点，`/tools/#tool-tab-*` 会在页面加载或 hashchange 时自动激活对应工具面板。
- **验证**：`node --test tests/build-extra.test.mjs tests/search-behavior.test.mjs tests/js-behavior.test.mjs tests/workflows.test.mjs` 95/95 通过；`npm run test:browser-smoke` 通过，真实浏览器中搜索 `Cron` 后跳转 `/tools/#tool-tab-cron` 并确认 Cron 面板激活；`npm run quality:baseline` 通过。
- **收益**：工具名、隐私服务和 AI 导航内容不再只依赖静态页 summary/tags；搜索结果能直接解释并定位到页面内功能区。

## WV-17 [已处理]: 文章列表页搜索已纳入正文和章节长尾词

- **位置**：`js/blog.js`, `scripts/browser-smoke.mjs`, `tests/blog.test.mjs`, `tests/workflows.test.mjs`
- **当前状态**：`/post/` 文章列表页本地搜索的 haystack 已从标题/摘要/标签扩展为标题、摘要、H2/H3 章节标题、正文、slug 和标签。现有标签筛选、`?q=` URL 同步、年份分组计数、空状态和 J/K 导航保持不变。
- **验证**：`node --test tests/blog.test.mjs tests/workflows.test.mjs` 32/32 通过；`npm run lint:check` 通过；`npm run test:browser-smoke` 通过并新增 `/post/ search interactions`，真实浏览器中搜索 `ESClient` / `Web Worker` 可筛出对应文章并同步 URL。
- **收益**：全局搜索能找到的正文长尾词，在文章列表页内也能继续筛选定位，减少用户从全局搜索进入目录页后的搜索口径落差。

## WV-05 [已处理]: 生产验证脚本在大输出测试套件下误报失败

- **位置**：`scripts/validate-production.mjs:16`, `scripts/validate-production.mjs:130-136`, `tests/workflows.test.mjs:103-108`
- **当前状态**：`npm run validate:production` 首次在内部测试阶段误报失败；直接运行 `node --test tests/*.test.mjs` 和覆盖率套件均通过，确认是校验脚本输出缓冲不足。
- **修复方案**：为测试执行设置 `TEST_OUTPUT_MAX_BUFFER = 32 * 1024 * 1024`，并新增静态回归测试锁定该保护。
- **验证**：`node --test tests/workflows.test.mjs` 通过；`npm run validate:production` 74/74 通过；`npm run test:coverage` 847/847 通过。
- **收益**：生产门禁不再因测试输出增长而假红，后续自主循环能继续依赖该命令作为部署前质量信号。

## WV-03 [已处理]: Cron 不可能日期表达式已短路

- **位置**：`js/tools-core.js:938-980`, `tests/tools-core-deep.test.mjs:258-266`
- **修复状态**：`parseCronExpression()` 已提前识别“月份中没有任何可匹配 day-of-month，且 day-of-week 为通配”的不可能日期表达式，避免两年分钟粒度扫描。
- **验证**：`npm test` 847/847 通过；`tests/tools-core-deep.test.mjs` 新增 `<50ms` 性能预算断言和 `0 0 31 2 mon` OR 语义保护用例。

## WV-06 [已处理]: 公开站点缺少隐私与信任入口

- **位置**：`src/trust-data.mjs`, `src/templates/trust.mjs`, `src/config.mjs`, `src/templates/layout.mjs`, `trust/index.html`
- **当前状态**：新增 `/trust/` 页面，集中说明本机数据、第三方服务、用户控制和安全摘要，并接入导航、页脚、站内搜索、sitemap、robots、HTTP smoke 和 browser smoke。
- **验证**：`node --test tests/templates-extended.test.mjs tests/css.test.mjs tests/build.test.mjs tests/workflows.test.mjs` 通过；`npm run test:http-smoke` 7/7 通过；`npm run test:browser-smoke` 通过。
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
