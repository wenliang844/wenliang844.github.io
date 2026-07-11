# CWLBlog 全站浏览测试与优化建议审计报告

> 审计日期：2026-07-03  
> 审计方式：临时副本质量门禁 + 本地静态服务 + Chrome/Playwright 浏览矩阵 + Lighthouse 抽样  
> 产物目标：记录当前真实状态、可复现问题、优化优先级和新增功能 backlog。

## 1. 执行摘要

本次审计覆盖 19 个 HTML 入口、4 个视口（1440x900、1280x800、768x1024、390x844）和 8 条核心用户流。整体质量已经比较稳：构建、测试、生产验证、依赖审计都通过；首页和文章页 Lighthouse 分数优秀；搜索、订阅、AI 助手、博客筛选、文章分享、工具箱、编辑器、Overleaf、反馈和 AI 中转站主要流程可用。

最高优先级问题集中在三类：

- 生成文章页的 CSP 与手写页不一致，导致 giscus 的 `default.css` 被拦截，文章评论样式会在浏览器控制台报错。
- `/post/` 聚合页一次渲染多篇文章完整正文，多个文章正文生成了重复的 `toc-*` heading id，影响锚点、目录、DOM 唯一性和后续脚本可靠性。
- 工具箱移动端性能和可访问性低于其他页面：Lighthouse mobile performance 85、accessibility 89，主要来自 1345 个 DOM 节点、单体 CSS、工具脚本/面板一次性加载。

建议先修 P1，再按“性能拆分、可访问性补齐、工程化自动浏览回归、功能产品化”推进。

## 2. 审计范围与方法

- 页面覆盖：`/`、`/post/`、6 篇文章详情、`/ai/`、`/tools/`、`/editor/`、`/overleaf/`、`/appreciation/`、`/sponsor/`、`/contact/`、`/categories/`、`/tags/`、`/about/`、`/404.html`。
- 交互覆盖：导航菜单、主题切换、语言切换、全站搜索、订阅弹窗、AI 助手、本地问答、博客搜索/标签筛选、文章 TOC/分享/评论、工具箱 JSON/Base64/Markdown/API Tester、编辑器预览、Overleaf 格式切换、反馈表单、AI 页面 tab/relay 搜索。
- 浏览器路径：浏览器插件核心文件存在，但当前会话没有暴露该插件要求的浏览器控制入口；按计划改用 Playwright 1.61.1 + 本机 Chrome 150.0.7871.47 作为替代。
- 临时副本：按计划排除 `.git`、`node_modules`、`.idea`、`temp`。由于项目测试依赖 `git ls-files *.html`，在副本中临时 `git init` 并暂存 19 个 HTML 文件后重跑测试。

## 3. 质量门禁结果

| 检查项 | 结果 | 备注 |
| --- | --- | --- |
| `npm ci` | 通过 | 有弃用警告：`eslint@8`、`glob@7`、`rimraf@3`、`inflight` 等 |
| `npm run lint:check` | 通过 | 0 errors；77 warnings，集中在 `js/galaxy.js` / `js/gesture.js` 的 `var` / `prefer-const` |
| `npm test` | 通过 | 731/731；首次因副本无 `.git` 失败，补临时 Git 索引后通过 |
| `npm run validate:posts` | 通过 | 6 篇文章 front matter 有效 |
| `npm run build` | 通过 | 生成 6 篇文章和索引产物 |
| `npm run validate:production` | 通过 | 34 passed / 0 failed / 0 warnings |
| `npm run test:coverage` | 通过 | all files line 94.27%、branch 76.04%、funcs 91.70% |
| `npm audit --registry=https://registry.npmjs.org` | 通过 | 0 vulnerabilities |
| `npm outdated --json` | 有维护项 | 仅 `eslint`：8.57.1 -> 9.39.4 |

覆盖率低点：

- `scripts/parse-relay.mjs`：line 77.23%、branch 46.58%。
- `scripts/update-commercial-relay.mjs`：line 68.14%、branch 64.91%。

## 4. Lighthouse 抽样结果

| 页面 | 设备 | Performance | Accessibility | Best Practices | SEO | 主要观察 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `/` | mobile | 89 | 100 | 100 | 100 | LCP 3.3s；CSS render-blocking 约 710ms；`assistant.js` 约 26 KiB unused |
| `/` | desktop | 100 | 100 | 100 | 100 | 桌面首屏表现优秀 |
| `/post/rule-engine-alerts/` | mobile | 92 | 100 | 93 | 100 | giscus CSS CSP console error；LCP 3.2s |
| `/tools/` | mobile | 85 | 89 | 100 | 100 | LCP 4.1s；DOM 1345；unused JS 约 101 KiB；unused CSS 约 112 KiB |

Lighthouse 在 Windows 上生成 JSON 后清理临时 Chrome 目录时返回 `EPERM`，但四份 JSON 均成功生成并可解析；该异常记录为工具清理问题，不计为站点缺陷。

## 5. 优先问题清单

### P1-01 生成文章页 CSP 拦截 giscus 样式

- 分类：安全 / 评论体验 / 配置一致性
- 影响：`/post/` 和所有文章详情页。
- 证据：浏览器控制台报错 `Loading the stylesheet 'https://giscus.app/default.css' violates ... style-src 'self' 'unsafe-inline'`；Playwright 在文章页 4 个视口均捕获 `https://giscus.app/default.css` 的 CSP request failure。
- 源码位置：`src/templates/layout.mjs:43-44` 的 `style-src` 缺少 `https://giscus.app`；手写页如 `index.html:6` 已包含该域名，生成页如 `post/index.html:6` 不包含。
- 复现：启动站点，打开任意文章详情页，查看 DevTools Console / Network。
- 建议方案：统一 CSP 来源，优先从公共模板生成所有页面的 CSP；短期在 `CONTENT_SECURITY_POLICY` 的 `style-src` 加上 `https://giscus.app`，并补测试断言生成页和手写页 CSP 完全一致。
- 成本：低。
- 验收标准：文章页无 giscus `default.css` CSP 错误；`npm test` 增加 CSP host 回归；Lighthouse `errors-in-console` 恢复通过。

### P1-02 `/post/` 聚合页存在重复正文 heading id

- 分类：SEO / 可访问性 / 锚点可靠性
- 影响：`/post/` 4 个视口。
- 证据：浏览器扫描发现多个重复 id，如 `toc-1-一-项目概述`、`toc-2-二-业务价值` 等；这些 id 来自多篇文章相同标题。
- 源码位置：`scripts/build.mjs:203-220` 生成 heading id；`src/templates/post.mjs:319-343` 在聚合页一次渲染所有文章正文。
- 复现：打开 `/post/`，在控制台执行 `Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i)`。
- 建议方案：聚合页 heading id 加文章 slug 前缀，例如 `post-${slug}-toc-*`；单篇页保持当前短 id；TOC、搜索和文章切换逻辑同步使用聚合页 id。另一个中期方案是 `/post/` 只渲染摘要，点击文章后进入详情页或懒加载正文。
- 成本：中。
- 验收标准：`/post/` 无重复 id；列表页文章切换、TOC、hash 跳转、搜索和分享仍通过；新增 HTML 扫描测试阻断重复 id 回归。

### P1-03 工具箱移动端首屏偏重

- 分类：性能 / 移动体验
- 影响：`/tools/`。
- 证据：Lighthouse mobile：Performance 85、LCP 4.1s、DOM 1345、unused JS 约 101 KiB、unused CSS 约 112 KiB；页面一次性渲染 31 个 tab/panel。
- 源码位置：`tools/index.html` 约 100KB+；`src/templates/tools.mjs` 一次输出所有面板；`js/tools-core.js` / `js/tools.js` 首屏加载全部工具逻辑。
- 复现：运行 Lighthouse mobile 或在低端移动模拟器打开 `/tools/`。
- 建议方案：首屏只 SSR 当前 active panel 和 tab 列表，其他工具面板用 `<template>` 或 JSON 按需挂载；工具核心函数按类别拆分；手势/Galaxy/Markdown/highlight 等重资源继续按需加载；为 `/tools/` 单独设性能预算。
- 成本：中到高。
- 验收标准：`/tools/` mobile Lighthouse Performance >= 90、Accessibility >= 95；DOM 节点首屏降到 800 以下；未打开的工具不加载对应运行时代码。

### P2-04 工具页、编辑器、Overleaf 预览内容引入第二个 H1

- 分类：SEO / 语义结构
- 影响：`/tools/`、`/editor/`、`/overleaf/`。
- 证据：浏览器扫描显示 `/editor/` 有 `Markdown 编辑器` 和预览里的 `新文章标题` 两个 H1；`/overleaf/` 有 `多格式简历模板` 和简历预览里的 `CWL`；`/tools/` 有 `在线工具箱` 和内嵌 Markdown 预览里的 `新文章标题`。
- 源码位置：`editor/index.html:82`、`js/editor.js:18`、`overleaf/index.html:80`、`js/overleaf.js:682` / `js/overleaf.js:790`、`tools/index.html:85` / `tools/index.html:637`。
- 复现：打开对应页面，执行 `document.querySelectorAll('h1').length`。
- 建议方案：预览 iframe 化，或给预览容器加 `aria-label` 并将示例 Markdown 默认标题降为 `##`；Overleaf 预览可保留视觉 H1 但放入 isolated iframe / shadow root，避免与页面主文档争夺语义层级。
- 成本：中。
- 验收标准：页面主文档只有一个 H1；预览内容仍视觉正确；编辑器/Overleaf 测试同步更新。

### P2-05 [已修复] 搜索输入缺少显式可访问名称

- 分类：可访问性
- 影响：全站搜索弹窗、AI 中转站筛选。
- 修复状态：`.search-modal-input` 已增加 `aria-label` 并随语言切换同步；`#relay-search-input` 已增加 `aria-label="搜索中转站"`、`data-i18n-aria="relay.search.aria"` 和英文文案。
- 验证：`npm run check:readonly` 通过；Playwright 抽查 `/ai/` 确认 Relay 搜索输入可读名称存在。
- 原证据：全站搜索弹窗 input 仅有 placeholder 和 `role="combobox"`；AI relay 搜索 input 被 `<label class="relay-search">` 包裹但没有可读文本，只有图标和 placeholder。
- 源码位置：`js/search.js:24`、`ai/index.html:103-105`、`src/templates/ai.mjs` 对应模板。
- 复现：打开搜索弹窗或 `/ai/`，用 Accessibility 面板查看输入框 name。
- 建议方案：为 `.search-modal-input` 加 `aria-label` / `aria-labelledby`，语言切换时同步；为 `#relay-search-input` 加 `aria-label="搜索中转站"` 或可见 `<span>`。
- 成本：低。
- 验收标准：Playwright/axe/Lighthouse 均能读出输入框名称；中英文切换后名称同步。

### P2-06 全站 CSP 仍偏宽松

- 分类：安全加固
- 影响：所有 19 个入口。
- 证据：所有页面 CSP 包含 `script-src 'unsafe-inline' 'wasm-unsafe-eval'`；Lighthouse `csp-xss` 提示 host allowlist、unsafe-inline、meta CSP 都是弱点。
- 源码位置：`src/templates/layout.mjs:39-44` 及手写页 meta CSP。
- 复现：运行 Lighthouse，查看 `csp-xss` audit。
- 建议方案：短期统一 CSP；中期移除不必要的 `cdn.jsdelivr.net` 和页面不用的第三方域名；长期将 CSP 移到 HTTP header（GitHub Pages 可通过反代/Cloudflare Pages 实现），对内联 JSON-LD 使用 nonce/hash 策略，评估 `wasm-unsafe-eval` 是否仅工具页需要。
- 成本：中到高。
- 验收标准：CSP 按页面最小化；无 Lighthouse 高危提示；所有动态脚本和 JSON-LD 通过测试。

### P2-07 单体 CSS 已成为主要渲染阻塞资源

- 分类：性能 / 架构
- 影响：全站。
- 证据：Lighthouse 显示 `css/coder.css` 在首页、文章页、工具页均为 render-blocking；unused CSS 约 104-112 KiB；文件接近现有 140KB 预算。
- 源码位置：`css/coder.css`、`src/templates/layout.mjs` 样式注入。
- 复现：任意页面 Lighthouse，查看 `render-blocking-resources` 和 `unused-css-rules`。
- 建议方案：拆成 `core.css`、`article.css`、`tools.css`、`editor.css`、`effects.css`；首屏 critical CSS 内联或 preload；非当前页面样式延迟加载。
- 成本：中。
- 验收标准：首页 mobile LCP < 2.8s，工具页 mobile LCP < 3.5s；核心 CSS 首包明显下降；CSS 测试覆盖拆分后选择器。

### P2-08 `assistant.js` 全站加载但首屏大量 unused

- 分类：性能 / 交互加载策略
- 影响：首页、文章页、工具页等所有页面。
- 证据：首页和文章页 Lighthouse 均显示 `assistant.js` 约 26 KiB unused；工具页也同样存在。
- 源码位置：公共脚本注入处和 `js/assistant.js`。
- 复现：Lighthouse `unused-javascript`。
- 建议方案：保留轻量按钮壳，用户点击 AI 按钮或空闲时再加载完整助手；或拆分 `assistant-shell.js` 与 `assistant-core.js`。
- 成本：中。
- 验收标准：首屏不加载完整助手核心；点击 AI 后 1s 内可交互；相关助手测试改为懒加载场景。

### P2-09 [已修复] 反馈表单无效提交缺少字段级错误态

- 分类：可访问性 / 表单体验
- 影响：`/contact/`。
- 修复状态：空提交会给 `#fb-message` 添加 `.is-invalid` 与 `aria-invalid="true"`，聚焦输入；用户输入有效内容时清除错误态。
- 验证：`npm run check:readonly` 通过；Playwright 抽查 `/contact/` 空提交确认字段、状态文案和样式同步。
- 原证据：浏览器流中空提交显示 `请输入反馈内容。`，但 `#fb-message` 没有 `aria-invalid`。
- 源码位置：`contact/index.html:106-119`、`js/feedback.js`。
- 复现：打开 `/contact/`，不填反馈内容直接提交，检查 textarea 属性和焦点。
- 建议方案：沿用订阅表单模式，空内容时给 `#fb-message` 添加 `.is-invalid` 与 `aria-invalid="true"`，聚焦输入；用户输入后清除。
- 成本：低。
- 验收标准：空提交后字段、状态文案、焦点和辅助技术状态同步；新增回归测试。

### P3-10 relay 数据同步脚本覆盖率偏低

- 分类：工程质量
- 影响：AI 中转站数据更新链路。
- 证据：`parse-relay.mjs` branch 46.58%，`update-commercial-relay.mjs` line 68.14%。
- 源码位置：`scripts/parse-relay.mjs`、`scripts/update-commercial-relay.mjs`、`tests/relay.test.mjs`。
- 建议方案：增加 SQL 字段缺失、异常 JSON、重复 provider 合并、token/email/url 脱敏、商业源部分失败、网络超时和空数据回退测试。
- 成本：低到中。
- 验收标准：两个脚本 line >= 85%、branch >= 70%；异常输入不会污染 `data/relay-providers.json`。

### P3-11 依赖维护与 lint 噪声

- 分类：工程维护
- 影响：CI 维护成本。
- 证据：`npm ci` 弃用警告；`npm outdated` 显示 ESLint 8 -> 9；`lint:check` 仍有 77 warnings。
- 源码位置：`package.json`、`.eslintrc.json`、`js/galaxy.js`、`js/gesture.js`。
- 建议方案：分两步：先把 `var` / `prefer-const` 警告清零；再规划 ESLint 9 flat config 迁移。
- 成本：低到中。
- 验收标准：`npm run lint:check -- --max-warnings=0` 可通过；Dependabot 后续升级风险降低。

### P3-12 临时副本无 `.git` 时测试不可运行

- 分类：开发体验 / 测试健壮性
- 影响：CI 外的审计、副本测试、压缩包交付场景。
- 证据：首次 `npm test` 因 `git ls-files *.html` 报 `fatal: not a git repository`；补临时 Git 索引后 731/731 通过。
- 源码位置：`tests/i18n-a11y.test.mjs`、`tests/links.test.mjs`、`tests/performance.test.mjs`、`tests/security-extended.test.mjs`。
- 建议方案：封装 `listHtmlFiles()` 测试 helper：优先 `git ls-files`，失败时回退递归扫描并排除 `node_modules` / `temp`。
- 成本：低。
- 验收标准：无 `.git` 的临时副本仍可运行 `npm test`。

## 6. 观察项与误报处理

- 反馈表单 input/textarea 被自动脚本标记为 unnamed interactive，但源码中它们被 `<label>` 包裹，属于脚本启发式误报，不列为缺陷。
- 工具箱用户流第一次因审计脚本使用了不存在的 `[data-markdown-render]` 选择器失败；补跑后 JSON、Base64、Markdown 安全预览、API Tester 中转站填充均通过。
- 404 页面缺少 JSON-LD 被脚本标记为 `missing-jsonld`。这不是阻塞问题；更重要的是确保真实 404 路径返回 404 状态并避免被索引。
- 文章分享二维码 overlay 的 `role="dialog"` 在内层 `.share-qr-card`，外层 overlay 无 role；当前测试已有覆盖，暂不列为问题。

## 7. 新增功能与优化 Backlog

### 近期 1-2 周

- 加入 Playwright smoke：覆盖首页搜索、订阅无效输入、AI 助手打开、本地问答、博客搜索、文章分享、工具箱 JSON/Base64/Markdown、反馈提交、AI tab。放入 CI 的可选 job 或夜间 job。
- 加入 Lighthouse CI budget：至少监控 `/`、`/post/rule-engine-alerts/`、`/tools/`；先只报警不阻断，稳定后设阈值。
- 工具箱增加面板搜索和收藏：31 个工具已经较多，建议顶部加搜索/最近使用/固定常用工具。
- 工具箱统一重置按钮已完成：每个工具支持恢复输入、清空输出和状态；后续可继续优化快捷键和批量操作。
- API Tester 历史隐私核心防护已完成：敏感 Header 脱敏、请求体默认不保存；后续可增加一次性确认弹窗和更细粒度保留策略。

### 中期 2-6 周

- 工具箱按需挂载：tab 切换时才创建 heavy panel DOM；Galaxy/手势/Markdown/highlight/QR 继续懒加载。
- AI 中转站增强：健康趋势、价格/模型能力筛选、收藏 provider、导出 CSV、复制 curl/OpenAI SDK 示例。
- 编辑器增强：SEO 预览（title/description/OG 卡片）、front matter 校验提示、草稿列表、从文件导入 Markdown。
- 文章阅读增强：阅读位置恢复、文章系列/专栏、相关文章解释理由、图片 lightbox（旧文档里提过但本轮浏览未看到明显入口）。
- 评论区降级体验：giscus 加载失败时显示可操作 fallback，链接到 `/contact/#feedback-title`。

### 长期 6 周以上

- CSS/JS 页面级拆包：引入轻量构建管线（如 esbuild）输出 `core` + page bundles。
- PWA/offline：离线阅读、搜索索引缓存、工具箱常用工具离线可用。
- AI 助手产品化：本地站内问答优先，LLM 模式通过用户自有 key 或安全代理，支持引用来源、清空会话、导出对话。
- 内容运营：文章 RSS 全文/摘要双模式、newsletter 标签订阅、站内“项目地图”、简历页与博客文章互链。
- 数据质量监控：relay 数据 schema 校验、数据源健康监控、榜单变更 diff 报告。

## 8. 建议实施顺序

1. 修 `P1-01` 生成页 CSP，解除 giscus 样式拦截。
2. 修 `P1-02` `/post/` 重复 heading id，并补 HTML 扫描测试。
3. ✅ 已完成 `P2-05` 搜索输入可访问名称和 `P2-09` 反馈错误态，低成本提升无障碍。
4. 做 `/tools/` 性能一期：延迟渲染非 active panel，先把 Lighthouse mobile performance 拉到 90+。
5. 建 Playwright/Lighthouse 自动浏览回归，让这类问题以后自动浮上来。
6. 再推进 CSP 收紧、CSS/JS 拆包、工具箱产品化和 AI/Relay 新功能。

## 9. 附录：关键浏览结果

- 页面扫描：19 个 route × 4 视口 = 76 次页面检查。
- 用户流：8 条；7 条首轮通过，工具箱流因审计选择器错误失败，补跑通过。
- 截图：临时副本生成首页、AI、编辑器、博客、工具箱的 desktop/mobile 首屏截图。
- 全站搜索：输入 `AI` 返回 3 条结果，可关闭，语言切换后文案进入英文。
- 订阅弹窗：无效邮箱显示英文错误并设置 `aria-invalid="true"`。
- AI 助手：首页可打开，本地站内模式回答“工具箱在哪里”，返回 `/tools/` 和 `/ai/#nav` 链接。
- 博客列表：搜索 `Activiti` 后仅显示 `post-activiti-workflow-engine`；标签筛选会更新 URL。
- 文章页：TOC 9 个链接，微信分享二维码可打开；评论容器存在，但生成页 CSP 拦截 giscus CSS。
- 工具箱：31 个 tab/panel；JSON 格式化、Base64 编码、Markdown 预览净化、API Tester 中转站填充通过。
- 编辑器：标题、slug、front matter 必填字段和 Markdown 预览可用。
- Overleaf：格式切换到 Markdown 后源码和预览同步。
- 联系页：本地反馈可提交并保存到列表；空提交仅有状态文案，缺少字段级 `aria-invalid`。
- AI 页面：2 个 tab，43 条 relay 选项，20 个 AI 导航卡片；搜索 `gpt` 后仍有可见匹配项。

## 10. 本轮已落地修复记录

本轮在审计后已修复以下项目，并通过重新构建与测试验证：

- `P1-01` 生成文章页 CSP 拦截 giscus 样式：`src/templates/layout.mjs` 的 `style-src` 已补充 `https://giscus.app`，并重新生成所有受影响 HTML。
- `P1-02` `/post/` 聚合页重复 heading id：列表页正文渲染时为 `toc-*` heading id 和同页锚点加文章 slug 作用域，`post/index.html` 复测为 77 个 id / 0 个重复 id。
- `P3-11` lint 噪声：`js/galaxy.js` 和 `js/gesture.js` 的 `no-var` / `prefer-const` 警告已清零，`npm run lint:check` 现在 0 warnings。
- 工具箱 UX：每个有状态工具面板增加重置按钮，覆盖输入、输出、状态、颜色预览、二维码、UUID、时间结果等派生状态，并补中英文状态文案。
- 工具箱 API Tester 隐私：历史保存会默认隐藏 `Authorization`、`Cookie`、`x-api-key` 等敏感头，请求体默认不保存；用户勾选“保存请求体”后才写入 body，并补普通 header 与 JSON header 脱敏测试。
- 文章阅读 UX：新增阅读位置恢复提示与文章图片 lightbox，并补对应测试。
- 表单与搜索可访问性：全站搜索框和 relay 搜索框补充可访问名称；反馈留言空提交会设置 `.is-invalid` 与 `aria-invalid="true"`，输入有效内容后清除。
- 工程化清理：`test-results/` 已加入 `.gitignore`，避免 Playwright/浏览器追踪产物进入提交。

本轮最终验证指标：

| 指标 | 基线 | 本轮结果 |
| --- | ---: | ---: |
| `npm run lint:check` | 0 errors / 77 warnings | 0 errors / 0 warnings |
| `npm test` | 731 passed | 740 passed |
| `npm run test:coverage` | line 94.32% / branch 76.28% / funcs 91.70% | line 94.29% / branch 76.07% / funcs 91.73% |
| `npm audit --registry=https://registry.npmjs.org` | 0 vulnerabilities | 0 vulnerabilities |
| `/post/` duplicate id scan | 9 duplicate ids | 0 duplicate ids |

性能指标说明：本轮未引入新的 Lighthouse 复测分数；主要落地项是功能正确性、CSP 配置一致性、DOM 唯一性、lint 清理和工具箱/文章 UX。Lighthouse 基线仍以第 4 节记录为准，后续优先推进 `/tools/` 首屏拆分、CSS 拆包和 AI 助手懒加载。
