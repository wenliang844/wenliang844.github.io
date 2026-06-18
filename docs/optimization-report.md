# CWLBlog 自主优化记录

## 第 1 轮：构建安全与回归测试

时间：2026-06-17

### 已完成内容

- 梳理项目结构：静态站点源码位于 `src/`，构建脚本为 `scripts/build.mjs`，生成文章页、标签页、归档页、AI 导航页、RSS、sitemap 和搜索索引。
- 新增 `npm test`，使用 Node.js 内置测试运行器覆盖构建产物与模板安全边界。
- 收紧模板输出转义：标题、摘要、标签、meta、OG/Twitter 卡片和标签页 i18n 属性统一走公共转义函数。
- 收紧构建输出路径：`--out` 缺失参数时报错，且输出目录必须位于项目内。
- 对文章 slug、日期和必填 front matter 增加校验，避免生成异常路径或不完整页面。
- 运行本地静态服务并通过浏览器验证关键页面、全局搜索和控制台错误。

### 发现的问题

- 项目此前没有自动化测试入口，构建正确性、安全转义和产物结构缺少可重复校验。
- 部分模板直接拼接 front matter 文本到 HTML 文本节点或属性中，特殊字符可能破坏 HTML 结构。
- `node scripts/build.mjs --out` 缺少参数或传入项目外目录时缺少明确防护。
- npm audit 在当前 registry `https://registry.npmmirror.com/` 下失败：镜像不支持 `/-/npm/v1/security/audits/quick`。
- 浏览器截图通道连续超时，页面 DOM、控制台和交互验证可用，但本轮未能保存截图。

### 修复方案

- 在 `src/lib/format.mjs` 增加 `escapeHtml`，与 `escapeAttr` 分别处理文本节点和属性上下文。
- 更新公共布局、文章、标签、归档模板，避免标题、摘要和标签元数据未经转义输出。
- 在构建脚本中校验输出目录、文章 slug、日期格式和必填 front matter 字段。
- 新增 `tests/build.test.mjs` 和 `tests/templates.test.mjs`，覆盖构建产物、搜索索引、sitemap/RSS 基础结构、模板转义和非法输出目录。

### 性能与质量指标

- 构建基线：`npm run build` 通过，生成 6 篇文章。
- 测试覆盖基线：此前无测试；本轮新增 6 个测试用例，`npm test` 全部通过。
- 测试耗时：约 5.6 秒。
- 浏览器验证：`/post/`、`/`、`/ai/`、`/tags/`、`/categories/` 均无控制台错误。
- 搜索验证：`Ctrl+K` 打开全局搜索，关键词“规则”返回 3 条结果。

### 下一步计划

- 继续审计前端脚本中的动态 HTML、剪贴板、localStorage 和第三方脚本加载路径。
- 补充浏览器级自动化测试或更稳定的截图方案。
- 检查依赖版本与 npm registry 配置，恢复可执行的安全审计流程。
- 继续评估首屏资源、脚本懒加载和静态资源缓存策略。

## 第 2 轮：依赖安全审计

时间：2026-06-17

### 已完成内容

- 使用官方 npm registry 执行依赖安全审计。
- 移除 `gray-matter`，切断其对存在 DoS 告警的 `js-yaml` 依赖链。
- 新增 `yaml` 作为 front matter 的结构化 YAML 解析器。
- 更新 `scripts/build.mjs`，保留标准 `---` front matter 分隔格式，并用 `yaml` 解析元数据。

### 发现的问题

- `gray-matter` 依赖链包含 `js-yaml <=4.1.1`，npm audit 报告 2 个 moderate 级别漏洞：
  - `GHSA-h67p-54hq-rp68`：merge key repeated aliases 可能导致二次复杂度 DoS。
- `npm audit fix --force` 给出的自动方案会降级 `gray-matter`，存在破坏性风险，不适合直接采用。

### 修复方案

- 替换依赖而不是强制降级：使用 `yaml` 解析 front matter 中的 YAML 元数据。
- 保持构建接口不变：`src/posts/*.md` 输入格式、生成文件路径和构建命令保持一致。

### 性能与安全指标

- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- `npm test`：22 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过，生成 6 篇文章。

### 下一步计划

- 继续审计 RSS/XML 输出中的文本转义，确保标题和摘要在 XML 上下文中也安全。
- 评估是否把 front matter 解析和校验拆成可单测模块，降低构建脚本回归风险。

## 第 3 轮：RSS 与 sitemap XML 转义

时间：2026-06-17

### 已完成内容

- 新增 `escapeXml`，专门处理 RSS 与 sitemap 的 XML 文本/属性上下文。
- 更新 RSS 频道信息、文章标题、文章描述、链接和 guid 输出。
- 更新 sitemap URL 输出，避免特殊字符破坏 XML。
- 为 XML 转义补充回归测试。

### 发现的问题

- RSS 与 sitemap 使用 XML 语法，不能只依赖 HTML 转义思路。
- 当前内容较干净，不一定触发现实错误，但标题或描述一旦包含 `&`、`<`、引号等字符，就可能生成不合法 XML。

### 修复方案

- 在 `src/lib/format.mjs` 中集中提供 `escapeXml`。
- 构建 RSS/sitemap 时对所有动态 XML 值显式转义。

### 性能与安全指标

- `npm test`：22 个测试全部通过，耗时约 0.75 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续评估前端脚本里的动态 `innerHTML` 使用点，把纯文本更新替换为 `textContent`，保留必要的图标 HTML。
- 检查生成产物是否需要更严格的缓存、preload 和脚本加载策略。

## 第 4 轮：反馈表单公开凭据加固

时间：2026-06-17

### 已完成内容

- 审计联系页反馈脚本中的第三方提交逻辑。
- 移除前端硬编码的 Web3Forms access key。
- 增加测试，防止 UUID 形式的 Web3Forms key 再次被提交到前端脚本。

### 发现的问题

- 静态站无法保密客户端 JavaScript 中的 Web3Forms access key。
- 公开 key 可能被复制后用于垃圾提交或滥用第三方表单投递能力。

### 修复方案

- 将 `WEB3FORMS_ACCESS_KEY` 默认置空，反馈仍保存在访客本地浏览器。
- 只有站点所有者明确接受公开客户端提交风险时，才手动配置远程投递。

### 性能与安全指标

- `npm test`：23 个测试全部通过，耗时约 0.75 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续检查是否有其他公开 token、邮箱投递端点或第三方脚本配置暴露。
- 继续优化反馈列表渲染，减少不必要的 HTML 字符串拼接。

## 第 5 轮：反馈列表 DOM 渲染加固

时间：2026-06-17

### 已完成内容

- 将 `js/feedback.js` 中留言列表渲染从 HTML 字符串拼接改为 DOM API。
- 使用 `textContent` 写入昵称、时间、按钮文本和留言内容。
- 增加测试，防止 `feedback.js` 再次对反馈列表使用 `innerHTML`。

### 发现的问题

- 反馈内容保存在 localStorage，用户或浏览器扩展可以手工篡改其中的数据。
- 旧实现虽然有转义函数，但仍把本地数据拼成 HTML 字符串，后续维护时容易发生 XSS 回归。

### 修复方案

- 使用 `replaceChildren()` 清空列表。
- 使用 `createElement()` 构建列表项、按钮、文本节点和正文。
- 所有用户可控文本通过 `textContent` 写入。

### 性能与安全指标

- `npm test`：24 个测试全部通过，耗时约 0.76 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续梳理搜索弹窗和分享弹窗的动态 HTML，区分静态模板与用户可控数据。
- 增加更接近浏览器行为的 jsdom 测试，覆盖反馈表单提交和本地渲染流程。

## 第 6 轮：站内断链修复与链接检查

时间：2026-06-17

### 已完成内容

- 扫描手写静态页中的站内文章链接。
- 修复首页和关于页“视频智能侦测系统”项目卡片的断链。
- 新增全站 HTML 根相对链接检查测试。

### 发现的问题

- `index.html` 与 `about/index.html` 指向 `/post/video-intelligence-platform/`。
- 当前项目没有该文章目录，点击后会进入 404。

### 修复方案

- 将两个项目卡片链接改为现有文章 `/post/manage-system/`。
- 新增 `tests/links.test.mjs`，扫描所有已提交 HTML 文件中的 `href="/..."`，验证目标文件存在。

### 性能与质量指标

- `npm test`：25 个测试全部通过，耗时约 0.98 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续检查手写页与模板页的脚本加载一致性。
- 考虑把首页、关于页、联系页等手写页也纳入模板构建，减少重复和漂移。

## 第 7 轮：手写页公共脚本一致性

时间：2026-06-17

### 已完成内容

- 为首页、关于页、联系页、编辑器、Overleaf 和 404 页补齐公共脚本。
- 统一公共脚本加载顺序：`error-handler` → `utils` → `i18n` → `coder` → `search-loader`。
- 为关于页补充全局搜索按钮。
- 增加 HTML 公共脚本一致性测试。

### 发现的问题

- 模板生成页已加载 `error-handler.js` 和 `utils.js`，但手写页仍使用旧脚本组合。
- 关于页缺少全局搜索入口，和其它页面导航体验不一致。

### 修复方案

- 手写页统一补齐基础脚本，保证主题、复制、滚动节流、错误提示和搜索入口行为一致。
- `tests/links.test.mjs` 增加脚本顺序和搜索按钮检查，避免模板页和手写页再次漂移。

### 性能与质量指标

- `npm test`：26 个测试全部通过，耗时约 0.79 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续审计 `error-handler.js` 的 toast 渲染，减少动态 HTML 字符串。
- 继续评估是否将手写页迁移为模板源文件，彻底消除重复导航与脚本片段。

## 第 8 轮：全局错误提示 DOM 渲染加固

时间：2026-06-17

### 已完成内容

- 将 `js/error-handler.js` 的 toast 渲染从 `innerHTML` 字符串拼接改为 DOM API。
- 错误消息改为通过 `textContent` 写入。
- 移除不再需要的局部 HTML 转义函数。
- 增加错误提示安全渲染回归测试。

### 发现的问题

- toast 消息虽然经过转义，但仍使用 `innerHTML` 组装 DOM。
- 全局错误消息未来可能来自更多上下文，继续使用 HTML 字符串会增加维护风险。

### 修复方案

- 使用 `createElement()` 构造 toast 容器、图标、文本和关闭按钮。
- 固定图标使用 className，动态消息只写入 `textContent`。

### 性能与安全指标

- `npm test`：27 个测试全部通过，耗时约 0.91 秒。
- `npm run build`：通过，生成 6 篇文章。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

### 下一步计划

- 继续检查搜索弹窗和分享弹窗中动态 HTML 的用户可控数据边界。
- 若继续扩展测试，优先补 jsdom 交互测试而不是只做静态字符串检查。

## 第 9 轮：订阅弹窗与 lint 回归修复

时间：2026-06-17

### 已完成内容

- 运行 `npm test`、`npm run lint`、临时构建和生产验证建立基线。
- 修复 `js/subscribe.js` 中 ESLint 报告的重复声明、块内函数声明和 `var` 使用问题。
- 精简订阅脚本启动逻辑，让导航订阅弹窗不再依赖页脚 `.subscribe` 表单存在。
- 增加 jsdom 交互测试，覆盖“无页脚订阅块时导航按钮仍可打开弹窗”的场景。

### 发现的问题

- `npm run lint` 失败：`showDisabled` 在同一函数作用域重复声明，并触发 `no-inner-declarations`。
- 订阅弹窗初始化被页脚订阅块绑定，未来页面若去掉 footer 表单，导航订阅按钮会失效。

### 修复方案

- 删除重复的顶部页脚探测逻辑，页脚表单和弹窗只共享 `submitEmail`。
- 将页脚状态函数改为块内函数表达式，避免函数声明提升造成 lint 回归。
- 新增 `tests/subscribe.test.mjs` 回归测试。

### 性能与质量指标

- `npm run lint`：修复前失败，修复后通过。
- `npm test`：34 个测试提升到 36 个测试，全部通过。
- 运行验证：`http://127.0.0.1:8137/`、文章页、RSS、搜索索引和 `/js/subscribe.js` 均返回 200。

### 下一步计划

- 继续收紧生产验证脚本，确保依赖审计在 Windows 与镜像 registry 环境下都能给出真实结论。

## 第 10 轮：生产依赖审计脚本加固

时间：2026-06-17

### 已完成内容

- 修复 `scripts/validate-production.mjs` 中 `npm audit` 在 Windows 下无法启动的问题。
- 修复 `npm audit` 发现漏洞时非零退出码被误判为“执行失败”的问题。
- 为默认 npm registry 不支持 audit 的环境增加官方 registry 自动重试。

### 发现的问题

- 当前默认 registry `npmmirror` 不支持 `/-/npm/v1/security/audits/quick`。
- Node.js 在 Windows 下直接 `execFile('npm.cmd')` 会触发 `spawn EINVAL`，需要通过 shell 启动 npm。
- 旧脚本没有解析 `npm audit` 非零退出时的 stdout JSON，存在真实漏洞被降级成 warning 的风险。

### 修复方案

- `runAudit()` 在成功和失败路径都解析 audit JSON；只要包含漏洞元数据，就进入统一评估逻辑。
- Windows 下使用 `execFile('npm', args, { shell: true })` 启动 npm。
- 默认 registry 不支持 audit 时，自动使用 `https://registry.npmjs.org/` 重试。

### 性能与安全指标

- `npm run validate:production`：33 项通过、0 失败、0 警告。
- 依赖审计：官方 registry 返回 0 个已知漏洞。
- `npm outdated --json`：仅 ESLint 存在 9.x 大版本可用；当前 8.57.1 无漏洞，暂不做破坏性迁移。

### 下一步计划

- 继续检查构建脚本的导入副作用、日期合法性和重复内容生成风险。

## 第 11 轮：构建脚本副作用与内容数据校验

时间：2026-06-17

### 已完成内容

- 为 `scripts/build.mjs` 增加 CLI 入口保护，测试 import 构建函数时不再顺带执行完整站点生成。
- 将日期校验从“只校验格式”提升为“校验真实日历日期”。
- 增加重复 slug 校验，避免多篇文章静默写入同一个 URL。
- 捕获测试中预期的 `console.warn`，保留 localStorage 异常路径覆盖，同时减少 CI 输出噪声。

### 发现的问题

- 测试 import `normalizeDate`、`validateSlug`、`validatePost` 时会执行 `main()`，造成测试副作用和额外构建输出。
- `2024-02-30`、`2023-02-29` 这类非法日期可以通过旧校验。
- 重复 slug 会导致后处理文章覆盖先处理文章，构建没有显式失败。

### 修复方案

- 使用 `process.argv[1]` 与 `import.meta.url` 比较，只在 CLI 执行时运行 `main()`。
- `normalizeDate()` 使用 UTC 日期反查年月日，拒绝不存在的日期。
- 新增 `validateUniqueSlug()`，在读取文章时用 `Map` 检查重复 slug。
- 更新 `tests/security.test.mjs`，覆盖闰年、非法日期和重复 slug。

### 性能与质量指标

- `npm test`：36 个测试全部通过，测试输出不再打印预期异常堆栈。
- 测试耗时：约 1.38 秒。
- `node scripts/build.mjs --out temp/verify-build-3`：通过，生成 6 篇文章。

### 下一步计划

- 继续执行完整 `npm run validate`，并在最终构建前同步生成产物。
- 后续可考虑把首页、关于页等手写页面继续迁移到模板源，减少长期漂移。

## 第 12 轮：测试覆盖率命令补齐

时间：2026-06-17

### 已完成内容

- 使用 Node.js 内置测试覆盖率功能运行全量测试。
- 在 `package.json` 中新增 `npm run test:coverage`，方便后续复现覆盖率指标。

### 发现的问题

- 项目已有测试入口，但没有可复现的覆盖率命令，最终报告只能描述测试数量，缺少覆盖率基线。

### 修复方案

- 新增脚本：`node --test --experimental-test-coverage tests/*.test.mjs`。
- 保持现有测试框架不变，不引入额外覆盖率依赖。

### 性能与覆盖率指标

- 覆盖率：行覆盖 98.47%，分支覆盖 83.03%，函数覆盖 96.46%。
- `scripts/build.mjs` 行覆盖 95.04%。
- `src/templates/post.mjs` 行覆盖 100%，函数覆盖 100%。
- 其他模板与格式化模块行覆盖接近或达到 100%。

### 下一步计划

- 若继续提升分支覆盖，优先补充构建错误路径、空内容文章和 OG 图片缺失分支的测试。

## 第 13 轮：搜索脚本懒加载回归修复

时间：2026-06-17

### 已完成内容

- 扫描所有 HTML 中的搜索相关脚本加载方式。
- 删除 `index.html`、`404.html`、`overleaf/index.html` 中对 `/js/vendor/fuse.min.js` 和 `/js/search.js` 的直接加载。
- 保留 `/js/search-loader.js`，继续在用户首次打开搜索时懒加载搜索 bundle。
- 新增测试，防止加载 `search-loader.js` 的页面再次预加载 Fuse/Search 主脚本。

### 发现的问题

- 项目已经实现搜索懒加载，但 3 个手写页面仍然直接加载 Fuse 和搜索主脚本。
- 这会让首屏无搜索行为的访问也承担搜索 bundle 成本。

### 修复方案

- 移除重复脚本标签，统一依赖 `search-loader.js`。
- 在 `tests/links.test.mjs` 中增加搜索 bundle 懒加载约束。

### 性能与质量指标

- 每个受影响页面减少约 39 KB 原始 JS 预加载（`fuse.min.js` 23,858 bytes + `search.js` 15,510 bytes）。
- 3 个页面合计减少 118,104 bytes 的重复预加载。
- `npm test`：37 个测试全部通过。

### 下一步计划

- 后续可继续拆分 `coder.css` 或按页面拆分大型编辑器/简历工具资源，但需要配合浏览器截图回归验证。

## 第 14 轮：生产验证跨平台文档检查

时间：2026-06-17

### 已完成内容

- 对齐生产验证脚本中的 README 文件名检查。
- 将 `README.md` 改为仓库真实文件名 `readme.md`，避免 Linux/CI 环境大小写敏感时出现误报。

### 发现的问题

- Windows 文件系统大小写不敏感，旧检查会通过。
- 在大小写敏感环境中，`README.md` 与 `readme.md` 不等价，生产验证会产生不必要 warning。

### 修复方案

- 更新 `scripts/validate-production.mjs` 文档清单中的文件名。

### 质量指标

- `npm run validate:production`：33 项通过、0 失败、0 警告。

## 第 15 轮：文章列表锚点直达修复

时间：2026-06-17

### 已完成内容

- 扫描根相对锚点链接，如 `/contact/#feedback-title` 与 `/post/#slug`。
- 修复文章列表页文章面板缺少原生 `id=slug` 锚点的问题。
- 新增测试，确保所有根相对锚点链接都能在目标 HTML 中找到对应 `id` 或 `name`。

### 发现的问题

- 单篇文章页的“文章”链接和归档页文章链接指向 `/post/#<slug>`。
- 文章列表页实际 panel id 是 `post-<slug>`，没有原生 `id="<slug>"`。
- JavaScript 会按 hash 切换 panel，但无 JS、外部直链或浏览器原生锚点行为无法命中目标。

### 修复方案

- 在 `src/templates/post.mjs` 的每个文章面板前生成轻量锚点：`<span class="post-anchor" id="<slug>" aria-hidden="true"></span>`。
- 保持现有 `post-<slug>` panel id 和 `data-post-target` 行为不变，避免影响现有 JS 切换逻辑。
- 在 `tests/links.test.mjs` 中增加根相对锚点目标校验。

### 质量指标

- `npm test`：39 个测试全部通过。
- `/post/#rule-engine-alerts` 等文章直达链接现在有原生锚点目标。

## 第 16 轮：文章列表移动端侧栏 lint 修复

时间：2026-06-17

### 已完成内容

- 修复 `js/blog.js` 中移动端文章目录浮层的块内函数声明。
- 保持原有展开/收起逻辑不变，仅将 `setOpen` 改为函数表达式。

### 发现的问题

- `npm run lint` 报告 `no-inner-declarations`：`setOpen` 声明在 `if (sidebar)` 块内部。

### 修复方案

- 使用 `const setOpen = function (open) { ... };` 替代块内 `function setOpen(open)`。

### 质量指标

- `npm run lint`：通过。
- `npm run validate`：通过。

## 第 17 轮：在线工具箱与 AI 助手回归优化

时间：2026-06-18

### 已完成内容

- 对 `/tools/` 在线工具箱和 AI 助手悬浮球做桌面与 390px 移动端浏览器回归。
- 验证 JSON、Base64、URL、时间戳、UUID、JWT 六类工具的核心交互。
- 验证 AI 助手打开、提问、站内推荐链接和用户输入 XSS 转义。
- 为工具箱 tab 补充 `tablist`、`tab`、`tabpanel`、`aria-selected`、`tabindex`，并支持方向键、Home、End 键切换。
- 修复 UUID 未生成时复制占位文字的问题；生成 UUID 后切换语言不再覆盖生成结果。
- 优化手机端 AI 助手快捷按钮布局，去掉横向滚动条。
- 增加 jsdom 回归测试覆盖 tab 键盘导航和 UUID 复制边界。

### 发现的问题

- 移动端 AI 助手快捷按钮区域功能可用，但出现明显横向滚动条，影响观感和触控效率。
- UUID 生成器初始占位文案会被复制按钮当作真实内容复制。
- UUID 生成结果仍带 `data-i18n` 时，切换语言可能被占位翻译覆盖。
- 工具箱工具切换按钮缺少标准 tab 语义和键盘切换路径。

### 修复方案

- 在 `src/templates/tools.mjs` 中统一生成工具 tab 与 panel 的 ARIA 属性。
- 在 `js/tools.js` 中集中维护 tab 选中状态、隐藏状态和键盘切换逻辑。
- 为 UUID 输出增加 `data-empty` 占位标记，复制时拦截空占位；生成后移除占位与 i18n 属性。
- 在移动端 CSS 中让 `.assistant-quick` 换行排列，按钮以两列自适应展示。
- 在 `tests/tools.test.mjs` 中补充工具 tab 可访问性、键盘导航、UUID 复制和生成状态测试。

### 性能、覆盖率与质量指标

- 基线浏览器验证：桌面 `/tools/` 无横向溢出，站点控制台无 warning/error。
- 移动端验证：390x844 视口无页面横向溢出，AI 助手面板完整位于视口内。
- 移动端优化后：AI 助手快捷按钮不再横向滚动，`quickScrollable=false`。
- `npm test`：221 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.71%，分支覆盖 88.14%，函数覆盖 96.75%。
- 覆盖率变化：分支覆盖从本轮基线 85.81% 提升到 88.14%，行覆盖保持 98.71%。
- `npm run build`：通过，生成 6 篇文章与工具箱页面。
- 浏览器截图：`temp/qa/tools-mobile-assistant-after.png`。

### 下一步计划

- 继续审计工具箱大输入场景，评估 JSON/JWT/Base64 大文本处理是否需要输入大小保护。
- 继续检查 AI 助手站内匹配规则是否需要从静态数组迁移到搜索索引，减少重复维护。
- 继续补浏览器级端到端测试脚本，将当前手工浏览器回归沉淀为可重复命令。

## 第 18 轮：Base64 文本边界与助手可访问性

时间：2026-06-18

### 已完成内容

- 对工具箱大输入场景做微基准：Base64 1MB/10MB、JSON 0.3MB/3.3MB/10.3MB。
- 将 Base64 编码的字节转二进制字符串逻辑改为分块转换，避免未来大输入实现使用展开参数时触发调用栈风险。
- 将 Base64 解码改为严格 UTF-8 文本解码，合法 Base64 但非 UTF-8 文本不再静默显示替换字符。
- 为 Base64 非 UTF-8 输入和大文本往返补充回归测试。
- 为 AI 助手面板增加 `role="dialog"`、`aria-labelledby`、`aria-describedby`。
- 关闭按钮和 Escape 关闭后把焦点返回悬浮按钮，改善键盘和读屏体验。

### 发现的问题

- `decodeBase64("/w==")` 这类合法 Base64 但非 UTF-8 文本会被浏览器 `TextDecoder` 默认替换为 `�`，用户容易误以为解码结果有效。
- AI 助手视觉上是浮层对话框，但缺少 dialog 语义与标题/说明关联。
- Escape 关闭助手后焦点没有明确返回打开按钮，键盘用户需要重新定位。

### 修复方案

- `js/tools-core.js` 新增 `bytesToBinary()`，按 32KB chunk 拼接二进制字符串。
- `decodeBase64()` 使用 `new TextDecoder("utf-8", { fatal: true })`，保留旧浏览器 fallback 的异常行为。
- `tests/tools.test.mjs` 增加非 UTF-8 Base64 拒绝和大文本 Base64 往返测试。
- `js/assistant.js` 为面板、标题和隐私说明补充 ARIA 关系，并在关闭路径支持 `returnFocus`。
- `tests/assistant.test.mjs` 覆盖 dialog 语义和 Escape 焦点返回。

### 性能、覆盖率与质量指标

- Base64 10MB 基线：编码约 30ms，解码约 67ms。
- Base64 10MB 优化后：编码约 31ms，解码约 61ms。
- JSON 10.3MB 格式化约 159ms，压缩约 135ms；暂不需要硬性限流。
- `npm test`：221 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.71%，分支覆盖 88.14%，函数覆盖 96.75%。
- `npm run build`：通过。
- 浏览器回归：非 UTF-8 Base64 显示错误状态；AI 助手 dialog 语义、Escape 关闭和焦点返回通过；控制台无站点 warning/error。

### 下一步计划

- 继续评估 AI 助手匹配规则与 `search-index.json` 的重复维护问题。
- 继续检查工具箱复制、剪贴板失败和英文模式下的错误状态一致性。
- 考虑将本轮浏览器回归沉淀成 Playwright/Node 可重复脚本。

## 第 19 轮：剪贴板失败路径加固

时间：2026-06-18

### 已完成内容

- 审计工具箱复制逻辑在无 `navigator.clipboard` 或剪贴板 API 同步抛错时的行为。
- 将复制调用包进 Promise 链，统一捕获同步异常和异步 reject。
- 为无剪贴板 API 环境补充 jsdom 回归测试。

### 发现的问题

- 旧复制逻辑直接执行 `copier(data).then(...)`。
- 当 `navigator.clipboard` 不存在时，fallback 会在返回 Promise 前同步抛出 TypeError。
- 该异常会跳出点击处理器，用户看不到“复制失败，请手动选择复制”的状态提示。

### 修复方案

- 在 `js/tools.js` 中使用 `Promise.resolve().then(() => copier(data))` 包裹复制动作。
- 保留成功、失败状态的原有 UI 文案和 class 切换。
- 在 `tests/tools.test.mjs` 中显式移除 JSDOM 的 `navigator.clipboard`，确认失败状态可见。

### 性能、覆盖率与质量指标

- `npm test`：222 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.71%，分支覆盖 88.14%，函数覆盖 96.75%。
- `npm run build`：通过。
- 新增测试：`copy failures are reported when clipboard APIs are unavailable`。

### 下一步计划

- 继续检查英文模式下工具状态文案和助手响应的混合语言边界。
- 继续评估 AI 助手是否应复用搜索索引，减少页面/文章关键词重复维护。
- 把关键浏览器回归流程整理成可重复脚本，减少人工操作成本。

## 第 20 轮：AI 助手短查询匹配质量

时间：2026-06-18

### 已完成内容

- 审计 AI 助手页面匹配评分逻辑。
- 修复短查询只按“query 包含完整标题”评分的问题。
- 增加“标题包含 query”评分路径，让短词也能命中页面标题。
- 补充“工具”与“AI”两个短查询的回归测试。
- 通过浏览器验证 `/tools/` 页面中助手短查询首链排序。

### 发现的问题

- 用户输入“工具”时，旧评分不会给“工具箱”标题加分。
- “AI 导航”因关键词包含“工具”可能排在工具箱之前，导致导航意图偏移。
- 该问题不会导致崩溃，但会降低助手作为站内导航入口的准确性。

### 修复方案

- 在 `js/assistant.js` 的 `score()` 中增加标题双向包含判断：
  - query 包含完整标题时加分。
  - 标题包含 query 时也加分。
- 在 `tests/assistant.test.mjs` 中新增：
  - “工具”应优先返回 `/tools/`。
  - “AI”仍应优先返回 `/ai/`。

### 性能、覆盖率与质量指标

- `npm test`：224 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.71%，分支覆盖 88.14%，函数覆盖 96.75%。
- `npm run build`：通过。
- 浏览器回归：`工具 -> /tools/`，`AI -> /ai/`，控制台无站点 warning/error。

### 下一步计划

- 继续评估助手数据与 `search-index.json` 的重复维护问题。
- 继续检查助手英文模式下中文查询、英文查询混用时的返回文案和链接排序。
- 沉淀本轮浏览器检查为可重复脚本。

## 第 21 轮：工具箱与助手定向测试命令

时间：2026-06-18

### 已完成内容

- 在 `package.json` 中新增 `npm run test:toolbox`。
- 该命令只运行 `tests/assistant.test.mjs` 和 `tests/tools.test.mjs`。
- 保留全量 `npm test`、`npm run test:coverage` 和 `npm run build` 验证流程。

### 发现的问题

- 工具箱/助手每轮小改动都需要手动输入两个测试文件路径，复现成本偏高。
- 全量测试很完整，但对当前功能的快速红绿反馈不够直接。

### 修复方案

- 新增脚本：`node --test tests/assistant.test.mjs tests/tools.test.mjs`。
- 不引入新依赖，不改变 CI/validate 现有路径。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：11 个测试全部通过，耗时约 1.1 秒。
- `npm test`：224 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.71%，分支覆盖 88.14%，函数覆盖 96.75%。
- `npm run build`：通过。

### 下一步计划

- 继续把浏览器验证步骤脚本化或文档化，补齐移动端截图和控制台日志检查的可重复路径。
- 继续审计助手英文/中文混合查询的返回质量。

## 第 22 轮：AI 助手消息历史上限

时间：2026-06-18

### 已完成内容

- 对 AI 助手长会话路径做压力回归，连续发送 45 次站内查询。
- 为助手消息容器增加最多 40 条消息的保留上限，超过后移除最旧消息。
- 补充 jsdom 回归测试，防止消息列表再次无界增长。
- 通过移动端浏览器复核消息上限、面板宽度和控制台状态。

### 发现的问题

- AI 助手每次提问都会追加用户消息和助手回复，但旧消息没有回收。
- 长时间使用或自动化连续提问时，DOM 节点会持续增长，存在内存占用和滚动性能退化风险。

### 修复方案

- 在 `js/assistant.js` 中新增 `MAX_MESSAGES = 40`。
- `addMessage()` 每次追加消息后检查消息数量，超出上限时从头部移除旧消息。
- 保持最新消息可见，并保留现有滚动到底部行为。

### 性能、覆盖率与质量指标

- 长会话浏览器验证：连续 45 次发送后 `.assistant-message` 数量稳定为 40。
- 移动端验证：390x844 视口无横向溢出，AI 助手面板完整位于视口内，控制台无站点 warning/error。
- `npm run test:toolbox`：12 个测试全部通过，耗时约 1.0 秒。
- `npm test`：225 个测试全部通过。
- `npm run test:coverage`：行覆盖 98.75%，分支覆盖 88.22%，函数覆盖 96.77%。
- `npm run build`：通过。

### 下一步计划

- 继续评估 AI 助手与搜索索引的数据重复维护问题。
- 继续检查助手英文/中文混合查询和新增 relay 入口之间的排序边界。
- 继续把浏览器回归步骤沉淀成可重复脚本或轻量文档。

## 第 23 轮：工具失败路径清理陈旧输出

时间：2026-06-18

### 已完成内容

- 审计工具箱 JSON、时间戳、JWT 等工具的失败路径。
- 修复处理失败时旧输出仍保留在输出框的问题。
- 补充 jsdom 回归测试，覆盖 JSON 解析失败、时间戳转换失败和 JWT 解码失败后的输出清理。
- 使用浏览器验证 `/tools/` 页面运行时 textarea/pre 输出状态、横向溢出和控制台日志。

### 发现的问题

- 工具箱成功处理一次后，如果下一次输入无效，状态会显示错误，但上一轮成功输出仍留在输出区域。
- 用户在错误状态下可能误复制陈旧结果，尤其是 JSON/JWT 这类经常复制输出的工具。

### 修复方案

- `applyResult()` 在失败时清空对应 textarea 输出。
- 时间戳转换失败时清空当前转换方向对应的输出块。
- JWT 解码失败时同时清空 header 与 payload 输出。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：16 个测试全部通过，耗时约 1.1 秒。
- `npm test`：233 个测试全部通过。
- `npm run test:coverage`：233 个测试全部通过；当前工作区全量口径行覆盖 94.07%，分支覆盖 75.16%，函数覆盖 89.67%。该口径包含未提交的 relay 脚本与测试，因此不能与第 22 轮只看工具箱/助手时的覆盖率直接等价比较。
- `npm run build`：通过，生成 6 篇文章与站点产物。
- 浏览器回归：JSON 与时间戳失败后运行时输出为空，390/桌面页面无横向溢出，控制台 warning/error 为 0。

### 下一步计划

- 继续审计工具箱复制行为，确认错误状态下不会复制隐藏或陈旧内容。
- 继续检查 AI 助手模式切换、请求取消和长文本返回路径。
- 继续拆分可独立提交的改动，避免混入并行 relay/大模型未提交变更。

## 第 24 轮：时间戳工具严格日期校验

时间：2026-06-18

### 已完成内容

- 审计时间戳工具的日期转时间戳实现。
- 将 `datetime-local` 输入从直接 `new Date(raw)` 解析改为严格格式和真实日历日期校验。
- 补充测试覆盖合法秒/毫秒、低年份、不可存在日期、24 点和非标准格式。
- 通过浏览器验证正常日期转换路径、页面溢出和控制台状态。

### 发现的问题

- JavaScript `new Date("2026-02-30T00:00")` 会把不存在日期归一化到后续真实日期，而不是返回 invalid。
- 旧实现会把这类无效输入转换为看似有效的时间戳，属于数据正确性问题。
- `new Date(year, ...)` 对 0-99 年份存在 1900 年偏移特例，严格校验函数也需要规避。

### 修复方案

- 新增 `parseLocalDateTime()`，只接受 `YYYY-MM-DDTHH:mm[:ss[.SSS]]` 形式。
- 显式校验月、日、时、分、秒范围。
- 使用 `setFullYear()` 构造本地时间，再反查年月日时分秒毫秒，拒绝被 JS 自动归一化的日期。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：16 个测试全部通过，耗时约 1.2 秒。
- `npm test`：233 个测试全部通过。
- `npm run test:coverage`：233 个测试全部通过；当前工作区全量口径行覆盖 94.07%，分支覆盖 75.16%，函数覆盖 89.67%。该口径仍包含未提交的 relay 脚本与测试。
- `npm run build`：通过。
- 浏览器回归：正常日期转换可用，页面无横向溢出，控制台 warning/error 为 0；无效日期输入由浏览器原生控件拦截，核心错误路径由单测覆盖。

### 下一步计划

- 继续检查工具箱时间戳边界，如极大整数、负数和时区展示一致性。
- 继续审计 AI 助手请求/取消/模式切换的可独立修复点。
- 继续保持每轮小范围提交，避免混入并行未提交功能。

## 第 25 轮：工具箱英文可访问名称与导航溢出

时间：2026-06-18

### 已完成内容

- 审计工具箱英文模式下的 tablist 可访问名称。
- 为工具 tab 容器补充 `data-i18n-aria` 和英文内联文案。
- 修复英文导航文案过长时桌面导航撑出页面宽度的问题。
- 补充工具箱测试，覆盖 tablist i18n 属性和导航可换行 CSS 约束。

### 发现的问题

- `.tools-tabs` 的 `aria-label` 固定为“工具列表”，英文模式下读屏仍会读中文。
- 工具箱页面切换英文后，顶部导航文案变长，单行 flex 导航在 1280px 宽度下产生横向溢出。
- 当前工作区存在并行未提交的助手默认模式改动，导致 `npm run test:toolbox` 组合命令一度被助手测试期望不一致影响；工具箱单测本身通过。

### 修复方案

- 在 `src/templates/tools.mjs` 中为 `.tools-tabs` 增加 `data-i18n-aria="tools.tabs"` 和 `data-i18n-en-aria="Tool list"`。
- 在 `js/i18n.js` 中增加 `tools.tabs` 英文词条。
- 在导航 CSS 中为 `.navigation-list` 设置 `min-width: 0`，并允许 `.navigation-list ul` 换行、右对齐和收紧间距。

### 性能、覆盖率与质量指标

- `node --test tests/tools.test.mjs`：7 个测试全部通过。
- `npm run build`：通过。
- 浏览器回归：工具箱英文模式 `aria-label="Tool list"`；英文和中文模式页面均无横向溢出，控制台 warning/error 为 0。
- 组合回归状态：`npm run test:toolbox` 曾通过 19/19；随后因并行未提交助手默认模式从 LLM 改回站点模式，而测试仍期待 LLM 默认激活，组合命令出现 1 个助手测试失败，和本轮工具箱改动无关。

### 下一步计划

- 继续跟踪并行助手默认模式改动，等其稳定后恢复完整 `npm run test:toolbox` 作为提交门禁。
- 继续检查工具箱英文模式下其它 aria-label、placeholder 和按钮宽度。
- 继续关注 CSS 体积超限问题，但避免混入当前并行 CSS 大改。

## 第 26 轮：工具箱输入占位文案国际化

时间：2026-06-18

### 已完成内容

- 继续检查工具箱英文模式下的输入提示文案。
- 为 Base64 和 URL 编解码输入框增加 placeholder 的 i18n 绑定。
- 补充工具箱测试，覆盖 codec 输入框的 `data-i18n-ph` 与英文占位文案。
- 通过浏览器验证中文/英文 placeholder 切换、页面溢出和控制台状态。

### 发现的问题

- Base64 输入框 placeholder 固定为“输入要编码或解码的文本”，英文模式下仍显示中文。
- URL 输入框示例固定为 `https://example.com/?q=中文`，英文模式下示例语言不一致。

### 修复方案

- 扩展 `renderCodecTool()`，允许传入英文 placeholder。
- 为 Base64 输入框输出 `data-i18n-ph="tools.base64.placeholder"` 和 `data-i18n-en-ph="Text to encode or decode"`。
- 为 URL 输入框输出英文示例 `https://example.com/?q=search`。

### 性能、覆盖率与质量指标

- `node --test tests/tools.test.mjs`：7 个测试全部通过。
- `npm run build`：通过。
- 浏览器回归：英文模式 Base64 placeholder 为 `Text to encode or decode`，URL placeholder 为 `https://example.com/?q=search`；页面无横向溢出，控制台 warning/error 为 0。

### 下一步计划

- 继续检查工具箱英文模式下状态文案、错误提示和复制提示的一致性。
- 继续等待并行助手默认模式改动稳定后恢复组合测试。
- 继续避免把未提交的大模型/relay/CSS 大改混入工具箱小修提交。

## 第 27 轮：URL 编码错误文案国际化

时间：2026-06-18

### 已完成内容

- 审计工具箱动态错误文案的 i18n 覆盖情况。
- 为 URL 编码失败路径补充稳定错误码。
- 增加英文错误词条，避免英文模式下回退中文错误信息。
- 补充工具箱单测覆盖非法 URI 编码输入和 i18n 词条存在性。

### 发现的问题

- `encodeUrl()` 在 `encodeURIComponent()` 抛错时没有传递错误 code。
- 英文模式下 `tools.js` 无法通过 `tools.error.*` 查到英文文案，只能显示中文 fallback。
- 该问题可由孤立 surrogate 等非法 URI 文本触发。

### 修复方案

- `encodeUrl()` 失败时返回 `code: "urlEncode"`。
- 在 `js/i18n.js` 中增加 `tools.error.urlEncode`。
- 在 `tests/tools.test.mjs` 中用 `"\uD800"` 覆盖非法 URI 编码输入。

### 性能、覆盖率与质量指标

- `node --test tests/tools.test.mjs`：8 个测试全部通过。
- `npm run build`：通过。
- 该错误分支依赖不可正常手工输入的非法 Unicode，浏览器层以构建与已有工具箱回归为主，核心行为由单测覆盖。

### 下一步计划

- 继续检查其它直接返回 fallback 错误文案的工具核心函数。
- 继续跟踪并行助手默认模式测试不一致问题。
- 继续保持小范围提交，避免引入外部功能改动。

## 第 28 轮：工具核心 falsey 输入保真

时间：2026-06-18

### 已完成内容

- 审计 `tools-core` 中对输入值的字符串归一化方式。
- 将多处 `String(value || "")` 改为统一 helper，保留 `0`、`false` 等非空 falsey 值。
- 补充直接调用核心 API 的回归测试。

### 发现的问题

- `formatJson(0)`、`encodeBase64(0)`、`encodeUrl(0)`、`normalizeTimestamp(0)` 这类直接 API 调用会把 `0` 当成空字符串。
- UI textarea/input 主要传字符串，因此普通页面交互不易触发，但导出的核心函数行为不严谨。

### 修复方案

- 新增 `text(value)`，仅把 `null` 和 `undefined` 归一化为空字符串。
- JSON、Base64、URL、时间戳、JWT 路径统一使用该 helper。
- `base64UrlDecode()` 也复用同一输入文本，避免重复转换。

### 性能、覆盖率与质量指标

- `node --test tests/tools.test.mjs`：9 个测试全部通过。
- `npm run build`：通过。

### 下一步计划

- 继续检查工具核心中其它直接 API 与 UI 输入之间的边界差异。
- 继续等待并行助手默认模式改动稳定后恢复组合测试。
- 继续优先处理可独立验证的小范围修复。

## 第 29 轮：工具箱单独测试脚本

时间：2026-06-18

### 已完成内容

- 梳理当前测试脚本粒度。
- 新增 `npm run test:tools`，只运行 `tests/tools.test.mjs`。
- 验证新脚本可用于工具箱改动的快速回归。

### 发现的问题

- `npm run test:toolbox` 同时包含助手和工具箱测试。
- 当前工作区存在并行未提交的助手默认模式改动，导致工具箱小改动也可能被助手测试状态阻塞。

### 修复方案

- 在 `package.json` 中新增脚本：`node --test tests/tools.test.mjs`。
- 保留原 `test:toolbox` 作为助手+工具箱组合回归入口。

### 性能、覆盖率与质量指标

- `npm run test:tools`：9 个测试全部通过，耗时约 1.1 秒。

### 下一步计划

- 等助手并行改动稳定后，继续恢复 `npm run test:toolbox` 为组合回归。
- 继续视需要增加 `test:assistant`，把助手单独回归也显式暴露。
- 继续围绕工具箱/助手做小范围、高确定性提交。

## 第 30 轮：AI 助手单独测试脚本

时间：2026-06-18

### 已完成内容

- 单独运行助手测试，确认当前工作区助手测试可稳定通过。
- 新增 `npm run test:assistant`，只运行 `tests/assistant.test.mjs`。
- 复跑助手+工具箱组合测试，确认当前状态下组合回归恢复。

### 发现的问题

- 第 29 轮只增加了工具箱单独测试入口，助手仍缺少对称的快速回归命令。
- 当助手或工具箱任一侧处于并行开发状态时，单独脚本能更快定位失败范围。

### 修复方案

- 在 `package.json` 中新增脚本：`node --test tests/assistant.test.mjs`。
- 保留 `test:toolbox` 作为组合回归入口。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：13 个测试全部通过，耗时约 1.1 秒。
- `npm run test:toolbox`：22 个测试全部通过，耗时约 1.2 秒。

### 下一步计划

- 继续在功能提交前优先跑 `test:assistant`、`test:tools`，再按需跑组合与全量。
- 继续审计助手大模型模式相关的取消、超时和错误提示边界。
- 继续记录并隔离并行未提交改动带来的全量测试噪声。

## 第 31 轮：工具箱英文交互自动化回归

时间：2026-06-18

### 已完成内容

- 将前几轮浏览器验证过的英文模式行为沉淀到 jsdom 自动化测试。
- 扩展工具箱测试加载器，可选加载 `i18n.js`。
- 新增测试覆盖英文模式下的标题、tablist aria-label、Base64/URL placeholder 和 UUID 空复制状态。

### 发现的问题

- 此前英文 placeholder、动态状态提示主要依赖浏览器手工验证。
- 缺少自动化测试时，后续 i18n 字典或模板改动容易让这些细节回归。

### 修复方案

- `loadToolsPage({ i18n: true })` 会加载 i18n 脚本并清理 localStorage，保证语言状态隔离。
- 新增英文模式交互测试，点击 `.lang-toggle` 后断言静态和动态文案。

### 性能、覆盖率与质量指标

- `npm run test:tools`：10 个测试全部通过，耗时约 1.4 秒。

### 下一步计划

- 继续把高价值浏览器回归沉淀为轻量自动化测试。
- 继续检查助手大模型模式中可独立验证的取消/错误处理。
- 继续隔离并行未提交改动，避免扩大提交范围。

## 第 32 轮：Base64 解码全局依赖收敛

时间：2026-06-18

### 已完成内容

- 审查工具核心 Base64 编解码实现。
- 将解码路径从未限定的 `atob()` 调整为 `root.atob()`。
- 复跑工具箱单测和构建。

### 发现的问题

- 编码路径使用 `root.btoa()`，解码路径使用全局 `atob()`。
- 在浏览器中通常等价，但对导出的核心函数来说，显式使用同一个 root 对象更一致，也减少非浏览器环境或测试环境下的隐式全局依赖。

### 修复方案

- `decodeBase64()` 改为调用 `root.atob(clean)`。
- 保持错误处理和 UTF-8 严格解码逻辑不变。

### 性能、覆盖率与质量指标

- `npm run test:tools`：10 个测试全部通过，耗时约 1.3 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计工具核心对浏览器全局对象的直接依赖。
- 继续检查助手大模型模式中可独立验证的取消/错误处理。
- 继续保持提交范围小而可回滚。

## 第 33 轮：Base64 兼容路径回归覆盖

时间：2026-06-18

### 已完成内容

- 继续审查工具核心 Base64 编解码兼容路径。
- 将无 `TextEncoder` / `TextDecoder` 时的 legacy fallback 从隐式全局调用收敛到 `root` 对象。
- 增加 jsdom 回归测试，模拟缺少 `TextEncoder` 与 `TextDecoder` 的运行环境。

### 发现的问题

- Base64 fallback 路径仍直接调用 `escape()` / `unescape()`，与前一轮 `root.atob()` 收敛方向不一致。
- 缺少覆盖 legacy fallback 的自动化测试，后续调整可能只验证现代浏览器路径。

### 修复方案

- `encodeBase64()` fallback 改为 `root.unescape(encodeURIComponent(raw))`。
- `decodeBase64()` fallback 改为 `decodeURIComponent(root.escape(binary))`。
- 新增 `tools core Base64 fallback works without TextEncoder and TextDecoder` 测试，验证中文文本在兼容路径下可往返。

### 性能、覆盖率与质量指标

- `npm run test:tools`：11 个测试全部通过，耗时约 1.2 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计工具核心对浏览器全局对象的直接依赖与异常路径。
- 继续把浏览器手工验证中发现的高价值边界沉淀为自动化测试。
- 继续隔离并行未提交改动，保持每轮提交范围清晰。

## 第 34 轮：JWT Base64URL 字符集校验

时间：2026-06-18

### 已完成内容

- 审查 JWT 解码中 Base64URL 片段的输入校验。
- 增加 Base64URL 字符集与 padding 位置校验。
- 补充测试覆盖合法 URL-safe payload 与非法标准 Base64 payload。

### 发现的问题

- JWT header/payload 解码前没有显式校验 Base64URL 字符集。
- 包含 `+` 或 `/` 的标准 Base64 片段可能被当前流程成功解码，和 JWT 使用的 URL-safe 编码语义不一致。
- padding 处理依赖 `atob()` 的异常，错误边界不够清晰。

### 修复方案

- 新增 `isBase64UrlText()`，只允许 `A-Z`、`a-z`、`0-9`、`-`、`_` 与尾部合法 padding。
- 对长度余数为 1、padding 位置不合法、含 `+` / `/` 的片段提前返回错误。
- 以去 padding 后的长度进行补齐，避免兼容 padded 输入时过度补 `=`。

### 性能、覆盖率与质量指标

- `npm run test:tools`：11 个测试全部通过，耗时约 1.6 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计 JWT 和 Base64 解码的错误提示一致性。
- 继续检查工具箱页面交互在真实浏览器中的控制台错误与布局状态。
- 继续保持小步提交，避免混入并行功能改动。

## 第 35 轮：真实浏览器工具箱与助手回归

时间：2026-06-18

### 已完成内容

- 使用本地服务 `http://127.0.0.1:8138/tools/` 执行真实浏览器回归。
- 验证工具箱页面标题、语言状态、当前选中工具、水平溢出和 AI 悬浮球初始状态。
- 验证 JWT 非法 Base64URL payload 在页面中会清空输出并展示英文错误。
- 打开 AI 助手面板，验证 dialog、模式按钮、快捷入口、输入框和发送按钮可访问。
- 执行一条本地问答，确认用户输入不会以原始 HTML 渲染，助手能返回工具箱结果。

### 发现的问题

- 本轮未发现新的崩溃、控制台 warn/error 或横向溢出问题。
- JWT 错误提示与第 34 轮修复一致，真实页面行为符合预期。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增代码修复。
- 保持后续优化继续以自动化测试和真实浏览器检查组合验证。

### 性能、覆盖率与质量指标

- `GET /tools/`：HTTP 200。
- 桌面浏览器视口约 `1280 x 720`，`scrollWidth` 与 `clientWidth` 一致，无水平溢出。
- 浏览器 console `warn/error`：0。
- `npm run test:toolbox`：24 个测试全部通过，耗时约 1.9 秒。

### 下一步计划

- 继续审计助手消息渲染与大模型模式的异常路径。
- 继续检查工具箱按钮文案、可访问名称和错误提示一致性。
- 继续将真实浏览器发现的高价值路径沉淀为自动化回归。

## 第 36 轮：JWT JSON 对象校验

时间：2026-06-18

### 已完成内容

- 继续审计工具箱 JWT 解码的数据结构边界。
- 在 header/payload JSON 解析后增加对象类型校验。
- 新增 primitive JWT 回归测试，覆盖 `null.null.signature` 这类语法合法但结构无效的输入。

### 发现的问题

- 旧逻辑只校验 header/payload 能否 `JSON.parse()`。
- `null`、字符串、数字或数组等 JSON 值会被显示为合法 JWT 解码结果。
- JWT header 和 claims payload 应为 JSON 对象，当前行为会误导用户判断 token 结构。

### 修复方案

- 新增 `isJsonObject()`，要求解析结果为非数组对象。
- `decodeJwt()` 先解析 header/payload，再校验对象类型，最后格式化输出。
- 对结构不合法的 JSON 值返回 `jwtJson` 错误，避免输出伪合法结果。

### 性能、覆盖率与质量指标

- `npm run test:tools`：11 个测试全部通过，耗时约 1.4 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计 JWT compact segment 数量和空片段处理。
- 继续检查工具箱页面错误提示在中英文模式下的一致性。
- 在并行助手改动稳定后，再处理 LLM 超时与取消文案区分问题。

## 第 37 轮：JWT compact 片段数量校验

时间：2026-06-18

### 已完成内容

- 审计 JWT compact serialization 的段数处理。
- 收紧 `decodeJwt()` 对 token 结构的校验。
- 新增四段 token 与空 header 的回归测试。

### 发现的问题

- 旧逻辑只要求 token 至少包含 header 和 payload。
- `header.payload.signature.extra` 会被忽略尾部 `extra` 后成功解码，容易让用户误判 malformed token。
- 空 header 或空 payload 会进入 Base64/JSON 解析路径，错误分类不够直接。

### 修复方案

- `decodeJwt()` 仅接受 2 段或 3 段 token。
- 明确拒绝空 header 和空 payload。
- 结构错误统一返回 `jwtParts`，让 UI 清空输出并展示结构类错误。

### 性能、覆盖率与质量指标

- `npm run test:tools`：11 个测试全部通过，耗时约 1.6 秒。
- `npm run build`：通过。

### 下一步计划

- 继续检查工具箱错误提示在真实浏览器中的表现。
- 继续审计 Base64、URL 和时间戳工具中可以自动化覆盖的边界。
- 保持助手 LLM 相关修复等待并行改动稳定后再提交。

## 第 38 轮：复制 fallback 临时节点清理

时间：2026-06-18

### 已完成内容

- 审计工具箱复制按钮依赖的公共 `CWLUtils.copyText()` 降级路径。
- 修复 `legacyCopy()` 在 `execCommand()` 或选择文本失败时可能遗留临时 textarea 的问题。
- 增加 jsdom 回归测试，模拟复制失败并断言 DOM 无残留临时节点。

### 发现的问题

- `legacyCopy()` 只在 `execCommand("copy")` 返回后移除 textarea。
- 如果 `select()`、`setSelectionRange()` 或 `execCommand()` 抛错，隐藏 textarea 会留在页面中。
- 工具箱、代码块复制和分享复制都可能经过公共复制工具，失败路径需要保证无 DOM 泄漏。

### 修复方案

- 将临时 textarea 引用提升到 `try` 外。
- 使用 `finally` 在成功、返回失败或抛错后统一移除临时节点。
- 新增 `copy utility cleans up legacy textarea when copy fails` 测试。

### 性能、覆盖率与质量指标

- `npm run test:tools`：12 个测试全部通过，耗时约 1.6 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计工具箱与公共工具函数的失败路径资源清理。
- 继续检查复制状态在真实浏览器中的表现。
- 继续保持提交范围小，避免混入并行页面改动。

## 第 39 轮：真实浏览器复制回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `http://127.0.0.1:8138/tools/`。
- 进入 UUID 工具，生成 UUID 并点击复制。
- 读取浏览器剪贴板，验证复制内容与页面生成值一致。
- 检查复制状态、临时 textarea 残留和控制台日志。

### 发现的问题

- 本轮未发现新的复制失败或控制台 warn/error。
- 第 38 轮修复后的公共复制降级路径未造成真实浏览器回归。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持复制相关风险继续由自动化测试和浏览器验证共同覆盖。

### 性能、覆盖率与质量指标

- 复制结果：剪贴板 UUID 与页面 UUID 完全一致。
- UUID 状态提示：`Copied`，状态为成功。
- 临时复制 textarea 残留：0。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续检查工具箱其它交互的真实浏览器状态。
- 继续审计公共工具函数中可能影响工具箱的边界路径。
- 第 3 小时报告时汇总本阶段已提交修复、测试和剩余风险。

## 第 40 轮：UUID crypto API 防崩溃

时间：2026-06-18

### 已完成内容

- 审计 UUID 生成器对浏览器 `crypto` API 的调用方式。
- 为 `randomUUID()` 和 `getRandomValues()` 增加函数类型检查和异常降级。
- 新增测试模拟 `randomUUID()` 抛错、`getRandomValues()` 正常可用的环境。

### 发现的问题

- 旧逻辑只判断 `root.crypto.randomUUID` 是否 truthy，然后直接调用。
- 如果某些环境、扩展或测试桩提供了非函数属性，或 `randomUUID()` 调用时抛错，UUID 生成会直接崩溃。
- `getRandomValues()` 同样缺少类型和异常保护。

### 修复方案

- 仅当 `crypto.randomUUID` 是函数时才调用，并在异常时降级。
- 仅当 `crypto.getRandomValues` 是函数且调用成功时才使用填充结果。
- 如果安全随机 API 不可用或失败，继续使用原有 `Math.random()` 兼容兜底，避免 UI 崩溃。

### 性能、覆盖率与质量指标

- `npm run test:tools`：13 个测试全部通过，耗时约 1.4 秒。
- `npm run build`：通过。

### 下一步计划

- 继续检查 UUID 生成在真实浏览器中的交互状态。
- 继续审计工具核心其它浏览器 API 依赖的类型与异常边界。
- 到第 3 小时输出阶段性工作报告。

## 第 41 轮：JWT 英文按钮可访问名称优化

时间：2026-06-18

### 已完成内容

- 审查工具箱英文模式下 JWT 面板按钮文案。
- 为 JWT 解码按钮增加模板内联英文 HTML 文案。
- 补充英文模式测试，确保按钮文案切换为 `Decode JWT`。

### 发现的问题

- JWT 面板只有一个主操作按钮，但英文模式下显示为泛化的 `Decode`。
- 在真实浏览器自动化中，按钮可访问名称不够具体，容易和 Base64/URL 面板的通用 Decode 概念混淆。
- 直接改 `js/i18n.js` 会碰到并行未提交字典改动，不适合作为本轮小提交。

### 修复方案

- 在 `src/templates/tools.mjs` 的 JWT 按钮上增加 `data-i18n-en-html`。
- 继续使用现有 i18n inline override 机制，不改全局字典。
- 新增测试断言英文切换后 `[data-jwt-decode]` 文案包含 `Decode JWT`。

### 性能、覆盖率与质量指标

- `npm run test:tools`：13 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过。

### 下一步计划

- 继续检查英文模式下其它工具按钮的可访问名称。
- 继续用真实浏览器复核 JWT 面板交互。
- 保持不触碰并行脏文件，必要时用模板 inline 文案做局部优化。

## 第 42 轮：真实浏览器 JWT 标签回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 验证英文模式下 JWT tab 可见且可点击。
- 使用可访问名称 `Decode JWT` 精确定位 JWT 解码按钮。
- 检查页面横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的布局溢出或控制台 warn/error。
- 第 41 轮模板 inline 英文文案在真实浏览器中生效。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持英文按钮文案由模板 inline override 控制，避免触碰并行 i18n 字典改动。

### 性能、覆盖率与质量指标

- JWT 按钮可访问名称：`Decode JWT`，精确定位数量为 1。
- 当前选中工具：`jwt`。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续检查工具箱其它英文可访问名称是否需要局部优化。
- 继续审计页面绑定层的异常路径。
- 继续把浏览器验证结果写入优化报告。

## 第 43 轮：工具箱静态产物同步

时间：2026-06-18

### 已完成内容

- 检查第 41 轮模板变更后的构建产物状态。
- 确认 `tools/index.html` 已由构建更新。
- 将工具箱静态输出中的 JWT 按钮英文 inline 文案同步纳入提交范围。

### 发现的问题

- 第 41 轮已提交模板和测试，但跟踪的生成页 `tools/index.html` 仍处于未提交状态。
- 如果不提交静态产物，部署到静态站点时可能仍显示旧的英文按钮文案。

### 修复方案

- 只暂存 `tools/index.html` 中与 JWT 按钮 `data-i18n-en-html` 对应的一行变更。
- 保持其它由并行构建或配置改动产生的 HTML / sitemap / search-index 改动不纳入本轮。

### 性能、覆盖率与质量指标

- `tools/index.html` diff：1 行模板产物同步。
- `git diff --check -- tools/index.html`：通过。

### 下一步计划

- 后续模板改动后继续检查是否存在跟踪的静态产物需要同步。
- 继续保持生成文件提交范围与源码变更一致。
- 继续下一轮工具箱交互审计。

## 第 44 轮：Clipboard 访问异常安全降级

时间：2026-06-18

### 已完成内容

- 审计公共复制入口 `CWLUtils.copyText()` 对 `navigator.clipboard` 的访问方式。
- 为 clipboard getter 抛错、`writeText` 非函数等异常环境增加安全降级。
- 补充 jsdom 测试，模拟 clipboard 访问抛错后仍可走 `execCommand` fallback。

### 发现的问题

- 旧逻辑直接读取裸 `navigator.clipboard`，如果受限环境或浏览器策略导致 getter 抛错，会同步中断。
- `writeText` 只做 truthy 判断，没有确认它是函数。
- 工具箱复制按钮通过公共复制工具触发该路径，异常时可能直接显示失败而不是尝试 legacy fallback。

### 修复方案

- 使用 `window.navigator` 并将 clipboard 访问包在 `try/catch` 中。
- 仅当 `clipboard.writeText` 是函数时使用现代 Clipboard API。
- clipboard 访问失败时直接调用 `Utils.legacyCopy(text)`。

### 性能、覆盖率与质量指标

- `npm run test:tools`：14 个测试全部通过，耗时约 1.6 秒。
- `node --test tests/js-behavior.test.mjs`：25 个测试全部通过，耗时约 1.3 秒。
- `npm run build`：通过。

### 下一步计划

- 继续真实浏览器验证复制成功路径没有回归。
- 继续审计公共工具函数中可能被工具箱间接使用的异常路径。
- 继续保持本轮提交只包含 `utils.js`、工具测试和报告。

## 第 45 轮：Clipboard guard 真实浏览器回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 进入 UUID 工具，生成 UUID 并执行复制。
- 读取浏览器剪贴板，验证复制成功路径未受第 44 轮 clipboard guard 影响。
- 检查页面状态、横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的复制失败、布局溢出或控制台 warn/error。
- 第 44 轮对公共复制入口的异常保护没有影响现代 Clipboard API 成功路径。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持复制路径后续同时覆盖异常 fallback 与真实浏览器成功路径。

### 性能、覆盖率与质量指标

- 复制结果：剪贴板 UUID 与页面 UUID 完全一致。
- UUID 状态提示：`Copied`，状态为成功。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续审计工具箱状态提示和失败路径。
- 继续检查公共工具函数的异常处理一致性。
- 继续维持每轮提交和报告记录。

## 第 46 轮：工具箱事件委托防崩溃

时间：2026-06-18

### 已完成内容

- 审计 `js/tools.js` 的 click / keydown 事件委托。
- 增加安全 `closest()` helper，统一处理非 Element 事件目标。
- 新增测试模拟 document 作为事件目标时的 click 和 keydown。

### 发现的问题

- 旧逻辑在 click handler 中直接调用 `event.target.closest(...)`。
- 如果事件目标是 `document` 或其它没有 `closest()` 的对象，会抛出 TypeError。
- 这类异常会影响工具箱页面的全局交互稳定性，尤其是自动化、插件或脚本派发事件时。

### 修复方案

- 新增 `closest(target, selector)`，仅当 `target.closest` 是函数时才调用。
- 将 click handler 中所有 `event.target.closest(...)` 调整为安全 helper。
- keydown handler 也复用同一 helper，保持行为一致。

### 性能、覆盖率与质量指标

- `npm run test:tools`：15 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过。

### 下一步计划

- 继续真实浏览器验证工具箱主要交互路径。
- 继续审计页面绑定层其它事件入口。
- 继续扩展高价值异常路径的 jsdom 回归测试。

## 第 47 轮：事件委托真实浏览器回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 验证 Base64 tab 切换、输入和编码按钮交互。
- 验证 JWT tab 切换以及 `Decode JWT` 按钮文案。
- 检查横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的交互失败、布局溢出或控制台 warn/error。
- 第 46 轮事件委托 helper 未影响正常 Element 事件路径。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持事件委托异常路径由 jsdom 覆盖，正常交互路径由浏览器回归覆盖。

### 性能、覆盖率与质量指标

- Base64 输入 `event guard` 编码结果：`ZXZlbnQgZ3VhcmQ=`。
- Base64 状态提示：`Done`。
- 当前选中工具：`jwt`。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续审计工具箱绑定层状态更新和错误恢复。
- 继续检查工具箱核心函数的边界输入。
- 继续维持自动化测试与浏览器验证组合。

## 第 48 轮：工具箱定向覆盖率记录

时间：2026-06-18

### 已完成内容

- 运行工具箱定向覆盖率命令。
- 记录当前工具箱模板和相关 ESM 模块覆盖率。
- 为最终报告建立可引用的覆盖率指标。

### 发现的问题

- Node 原生覆盖率主要统计 ESM import 的构建模板与库模块。
- 通过 jsdom `eval()` 加载的浏览器脚本不会完整进入本次覆盖率表，因此仍需结合测试数量和浏览器验证说明实际覆盖面。

### 修复方案

- 本轮为质量指标记录，没有新增代码修复。
- 后续如需更完整的浏览器脚本覆盖率，可单独引入前端覆盖率采集配置。

### 性能、覆盖率与质量指标

- `node --test --experimental-test-coverage tests/tools.test.mjs`：15 个测试全部通过，耗时约 1.7 秒。
- `src/templates/tools.mjs`：line 100%，branch 95.83%，funcs 100%。
- 本次覆盖率 all files：line 95.38%，branch 75.51%，funcs 76.00%。

### 下一步计划

- 继续扩大工具箱核心和页面绑定层的边界测试。
- 继续在最终报告中区分 ESM 覆盖率和 jsdom 行为覆盖。
- 继续检查真实浏览器路径，弥补覆盖率工具未统计的浏览器脚本执行面。

## 第 49 轮：英文时间戳本地时间格式

时间：2026-06-18

### 已完成内容

- 在真实浏览器检查英文模式下时间戳转换输出。
- 修复 `formatTimeResult()` 对 `local` 行的格式化逻辑。
- 补充英文模式时间戳转换测试，断言 `toLocaleString("en-US")` 被用于显示本地时间。

### 发现的问题

- 页面语言为英文时，时间戳转换结果的标签已翻译为 `Local time`，但值仍使用默认系统 locale。
- 真实浏览器输出示例为 `Local time: 2024/6/18 16:00:00`，而英文模式预期应使用 `en-US` 格式。
- `updateNow()` 已使用页面语言 locale，但转换结果没有复用同样逻辑。

### 修复方案

- 在 `formatTimeResult()` 渲染 `local` 行时，基于 `milliseconds` 重新构造 Date。
- 使用现有 `locale()` 函数调用 `toLocaleString(locale())`。
- 保留核心函数返回数据结构不变，只在页面显示层做语言相关格式化。

### 性能、覆盖率与质量指标

- `npm run test:tools`：15 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过。

### 下一步计划

- 使用真实浏览器复核英文时间戳输出。
- 继续检查日期转时间戳输出是否同样跟随页面语言。
- 继续审计语言切换后的动态状态一致性。

## 第 50 轮：真实浏览器时间戳 locale 回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 切换到时间戳工具并输入 `1718697600`。
- 验证英文模式下本地时间输出使用 `en-US` 格式。
- 检查横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的布局溢出或控制台 warn/error。
- 第 49 轮修复后的英文时间戳输出与浏览器 `toLocaleString("en-US")` 一致。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 继续保留 jsdom 断言，防止显示层绕过 `locale()`。

### 性能、覆盖率与质量指标

- 输入秒级时间戳：`1718697600`。
- 英文本地时间输出：`Local time: 6/18/2024, 4:00:00 PM`。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续检查日期转时间戳输出路径。
- 继续审计语言切换后动态结果是否需要刷新或重新渲染。
- 继续记录真实浏览器验证证据。

## 第 51 轮：真实浏览器日期转时间戳 locale 回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 切换到时间戳工具，输入本地日期时间 `2026-06-18T12:34`。
- 验证日期转时间戳输出同样使用英文 locale。
- 检查状态提示、横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的转换失败、布局溢出或控制台 warn/error。
- 第 49 轮显示层修复同时覆盖了秒/毫秒转日期和日期转时间戳两条路径。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持时间转换输出统一由 `formatTimeResult()` 控制。

### 性能、覆盖率与质量指标

- 输入日期时间：`2026-06-18T12:34`。
- 输出包含：`Local time: 6/18/2026, 12:34:00 PM`。
- 状态提示：`Converted`。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续审计语言切换后的动态状态一致性。
- 继续检查工具箱错误恢复路径。
- 继续保持真实浏览器验证覆盖主要用户路径。

## 第 52 轮：工具箱与助手组合回归

时间：2026-06-18

### 已完成内容

- 运行工具箱与 AI 助手组合测试入口。
- 确认最近工具箱页面绑定改动未影响助手测试。
- 检查本阶段触碰的工具箱相关文件没有未提交残留。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 当前工作区仍有大量并行未提交改动，但工具箱相关已提交文件保持清洁。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续将无关并行改动排除在本任务提交之外。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：29 个测试全部通过，耗时约 1.7 秒。
- 工具箱相关文件状态：clean。

### 下一步计划

- 继续寻找工具箱可独立修复的错误恢复与 UX 问题。
- 继续避免触碰并行 assistant/relay/workflow 改动。
- 下一轮优先检查动态语言切换后的状态一致性。

## 第 53 轮：时间转换结果语言切换重绘

时间：2026-06-18

### 已完成内容

- 审计时间戳转换结果在语言切换后的显示状态。
- 为成功的时间转换结果增加缓存。
- 在 `cwl:langchange` 后重绘已有时间转换输出。
- 新增测试覆盖中文结果切换到英文后的标签与本地时间格式更新。

### 发现的问题

- 旧逻辑只在语言切换时更新“当前时间戳”区域。
- 已生成的时间转换结果是纯文本，不会被 i18n 自动更新。
- 用户先生成中文结果再切英文时，输出标签和本地时间格式会停留在旧语言。

### 修复方案

- 使用 `timeResults` 按输出元素缓存最近成功的转换数据。
- 转换失败时删除对应缓存，避免错误后继续重绘旧结果。
- 语言切换时调用 `formatTimeResult()` 重新渲染缓存结果。

### 性能、覆盖率与质量指标

- `npm run test:tools`：16 个测试全部通过，耗时约 1.6 秒。
- `npm run build`：通过。

### 下一步计划

- 使用真实浏览器验证语言切换后的时间结果重绘。
- 继续检查其它动态输出是否需要语言切换重绘。
- 继续保持缓存范围只覆盖可安全重绘的数据。

## 第 54 轮：真实浏览器时间结果语言切换回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 切换到中文模式，生成时间戳转换结果。
- 再切换到英文模式，验证已有输出即时重绘。
- 检查横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的语言切换、布局溢出或控制台 warn/error 问题。
- 第 53 轮缓存重绘方案在真实浏览器中符合预期。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持时间转换结果在语言切换后由缓存数据重绘，而不是复用旧纯文本。

### 性能、覆盖率与质量指标

- 中文输出包含：`本地时间: 2024/6/18 16:00:00`。
- 切换英文后输出包含：`Local time: 6/18/2024, 4:00:00 PM`。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续检查其它动态输出是否存在语言切换后的旧文本残留。
- 继续优先处理可测试、可独立提交的问题。
- 继续记录真实浏览器验证证据。

## 第 55 轮：语言切换修复后组合回归

时间：2026-06-18

### 已完成内容

- 运行工具箱与 AI 助手组合测试入口。
- 验证第 53 轮语言切换缓存改动未影响助手测试。
- 更新当前组合回归测试数量和耗时指标。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 当前 assistant 测试仍受并行未提交改动影响，测试数量已扩展到内置 demo key 场景；本轮只记录结果，不提交这些并行改动。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续使用 `test:toolbox` 作为工具箱与助手交叉影响的快速检查入口。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：30 个测试全部通过，耗时约 1.7 秒。

### 下一步计划

- 继续审计工具箱动态输出和状态提示。
- 继续在第 4 小时报告中汇总本阶段修复。
- 继续隔离并行 assistant/relay 改动。

## 第 56 轮：工具箱状态提示逻辑收敛

时间：2026-06-18

### 已完成内容

- 审计工具箱复制路径和通用操作路径的状态提示代码。
- 新增 `setStatusElement()`，统一设置文本和 `is-ok` / `is-error` class。
- 将复制空内容、复制成功、复制失败三条路径改为复用同一状态 helper。

### 发现的问题

- 复制路径手动操作 `textContent` 和 class，与 `setStatus()` 的逻辑重复。
- 后续维护时容易出现成功/失败 class 清理不一致。

### 修复方案

- 将状态元素更新逻辑拆成 `setStatusElement(el, message, type)`。
- `setStatus(id, ...)` 继续作为按 id 设置状态的薄封装。
- 复制路径改用 `setStatusElement()`，减少重复代码。

### 性能、覆盖率与质量指标

- `npm run test:tools`：16 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计工具箱页面绑定层的重复逻辑。
- 继续用现有复制状态测试覆盖 refactor 风险。
- 准备第 4 小时阶段报告。

## 第 57 轮：状态提示真实浏览器回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 验证 UUID 空复制错误状态。
- 生成 UUID 后验证复制成功状态。
- 检查横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的状态 class 错误、布局溢出或控制台 warn/error。
- 第 56 轮状态 helper refactor 未改变复制状态行为。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 保持状态 class 行为由 jsdom 测试和浏览器验证双重覆盖。

### 性能、覆盖率与质量指标

- 空复制状态：`Nothing to copy`，`is-error=true`，`is-ok=false`。
- 成功复制状态：`Copied`，`is-ok=true`，`is-error=false`。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续审计状态提示与动态语言切换的交叉路径。
- 准备第 4 小时阶段报告。
- 继续保持真实浏览器验证覆盖主要用户路径。

## 第 58 轮：助手工具箱问答浏览器回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 打开 AI 助手悬浮球。
- 输入 `toolbox json`，验证本地站点助手返回工具箱相关结果。
- 检查助手面板状态、工具箱链接、横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的助手打开失败、工具箱推荐失败、布局溢出或控制台 warn/error。
- 本地问答文本与链接之间在纯 `textContent` 中会连在一起，但可见链接结构存在且可点击，本轮不改动并行 assistant 文件。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 继续避免触碰当前存在大块并行 diff 的 `js/assistant.js`。

### 性能、覆盖率与质量指标

- 助手面板状态：open。
- 工具箱链接：存在 `/tools/`。
- 横向溢出：false。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 第 4 小时报告中纳入本轮助手浏览器验证结果。
- 待 assistant 并行改动稳定后，再处理链接文本间距等细节。
- 继续优先推进工具箱可独立修复项。

## 第 59 轮：时间转换成功状态语言切换重绘

时间：2026-06-18

### 已完成内容

- 继续审计时间转换结果语言切换后的动态状态。
- 在 `cwl:langchange` handler 中同步刷新时间工具成功状态文案。
- 扩展测试断言中文转换成功后切英文，状态变为 `Converted`。

### 发现的问题

- 第 53 轮已重绘时间转换输出，但 `time-status` 成功文案仍可能停留在旧语言。
- 用户先在中文生成结果，再切英文时，输出已英文但状态仍可能是 `转换完成`。

### 修复方案

- 语言切换时，如果存在成功缓存结果且 `time-status` 当前为成功状态，则重新调用 `setStatus()`。
- 只刷新成功状态，不缓存错误状态，避免错误输入被语言切换误恢复。

### 性能、覆盖率与质量指标

- `npm run test:tools`：16 个测试全部通过，耗时约 1.5 秒。
- `npm run build`：通过。

### 下一步计划

- 使用真实浏览器验证时间状态文案切换。
- 继续检查其它动态状态是否存在同类问题。
- 继续保持状态刷新逻辑限定在可安全重绘的场景。

## 第 60 轮：真实浏览器时间状态语言切换回归

时间：2026-06-18

### 已完成内容

- 在真实浏览器重新加载 `/tools/`。
- 中文模式下生成时间戳转换结果。
- 切换到英文模式，验证成功状态和输出同时重绘。
- 检查横向溢出和控制台日志。

### 发现的问题

- 本轮未发现新的状态重绘失败、布局溢出或控制台 warn/error。
- 第 59 轮状态重绘逻辑在真实浏览器中符合预期。

### 修复方案

- 本轮为真实浏览器验证与证据记录，没有新增代码修复。
- 继续将成功状态重绘限定在存在缓存结果的时间工具内。

### 性能、覆盖率与质量指标

- 切换前状态：`转换完成`，`is-ok=true`。
- 切换后状态：`Converted`，`is-ok=true`。
- 切换后输出包含：`Local time: 6/18/2024, 4:00:00 PM`。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续审计其它动态状态的语言切换行为。
- 继续组合回归，确认本阶段工具箱改动未影响助手。
- 继续保持每轮验证记录。

## 第 61 轮：第 4 小时后组合回归

时间：2026-06-18

### 已完成内容

- 检查工具箱相关已提交文件状态。
- 运行工具箱与 AI 助手组合测试入口。
- 验证第 59 轮时间状态语言切换修复未影响助手侧测试。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 工具箱相关文件保持 clean。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续将并行未提交改动排除在本任务提交之外。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：30 个测试全部通过，耗时约 1.9 秒。

### 下一步计划

- 继续审计工具箱剩余动态状态与错误恢复路径。
- 继续定期运行组合回归。
- 继续推进可独立提交的小范围修复。

## 第 62 轮：UUID crypto getter 防崩溃

时间：2026-06-18

### 已完成内容

- 继续审计 UUID 生成器的浏览器 API 防御边界。
- 增加 `getCrypto()` 安全读取 helper。
- 新增测试模拟 `window.crypto` getter 抛错的环境。

### 发现的问题

- 第 40 轮已处理 `randomUUID()` / `getRandomValues()` 调用抛错。
- 但如果 `root.crypto` 属性读取本身抛错，旧逻辑仍会在降级前崩溃。
- 受限 iframe、测试桩或异常浏览器扩展环境可能暴露这类 getter 异常。

### 修复方案

- 使用 `getCrypto()` 包裹 `root.crypto` 读取。
- crypto 访问失败时返回 `null`，继续走 `Math.random()` 兼容兜底，避免 UI 崩溃。
- 扩展 `loadToolsCore()` 测试加载器支持 `cryptoThrows` 场景。

### 性能、覆盖率与质量指标

- `npm run test:tools`：17 个测试全部通过，耗时约 2.2 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计工具核心其它浏览器全局 getter 的异常边界。
- 继续保持 UUID 生成的格式与版本位测试覆盖。
- 继续组合回归确认助手不受影响。

## 第 63 轮：Base64 文本编解码全局访问防护

时间：2026-06-18

### 已完成内容

- 将工具核心里的浏览器全局能力读取抽为 `getGlobal()`。
- 让 `TextEncoder` / `TextDecoder` getter 异常时继续使用既有 UTF-8 fallback。
- 新增 Base64 测试模拟文本编解码 API 访问被阻断的环境。

### 发现的问题

- `encodeBase64()` 和 `decodeBase64()` 虽然已有无 TextEncoder/TextDecoder 的 fallback。
- 但旧逻辑直接读取 `root.TextEncoder` / `root.TextDecoder`，如果 getter 自身抛错，会提前进入失败分支。
- 受限测试环境、浏览器扩展或隔离 iframe 可能暴露这类异常。

### 修复方案

- 新增 `getGlobal(name)`，统一捕获全局属性读取异常。
- Base64 编码和解码先安全读取文本编解码构造器，读取失败时继续走 `unescape` / `escape` fallback。
- `getCrypto()` 改为复用 `getGlobal("crypto")`，减少重复防护代码。

### 性能、覆盖率与质量指标

- `npm run test:tools`：18 个测试全部通过，耗时约 2.0 秒。
- `npm run build`：通过。

### 下一步计划

- 继续审计 Base64 其它全局函数不可用时的错误提示一致性。
- 继续运行工具箱与助手组合回归。
- 继续排查页面交互状态在异常输入后的恢复路径。

## 第 64 轮：文本编解码防护后组合回归

时间：2026-06-18

### 已完成内容

- 在第 63 轮 Base64 全局访问防护后运行工具箱与 AI 助手组合测试。
- 验证助手本地回答、快捷搜索、LLM 请求封装和面板隐藏状态。
- 验证工具箱新增文本编解码 getter 防护与既有 UUID 防护同时通过。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 并行工作树仍存在大量非本任务改动，本轮未纳入提交。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续以小范围提交隔离工具箱/助手相关变更。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：32 个测试全部通过，耗时约 1.9 秒。

### 下一步计划

- 继续审计 Base64 全局函数缺失时的错误提示质量。
- 继续检查工具页面复制、状态和语言切换交互。
- 继续定期运行浏览器级回归。

## 第 65 轮：工具箱与助手浏览器冒烟验证

时间：2026-06-18

### 已完成内容

- 在本地浏览器打开 `http://127.0.0.1:8138/tools/`。
- 验证 Base64 工具英文界面输入 `Codex 你好` 后输出 `Q29kZXgg5L2g5aW9`。
- 验证 UUID 工具生成 v4 UUID 后状态显示成功。
- 打开 AI 助手悬浮球，切换到站内助手模式，发送 `toolbox jwt` 查询。

### 发现的问题

- 本轮浏览器冒烟未发现新的功能失败。
- 页面当前语言为英文，来自浏览器本地语言状态，交互和状态文案均正常。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续保持站内助手查询不触发外部大模型请求。

### 性能、覆盖率与质量指标

- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。
- 助手回答包含 `/tools/` 链接，消息数为 3，面板保持打开。

### 下一步计划

- 继续审计 Base64 全局函数缺失时的错误提示质量。
- 继续检查助手模式切换和用户输入边界。
- 继续补充可自动化的浏览器级断言。

## 第 66 轮：Base64 缺失运行时 API 提示优化

时间：2026-06-18

### 已完成内容

- 审计 Base64 编解码依赖的 `btoa`、`atob`、`escape`、`unescape`。
- 将缺失运行时 API 的分支改为明确返回用户可读错误。
- 新增测试覆盖 Base64 关键全局函数不可用时的返回结果。

### 发现的问题

- 旧逻辑虽然会捕获异常，但中文环境会暴露 `is not a function` 这类底层错误。
- 缺少文本 fallback API 时，用户无法判断是输入问题还是浏览器能力受限。

### 修复方案

- 在调用 `btoa` / `atob` 前先判断是否为函数。
- 在 TextEncoder/TextDecoder fallback 路径中显式检查 `unescape` / `escape`。
- 保持错误 code 为 `base64Encode` / `base64Decode`，让页面层 i18n 仍可统一处理英文状态。

### 性能、覆盖率与质量指标

- `npm run test:tools`：19 个测试全部通过，耗时约 1.4 秒。
- `npm run build`：通过。

### 下一步计划

- 继续检查工具核心时间转换和 JWT 解码的异常边界。
- 继续运行组合回归，确认助手侧不受影响。
- 继续关注用户可见错误文案是否一致。

## 第 67 轮：工具 tab 未知目标状态防护

时间：2026-06-18

### 已完成内容

- 审计工具箱 tab 切换的事件委托边界。
- 修复未知 `data-tool-tab` 或外部伪 tab 触发时会破坏当前选中状态的问题。
- 新增测试覆盖外部伪 tab 与 tablist 内未知 id 两种异常点击。

### 发现的问题

- 旧逻辑会对所有 `[data-tool-tab]` 执行状态切换。
- 如果页面上出现未知 tab id，可能先清空真实 tab 的 active/aria 状态，再发现无匹配 panel。
- 浏览器扩展、异常 DOM 注入或未来模板改动都可能触发该边界。

### 修复方案

- `switchTool()` 只查询 `.tools-tabs` 内的 tab。
- 切换前同时确认目标 tab 与目标 panel 存在。
- click 委托只响应 `.tools-tabs` 内的 tab，避免外部同名属性误触发。

### 性能、覆盖率与质量指标

- `npm run test:tools`：20 个测试全部通过，耗时约 2.0 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续检查助手模式切换的事件委托边界。
- 继续审计工具页面 keyboard navigation 的异常 DOM 情况。

## 第 68 轮：tab 状态防护后组合回归

时间：2026-06-18

### 已完成内容

- 在第 67 轮 tab 切换防护后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、面板隐藏状态。
- 覆盖工具核心 Base64/UUID 防护、tab 键盘导航、未知 tab 点击防护和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 工具箱与助手相关已提交文件保持 clean，工作树剩余改动仍为并行无关改动。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续用独立小提交隔离验证记录。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：34 个测试全部通过，耗时约 1.9 秒。

### 下一步计划

- 继续检查助手模式切换的事件委托边界。
- 继续审计工具页面 keyboard navigation 的异常 DOM 情况。
- 继续运行浏览器级回归确认真实页面行为。

## 第 69 轮：工具 tab 键盘导航合法目标过滤

时间：2026-06-18

### 已完成内容

- 继续审计工具箱 tab 键盘导航路径。
- 抽取 `toolPanels()`、`panelFor()`、`toolTabs()`，统一合法 tab/panel 判定。
- 扩展未知 tab 回归测试，确认 `End` 键会跳到最后一个合法 tab，而不是被未知 id 卡住。

### 发现的问题

- 第 67 轮修复了点击路径，但键盘路径仍从全页面收集 `[data-tool-tab]`。
- 如果 tablist 内存在未知 tab id，`End` / 箭头导航可能尝试切到无面板目标，导致键盘交互无响应。

### 修复方案

- 键盘和鼠标切换统一使用 `.tools-tabs` 内且存在匹配 panel 的 tab 列表。
- `switchTool()` 继续在状态变更前校验目标 tab 和 panel。
- 测试覆盖未知 tab 后的键盘 `End` 导航恢复。

### 性能、覆盖率与质量指标

- `npm run test:tools`：20 个测试全部通过，耗时约 1.4 秒。
- `npm run build`：通过。

### 下一步计划

- 继续检查助手模式切换的事件委托边界。
- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证键盘和点击路径。

## 第 70 轮：复制目标缺失状态反馈

时间：2026-06-18

### 已完成内容

- 审计工具箱复制按钮的异常目标路径。
- 修复 `data-copy-target` 指向不存在元素时没有状态反馈的问题。
- 新增测试覆盖无效复制目标应在触发按钮所在面板显示错误。

### 发现的问题

- 旧逻辑只从复制目标所属面板查找 `.tool-status`。
- 当目标 id 缺失或模板未来出现拼写错误时，用户点击复制不会看到任何反馈。

### 修复方案

- `copyFrom()` 增加触发源参数。
- 状态区域优先使用目标所在面板，目标不存在时回退到触发按钮所在面板。
- 事件委托调用复制逻辑时传入当前复制按钮。

### 性能、覆盖率与质量指标

- `npm run test:tools`：21 个测试全部通过，耗时约 1.8 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证复制状态反馈。
- 继续审计其它用户操作的无反馈失败路径。

## 第 71 轮：复制状态修复后组合回归

时间：2026-06-18

### 已完成内容

- 在第 70 轮复制目标缺失状态反馈修复后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱 Base64/UUID 防护、tab 导航、复制目标缺失和剪贴板失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 当前工具箱相关提交保持独立，未混入助手并行改动。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留无效复制目标测试作为回归保护。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：35 个测试全部通过，耗时约 1.6 秒。

### 下一步计划

- 继续浏览器级验证复制状态反馈。
- 继续审计其它用户操作的无反馈失败路径。
- 继续等待助手并行改动稳定后再考虑助手脚本小修。

## 第 72 轮：复制状态浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 验证 UUID 未生成时点击复制显示 `Nothing to copy`。
- 验证生成 UUID 后点击复制显示 `Copied`。

### 发现的问题

- 本轮浏览器验证未发现新的复制状态问题。
- 页面复制反馈在英文语言状态下显示正常。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续保留第 70 轮无效复制目标自动化测试。

### 性能、覆盖率与质量指标

- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。
- UUID 输出示例：`024743d7-fbed-4db0-85f0-92ddb25a9c24`。

### 下一步计划

- 继续审计其它用户操作的无反馈失败路径。
- 继续组合回归，确认浏览器验证后的代码状态稳定。
- 继续等待助手并行改动稳定后再考虑助手脚本小修。

## 第 73 轮：工具专项覆盖率采样

时间：2026-06-18

### 已完成内容

- 运行 Node 内置覆盖率采样命令：`node --test --experimental-test-coverage tests/tools.test.mjs`。
- 记录工具箱测试数量、耗时和覆盖率摘要。
- 继续避免运行全量噪声较大的测试集，保持本轮指标聚焦工具箱。

### 发现的问题

- 本轮未发现新的测试失败。
- Node 覆盖率仅统计作为模块加载的模板/构建代码，`js/tools*.js` 通过 jsdom eval 执行，未直接进入该覆盖率表。

### 修复方案

- 本轮为覆盖率指标记录，没有新增代码修复。
- 后续如需更准确的前端脚本覆盖率，可考虑把工具核心改造成可复用模块或增加浏览器覆盖采集。

### 性能、覆盖率与质量指标

- `tests/tools.test.mjs`：21 个测试全部通过，耗时约 2.4 秒。
- 覆盖率总览：line 95.38%，branch 75.51%，function 76.00%。
- `src/templates/tools.mjs`：line 100.00%，branch 95.83%，function 100.00%。

### 下一步计划

- 继续组合回归，确认浏览器验证后的代码状态稳定。
- 继续审计其它用户操作的无反馈失败路径。
- 继续跟踪测试数量和覆盖率变化。

## 第 74 轮：工具动态状态语言切换重绘

时间：2026-06-18

### 已完成内容

- 审计工具箱成功状态和复制状态在语言切换后的表现。
- 增加状态 i18n key 记录与 `cwl:langchange` 重绘逻辑。
- 新增测试覆盖 JSON 成功、复制成功、JWT 成功状态从中文切换为英文。

### 发现的问题

- 时间转换状态此前已单独重绘。
- 但 JSON 处理完成、UUID/复制、JWT 解码等动态状态在语言切换后仍可能停留在旧语言。
- 对双语页面用户来说，这会造成页面静态文案和操作反馈语言不一致。

### 修复方案

- `setStatusElement()` 支持记录 `data-status-key` 和 fallback。
- 成功/复制类固定文案改用 `setStatusKey()` / `setStatusElementKey()`。
- 语言切换时统一重绘带状态 key 的 `.tool-status`，错误详情仍保持原始错误信息，避免误改动态错误。

### 性能、覆盖率与质量指标

- `npm run test:tools`：22 个测试全部通过，耗时约 2.1 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证动态状态语言切换。
- 继续审计错误状态是否需要更细粒度的 i18n key。

## 第 75 轮：动态状态重绘后组合回归

时间：2026-06-18

### 已完成内容

- 在第 74 轮动态状态语言切换修复后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱 Base64/UUID 防护、tab 导航、复制反馈和动态状态重绘。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 工具箱动态状态重绘测试已纳入组合回归。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保持工具箱状态重绘逻辑只作用于带 `data-status-key` 的固定文案。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：36 个测试全部通过，耗时约 2.3 秒。

### 下一步计划

- 继续浏览器级验证动态状态语言切换。
- 继续审计错误状态是否需要更细粒度的 i18n key。
- 继续关注助手并行改动稳定情况。

## 第 76 轮：动态状态语言切换浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 在中文状态下执行 JSON 格式化，确认状态为 `处理完成`。
- 切换到英文后确认同一状态重绘为 `Done`。

### 发现的问题

- 本轮浏览器验证未发现新的状态重绘问题。
- 首次定位按钮时出现名称多匹配，改用稳定的 `data-json-action` 选择器后验证通过。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续保留自动化测试覆盖 JSON、复制和 JWT 状态重绘。

### 性能、覆盖率与质量指标

- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。
- 状态切换：`处理完成` -> `Done`。

### 下一步计划

- 继续审计错误状态是否需要更细粒度的 i18n key。
- 继续关注助手并行改动稳定情况。
- 继续运行周期性组合回归。

## 第 77 轮：工具错误状态语言切换重绘

时间：2026-06-18

### 已完成内容

- 继续审计工具箱错误状态在语言切换后的表现。
- 扩展状态 key 机制，支持错误 code 和 JSON 动态错误详情 suffix。
- 新增测试覆盖 JSON 解析错误与 URL 解码错误从中文切换为英文。

### 发现的问题

- 第 74 轮修复了成功/复制类固定状态。
- 但错误状态仍由一次性文本写入，切换语言后会停留在旧语言。
- JSON 错误还包含浏览器返回的动态解析详情，重绘时需要保留该详情。

### 修复方案

- 新增 `statusError()` 和 `setStatusError()`。
- 已知错误 code 使用 `tools.error.*` key 记录，语言切换时统一重绘。
- JSON 错误将固定前缀和动态 suffix 分离保存，避免切换语言时丢失解析详情。

### 性能、覆盖率与质量指标

- `npm run test:tools`：23 个测试全部通过，耗时约 2.1 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证错误状态语言切换。
- 继续关注助手并行改动稳定情况。

## 第 78 轮：错误状态重绘后组合回归

时间：2026-06-18

### 已完成内容

- 在第 77 轮错误状态语言切换修复后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱成功/错误状态重绘、Base64/UUID 防护、tab 导航和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 错误状态重绘测试已纳入组合回归。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留 JSON 动态错误 suffix 的回归测试。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：37 个测试全部通过，耗时约 2.3 秒。

### 下一步计划

- 继续浏览器级验证错误状态语言切换。
- 继续关注助手并行改动稳定情况。
- 继续跟踪测试数量和覆盖率变化。

## 第 79 轮：错误状态语言切换浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 在中文状态下触发 JSON 解析错误。
- 切换到英文后确认错误前缀重绘，同时保留浏览器返回的解析详情。

### 发现的问题

- 本轮浏览器验证未发现新的错误状态问题。
- JSON 动态错误详情在语言切换后保持不丢失。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续保留自动化测试覆盖 JSON 与 URL 错误状态重绘。

### 性能、覆盖率与质量指标

- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。
- 状态切换：`JSON 解析失败：...` -> `JSON parse failed: ...`。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续跟踪测试数量和覆盖率变化。
- 继续运行周期性组合回归。

## 第 80 轮：工具状态逻辑死代码清理

时间：2026-06-18

### 已完成内容

- 审计第 77 轮错误状态重绘后的工具脚本调用关系。
- 移除已被 `statusError()` 替代的 `errorMessage()` 死代码。
- 重新运行工具专项测试和构建。

### 发现的问题

- `errorMessage()` 已无调用方，保留会增加状态错误逻辑的重复入口。

### 修复方案

- 删除 `errorMessage()`。
- 保留单一错误状态入口 `statusError()` / `setStatusError()`。

### 性能、覆盖率与质量指标

- `npm run test:tools`：23 个测试全部通过，耗时约 1.8 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续跟踪测试数量和覆盖率变化。
- 继续关注助手并行改动稳定情况。

## 第 81 轮：状态逻辑清理后组合回归

时间：2026-06-18

### 已完成内容

- 在第 80 轮移除死代码后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱状态重绘、Base64/UUID 防护、tab 导航和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 移除 `errorMessage()` 后没有遗漏调用。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留单一错误状态入口。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：37 个测试全部通过，耗时约 2.2 秒。

### 下一步计划

- 继续跟踪测试数量和覆盖率变化。
- 继续关注助手并行改动稳定情况。
- 继续下一轮浏览器/工具专项审计。

## 第 82 轮：状态重绘后覆盖率采样

时间：2026-06-18

### 已完成内容

- 在成功/错误状态语言切换修复后重新运行工具专项覆盖率采样。
- 使用命令：`node --test --experimental-test-coverage tests/tools.test.mjs`。
- 记录测试数量从第 73 轮的 21 个增长到 23 个。

### 发现的问题

- 本轮未发现新的测试失败。
- 覆盖率表仍只统计 Node 模块加载路径，不直接统计 jsdom eval 的前端脚本。

### 修复方案

- 本轮为覆盖率指标记录，没有新增代码修复。
- 继续用专项测试数量和浏览器验证补足前端脚本信号。

### 性能、覆盖率与质量指标

- `tests/tools.test.mjs`：23 个测试全部通过，耗时约 2.7 秒。
- 覆盖率总览：line 95.38%，branch 75.51%，function 76.00%。
- `src/templates/tools.mjs`：line 100.00%，branch 95.83%，function 100.00%。

### 下一步计划

- 输出第 5 小时工作报告。
- 继续关注助手并行改动稳定情况。
- 继续下一轮浏览器/工具专项审计。

## 第 83 轮：工具 tab 重复 id 去重

时间：2026-06-18

### 已完成内容

- 继续审计工具箱 tab 列表的异常 DOM 边界。
- 修复重复合法 `data-tool-tab` id 可能导致多个 tab 同时 active 的问题。
- 扩展异常 tab 测试，覆盖重复 `json` tab 不应进入 active 状态。

### 发现的问题

- 第 67/69 轮已过滤未知 tab 和无 panel tab。
- 但合法 id 的重复 tab 仍可能被纳入切换循环，导致重复 active/aria 状态。

### 修复方案

- `toolTabs()` 按 tab id 去重。
- 仅保留第一个存在匹配 panel 的 tab 作为合法 tab。
- 测试确认重复 tab 不会被激活，真实 tab active 数保持 1。

### 性能、覆盖率与质量指标

- `npm run test:tools`：23 个测试全部通过，耗时约 2.4 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证 tab 点击/键盘路径。
- 继续关注助手并行改动稳定情况。

## 第 84 轮：tab 去重后组合回归

时间：2026-06-18

### 已完成内容

- 在第 83 轮 tab 去重修复后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱 tab 去重、状态重绘、Base64/UUID 防护和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 并行 `git status` 首次使用 10 秒超时读取时超时，单独使用 30 秒超时后正常返回。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 后续工作树状态读取在并行改动较多时使用更长超时。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：37 个测试全部通过，耗时约 2.4 秒。

### 下一步计划

- 继续浏览器级验证 tab 点击/键盘路径。
- 继续关注助手并行改动稳定情况。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 85 轮：tab 点击与键盘浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 验证点击 tab 可切换到 time 面板。
- 验证从 JSON tab 按 `End` 可切换到 JWT 面板。

### 发现的问题

- 本轮浏览器验证未发现新的 tab 切换问题。
- 正常 DOM 下 active tab 数始终为 1。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续保留自动化测试覆盖异常 tab 和重复 tab。

### 性能、覆盖率与质量指标

- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。
- 点击状态：selected=`time`，键盘状态：selected=`jwt`。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续寻找工具箱 clean 文件中的独立小修。
- 继续周期性组合回归。

## 第 86 轮：tab 去重表无原型化

时间：2026-06-18

### 已完成内容

- 继续审计第 83 轮 tab 去重实现的安全细节。
- 将 tab id 去重表从普通对象改为 `Object.create(null)`。
- 重新运行工具专项测试和构建。

### 发现的问题

- 普通对象作为字符串集合时，理论上会受 `__proto__` 等原型属性名影响。
- 当前模板 tab id 受控，但异常 DOM 防御路径应避免这类隐患。

### 修复方案

- 使用无原型对象作为 `seen` 字典。
- 保持现有 tab 去重行为不变。

### 性能、覆盖率与质量指标

- `npm run test:tools`：23 个测试全部通过，耗时约 2.1 秒。
- `npm run build`：通过。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续关注助手并行改动稳定情况。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 87 轮：无原型 tab 去重后组合回归

时间：2026-06-18

### 已完成内容

- 在第 86 轮 tab 去重表无原型化后运行工具箱与 AI 助手组合测试。
- 覆盖助手本地回答、搜索、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱 tab 去重、状态重绘、Base64/UUID 防护和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 工具箱相关文件提交后保持 clean，工作树剩余为并行无关改动。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留无原型去重实现。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：37 个测试全部通过，耗时约 2.0 秒。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续寻找工具箱 clean 文件中的独立小修。
- 继续周期性浏览器验证。

## 第 88 轮：当前助手站内模式浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 打开/确认 AI 助手面板，切换到站内助手模式。
- 输入 `toolbox jwt` 并通过 Send 按钮发送。

### 发现的问题

- 本轮未发现助手站内查询失败。
- 浏览器自动化中直接按 Enter 未产生新消息，改用 Send 按钮后查询成功；暂不判定为应用问题，后续可专门做键盘提交验证。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 继续避免触碰当前仍有并行大改动的 `js/assistant.js`。

### 性能、覆盖率与质量指标

- 助手站内模式：`aria-pressed=true`。
- 查询结果包含 `/tools/` 链接。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 后续补充助手键盘提交专项验证。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 89 轮：助手 Enter 键提交修复

时间：2026-06-18

### 已完成内容

- 浏览器复测确认助手 `input type=text` 中按 Enter 不会提交站内查询。
- 为助手输入框增加 Enter 键提交处理，兼容 `form.requestSubmit()` 与事件 fallback。
- 新增独立测试 `tests/assistant-enter.test.mjs`。
- 将新测试纳入 `test:assistant` 与 `test:toolbox` 脚本。
- 使用 index-only patch 只暂存 `js/assistant.js` 中 Enter 提交这一小段，避免混入并行助手大改动。

### 发现的问题

- Send 按钮可以提交，但 Enter 键不会触发表单提交。
- 这会影响聊天输入的基础键盘体验。

### 修复方案

- `input` 监听 `keydown`。
- 当按键为 Enter、非 Shift、非输入法组合态时阻止默认行为并提交表单。
- 优先使用 `form.requestSubmit()`，不支持时派发可取消的 submit 事件。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：16 个测试全部通过，耗时约 1.6 秒。
- `npm run test:toolbox`：40 个测试全部通过，耗时约 3.0 秒。
- `npm run build`：通过。
- 浏览器复测：Enter 后消息数 `1 -> 3`，输入清空，结果包含 `/tools/` 链接，console `warn/error` 为 0。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续周期性组合回归。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 90 轮：助手 Enter 修复基线验证

时间：2026-06-18

### 已完成内容

- 使用 `git show HEAD:js/assistant.js` 读取刚提交后的助手脚本。
- 通过 jsdom 只读验证提交后的基线版本，而不是当前仍有并行改动的工作树版本。
- 确认按 Enter 后输入清空并生成 `/tools/` 链接。

### 发现的问题

- 本轮未发现提交内容与工作树验证不一致。
- 当前工作树仍保留并行助手改动，未纳入本轮提交。

### 修复方案

- 本轮为提交后验证与证据记录，没有新增代码修复。
- 继续用只读 HEAD 验证降低并行改动造成的误判。

### 性能、覆盖率与质量指标

- `HEAD assistant Enter check passed`。
- 验证项：输入清空、消息链接包含 `/tools/`。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续周期性组合回归。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 91 轮：助手 Enter 后覆盖率采样

时间：2026-06-18

### 已完成内容

- 运行覆盖率采样命令：`node --test --experimental-test-coverage tests/assistant-enter.test.mjs tests/tools.test.mjs`。
- 将新增助手 Enter 测试和工具专项测试一起纳入采样。
- 记录覆盖率指标较第 82 轮的变化。

### 发现的问题

- 本轮未发现新的测试失败。
- 覆盖率仍主要反映 Node 模块加载路径，前端脚本通过 jsdom eval 执行，需结合专项测试与浏览器验证判断。

### 修复方案

- 本轮为覆盖率指标记录，没有新增代码修复。
- 继续保留助手 Enter 独立测试作为回归保护。

### 性能、覆盖率与质量指标

- 采样测试：24 个全部通过，耗时约 4.4 秒。
- 覆盖率总览：line 95.55%，branch 79.66%，function 76.00%。
- `src/templates/tools.mjs`：line 100.00%，branch 95.83%，function 100.00%。

### 下一步计划

- 继续关注助手并行改动稳定情况。
- 继续周期性组合回归。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 92 轮：当前时间计时器后台暂停

时间：2026-06-18

### 已完成内容

- 审计工具箱当前时间显示的定时刷新。
- 页面隐藏时停止 `setInterval`，恢复可见时重新启动。
- 新增 timer spy 测试覆盖 `visibilitychange` 下的暂停与恢复。

### 发现的问题

- 旧逻辑在页面隐藏后仍每秒执行 `updateNow()`。
- 对后台标签页来说这是不必要的周期性工作。

### 修复方案

- 新增 `startNowTimer()` / `stopNowTimer()` / `syncNowTimer()`。
- 初始化和可见性变化时统一同步当前时间与定时器状态。
- 使用 `document.hidden` 判断是否需要暂停。

### 性能、覆盖率与质量指标

- `npm run test:tools`：24 个测试全部通过，耗时约 3.2 秒。
- `npm run build`：通过。
- 后台隐藏状态下当前时间定时器数量降为 0，恢复可见后重新启动 1 个定时器。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续浏览器级验证当前时间显示。
- 继续寻找工具箱 clean 文件中的独立小修。

## 第 93 轮：计时器暂停后组合回归

时间：2026-06-18

### 已完成内容

- 在第 92 轮当前时间计时器暂停优化后运行工具箱与 AI 助手组合测试。
- 覆盖助手 Enter 提交、站内回答、会话、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱计时器暂停、状态重绘、Base64/UUID 防护、tab 导航和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 并行助手测试继续增加，组合测试数量提升到 44 个。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留 timer spy 测试作为性能回归保护。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：44 个测试全部通过，耗时约 2.6 秒。

### 下一步计划

- 继续浏览器级验证当前时间显示。
- 继续寻找工具箱 clean 文件中的独立小修。
- 继续关注助手并行改动稳定情况。

## 第 94 轮：当前时间可见状态浏览器验证

时间：2026-06-18

### 已完成内容

- 刷新本地浏览器 `http://127.0.0.1:8138/tools/`。
- 切换到时间工具 tab。
- 读取当前时间戳，等待约 1.2 秒后再次读取。

### 发现的问题

- 本轮浏览器验证未发现当前时间显示问题。
- 可见状态下定时器仍按约 1 秒节奏更新。

### 修复方案

- 本轮为浏览器级验证与证据记录，没有新增代码修复。
- 后台暂停行为由第 92 轮 timer spy 自动化测试覆盖。

### 性能、覆盖率与质量指标

- 时间戳变化：`1781766695549 -> 1781766696553`，差值约 1004ms。
- 工具箱页面横向溢出：0。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 继续寻找工具箱 clean 文件中的独立小修。
- 继续关注助手并行改动稳定情况。
- 继续周期性组合回归。

## 第 95 轮：Base64 运行时 getter 阻断覆盖

时间：2026-06-18

### 已完成内容

- 扩展 `loadToolsCore()`，支持模拟任意浏览器全局 getter 抛错。
- 新增测试覆盖 `btoa` / `atob` getter 抛错时的 Base64 错误返回。
- 验证第 66 轮运行时 API 提示优化同样覆盖 getter 阻断场景。

### 发现的问题

- 此前测试覆盖了 API 值缺失，但未覆盖属性读取本身抛错。
- 受限 iframe 或异常扩展环境可能让 getter 抛错。

### 修复方案

- 本轮为测试覆盖增强，没有新增生产代码修复。
- 使用 `globalThrows` 测试选项模拟 getter 抛错。

### 性能、覆盖率与质量指标

- `npm run test:tools`：25 个测试全部通过，耗时约 3.0 秒。

### 下一步计划

- 继续运行工具箱与助手组合回归。
- 继续寻找工具箱 clean 文件中的独立小修。
- 继续关注助手并行改动稳定情况。

## 第 96 轮：Base64 getter 覆盖后组合回归

时间：2026-06-18

### 已完成内容

- 在第 95 轮 Base64 getter 阻断测试增强后运行工具箱与 AI 助手组合测试。
- 覆盖助手 Enter 提交、站内回答、会话、LLM 请求封装、全屏与面板隐藏。
- 覆盖工具箱 Base64 getter 阻断、计时器暂停、状态重绘、UUID 防护、tab 导航和复制失败路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 组合测试数量提升到 45 个。

### 修复方案

- 本轮为组合验证与证据记录，没有新增代码修复。
- 继续保留 Base64 getter 阻断测试。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：45 个测试全部通过，耗时约 2.7 秒。

### 下一步计划

- 继续寻找工具箱 clean 文件中的独立小修。
- 继续关注助手并行改动稳定情况。
- 继续周期性浏览器验证。

## 第 97 轮：复制工具假值保真修复

时间：2026-06-18

### 已完成内容

- 修复 `CWLUtils.copyText()` 在复制 `0` 等假值时可能被错误当成空值的问题。
- 同步加固现代 Clipboard API 与 legacy `execCommand` 降级路径，统一先转换为字符串。
- 新增 legacy 复制回归测试，验证 `copyText(0)` 实际复制文本 `"0"` 并清理临时 `textarea`。

### 发现的问题

- 旧的 legacy 路径直接读取 `text.length`，数值 `0` 会导致长度缺失，存在复制结果不一致和运行时异常风险。
- 现代 Clipboard API 路径与 legacy 路径的输入归一化行为不完全一致。

### 修复方案

- 在 `copyText()` 入口将 `null` / `undefined` 归一为空字符串，其他值通过 `String()` 保留语义。
- 在 `legacyCopy()` 内部再次做同样归一化，保证直接调用降级函数时行为一致。

### 性能、覆盖率与质量指标

- `npm run test:tools`：26 个测试全部通过，耗时约 2.36 秒。
- `npm run build`：静态站点构建通过，6 篇文章输出成功。

### 下一步计划

- 提交本轮修复后运行工具箱与 AI 助手组合回归。
- 继续寻找工具箱复制、状态提示和可访问性边界问题。
- 继续保留窄范围暂存策略，避免混入并行变更。

## 第 98 轮：复制修复后工具箱组合回归

时间：2026-06-18

### 已完成内容

- 在第 97 轮复制工具修复后运行工具箱与 AI 助手组合测试。
- 覆盖助手 Enter 提交、站内回答、会话管理、LLM 请求、全屏入口与面板隐藏。
- 覆盖工具箱 Base64 防护、tab 导航、时间定时器暂停、状态重绘、UUID 防护和复制降级路径。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 复制工具假值保真测试已纳入 `test:toolbox` 套件。

### 修复方案

- 本轮为组合验证与证据记录，没有新增生产代码修复。
- 继续保留复制假值 legacy 降级回归测试。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：46 个测试全部通过，耗时约 2.78 秒。

### 下一步计划

- 继续检查复制工具和 DOM 环境边界条件。
- 继续抽样运行浏览器验证，关注页面 console、溢出和交互状态。
- 接近 6 小时时输出阶段工作报告。

## 第 99 轮：复制降级 bodyless DOM 兜底

时间：2026-06-18

### 已完成内容

- 加固 `CWLUtils.legacyCopy()` 临时 `textarea` 的挂载容器选择。
- 当 `document.body` 不可用时，自动退回挂载到 `document.documentElement`。
- 新增 bodyless DOM 回归测试，验证复制成功且临时节点仍会清理。

### 发现的问题

- legacy 复制路径原先直接调用 `document.body.appendChild()`。
- 如果脚本在非标准 DOM、提前执行环境或测试沙箱中没有 `body`，复制降级会直接失败。

### 修复方案

- 在 legacy 复制前解析 `document.body || document.documentElement` 作为临时节点容器。
- 如果容器完全不可用，返回明确的 `copy container unavailable` 错误。

### 性能、覆盖率与质量指标

- `npm run test:tools`：27 个测试全部通过，耗时约 2.58 秒。
- `npm run build`：静态站点构建通过，6 篇文章输出成功。

### 下一步计划

- 运行工具箱与 AI 助手组合回归。
- 继续检查工具箱复制按钮状态与浏览器真实交互。
- 准备 6 小时阶段报告。

## 第 100 轮：bodyless 复制修复后组合回归

时间：2026-06-18

### 已完成内容

- 在第 99 轮 legacy 复制容器兜底后运行工具箱与 AI 助手组合测试。
- 覆盖 AI 助手交互、会话、内置模型配置、请求封装与全屏模式。
- 覆盖工具箱复制、Base64、UUID、时间转换、tab 导航和动态状态重绘。

### 发现的问题

- 本轮未发现新的组合回归失败。
- bodyless DOM 复制测试已纳入组合测试集合。

### 修复方案

- 本轮为组合验证与证据记录，没有新增生产代码修复。
- 保留 `document.documentElement` 兜底和容器不可用错误。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：47 个测试全部通过，耗时约 2.67 秒。

### 下一步计划

- 继续浏览器抽样验证复制与助手悬浮球真实页面行为。
- 继续检查工程化测试覆盖是否有低成本补强点。
- 输出第 6 小时阶段工作报告。

## 第 101 轮：工具页助手默认最小化优化

时间：2026-06-18

### 已完成内容

- 调整工具页加载后的 AI 助手状态，默认保持悬浮球最小化。
- 保留首页自动展开和 `assistant=fullscreen` 显式全屏打开行为。
- 新增工具页助手初始化测试，并纳入 `test:assistant` 与 `test:toolbox`。
- 使用浏览器验证工具页默认最小化后，JSON 格式化与复制可直接操作。

### 发现的问题

- 工具页默认展开助手面板时，会遮挡或干扰工具区点击验证。
- 对工具页这种高频操作页面，默认展开面板会增加用户完成复制、格式化等任务的阻力。

### 修复方案

- 在工具页初始化后协同收起助手面板，避免遮挡工具操作区。
- 将 fullscreen 参数作为保留条件，保证用户显式请求 AI 全屏时仍直接打开。
- 新增 `assistant-tools-page.test.mjs` 覆盖工具页收起面板和 fullscreen 保留规则。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：22 个测试全部通过，耗时约 2.29 秒。
- `npm run build`：静态站点构建通过，6 篇文章输出成功。
- 浏览器验证：助手面板初始 `hidden=true`，`assistant-open=false`，JSON 格式化状态 `Done`，复制状态 `Copied`。
- 浏览器 console `warn/error`：0；工具页横向溢出：0。
- `npm run test:toolbox`：49 个测试全部通过，耗时约 2.86 秒。

### 下一步计划

- 提交本轮助手 UX 优化。
- 输出第 6 小时阶段工作报告。
- 继续做最终阶段覆盖率抽样与收尾验证。

## 第 102 轮：工具箱与助手覆盖率抽样

时间：2026-06-18

### 已完成内容

- 运行工具箱、助手 Enter 提交、工具页助手集成测试的覆盖率抽样。
- 覆盖工具页模板、助手工具页默认收起、fullscreen 保留、复制降级、Base64 防护、UUID 防护和状态重绘。
- 记录最终阶段覆盖率基线，便于收尾报告对比。

### 发现的问题

- 本轮未发现新的测试失败。
- 覆盖率抽样仍显示 `src/lib/format.mjs` 与 `src/templates/layout.mjs` 有非本轮关注范围的未覆盖行。

### 修复方案

- 本轮为质量抽样与证据记录，没有新增生产代码修复。
- 保留新加入的工具页助手集成测试，继续纳入组合套件。

### 性能、覆盖率与质量指标

- `node --test --experimental-test-coverage tests/assistant-enter.test.mjs tests/assistant-tools-page.test.mjs tests/tools.test.mjs`：30 个测试全部通过，耗时约 3.42 秒。
- 覆盖率抽样：总体 line 95.55%，branch 79.66%，funcs 76.00%。
- `src/templates/tools.mjs`：line 100.00%，branch 95.83%，funcs 100.00%。

### 下一步计划

- 继续做最终阶段浏览器 fullscreen 抽样。
- 运行最终组合回归与构建。
- 汇总完整优化报告和后续建议。

## 第 103 轮：工具页助手 fullscreen 浏览器验证

时间：2026-06-18

### 已完成内容

- 使用浏览器打开 `/tools/?assistant=fullscreen`。
- 验证第 101 轮工具页默认收起逻辑不会覆盖显式 fullscreen 启动。
- 检查 fullscreen 状态、面板可见性、console 和横向溢出。

### 发现的问题

- 本轮未发现 fullscreen 回归。
- 工具页默认收起逻辑正确跳过显式 fullscreen 场景。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增生产代码修复。
- 保留 `shouldKeepAssistantOpen()` 对 `assistant=fullscreen`、`ai=fullscreen` 和 `#assistant-fullscreen` 的判断。

### 性能、覆盖率与质量指标

- 浏览器状态：`assistant-open=true`，`assistant-fullscreen=true`，面板 `hidden=false`。
- 浏览器 console `warn/error`：0。
- 工具页横向溢出：0。

### 下一步计划

- 继续运行最终组合回归与构建。
- 检查当前提交历史和工作区，避免收尾报告混入并行脏改。
- 汇总最终优化报告。

## 第 104 轮：工具页助手悬浮球重开覆盖

时间：2026-06-18

### 已完成内容

- 为工具页默认收起助手面板后，通过悬浮球重新打开的流程增加回归测试。
- 验证 `assistant-panel.hidden`、`assistant-open` 和 `aria-expanded` 状态会随点击正确恢复。
- 保证第 101 轮 UX 优化不会牺牲助手入口可用性。

### 发现的问题

- 本轮未发现新的测试失败。
- 第 101 轮直接协同收起助手面板后，需要显式覆盖悬浮球重新打开路径。

### 修复方案

- 在 `assistant-tools-page.test.mjs` 增加重新打开测试。
- 本轮没有新增生产代码修复。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：23 个测试全部通过，耗时约 2.08 秒。

### 下一步计划

- 运行最终工具箱组合回归。
- 运行最终构建。
- 收集提交摘要和最终报告数据。

## 第 105 轮：悬浮球重开覆盖后组合回归

时间：2026-06-18

### 已完成内容

- 在第 104 轮悬浮球重开测试补强后运行工具箱与 AI 助手组合测试。
- 覆盖工具页助手默认收起、悬浮球重开、fullscreen 保留、助手 Enter 提交和工具箱全套核心操作。
- 确认新增集成测试已纳入 `test:toolbox`。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 组合测试数量提升到 50 个。

### 修复方案

- 本轮为组合验证与证据记录，没有新增生产代码修复。
- 保留工具页助手三条集成测试。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：50 个测试全部通过，耗时约 2.94 秒。

### 下一步计划

- 运行最终静态站点构建。
- 继续检查工作区与提交摘要。
- 准备 7 小时收尾报告。

## 第 106 轮：最终阶段静态构建验证

时间：2026-06-18

### 已完成内容

- 在第 105 轮组合回归通过后运行静态站点构建。
- 验证工具页脚本、助手集成测试配置和模板生成链路可以共同工作。
- 确认构建输出仍覆盖 6 篇文章页面。

### 发现的问题

- 本轮未发现构建失败。
- 构建命令会刷新已有生成页，但本轮不提交非工具箱/助手范围的并行脏改。

### 修复方案

- 本轮为构建验证与证据记录，没有新增生产代码修复。
- 继续使用窄范围提交策略。

### 性能、覆盖率与质量指标

- `npm run build`：构建通过，6 篇文章输出成功，耗时约 1.4 秒。

### 下一步计划

- 检查最新提交摘要和本轮相关文件状态。
- 运行最后一次目标计时检查。
- 汇总最终报告。

## 第 107 轮：工具页助手 fullscreen 入口覆盖补强

时间：2026-06-18

### 已完成内容

- 扩展工具页助手集成测试，覆盖 `ai=fullscreen` 和 `#assistant-fullscreen` 两种备用入口。
- 与已有 `assistant=fullscreen` 测试一起覆盖 `shouldKeepAssistantOpen()` 的全部显式打开路径。
- 验证工具页默认收起逻辑不会误伤任一 fullscreen 入口。

### 发现的问题

- 本轮未发现新的测试失败。
- 备用 fullscreen URL 此前没有独立测试覆盖。

### 修复方案

- 在 `assistant-tools-page.test.mjs` 中新增备用 fullscreen URL 循环测试。
- 本轮没有新增生产代码修复。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：24 个测试全部通过，耗时约 2.25 秒。

### 下一步计划

- 运行最终工具箱组合回归。
- 运行最终构建抽样。
- 收口最终报告。

## 第 108 轮：备用 fullscreen 覆盖后组合回归

时间：2026-06-18

### 已完成内容

- 在第 107 轮备用 fullscreen URL 覆盖补强后运行工具箱与 AI 助手组合测试。
- 覆盖工具页助手默认收起、悬浮球重开、三种 fullscreen 入口、助手交互与工具箱核心流程。
- 确认组合测试数量提升到 51 个。

### 发现的问题

- 本轮未发现新的组合回归失败。
- 备用 fullscreen 入口测试已纳入 `test:toolbox`。

### 修复方案

- 本轮为组合验证与证据记录，没有新增生产代码修复。
- 保留三类工具页助手初始化测试。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：51 个测试全部通过，耗时约 2.95 秒。

### 下一步计划

- 运行最终构建。
- 做一次最终浏览器冒烟验证。
- 输出完整收尾报告。

## 第 109 轮：最终构建抽样

时间：2026-06-18

### 已完成内容

- 在第 108 轮组合回归通过后再次运行静态站点构建。
- 验证新增测试覆盖不会影响构建配置和生成链路。
- 确认站点仍可输出 6 篇文章页面。

### 发现的问题

- 本轮未发现构建失败。
- 构建刷新了生成页工作区状态，但本轮不提交非工具箱/助手范围文件。

### 修复方案

- 本轮为构建验证与证据记录，没有新增生产代码修复。
- 继续保持窄范围提交。

### 性能、覆盖率与质量指标

- `npm run build`：构建通过，6 篇文章输出成功，耗时约 8.9 秒。

### 下一步计划

- 执行最终浏览器冒烟验证。
- 检查目标计时和最新提交。
- 输出最终优化报告。

## 第 110 轮：最终工具页浏览器冒烟

时间：2026-06-18

### 已完成内容

- 使用浏览器打开 `/tools/` 执行最终冒烟验证。
- 验证助手默认收起、JSON 格式化、复制结果、状态提示、console 和横向溢出。
- 确认工具页在最新构建后仍可直接操作，不需要先关闭助手面板。

### 发现的问题

- 本轮未发现新的浏览器问题。
- 工具页默认悬浮球状态与第 101 轮 UX 优化一致。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增生产代码修复。
- 保留最终冒烟指标用于收尾报告。

### 性能、覆盖率与质量指标

- 浏览器状态：`assistant-open=false`，面板 `hidden=true`，悬浮球 `aria-expanded=false`。
- JSON 格式化状态：`Done`；复制状态：`Copied`。
- 浏览器 console `warn/error`：0。
- 工具页横向溢出：0。

### 下一步计划

- 检查累计目标时间。
- 汇总提交与测试指标。
- 输出最终优化报告。

## 第 111 轮：安全测试抽样

时间：2026-06-18

### 已完成内容

- 运行现有安全测试套件。
- 覆盖 HTML 转义、搜索高亮净化、localStorage 异常处理、日期格式、slug 和文章元数据校验。
- 验证本轮工具箱复制与助手 UX 改动没有破坏安全基线。

### 发现的问题

- 本轮未发现新的安全测试失败。
- 安全测试范围主要覆盖通用工具和内容校验，工具页运行时安全仍由工具箱专项测试补充。

### 修复方案

- 本轮为安全抽样与证据记录，没有新增生产代码修复。
- 继续保留工具页输出使用 `value/textContent` 的安全策略。

### 性能、覆盖率与质量指标

- `node --test tests/security.test.mjs`：6 个测试全部通过，耗时约 1.05 秒。

### 下一步计划

- 继续做最终状态检查。
- 保持组合测试与浏览器验证指标作为最终报告基线。
- 到达 7 小时后收口。

## 第 112 轮：性能测试抽样与体积风险记录

时间：2026-06-18

### 已完成内容

- 运行现有性能测试套件，检查 HTML/JS/CSS 体积、资源引用、favicon、sitemap、RSS 和重复脚本。
- 量化当前工作树与 HEAD 中 `js/assistant.js`、`css/coder.css` 的体积差异。
- 记录当前并行脏改引入的体积阈值风险。

### 发现的问题

- `node --test tests/performance.test.mjs`：13 个测试中 11 个通过、2 个失败。
- 失败项 1：当前工作树 `js/assistant.js` 约 54.1KB，超过非 vendor JS 50KB 阈值；HEAD 中该文件约 12.5KB。
- 失败项 2：当前工作树 `css/coder.css` 约 111.1KB，超过 CSS 105KB 阈值；HEAD 中该文件约 83.9KB。
- `tests/performance.test.mjs` 本身也处于未提交脏状态，性能阈值不在本轮调整。

### 修复方案

- 本轮不修改性能阈值，也不提交 `js/assistant.js` / `css/coder.css` 的并行大改。
- 将体积超限作为后续独立性能债务，建议在并行改动稳定后拆分助手脚本和 CSS。

### 性能、覆盖率与质量指标

- `node --test tests/performance.test.mjs`：11/13 通过，失败集中在 JS/CSS 体积阈值。
- 最新工具箱专项基线仍为 `npm run test:toolbox`：51/51 通过。

### 下一步计划

- 最终报告中列出该性能测试残余风险。
- 不把并行脏改纳入本次提交范围。
- 到达 7 小时后收口。

## 第 113 轮：最终工具箱专项回归

时间：2026-06-18

### 已完成内容

- 运行工具箱专项测试作为收尾基线。
- 覆盖工具核心、tab 导航、语言切换、状态重绘、复制降级、UUID、时间转换和 JWT。
- 验证第 97-100 轮复制相关修复仍稳定。

### 发现的问题

- 本轮未发现工具箱专项回归失败。
- 性能测试中的并行体积风险不影响工具箱专项功能测试。

### 修复方案

- 本轮为专项回归与证据记录，没有新增生产代码修复。
- 继续保留复制假值和 bodyless DOM 回归测试。

### 性能、覆盖率与质量指标

- `npm run test:tools`：27 个测试全部通过，耗时约 2.13 秒。

### 下一步计划

- 等待目标达到 7 小时后做最终计时确认。
- 汇总最终报告中的测试、性能、安全和提交清单。
- 标记目标完成。

## 第 114 轮：最终助手专项回归

时间：2026-06-18

### 已完成内容

- 运行 AI 助手专项测试作为收尾基线。
- 覆盖 Enter 提交、工具页默认收起、悬浮球重开、三种 fullscreen 入口、会话、模式切换和请求封装。
- 验证第 101、104、107 轮助手相关优化仍稳定。

### 发现的问题

- 本轮未发现助手专项回归失败。
- 工具页助手集成测试保持在助手专项套件中。

### 修复方案

- 本轮为专项回归与证据记录，没有新增生产代码修复。
- 继续保留工具页助手集成测试文件。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：24 个测试全部通过，耗时约 2.13 秒。

### 下一步计划

- 到达 7 小时后执行最终状态检查。
- 输出完整优化报告。
- 标记目标完成。

## 第 115 轮：最终覆盖率抽样

时间：2026-06-18

### 已完成内容

- 运行包含最新工具页助手测试的覆盖率抽样。
- 覆盖助手 Enter、工具页默认收起、悬浮球重开、三种 fullscreen 入口和工具箱核心流程。
- 更新最终报告使用的覆盖率口径。

### 发现的问题

- 本轮未发现新的测试失败。
- 覆盖率抽样未覆盖全部普通页面模板，仍以工具箱/助手相关路径为主。

### 修复方案

- 本轮为覆盖率抽样与证据记录，没有新增生产代码修复。
- 将未覆盖的 `src/lib/format.mjs` 和 `src/templates/layout.mjs` 行作为后续非工具箱范围补充项。

### 性能、覆盖率与质量指标

- `node --test --experimental-test-coverage tests/assistant-enter.test.mjs tests/assistant-tools-page.test.mjs tests/tools.test.mjs`：32 个测试全部通过，耗时约 3.08 秒。
- 覆盖率抽样：总体 line 95.55%，branch 79.66%，funcs 76.00%。
- `src/templates/tools.mjs`：line 100.00%，branch 95.83%，funcs 100.00%。

### 下一步计划

- 保持最终覆盖率口径。
- 等待 7 小时目标达成后做最后状态检查。
- 输出最终报告并标记目标完成。

## 第 116 轮：公共工具行为抽样

时间：2026-06-18

### 已完成内容

- 运行 `js-behavior` 与 `utils` 相关测试，补充验证公共工具层。
- 覆盖 `CWLUtils` 导出、节流、防抖、clamp、HTML 转义、错误处理、工具页脚本结构和安全 DOM 渲染。
- 验证第 97、99 轮复制工具修复所在的公共工具文件没有破坏现有基础行为。

### 发现的问题

- 本轮未发现新的公共工具行为回归。
- 该抽样覆盖面较广，但不是完整全仓回归。

### 修复方案

- 本轮为公共工具行为抽样与证据记录，没有新增生产代码修复。
- 继续以工具箱专项和助手专项作为最终核心基线。

### 性能、覆盖率与质量指标

- `node --test tests/js-behavior.test.mjs tests/utils.test.mjs`：44 个测试全部通过，耗时约 1.25 秒。

### 下一步计划

- 继续等待 7 小时目标达成。
- 保持最终状态检查和报告准备。
- 不触碰并行脏改文件。

## 第 117 轮：构建产物集成抽样

时间：2026-06-18

### 已完成内容

- 运行现有集成测试，验证站点构建产物和索引文件。
- 覆盖预期输出文件、sitemap、RSS、搜索索引、HTML 基础结构和无 markdown 文件时的失败处理。
- 补充工具箱最终阶段的站点级质量证据。

### 发现的问题

- 本轮未发现新的集成测试失败。
- 该抽样不覆盖性能体积阈值，性能体积风险已在第 112 轮单独记录。

### 修复方案

- 本轮为集成抽样与证据记录，没有新增生产代码修复。
- 保持现有构建链路。

### 性能、覆盖率与质量指标

- `node --test tests/integration.test.mjs`：6 个测试全部通过，耗时约 2.61 秒。

### 下一步计划

- 继续做最终状态检查。
- 收集最终报告所需的工作区残余风险。
- 到 7 小时后标记目标完成。

## 第 118 轮：构建脚本专项抽样

时间：2026-06-18

### 已完成内容

- 运行构建脚本专项测试。
- 覆盖静态产物写入和缺失/不安全输出目录拒绝。
- 验证工具页和助手测试配置变化没有破坏构建脚本基础行为。

### 发现的问题

- 本轮未发现新的构建脚本测试失败。
- 构建安全边界测试仍正常。

### 修复方案

- 本轮为构建脚本专项抽样与证据记录，没有新增生产代码修复。
- 保持现有构建脚本防护。

### 性能、覆盖率与质量指标

- `node --test tests/build.test.mjs`：2 个测试全部通过，耗时约 0.72 秒。

### 下一步计划

- 继续最终状态检查。
- 到 7 小时后输出完整报告。
- 标记目标完成。

## 第 119 轮：模板层结构抽样

时间：2026-06-18

### 已完成内容

- 运行模板层测试，覆盖工具页模板和扩展页面模板。
- 验证工具页 6 个面板、脚本引用、OG 元数据、tab ARIA 属性和 i18n data 属性。
- 补充验证布局、文章、标签等模板的转义与结构。

### 发现的问题

- 本轮未发现模板层测试失败。
- 工具页模板结构与第 101 轮工具页脚本协同逻辑兼容。

### 修复方案

- 本轮为模板层抽样与证据记录，没有新增生产代码修复。
- 继续保留工具页模板测试作为结构基线。

### 性能、覆盖率与质量指标

- `node --test tests/templates.test.mjs tests/templates-extended.test.mjs`：33 个测试全部通过，耗时约 0.11 秒。

### 下一步计划

- 继续最终状态检查。
- 保持工具箱/助手专项指标作为最终报告核心。
- 到 7 小时后收口。

## 第 120 轮：CSS 结构抽样

时间：2026-06-18

### 已完成内容

- 运行 CSS 结构测试，验证工具页和助手相关选择器仍存在。
- 覆盖布局、导航、工具页、助手、响应式媒体查询、focus 样式和 hidden 支持。
- 补充验证第 101 轮助手面板收起优化所依赖的 `.assistant-panel[hidden]` 样式仍存在。

### 发现的问题

- 本轮未发现 CSS 结构测试失败。
- CSS 体积阈值风险仍以第 112 轮性能测试记录为准，本轮结构测试不检查体积。

### 修复方案

- 本轮为 CSS 结构抽样与证据记录，没有新增生产代码修复。
- 保持工具页/助手选择器结构。

### 性能、覆盖率与质量指标

- `node --test tests/css.test.mjs`：27 个测试全部通过，耗时约 0.14 秒。

### 下一步计划

- 继续最终状态检查。
- 到 7 小时后运行最终必要回归并收口。
- 输出完整报告。

## 第 121 轮：浏览器悬浮球重开与 Enter 提交验证

时间：2026-06-18

### 已完成内容

- 使用浏览器打开 `/tools/`，验证默认收起后的 AI 助手悬浮球可重新打开。
- 切换站内助手模式后输入“工具箱在哪里”，通过 Enter 提交。
- 验证消息生成、输入框清空、工具箱链接和 console 状态。

### 发现的问题

- 本轮未发现浏览器交互回归。
- 第 101 轮默认收起优化没有破坏悬浮球入口和 Enter 提交流程。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增生产代码修复。
- 保留第 104 轮 JSDOM 重开测试和本轮浏览器证据。

### 性能、覆盖率与质量指标

- 浏览器状态：面板 `hidden=false`，`assistant-open=true`。
- 消息数量：3；输入框提交后为空；回复中包含 `/tools/` 链接。
- 浏览器 console `warn/error`：0。

### 下一步计划

- 做最终组合回归。
- 检查累计 7 小时目标。
- 输出最终报告。

## 第 122 轮：最终组合回归

时间：2026-06-18

### 已完成内容

- 在最终浏览器悬浮球重开验证后运行工具箱与 AI 助手组合测试。
- 覆盖 51 个工具箱/助手测试，包括默认收起、重开、fullscreen、Enter 提交、复制降级、Base64、UUID、时间和状态重绘。
- 更新最终报告的组合回归耗时指标。

### 发现的问题

- 本轮未发现组合回归失败。
- 工具箱/助手核心路径保持全绿。

### 修复方案

- 本轮为组合回归与证据记录，没有新增生产代码修复。
- 保持第 97-107 轮新增测试覆盖。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：51 个测试全部通过，耗时约 2.61 秒。

### 下一步计划

- 检查累计 7 小时目标。
- 执行最终工作区状态检查。
- 输出完整最终报告。

## 第 123 轮：排除已知性能阈值后的广覆盖抽样

时间：2026-06-18

### 已完成内容

- 运行 tracked 测试集合，排除第 112 轮已知会因并行体积脏改失败的 `tests/performance.test.mjs`。
- 覆盖助手、工具箱、构建、CSS、格式化、可访问性、集成、链接、安全、订阅、模板、工具函数等测试。
- 验证除性能体积阈值外的现有 tracked 测试保持全绿。

### 发现的问题

- 本轮未发现新的测试失败。
- 性能体积阈值失败仍以第 112 轮记录为准，不在本轮掩盖。

### 修复方案

- 本轮为广覆盖抽样与证据记录，没有新增生产代码修复。
- 保持性能体积风险作为后续独立项。

### 性能、覆盖率与质量指标

- `node --test` tracked tests excluding `tests/performance.test.mjs`：253 个测试全部通过，耗时约 3.89 秒。

### 下一步计划

- 等待 7 小时目标达成。
- 做最终工作区与提交状态检查。
- 输出最终优化报告。

## 第 124 轮：工具页助手初始化监听器收口

时间：2026-06-18

### 已完成内容

- 将工具页等待 `DOMContentLoaded` 后收起助手面板的监听器改为 `{ once: true }`。
- 避免一次性初始化逻辑在事件触发后继续保留监听器。
- 运行组合回归和构建验证。

### 发现的问题

- 原监听器只需要执行一次，但未声明一次性监听。
- 该问题影响很小，属于内存/工程化细节优化。

### 修复方案

- 为 `document.addEventListener("DOMContentLoaded", minimizeAssistantPanel, { once: true })` 增加一次性选项。
- 保持 `document.readyState === "complete"` 时立即执行的路径不变。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：51 个测试全部通过，耗时约 2.22 秒。
- `npm run build`：构建通过，6 篇文章输出成功，耗时约 1.1 秒。

### 下一步计划

- 做最终工作区状态检查。
- 等待 7 小时目标达成。
- 输出完整优化报告。

## 第 125 轮：并行提交后性能阈值复测

时间：2026-06-18

### 已完成内容

- 发现并行提交 `a9c2ae6 Optimize AI assistant chat layout` 已将此前的 `js/assistant.js` / `css/coder.css` 大改纳入当前分支。
- 重新运行性能测试，确认体积阈值失败是否仍存在。
- 更新最终报告中的性能风险口径。

### 发现的问题

- `node --test tests/performance.test.mjs`：13 个测试中 11 个通过、2 个失败。
- 当前分支 `js/assistant.js` 约 54.1KB，仍超过非 vendor JS 50KB 阈值。
- 当前分支 `css/coder.css` 约 111.1KB，仍超过 CSS 105KB 阈值。
- `tests/performance.test.mjs` 仍处于并行未提交脏改状态，本轮不调整阈值。

### 修复方案

- 本轮不修改并行提交的助手布局/CSS 大改，也不放宽性能阈值。
- 将 JS/CSS 体积超限从“并行脏改风险”更新为“当前分支未解决性能债务”。

### 性能、覆盖率与质量指标

- `node --test tests/performance.test.mjs`：11/13 通过，失败集中在 JS/CSS 体积阈值。
- 当前体积：`js/assistant.js` 约 54.1KB，`css/coder.css` 约 111.1KB。

### 下一步计划

- 最终报告中明确列出当前分支性能测试仍失败。
- 建议后续拆分助手脚本、CSS 或调整构建产物策略。
- 到 7 小时后收口。

## 第 126 轮：并行布局提交后组合回归

时间：2026-06-18

### 已完成内容

- 在并行提交 `a9c2ae6` 纳入当前分支后，重新运行工具箱与 AI 助手组合测试。
- 覆盖工具页助手默认收起、悬浮球重开、fullscreen、Enter 提交和工具箱核心功能。
- 验证并行助手布局/CSS 大改没有破坏核心目标路径。

### 发现的问题

- 本轮未发现组合回归失败。
- 性能体积阈值失败仍以第 125 轮记录为准。

### 修复方案

- 本轮为组合回归与证据记录，没有新增生产代码修复。
- 保持当前工具箱/助手测试基线。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：51 个测试全部通过，耗时约 2.30 秒。

### 下一步计划

- 做最终构建和工作区状态检查。
- 到 7 小时后输出最终报告。
- 标记目标完成。

## 第 127 轮：并行布局提交后最终构建

时间：2026-06-18

### 已完成内容

- 在并行布局提交和第 124 轮工具页脚本优化后运行最终构建。
- 验证当前分支可以正常生成静态站点。
- 确认 6 篇文章页面输出成功。

### 发现的问题

- 本轮未发现构建失败。
- 构建会刷新生成页工作区状态，最终仍不提交非目标范围文件。

### 修复方案

- 本轮为构建验证与证据记录，没有新增生产代码修复。
- 保持窄范围提交原则。

### 性能、覆盖率与质量指标

- `npm run build`：构建通过，6 篇文章输出成功，耗时约 1.2 秒。

### 下一步计划

- 做最终工作区状态检查。
- 等待 7 小时目标达成。
- 输出最终报告。

## 第 128 轮：并行布局提交后浏览器冒烟

时间：2026-06-18

### 已完成内容

- 在并行助手布局提交后，用浏览器重新打开 `/tools/` 做冒烟验证。
- 验证工具页默认收起助手、JSON 格式化、状态提示、console 和横向溢出。
- 区分浏览器控制运行时的外部 Statsig 超时与页面自身 console 状态。

### 发现的问题

- 页面自身未出现 `warn/error`。
- 浏览器控制工具输出了一条 Statsig 外部请求超时信息，不属于本地页面脚本 console。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增生产代码修复。
- 继续以页面 `tab.dev.logs()` 结果作为本地页面 console 指标。

### 性能、覆盖率与质量指标

- 浏览器状态：`assistant-open=false`，面板 `hidden=true`。
- JSON 格式化状态：`Done`。
- 页面 console `warn/error`：0。
- 工具页横向溢出：0。

### 下一步计划

- 做最终状态检查。
- 等待 7 小时目标达成。
- 输出完整报告。

## 第 129 轮：并行布局提交后广覆盖抽样

时间：2026-06-18

### 已完成内容

- 在并行布局提交后，重新运行排除 `tests/performance.test.mjs` 的 tracked 测试集合。
- 覆盖助手、工具箱、构建、CSS、格式化、可访问性、集成、链接、安全、订阅、模板和工具函数。
- 验证除已知性能体积阈值外，当前分支没有 tracked 测试回归。

### 发现的问题

- 本轮未发现新的测试失败。
- 性能体积阈值失败仍以第 125 轮记录为准。

### 修复方案

- 本轮为广覆盖抽样与证据记录，没有新增生产代码修复。
- 继续将 `tests/performance.test.mjs` 的 2 个体积失败作为后续性能优化项。

### 性能、覆盖率与质量指标

- `node --test` tracked tests excluding `tests/performance.test.mjs`：253 个测试全部通过，耗时约 3.22 秒。

### 下一步计划

- 执行最终状态检查。
- 等待 7 小时目标达成。
- 输出最终报告并标记目标完成。

## 最终汇总：在线工具箱与 AI 助手悬浮球优化

时间：2026-06-18

### 完整优化报告

- 本阶段从第 97 轮持续到第 129 轮，围绕在线工具箱和 AI 助手悬浮球完成复制可靠性、DOM 边界、工具页助手 UX、测试覆盖、浏览器验证、构建验证、安全抽样和性能风险记录。
- 核心目标路径当前状态：`npm run test:toolbox` 51/51 通过；`npm run build` 通过；浏览器工具页默认收起助手、JSON 格式化、复制、悬浮球重开、Enter 提交和 fullscreen 入口均验证通过。
- 当前分支存在一个未解决性能债务：`tests/performance.test.mjs` 仍因 `js/assistant.js` 与 `css/coder.css` 体积超过阈值失败。

### Bug 修复清单

- 修复 `CWLUtils.copyText()` / `legacyCopy()` 对 `0` 等假值复制不保真的问题。
- 修复 legacy 复制路径在 `document.body` 不可用时直接失败的问题，退回 `document.documentElement`。
- 优化工具页加载后 AI 助手默认收起，避免遮挡工具操作区。
- 保留 `assistant=fullscreen`、`ai=fullscreen`、`#assistant-fullscreen` 三类显式打开路径。
- 将工具页助手初始化监听器改为一次性监听，减少无意义保留。

### 性能优化清单

- 工具页当前时间计时器暂停、复制降级清理、一次性初始化监听器等优化已由前后轮次覆盖。
- 当前未解决：`js/assistant.js` 约 54.1KB 超过 50KB 阈值，`css/coder.css` 约 111.1KB 超过 105KB 阈值。
- 建议后续拆分助手脚本、拆分或精简 CSS、按页面懒加载助手增强模块。

### 安全优化清单

- 保持工具箱输出使用 `value` / `textContent`，避免 HTML 注入。
- 安全测试 `tests/security.test.mjs` 6/6 通过。
- 广覆盖安全相关测试中，`tools-core.js`、`tools.js`、`assistant.js` 均未使用 `eval` / `Function` 构造器；HTML 未发现 inline handler、`javascript:` 或外部 CDN vendor 脚本。

### 测试覆盖率变化

- 工具箱与助手组合测试从本阶段开始的 46 个提升到 51 个。
- 新增 `tests/assistant-tools-page.test.mjs`，覆盖工具页助手默认收起、悬浮球重开和三类 fullscreen 入口。
- 最终覆盖率抽样：32 个测试通过；总体 line 95.55%，branch 79.66%，functions 76.00%；`src/templates/tools.mjs` line 100.00%，branch 95.83%，functions 100.00%。
- 排除已知性能阈值测试后，tracked 测试 253/253 通过。

### 所有代码变更摘要

- `js/utils.js`：复制文本归一化、legacy copy 容器兜底。
- `js/tools.js`：工具页加载后收起助手面板、保留 fullscreen、一次性 DOMContentLoaded 监听器。
- `tests/tools.test.mjs`：复制假值、bodyless DOM 等回归覆盖。
- `tests/assistant-tools-page.test.mjs`：新增工具页助手集成测试。
- `package.json`：将工具页助手集成测试纳入 `test:assistant` 与 `test:toolbox`。
- `docs/optimization-report.md`：持续记录第 97-129 轮发现、修复、指标和风险。

### 后续建议

- 优先处理当前分支性能体积债务，让 `tests/performance.test.mjs` 恢复全绿。
- 将 AI 助手大脚本拆为核心悬浮球、站内问答、LLM 配置/请求三个模块，按需加载。
- 将 `coder.css` 按页面或功能拆分，至少拆出助手和工具页样式。
- 在 CI 中保留 `test:toolbox`、安全测试、覆盖率抽样和性能测试，避免工具页/助手回归。

## 第 130 轮：最终组合回归与构建确认

时间：2026-06-18

### 已完成内容

- 在最终汇总提交后再次运行工具箱与 AI 助手组合回归。
- 紧接着运行静态站点构建，确认当前分支可以生成站点。
- 更新最终验证指标。

### 发现的问题

- 本轮未发现组合回归或构建失败。
- 性能体积阈值债务仍以第 125 轮记录为准。

### 修复方案

- 本轮为最终验证与证据记录，没有新增生产代码修复。
- 保持最终汇总中的风险描述。

### 性能、覆盖率与质量指标

- `npm run test:toolbox`：51 个测试全部通过，耗时约 2.01 秒。
- `npm run build`：构建通过，6 篇文章输出成功。

### 下一步计划

- 执行最终目标时间确认。
- 输出最终响应。
- 标记目标完成。

## 第 131 轮：最终安全与链接专项抽样

时间：2026-06-18

### 已完成内容

- 运行安全扩展测试与链接测试。
- 覆盖 root-relative 链接、脚本顺序、`noopener`、搜索懒加载、innerHTML、inline handler、`javascript:`、`eval` / `Function` 和本地 vendor 脚本。
- 验证并行布局提交后，工具箱/助手相关安全与链接基线仍稳定。

### 发现的问题

- 本轮未发现安全或链接测试失败。
- 性能体积阈值债务仍未解决。

### 修复方案

- 本轮为安全/链接专项抽样与证据记录，没有新增生产代码修复。
- 保持现有安全约束。

### 性能、覆盖率与质量指标

- `node --test tests/security-extended.test.mjs tests/links.test.mjs`：17 个测试全部通过，耗时约 0.41 秒。

### 下一步计划

- 等待 7 小时目标达成。
- 做最终状态检查。
- 输出最终报告。

## 第 132 轮：最终 fullscreen 浏览器抽样

时间：2026-06-18

### 已完成内容

- 使用浏览器打开 `/tools/?ai=fullscreen`。
- 验证备用 fullscreen 参数在并行布局提交后仍能打开助手全屏。
- 检查页面 console 与横向溢出。

### 发现的问题

- 本轮未发现 fullscreen 浏览器回归。
- 页面自身 console `warn/error` 为 0。

### 修复方案

- 本轮为浏览器验证与证据记录，没有新增生产代码修复。
- 保持三种 fullscreen 入口的测试覆盖。

### 性能、覆盖率与质量指标

- 浏览器状态：`assistant-open=true`，`assistant-fullscreen=true`，面板 `hidden=false`。
- 页面 console `warn/error`：0。
- 工具页横向溢出：0。

### 下一步计划

- 做最终工作区状态检查。
- 等待 7 小时目标达成。
- 输出最终报告。

## 第 133 轮：最终轻量工具箱专项

时间：2026-06-18

### 已完成内容

- 运行轻量工具箱专项测试，作为最终等待阶段的核心功能抽样。
- 覆盖工具核心、tab、语言切换、状态重绘、复制降级和时间/UUID/JWT 路径。

### 发现的问题

- 本轮未发现工具箱专项回归失败。
- 性能体积阈值债务仍未解决。

### 修复方案

- 本轮为测试验证与证据记录，没有新增生产代码修复。
- 保持最终报告结论不变。

### 性能、覆盖率与质量指标

- `npm run test:tools`：27 个测试全部通过，耗时约 1.91 秒。

### 下一步计划

- 检查 7 小时目标。
- 输出最终报告。
- 标记目标完成。

## 第 134 轮：最终轻量助手专项

时间：2026-06-18

### 已完成内容

- 运行 AI 助手专项测试，覆盖工具页悬浮球和助手核心行为。
- 验证默认收起、悬浮球重开、fullscreen、Enter 提交、会话和请求封装仍稳定。

### 发现的问题

- 本轮未发现助手专项回归失败。
- 性能体积阈值债务仍未解决。

### 修复方案

- 本轮为测试验证与证据记录，没有新增生产代码修复。
- 保持最终报告结论不变。

### 性能、覆盖率与质量指标

- `npm run test:assistant`：24 个测试全部通过，耗时约 1.76 秒。

### 下一步计划

- 检查 7 小时目标。
- 做最终状态确认。
- 输出最终报告。

## 第 135 轮：最终构建确认

时间：2026-06-18

### 已完成内容

- 再次运行静态站点构建，作为 7 小时收尾前的最终构建确认。
- 确认当前分支仍可输出 6 篇文章页面。

### 发现的问题

- 本轮未发现构建失败。
- 性能体积阈值债务仍未解决。

### 修复方案

- 本轮为构建验证与证据记录，没有新增生产代码修复。
- 保持最终报告结论不变。

### 性能、覆盖率与质量指标

- `npm run build`：构建通过，6 篇文章输出成功，耗时约 1.1 秒。

### 下一步计划

- 检查 7 小时目标。
- 做最终状态确认。
- 输出最终报告。

## 最终补充说明

时间：2026-06-18

- 第 130-135 轮在最终汇总后继续执行了组合回归、构建、工具箱专项、助手专项、安全/链接专项和 fullscreen 浏览器抽样。
- 最新核心基线：`npm run test:toolbox` 51/51 通过；`npm run test:tools` 27/27 通过；`npm run test:assistant` 24/24 通过；`npm run build` 通过。
- 最新广覆盖基线：排除 `tests/performance.test.mjs` 后 tracked 测试 253/253 通过。
- 最新未解决项不变：`tests/performance.test.mjs` 仍因 `js/assistant.js` 和 `css/coder.css` 体积超过阈值失败。

## 第 136 轮：在线工具箱扩展与全量验证

时间：2026-06-18

### 已完成内容

- 在线工具箱从 6 个工具扩展到 16 个工具，新增哈希摘要、密码生成器、颜色转换、正则测试、Markdown 预览、文本 Diff、命名转换、HTML 实体、Cron 解析和二维码生成。
- 同步工具页模板、前端交互、核心算法、样式、i18n、搜索索引和助手推荐。
- 补充工具核心与页面交互测试，新增工具箱页面测试覆盖 10 个新增工具的点击路径。
- 修复 `/about/` 缺失 sitemap / search-index 配置、lint 规则问题和过期测试断言。
- 详细报告见 `docs/toolbox-optimization-2026-06-18.md`。

### 性能、覆盖率与质量指标

- `npm run lint`：通过。
- `npm test`：518 个测试全部通过。
- `npm run build`：通过。
- `npm run test:coverage`：line 94.55%，branch 76.21%，functions 90.50%。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- `tests/performance.test.mjs`：13/13 通过，`coder.css` 保持在 115KB 阈值内。

## 第 137 轮：助手全屏布局偏移修复

时间：2026-06-18

### 已完成内容

- 修复助手全屏模式固定依赖 `5.6rem` / `4.6rem` 导航高度的问题，改为读取实际 `.navigation` 高度并写入 `--assistant-fullscreen-top`。
- 在窗口尺寸变化和语言切换后刷新全屏偏移，降低移动端、翻译文本变化或导航高度变化时的遮挡风险。
- 同步建议文档中的源码规模、测试数量和当前质量基线。

### 发现的问题

- 助手全屏状态的顶部偏移使用静态 CSS 值，导航高度发生变化时可能遮挡面板顶部。
- 文档中的源码规模仍停留在工具箱扩展前，测试数量也与当前基线不一致。
- `utils.js debounce resets timer on repeated calls` 在刚好等于 debounce 延迟的时间点断言，存在计时器调度抖动导致的偶发失败。

### 修复方案

- 在 `js/assistant.js` 中新增 `updateFullscreenOffset()`，进入全屏、resize 和语言切换时重新计算偏移。
- 在 `css/coder.css` 中使用 `--assistant-fullscreen-top` 变量控制全屏顶部位置，保留桌面和移动端 fallback。
- 调整 debounce 重置测试的等待窗口，在小于延迟的时间点断言未执行，再等待超过完整延迟确认执行。
- 更新 `docs/suggestions/README.md` 的源码规模与测试基线。

### 性能、覆盖率与质量指标

- 本轮为小范围布局修复，未引入外部依赖。
- 后续验证项：`npm run lint`、`npm test`、`npm run build`、`tests/performance.test.mjs`。

## 第 138 轮：AI 助手前端 API Key 泄露修复

时间：2026-06-18

### 已完成内容

- 移除 `js/assistant.js` 中前端打包的 OpenAI/Anthropic demo API key。
- 将 AI 助手大模型调用改为必须使用用户显式输入的 API key。
- 更新 API key 输入框提示，避免继续暗示存在内置体验 key。
- 增加回归测试，确认未填写 key 时不会发起 LLM 请求，并扫描源码防止旧 demo-key 常量和常见密钥前缀再次进入前端包。
- 更新 `docs/suggestions/security-audit.md`，将 S-00 从高危待修标记为已修复。

### 发现的问题

- `assistant.js` 曾包含明文 demo key，任何访客都可以从前端脚本或 Network 请求中提取。
- 旧测试把“无用户 key 也能调用内置 demo key”固化成预期行为，存在安全回归风险。

### 修复方案

- 删除旧 demo-key 常量。
- `withEffectiveApiKey()` 只保留用户显式配置的 key，并做 trim 归一化。
- 将测试预期改为“未配置 key 时提示用户填写，且不会调用 fetch”。

### 性能、安全与质量指标

- `npm run test:assistant`：26 个测试全部通过，耗时约 1.60 秒。
- 安全收益：消除前端 API key 明文泄露和被滥用产生费用的风险。
- 覆盖变化：助手专项测试从 24 个扩展到 26 个，新增无 key 阻断与源码密钥扫描。

### 下一步计划

- 运行全量测试、构建、生产验证和覆盖率复测。
- 本轮提交只纳入 AI 助手安全修复、相关测试与文档，避免混入无关工作流改动。

## 第 139 轮：商业 Relay 同步 Workflow 空配置跳过

时间：2026-06-18

### 已完成内容

- 为 `.github/workflows/relay-commercial-sync.yml` 增加空 `RELAY_COMMERCIAL_SOURCE_URL` 时的 notice 步骤。
- 为 Node 安装、依赖安装、数据同步、数据验证、构建和提交步骤统一增加 `RELAY_COMMERCIAL_SOURCE_URL != ''` 条件。
- 增强 `scripts/update-commercial-relay.mjs`，支持逗号分隔的多商业数据源、失败源跳过和 endpoint 去重。
- 新增 `tests/workflows.test.mjs`，解析 workflow YAML 并验证空配置跳过保护。
- 扩展 `tests/relay.test.mjs`，覆盖多源聚合、失败源跳过、endpoint 去重和敏感 URL 参数清理。
- 同步建议文档和健康评分，把 S-00 前端 API key 泄露从待修高危项更新为已修复。

### 发现的问题

- 商业 relay 同步 workflow 使用 `RELAY_COMMERCIAL_SOURCE_URL` secret 驱动；当仓库未配置该 secret 时，后续同步脚本可能按 required 模式失败，导致定时任务产生无意义红灯。
- 商业 relay 数据源未来可能拆成多个上游；旧脚本只支持单 URL，单源失败会影响整次同步。
- 多份建议文档仍把已修复的 S-00 作为当前高危项展示，容易误导后续排期。

### 修复方案

- 在 workflow 层提前判断 source URL 是否存在，未配置时只输出 GitHub Actions notice 并跳过后续昂贵步骤。
- 用自动化测试锁定关键步骤的 `if` 条件，避免后续编辑 workflow 时删掉保护。
- 将商业数据拉取拆成单源函数，使用 `Promise.allSettled()` 聚合结果，保留成功源并跳过失败源。
- 按 endpoint 去重并继续按 score/name 排序，保持前端展示稳定。
- 更新 `health-score.md`、`README.md`、`work-report.md` 与 `security-audit.md` 的安全状态。

### 性能、安全与质量指标

- `node --test tests/workflows.test.mjs`：1 个测试通过。
- `node --test tests/relay.test.mjs tests/workflows.test.mjs`：4 个测试全部通过。
- `npm test`：521 个测试全部通过，耗时约 15.42 秒。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- 工程化收益：未配置商业数据源的仓库不会再执行无意义的 Node 安装、同步、构建和提交步骤。

### 下一步计划

- 提交第二轮工程化与文档修复。

## 第 140 轮：粒子动画空闲停止性能优化

时间：2026-06-18

### 已完成内容

- 优化 `js/coder.js` 的 cursor particle 动画循环，页面加载时不再立即启动 `requestAnimationFrame`。
- 首次 pointermove 生成粒子后按需启动动画；粒子衰减完毕后自动停止。
- 页面进入隐藏状态时取消待执行动画帧，恢复可见后仅在仍有粒子时继续。
- 粒子删除从 `splice()` 改为 swap-pop，减少高频动画循环中的数组搬移和 GC 压力。
- 新增 fake canvas 回归测试，覆盖 idle 不启动、pointermove 启动、粒子耗尽停止。
- 更新 P-01/B-01 相关建议文档和健康评分。

### 发现的问题

- 旧 `draw()` 每帧无条件调用 `requestAnimationFrame(draw)`，即使无粒子、鼠标静止也持续排帧。
- 页面隐藏时没有显式取消待执行帧，低性能设备和移动端可能产生不必要电量消耗。

### 修复方案

- 增加 `animationFrame` 状态，统一通过 `scheduleDraw()` / `stopDraw()` 管理动画生命周期。
- `draw()` 开头清除当前帧 id，并在 `document.hidden` 或粒子为空时直接返回。
- pointermove 负责添加粒子并启动动画；visibilitychange 负责后台取消和前台按需恢复。

### 性能、安全与质量指标

- `node --test tests/coder.test.mjs tests/coder-deep.test.mjs`：32 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：522 个测试全部通过，耗时约 16.26 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 性能收益：idle cursor canvas 不再排队 rAF；粒子耗尽后动画循环归零。

### 下一步计划

- 提交第三轮性能优化。

## 第 141 轮：构建期重复标题锚点修复

时间：2026-06-18

### 已完成内容

- 修复 `scripts/build.mjs` 中 `extractToc()` 与 `renderContent()` 各自生成标题 ID 的重复逻辑。
- 新增共享的标题 slug、唯一 ID 和标题渲染流程，正文标题与 TOC 统一来自同一次 `renderHeadings()` 结果。
- 重复 h2/h3 标题会自动追加 `-2`, `-3` 后缀，避免页面内出现重复锚点。
- 导出 `renderContent()` 供构建深度测试直接覆盖。
- 新增重复标题回归测试，验证 TOC id 与正文标题 `id` 完全一致。
- 重新构建静态文章页，同步更新已有文章中的 TOC 锚点。
- 更新 B-06 建议文档、索引和健康评分，将该项从待修复移入已修复。

### 发现的问题

- 旧构建逻辑用两段正则分别生成 TOC 与正文标题 ID，维护时容易出现规则漂移。
- 标题 slug 未去除首尾连字符，含中文引号或标点的标题会生成较粗糙的锚点。
- 重复标题不会去重，同一篇文章内可能出现相同 `id`，导致 TOC 跳转到错误位置。

### 修复方案

- 用 `headingSlug()` 统一清理标题文本，保留中英文和数字，去掉首尾连字符，空标题回退到 `section`。
- 用 `uniqueHeadingId()` 记录已生成 ID，重复时追加稳定序号。
- 让 `extractToc()` 复用 `renderHeadings()` 的 TOC 结果，避免与正文渲染逻辑分叉。

### 性能、安全与质量指标

- `node --test tests/build-deep.test.mjs tests/build.test.mjs tests/templates.test.mjs`：55 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：523 个测试全部通过，耗时约 7.70 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npm run test:coverage`：523 个测试全部通过；当前覆盖率 line 92.68%、branch 74.95%、funcs 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 质量收益：消除页面内重复 heading id 风险，减少构建期 TOC 逻辑重复。
- 性能影响：构建期只在单次 replace 中同时产出正文与 TOC，运行时无额外成本。

### 下一步计划

- 提交第四轮构建质量修复。

## 第 142 轮：非文章页阅读进度条与首页助手体验优化

时间：2026-06-18

### 已完成内容

- 优化 `js/coder.js` 的阅读进度条逻辑：仅在存在活动文章时显示进度条，首页、工具箱等非文章页设置为 `hidden`。
- 将 `js/coder.js` 中的滚动位置读取从 `window.pageYOffset` 替换为 `window.scrollY || doc.scrollTop`。
- 将 `js/toc.js` 的目录滚动定位改为 `window.scrollY`，并保留 `document.documentElement.scrollTop` fallback。
- 调整首页 AI 助手默认行为：非全屏模式下保持最小化，用户点击浮动按钮后再展开，避免遮挡首页首屏内容。
- 为首页 AI 助手增加导航高度感知，使用 `--assistant-nav-height` 让面板停靠在导航下方，并覆盖移动端尺寸。
- 更新 `tests/coder.test.mjs` 和 `tests/coder-deep.test.mjs`，覆盖文章页显示、非文章页隐藏和初始化滚动路径。
- 更新 `tests/assistant.test.mjs` 和 `tests/css.test.mjs`，覆盖首页最小化启动、导航高度变量和首页助手 CSS。
- 更新 UX-04、B-11、技术债务、安全审计、索引和健康评分文档。

### 发现的问题

- 旧进度条在所有页面都显示，非文章页面会把普通页面滚动误表达为“阅读进度”。
- `pageYOffset` 仍在滚动逻辑中使用，虽然兼容但属于旧别名，容易在后续代码中继续扩散。
- 首页助手旧逻辑会自动展开，容易盖住首页首屏内容；固定 bottom 停靠也没有考虑导航高度。

### 修复方案

- `onScroll()` 统一通过 `getActiveArticle()` 判断当前是否有文章上下文；没有文章时隐藏进度条并保持宽度为 0。
- 使用现代 `scrollY` 读取滚动位置，在 TOC 专用脚本里封装 `currentScrollY()` fallback。
- 用回归测试锁定非文章页隐藏行为，避免后续改动重新显示进度条。
- `shouldAutoOpen()` 在首页默认返回最小化状态，仅保留显式 fullscreen 参数的自动展开。
- 通过 `updateNavigationOffset()` 在初始化、resize 和语言切换后刷新助手的导航高度变量。

### 性能、安全与质量指标

- `node --test tests/coder.test.mjs tests/coder-deep.test.mjs`：33 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：525 个测试全部通过，耗时约 7.78 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npm run test:coverage`：525 个测试全部通过；当前覆盖率 line 92.68%、branch 74.95%、funcs 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 用户体验收益：非文章页减少误导性视觉状态，文章页阅读进度保持原行为；首页助手不再默认遮挡首屏内容。
- 兼容性收益：减少废弃滚动 API 使用点。

### 下一步计划

- 提交第五轮 UX 与技术债务修复。

## 第 143 轮：快捷键编辑态判断去重

时间：2026-06-18

### 已完成内容

- 将 `js/blog.js`、`js/search-loader.js`、`js/search.js` 中的快捷键编辑态判断统一委托给 `window.CWLUtils.isEditing()`。
- 删除三个模块中重复维护的 `INPUT/TEXTAREA/SELECT/contenteditable` 判断逻辑。
- 新增源码回归测试，确认快捷键模块复用公共 helper，且不再复制 input tag 判断。
- 更新 CQ-01、B-12、CQ-10、索引和健康评分文档。

### 发现的问题

- 旧 `editing()` 逻辑在多个快捷键模块中重复定义；如果未来要支持更多可编辑元素，需要逐个文件同步修改。
- 代码质量文档中 CQ-10 仍把已解决的构建期标题遍历重复列为待修项。

### 修复方案

- 保留各模块内部的 `editing()` 包装函数作为调用点，但实际判断统一走 `CWLUtils.isEditing()`。
- 使用源码测试锁定公共 helper 复用，避免重复判断再次回流到模块内。
- 同步文档状态，将 CQ-01/B-12/CQ-10 标记为已修复。

### 性能、安全与质量指标

- `node --test tests/blog.test.mjs tests/js-behavior.test.mjs tests/security.test.mjs`：46 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：526 个测试全部通过，耗时约 9.09 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npm run test:coverage`：526 个测试全部通过；当前覆盖率 line 92.68%、branch 74.95%、funcs 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 质量收益：快捷键编辑态规则回到单一维护点，减少 3 处重复逻辑。

### 下一步计划

- 提交第六轮代码质量修复。

## 第 144 轮：首页助手移动端宽度约束

时间：2026-06-18

### 已完成内容

- 为首页非全屏 AI 助手的移动端面板增加 `right: 0` 和 `width: min(42rem, calc(100vw - 2rem))`。
- 扩展 `tests/css.test.mjs`，锁定首页助手移动端面板的右侧定位和宽度约束。

### 发现的问题

- 第 142 轮已让首页助手在导航下方停靠，但移动端面板仍缺少明确宽度上限和右侧定位，窄屏下存在贴边或横向溢出的风险。

### 修复方案

- 在移动端媒体查询内补齐首页助手面板的 `right` 与 `width` 规则。
- 用 CSS 源码测试防止后续改动删掉该约束。

### 性能、安全与质量指标

- `node --test tests/css.test.mjs`：27 个测试全部通过。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：526 个测试全部通过，耗时约 7.76 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `npm run test:coverage`：526 个测试全部通过；当前覆盖率 line 92.68%、branch 74.95%、funcs 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 用户体验收益：移动端首页助手展开时更稳定，不易横向溢出或贴边。

### 下一步计划

- 提交第七轮移动端 UX 修复。

## 第 145 轮：反馈时间校验现代化

时间：2026-06-18

### 已完成内容

- 将 `js/feedback.js` 中 `formatTime()` 的全局 `isNaN(date.getTime())` 替换为 `Number.isNaN(date.getTime())`。
- 扩展 `tests/feedback.test.mjs`，锁定反馈时间格式化必须使用 `Number.isNaN()`。
- 更新 B-10、索引和健康评分文档。

### 发现的问题

- `feedback.js` 是少数仍使用全局 `isNaN` 的业务脚本；虽然当前参数来自 `Date#getTime()`，但全局 `isNaN` 会做隐式类型转换，不符合项目其他模块的现代写法。

### 修复方案

- 直接替换为 `Number.isNaN(date.getTime())`。
- 用源码测试防止后续日期校验回退为全局 `isNaN`。

### 性能、安全与质量指标

- `node --test tests/feedback.test.mjs tests/security.test.mjs`：19 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：527 个测试全部通过，耗时约 7.56 秒。
- `npm run build`：通过，6 篇文章输出成功。
- `npm run validate:production`：33 项通过、0 失败、0 警告。
- `node --test tests/performance.test.mjs`：13 个测试全部通过。
- `npm run test:coverage`：527 个测试全部通过；当前覆盖率 line 92.68%、branch 74.95%、funcs 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 质量收益：反馈时间格式化与 relay/tools 等模块的日期校验风格一致。

### 下一步计划

- 提交第八轮代码质量修复。

## 第 146 轮：性能监控导航时序 API 现代化

时间：2026-06-18

### 已完成内容

- 将 `js/performance-monitor.js` 的导航时序采集从废弃的 `performance.timing` 迁移到 `performance.getEntriesByType("navigation")[0]`。
- 增加 `duration()` 归一化函数，避免指标出现负数或小数噪声。
- 扩展 `tests/js-behavior.test.mjs`，锁定性能监控使用 Navigation Timing Level 2，并禁止回退到 `performance.timing`。
- 更新 B-09、TD-01、安全审计、索引和健康评分文档。

### 发现的问题

- `performance-monitor.js` 默认禁用，但未来一旦开启，会读取已废弃的 `window.performance.timing`。
- 技术债务与安全审计文档仍把该废弃 API 作为待修项。

### 修复方案

- 使用 `performance.getEntriesByType("navigation")` 获取 `PerformanceNavigationTiming`。
- 用 `nav.duration` 或 `nav.loadEventEnd` 计算总耗时，其他阶段用相对时间差计算。
- 用源码测试防止废弃 API 再次进入性能监控模块。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs tests/performance.test.mjs`：40 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：528 个测试全部通过，耗时约 7.62 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：528 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 兼容性收益：消除性能监控模块中的废弃导航时序 API。

### 下一步计划

- 提交第九轮技术债务修复。
- 继续处理 CQ-07 或 B-07 等低风险技术债务。

## 第 147 轮：DOM 集合转换现代化

时间：2026-06-18

### 已完成内容

- 将 `js/coder.js`、`js/blog.js`、`js/tools.js`、`js/overleaf.js` 中应用源码的 `Array.prototype.slice.call(...)` 统一替换为 `Array.from(...)`。
- 扩展 `tests/js-behavior.test.mjs`，锁定相关应用模块不再使用旧式 DOM 集合转换。
- 更新 CQ-07、TD-01、安全审计、索引和健康评分文档。

### 发现的问题

- 多个前端模块仍沿用 ES5 时代的 NodeList/HTMLCollection 转数组写法，和项目当前 ESLint `ecmaVersion: 2020` 能力不一致。
- 技术债与安全审计文档仍把旧式集合转换列为待处理项。

### 修复方案

- 对 `querySelectorAll()` 与 `children` 返回的集合使用 `Array.from()`，保留后续 `map()`、`filter()`、`forEach()` 行为不变。
- 用源码回归测试防止 `Array.prototype.slice.call()` 在这些应用模块中回流。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs`：28 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：529 个测试全部通过，耗时约 7.76 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：529 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 质量收益：减少旧式写法和样板代码，DOM 集合转换风格与现代浏览器 API 保持一致。

### 下一步计划

- 提交第十轮技术债修复。
- 继续评估 B-03/B-04 的 `innerHTML` 维护风险或 CQ-02 的复制逻辑重复。

## 第 148 轮：giscus 占位提示安全渲染

时间：2026-06-18

### 已完成内容

- 将 `js/giscus.js` 的未配置占位提示从 `thread.innerHTML = placeholder()` 改为 `createPlaceholder()` + `thread.replaceChildren(...)`。
- 对翻译文案中的 `<code>...</code>` 标记做受控拆分，`code` 内容通过 `textContent` 写入，其他文本也作为文本节点插入。
- 扩展 `tests/js-behavior.test.mjs`，锁定 `giscus.js` 不再对 `thread.innerHTML` 赋值。
- 更新 B-04、安全审计、索引和健康评分文档。

### 发现的问题

- giscus 未配置分支会把 i18n 文案拼成 HTML 字符串再赋值给 `innerHTML`。
- 当前默认配置已启用 giscus，风险路径不常触发，但一旦配置缺失或未来文案来源变化，维护风险仍存在。

### 修复方案

- 使用 DOM API 构建 `<p class="comments-hint">` 和内部 `<code>` 元素。
- 用 `replaceChildren()` 重渲染占位提示，避免残留旧节点，也避免 HTML 字符串注入。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs`：29 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：530 个测试全部通过，耗时约 7.19 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：530 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 安全收益：消除 giscus 占位提示的潜在 `innerHTML` 注入面。

### 下一步计划

- 提交第十一轮安全修复。
- 继续处理 B-03/S-02 等剩余 `innerHTML` 维护风险。

## 第 149 轮：微信二维码弹窗安全渲染

时间：2026-06-18

### 已完成内容

- 将 `js/share.js` 的微信二维码弹窗从 `overlay.innerHTML = ...` 模板字符串改为 DOM API 构建。
- 将二维码库返回的 SVG 字符串通过 `DOMParser` 解析后导入节点，解析失败时使用纯文本 fallback。
- 扩展 `tests/share.test.mjs`，验证恶意 i18n 文案不会创建 `<img>` 或 `<script>` 节点。
- 更新 S-02、安全审计、索引和健康评分文档。

### 发现的问题

- 二维码弹窗把 `t()` 返回值直接拼进 HTML 属性和文本位置，当前硬编码文案安全，但未来翻译来源变化时存在维护风险。

### 修复方案

- 使用 `document.createElement()` / `createElementNS()` 构建弹窗、关闭按钮图标、标题、二维码区域和文章名。
- 所有 i18n 文案通过 `setAttribute()` 或 `textContent` 写入。

### 性能、安全与质量指标

- `node --test tests/share.test.mjs tests/security-extended.test.mjs`：24 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：531 个测试全部通过，耗时约 7.19 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：531 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 安全收益：消除微信二维码弹窗的 i18n HTML/属性注入面。

### 下一步计划

- 提交第十二轮安全修复。
- 继续评估 B-03 搜索高亮 `innerHTML` 维护风险。

## 第 150 轮：搜索结果高亮安全渲染

时间：2026-06-18

### 已完成内容

- 将 `js/search.js` 的结果标题、标签和摘要高亮从 `innerHTML` 字符串注入改为 `appendHighlightedText()`。
- `appendHighlightedText()` 使用 text node 写入普通文本，并用真实 `<mark>` 节点包裹命中片段。
- 将搜索结果列表清空从 `innerHTML = ""` 改为 `replaceChildren()`。
- 更新 B-03、安全审计、索引和健康评分文档。

### 发现的问题

- 搜索结果渲染虽然先经过 `escapeHtml()`，但仍依赖“生成安全 HTML 字符串后再 innerHTML 注入”的模式，后续维护时容易被误改出 XSS 风险。

### 修复方案

- 删除搜索结果高亮路径上的 HTML 字符串拼接，改用 DOM API 创建文本节点和 `<mark>` 节点。
- 用源码安全测试锁定标题、标签、摘要不再通过 `innerHTML` 渲染。

### 性能、安全与质量指标

- `node --test tests/security.test.mjs tests/js-behavior.test.mjs`：35 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：531 个测试全部通过，耗时约 7.16 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：531 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 安全收益：消除搜索结果高亮中的维护型 XSS 注入面。

### 下一步计划

- 提交第十三轮安全修复。
- 继续评估剩余 `innerHTML` 使用点或代码重复问题。

## 第 151 轮：复制逻辑重复收敛

时间：2026-06-18

### 已完成内容

- 删除 `js/coder.js` 与 `js/share.js` 中重复的 Clipboard API / `execCommand` fallback。
- 复制调用方统一委托 `window.CWLUtils.copyText`，兼容 fallback 只保留在 `js/utils.js`。
- 扩展 `tests/js-behavior.test.mjs`，锁定业务模块不再复制 `execCommand` 或 textarea fallback。
- 更新 CQ-02、TD-01、索引和健康评分文档。

### 发现的问题

- `coder.js` 和 `share.js` 虽然优先使用 `CWLUtils.copyText`，但仍保留完整内联 fallback，导致剪贴板兼容逻辑有 3 个维护点。

### 修复方案

- 保留 `utils.js` 作为唯一剪贴板兼容实现。
- 业务模块在极端独立加载且缺少 `CWLUtils.copyText` 时返回明确的 rejected Promise，避免静默复制失败。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs tests/coder.test.mjs tests/share.test.mjs tests/utils-deep.test.mjs`：76 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：532 个测试全部通过，耗时约 7.43 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：532 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 质量收益：减少重复代码，降低剪贴板 fallback 未来行为漂移概率。

### 下一步计划

- 提交第十四轮代码质量修复。
- 继续评估剩余重复逻辑或工程化配置改进。

## 第 152 轮：搜索转义重复文档收敛

时间：2026-06-18

### 已完成内容

- 为 `tests/js-behavior.test.mjs` 增加源码回归测试，确认 `search.js` 不再保留本地 `escapeHtml` 或手写 HTML entity 编码表。
- 将 CQ-03 标记为已修复，说明搜索模块已改为 DOM text node + `<mark>` 渲染。
- 更新索引和健康评分文档。

### 发现的问题

- 第 150 轮已经删除了 `search.js` 的内联 `escapeHtml`，但代码质量文档仍把它列为待处理重复实现。

### 修复方案

- 用源码测试锁定该重复实现不会回流。
- 同步文档状态，保留服务端 `format.mjs` 与客户端 `utils.js` 两个合理边界。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs`：31 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：533 个测试全部通过，耗时约 7.33 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：533 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 质量收益：文档与代码状态一致，减少后续重复排查成本。

### 下一步计划

- 提交第十五轮文档/测试收敛。
- 继续评估剩余重复逻辑或更高收益的安全配置改进。

## 第 153 轮：统一 i18n helper

时间：2026-06-18

### 已完成内容

- 在 `js/utils.js` 新增 `CWLUtils.t(key, fallback)`，集中处理 `window.cwlT` 代理和 fallback。
- 将 `blog`、`coder`、`editor`、`feedback`、`giscus`、`overleaf`、`search`、`share`、`subscribe`、`tools` 等稳定模块的本地 `t()` 包装替换为公共 helper。
- 更新测试加载顺序，让单模块测试也按生产脚本顺序先加载 `utils.js`。
- 增加 `CWLUtils.t` 行为测试和源码守卫，避免本地 `t()` wrapper 回流。
- 更新 CQ-04、索引和健康评分文档。

### 发现的问题

- 多个前端模块重复维护同构的 `function t(key, fallback)`，翻译 fallback 规则散落在各业务脚本中。
- 部分单模块测试未模拟生产页的 `utils.js -> i18n.js -> 业务脚本` 加载顺序，容易掩盖公共工具依赖关系。

### 修复方案

- 将翻译 helper 纳入 `CWLUtils`，保持原有 `window.cwlT` 行为和 fallback 语义不变。
- 稳定业务模块直接使用 `window.CWLUtils.t`。
- 对独立测试补充 `utils.js` 加载，工具页复制测试保留可控 `copyText` stub 并继承公共 `t`。
- `assistant.js` 当前存在并行未提交改动，本轮不改动也不暂存；其完整 i18n 文案治理继续归入 CQ-05。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs tests/utils-deep.test.mjs tests/blog.test.mjs tests/coder.test.mjs tests/editor.test.mjs tests/feedback.test.mjs tests/giscus.test.mjs tests/overleaf.test.mjs tests/search.test.mjs tests/share.test.mjs tests/subscribe-deep.test.mjs tests/tools.test.mjs tests/assistant-tools-page.test.mjs`：177 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：535 个测试全部通过，耗时约 8.06 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：535 个测试全部通过；行覆盖率 92.68%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 质量收益：减少 10 个模块中的重复 i18n wrapper，翻译 fallback 维护点收敛到 `utils.js`。

### 下一步计划

- 提交第十六轮代码质量优化。
- 继续评估剩余重复逻辑或更高收益的安全配置改进。

## 第 154 轮：补充全站 meta CSP

时间：2026-06-18

### 已完成内容

- 在 `src/templates/layout.mjs` 增加共享 Content Security Policy meta 策略。
- 重新构建模板生成页，使所有构建产物带上 CSP。
- 为 404、首页、关于、联系、编辑器和 Overleaf 等手写 HTML 页面补齐同款 CSP。
- 新增全站 HTML 扫描测试，确认每个已提交 HTML 都包含 CSP 且保留关键指令。
- 更新 S-05、安全索引、健康评分和本报告。

### 发现的问题

- GitHub Pages 静态托管无法直接配置响应头，项目此前没有 CSP 防护。
- 首次模板层修复后，安全测试发现 6 个手写 HTML 页面未经过构建模板，仍缺少 CSP。
- `frame-ancestors` 不能通过 meta CSP 生效，因此不应写入 meta 策略造成误导。

### 修复方案

- 使用 meta CSP 覆盖 GitHub Pages 可支持的资源加载约束：`default-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`script-src` 限定站内和 giscus、`frame-src` 限定 giscus、`form-action` 限定站内/Buttondown/Web3Forms。
- `connect-src` 保留 `https:`，兼容 AI 助手用户自定义 HTTPS API 端点。
- `style-src 'unsafe-inline'` 保留，兼容当前运行时样式属性；后续若迁移到外部样式或 nonce，可继续收紧。

### 性能、安全与质量指标

- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/templates.test.mjs tests/security-extended.test.mjs tests/integration.test.mjs tests/links.test.mjs`：29 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：536 个测试全部通过，耗时约 7.60 秒。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run test:coverage`：536 个测试全部通过；行覆盖率 92.71%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 安全收益：全站默认资源加载来源被显式约束，禁止 object 插件加载，降低 XSS 后续利用面。

### 下一步计划

- 提交第十七轮安全优化。
- 继续评估剩余安全项或性能瓶颈。

## 第 155 轮：优化粒子动画绘制热路径

时间：2026-06-18

### 已完成内容

- 将 `js/coder.js` cursor 粒子绘制从 `shadowBlur` 阴影渲染改为双层圆绘制。
- 新增 `drawParticle()`，用外层低透明度圆模拟辉光、内层实心圆保留粒子主体。
- 扩展 `tests/coder-deep.test.mjs`，确认 cursor 粒子热路径不再使用 `shadowBlur`。
- 更新 P-09、索引、健康评分和本报告。

### 发现的问题

- 粒子动画虽然已经具备空闲停止机制，但活跃时仍在每个粒子每帧设置 `shadowBlur`，容易触发 canvas 阴影绘制的高成本路径。

### 修复方案

- 移除逐帧 `shadowColor` / `shadowBlur` 设置。
- 使用 `globalAlpha` 分两次绘制同色圆形，先绘制较大的半透明辉光层，再绘制核心粒子层。
- 每个粒子绘制结束后恢复 `globalAlpha = 1`，避免污染后续 canvas 状态。

### 性能、安全与质量指标

- `node --test tests/coder-deep.test.mjs tests/coder.test.mjs tests/js-behavior.test.mjs`：66 个测试全部通过。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：537 个测试全部通过，耗时约 7.87 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：537 个测试全部通过；行覆盖率 92.71%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 性能收益：避免 canvas 阴影渲染热路径，降低低端设备上粒子动画活跃期间的逐帧绘制成本。

### 下一步计划

- 提交第十八轮性能优化。
- 继续评估剩余安全项或性能瓶颈。

## 第 156 轮：补齐移动端导航点击外部关闭

时间：2026-06-18

### 已完成内容

- 在共享布局模板中为移动端菜单加入 `.menu-overlay` label，打开菜单时可点击遮罩关闭。
- 为 404、首页、关于、联系、编辑器和 Overleaf 等手写 HTML 页面同步导航 overlay。
- 更新构建产物，使文章、标签、工具箱、AI、赞赏、赞助等生成页保持同一导航结构。
- 新增模板、CSS 和全 HTML 扫描测试，防止移动端导航 overlay 回退。
- 更新 UX-01、索引和健康评分文档，将移动端导航无遮罩项标记为已修复。

### 发现的问题

- 移动端汉堡菜单只依赖 checkbox toggle，打开后没有遮罩层；用户点击菜单外区域无法关闭导航。
- 共享模板修复后，仍有 6 个手写 HTML 页面不会被构建脚本覆盖，需要同步补齐。
- 建议索引和健康评分仍把已完成的 UX-01、P-09、S-05 作为待办展示，容易误导下一轮排期。

### 修复方案

- 使用 `<label class="menu-overlay" for="menu-toggle" aria-hidden="true"></label>` 复用原生 label/checkbox 行为，无需新增 JavaScript。
- 在移动端媒体查询中仅当 `.menu-toggle:checked` 时显示固定遮罩，并保持 `.navigation-list` 的 z-index 高于 overlay。
- 增加 `tests/i18n-a11y.test.mjs` HTML 扫描，确保所有已提交 HTML 中含 `menu-toggle` 的页面都具备 overlay。
- 清理建议索引和健康评分中的已修复待办项。

### 性能、安全与质量指标

- `node --test tests/templates.test.mjs tests/css.test.mjs tests/i18n-a11y.test.mjs`：47 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm test`：539 个测试全部通过，耗时约 12.86 秒。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：539 个测试全部通过；行覆盖率 92.71%，分支覆盖率 74.95%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 用户体验收益：移动端导航支持点击菜单外区域关闭，且无 JS 场景仍可使用。

### 下一步计划

- 提交第十九轮用户体验优化。
- 继续评估剩余高收益 SEO、性能或工程化配置项。

## 第 157 轮：修复 sitemap priority 信号

时间：2026-06-18

### 已完成内容

- 将首页 sitemap priority 从 `0` 修正为 `1.0`。
- 为文章页 sitemap 条目增加 `0.8` priority。
- 为其他静态页 sitemap 条目增加 `0.6` priority。
- 扩展 `tests/build.test.mjs`，覆盖首页、文章页、静态页 priority 输出，并防止 `<priority>0</priority>` 回归。
- 更新 SEO-03、索引和健康评分文档，将 sitemap priority 项标记为已修复。

### 发现的问题

- `src/config.mjs` 中首页配置为 `{ path: "/", withDate: true, priority: 0 }`，导致生成的 `sitemap.xml` 把首页标记为最低优先级。
- 文章页此前没有输出 priority，搜索引擎只能依赖默认值推断页面重要性。
- 文档仍将 SEO-03 列为近期规划项，和当前修复进度不一致。

### 修复方案

- 在 `STATIC_PAGES` 中使用字符串 priority：`1.0`、`0.6`，避免 JS 数字序列化把 `1.0` 变成 `1`。
- 在构建脚本中增加 `POST_SITEMAP_PRIORITY = "0.8"`，写入所有文章页 sitemap URL。
- 重新构建站点，更新根目录 `sitemap.xml`。
- 同步建议文档与健康评分，移除 SEO-03 待办项。

### 性能、安全与质量指标

- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/build.test.mjs tests/integration.test.mjs tests/build-extra.test.mjs tests/performance.test.mjs`：49 个测试全部通过。
- `node --check scripts/build.mjs`：通过。
- `npx eslint js/*.js`：通过。
- `npm test`：539 个测试全部通过，耗时约 13.01 秒。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：539 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- SEO 收益：sitemap 页面重要性信号更合理，首页不再被标记为最低优先级。

### 下一步计划

- 提交第二十轮 SEO 优化。
- 继续评估首页 JSON-LD、编辑器代码高亮或工程化 CI 配置。

## 第 158 轮：补充首页 WebSite JSON-LD

时间：2026-06-18

### 已完成内容

- 在首页 `index.html` 的 `<head>` 中新增 `WebSite` JSON-LD。
- 结构化数据包含站点名称、URL、描述、作者和发布者信息。
- 新增首页 JSON-LD 解析测试，确认 `@context`、`@type`、站点 URL 和作者字段正确。
- 更新 SEO-01、索引、健康评分和工作报告，将首页 JSON-LD 标记为已修复。

### 发现的问题

- 文章页已有 Article JSON-LD，但手写首页缺少 WebSite/Person 结构化数据。
- SEO 文档和健康评分仍将首页 JSON-LD 作为主要待办项。

### 修复方案

- 在首页直接补充紧凑 JSON-LD，复用既有站点描述、 canonical URL 和关于页作者入口。
- 使用 `tests/build-extra.test.mjs` 直接解析首页 JSON-LD，避免只靠字符串包含判断。
- 保留 CSP 中当前允许的内联脚本策略；新增 JSON-LD 不加载外部资源，不引入执行逻辑。

### 性能、安全与质量指标

- `node --test tests/build-extra.test.mjs tests/security-extended.test.mjs`：42 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm test`：540 个测试全部通过，耗时约 12.87 秒。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：540 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- SEO 收益：首页具备 WebSite 结构化数据，站点实体和作者归属更清晰。

### 下一步计划

- 提交第二十一轮 SEO 优化。
- 继续评估编辑器代码高亮、其他静态页结构化数据或 CI 配置。

## 第 159 轮：移除编辑器废弃 marked highlight 配置

时间：2026-06-18

### 已完成内容

- 从 `js/editor.js` 移除 `marked.setOptions({ highlight })` 废弃配置。
- 明确编辑器代码高亮路径：Markdown 渲染完成后统一调用 `hljs.highlightElement()`。
- 新增 fake `marked`/`hljs` 回归测试，验证不再传入 deprecated `highlight` 选项，并确认代码块被高亮。
- 更新 MR-EDITOR-03、索引和健康评分文档。

### 发现的问题

- `marked@18` 已不再支持旧版 `highlight` option，当前配置会被忽略。
- 虽然编辑器已有渲染后 `highlightElement()` 兜底，但注释和配置仍暗示 marked 内置高亮生效，容易误导后续维护。
- 既有编辑器测试没有覆盖 marked + hljs 同时存在时的高亮路径。

### 修复方案

- 保留 `marked` 的 `gfm` 与 `breaks` 配置，删除无效 `highlight` 回调。
- 将代码注释改为说明 marked v5+ 后的渲染后高亮策略。
- 使用测试替身模拟 `marked.parse()` 输出 fenced code HTML，并检查 `hljs.highlightElement()` 调用与 `data-highlighted` 标记。

### 性能、安全与质量指标

- `node --test tests/editor.test.mjs tests/js-behavior.test.mjs`：50 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：541 个测试全部通过，耗时约 7.95 秒。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：541 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 功能收益：编辑器代码高亮逻辑与当前 marked 版本一致，减少无效配置和维护误判。

### 下一步计划

- 提交第二十二轮编辑器功能修复。
- 继续评估其他静态页结构化数据、CI 配置或文章图片资源项。

## 第 160 轮：收敛编辑器 HTML 复制 fallback

时间：2026-06-18

### 已完成内容

- 将 `js/editor.js` 的 `copyHtml()` 从内联 Clipboard API / textarea / `execCommand` fallback 改为调用 `CWLUtils.copyText()`。
- 扩展 `tests/editor.test.mjs`，验证 HTML 复制会把预览 HTML 传给公共 copy helper。
- 扩展 `tests/js-behavior.test.mjs`，将 `editor.js` 纳入复制 fallback 源码守卫。
- 更新编辑器模块文档，标记 MR-EDITOR-01/02 已修复，并说明 `escapeHtml` 文档项已过期。

### 发现的问题

- `editor.js` 仍保留独立复制 fallback，与 `coder.js`、`share.js` 已收敛到 `CWLUtils.copyText()` 的状态不一致。
- 编辑器模块文档仍记录本地 `escapeHtml` 重复定义，但源码已不再存在该函数，文档状态滞后。

### 修复方案

- `copyHtml()` 直接调用 `window.CWLUtils.copyText(preview.innerHTML)`，统一复用公共 Clipboard API 和 legacy fallback。
- 保留按钮成功/失败反馈逻辑，只替换底层复制实现。
- 用源码测试防止 `document.execCommand("copy")` 和 textarea fallback 再次回流到编辑器模块。

### 性能、安全与质量指标

- `node --test tests/editor.test.mjs tests/js-behavior.test.mjs`：51 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：542 个测试全部通过，耗时约 7.30 秒。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：542 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 代码质量收益：编辑器复制兼容逻辑复用公共 helper，减少重复 fallback 和浏览器兼容维护点。

### 下一步计划

- 提交第二十三轮代码质量优化。
- 继续评估其他静态页结构化数据、CI 配置或文章图片资源项。

## 第 161 轮：补齐编辑器导出必填 front matter

时间：2026-06-18

### 已完成内容

- 在 `editor/index.html` 新增短标题、摘要和描述输入项，并补充英文 i18n 文案。
- 在 `js/editor.js` 中保存、恢复、清空和示例填充 `shortTitle`、`summary`、`description`。
- 将 Markdown 导出的 front matter 扩展为 `title`、`shortTitle`、`date`、`summary`、`description`、`draft`，覆盖当前构建脚本的必填字段。
- 新增 YAML 字符串转义 helper，避免标题、摘要、描述中的引号或反斜杠破坏导出格式。
- 扩展编辑器测试，拦截导出 Blob 并验证必填字段与引号转义。
- 更新 MR-EDITOR-05、建议索引和健康评分文档。

### 发现的问题

- 编辑器导出的 Markdown 只包含 `title`、`date` 和 `draft`。
- `scripts/build.mjs` 的文章校验要求 `title`、`shortTitle`、`date`、`summary`、`description` 均存在，导致编辑器导出的文件无法直接进入构建流程。
- 既有测试只确认标题引号保留，没有验证下载文件真实 front matter 内容。

### 修复方案

- 在编辑器元信息区域补齐构建必需字段，并纳入 localStorage 状态。
- 标题输入时在短标题为空的情况下自动同步，降低用户重复输入成本。
- 摘要和描述为空时使用安全默认值，描述默认跟随摘要。
- 通过 `FileReader` 读取导出 Blob，验证下载路径生成的 Markdown，而不是只检查内部输入值。

### 性能、安全与质量指标

- `node --test tests/editor.test.mjs tests/i18n-a11y.test.mjs tests/js-behavior.test.mjs`：65 个测试全部通过。
- `npx eslint js/*.js`：通过。
- `npm test`：542 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：542 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 用户体验收益：编辑器导出 Markdown 可直接用于当前文章构建流程，减少手工补字段和构建失败。

### 下一步计划

- 提交第二十四轮编辑器导出修复。
- 继续评估其他静态页结构化数据、CI 配置或文章图片资源项。

## 第 162 轮：新增 GitHub Actions CI 质量门禁

时间：2026-06-18

### 已完成内容

- 新增 `.github/workflows/ci.yml`，在 `push`、`pull_request` 和手动触发时运行通用质量门禁。
- CI 权限限制为 `contents: read`，避免普通验证流程拥有写权限。
- CI 使用 Node.js 22 和 npm cache，依次运行依赖安装、lint 检查、全量测试、构建、生产验证、覆盖率和依赖审计。
- 在 `package.json` 新增 `lint:check`，供 CI 使用只检查不改写的 ESLint 命令。
- 扩展 `tests/workflows.test.mjs`，解析 CI YAML 并验证触发分支、权限、Node 配置和关键命令。
- 更新 DE-01、建议索引、健康评分和工程化成熟度文档。

### 发现的问题

- 项目已有商业 relay 定时同步 workflow，但缺少通用 PR/push 质量门禁。
- 现有 `lint` 脚本带 `--fix`，不适合在 CI 中作为只读检查步骤使用。
- 工程化建议文档仍将 CI/CD 作为未完成中等风险项。

### 修复方案

- 新建独立 CI workflow，不混入 relay 同步 workflow，保持职责清晰。
- CI 使用 `npm run lint:check` 而非 `npm run lint`，避免验证过程修改工作区。
- 将本地持续执行的验证链路固化到 CI：`npm test`、`npm run build`、`npm run validate:production`、`npm run test:coverage` 和中高危 `npm audit`。
- 用 YAML 解析测试锁住 workflow 结构，防止后续误删关键门禁。

### 性能、安全与质量指标

- `node --test tests/workflows.test.mjs`：2 个 workflow 测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：543 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：543 个测试全部通过；行覆盖率 92.72%，分支覆盖率 74.91%，函数覆盖率 89.33%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 工程化收益：PR 和主分支提交具备自动质量门禁，降低手动漏跑验证导致的回归风险。

### 下一步计划

- 提交第二十五轮工程化优化。
- 继续评估其他静态页结构化数据、文章图片资源项或覆盖率阈值。

## 第 163 轮：补齐静态页面 JSON-LD 结构化数据

时间：2026-06-18

### 已完成内容

- 在 `src/templates/layout.mjs` 新增 `siteUrl()` 和 `buildPageJsonLd()`，统一页面级 JSON-LD 的站点 URL、语言和 `isPartOf` 信息。
- 为博客列表、时间归档、标签、AI、工具箱、鉴赏和赞助等生成页补充 `CollectionPage`、`WebApplication` 或 `WebPage` 结构化数据。
- 为关于、联系、编辑器和 Overleaf 手写页补充 `Person`、`ContactPage` 和 `WebApplication` JSON-LD。
- 重新构建生成页，使 `post/index.html`、`tools/index.html`、`ai/index.html`、`categories/index.html`、`tags/index.html`、`appreciation/index.html`、`sponsor/index.html` 写入结构化数据。
- 扩展模板和构建测试，解析 JSON-LD 并验证类型、绝对 URL、站点实体和关键字段。
- 更新 SEO-02、建议索引、健康评分和本轮工作报告。

### 发现的问题

- 首页已有 WebSite JSON-LD，文章页已有 Article JSON-LD，但静态工具页、集合页和手写页缺少页面级结构化数据。
- `renderPage()` 已支持 `jsonLd` 参数，但缺少统一 helper，直接在各模板手写容易出现 URL 和站点实体不一致。
- 既有测试只覆盖首页和文章页 JSON-LD，没有覆盖其他静态页面。

### 修复方案

- 生成页统一通过 `buildPageJsonLd()` 输出结构化数据，集合页使用 `ItemList` 描述文章、标签、AI 工具或榜单条目。
- 工具型页面使用 `WebApplication`，并声明 `DeveloperApplication`、`operatingSystem: Any` 和免费 `Offer`。
- 手写 about/contact/editor/overleaf 页面直接加入紧凑 JSON-LD，并用构建测试解析验证。
- 通过模板级测试和产物级测试双层覆盖，防止模板改动或手写页遗漏。

### 性能、安全与质量指标

- `node --test tests/templates-extended.test.mjs tests/build-extra.test.mjs`：59 个测试全部通过。
- `node --test tests/build-extra.test.mjs tests/i18n-a11y.test.mjs tests/security-extended.test.mjs`：58 个测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：546 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：546 个测试全部通过；行覆盖率 93.01%，分支覆盖率 75.17%，函数覆盖率 89.92%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- SEO 收益：站点静态页面具备更完整的结构化数据，页面类型和实体关系更清晰。

### 下一步计划

- 提交第二十六轮 SEO 优化。
- 继续评估文章图片资源项、覆盖率阈值或 remaining 低风险 SEO 项。

## 第 164 轮：支持文章修改日期结构化数据

时间：2026-06-18

### 已完成内容

- 在 `scripts/build.mjs` 新增 `normalizeModifiedDate()`，支持可选 `modified` front matter。
- 构建文章对象时透传 `modified`，未填写时回退发布日期。
- `src/templates/post.mjs` 的 Article JSON-LD 改为使用 `post.modified || post.date` 输出 `dateModified`。
- 编辑器导出的 Markdown front matter 新增 `modified` 字段，默认等于发布日期。
- 扩展构建深测、模板测试和编辑器导出测试，覆盖 modified 默认值、合法后续日期、非法早于发布日期、Article JSON-LD 和导出 front matter。
- 更新 SEO-05、建议索引、健康评分和本轮工作报告。

### 发现的问题

- 文章 JSON-LD 的 `dateModified` 固定等于 `datePublished`，后续修订文章时无法表达真实更新时间。
- 构建脚本没有读取 `modified` 字段，也没有日期先后顺序校验。
- 编辑器导出的 Markdown 即使补齐了必填 front matter，也没有为后续修改日期预留字段。

### 修复方案

- `normalizeModifiedDate()` 复用 `normalizeDate()` 的格式和真实日期校验。
- 当 `modified` 缺失时保持完全向后兼容；当 `modified` 早于 `date` 时构建失败并报告具体文件。
- 编辑器 front matter 输出 `modified`，让新文章从源头具备可维护的更新时间字段。

### 性能、安全与质量指标

- `node --test tests/build-deep.test.mjs tests/templates-extended.test.mjs tests/editor.test.mjs`：99 个测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：549 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：549 个测试全部通过；行覆盖率 93.04%，分支覆盖率 75.39%，函数覆盖率 89.96%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- SEO 收益：文章修订时可输出准确 `dateModified`，搜索引擎更新时间信号更可靠。

### 下一步计划

- 提交第二十七轮 SEO 优化。
- 继续评估文章图片资源项、覆盖率阈值或低风险工程化项。

## 第 165 轮：声明 Node.js 运行时版本

时间：2026-06-18

### 已完成内容

- 在 `package.json` 新增 `engines.node`，声明支持 `20 || >=22`。
- 选择该范围以匹配当前 jsdom 依赖链中 `node: 20 || >=22` 的约束，并与 CI Node 22 配置保持一致。
- 扩展 `tests/workflows.test.mjs`，在验证 CI Node 22 的同时确认 package engines 已声明。
- 更新 DE-09、建议索引和本轮工作报告。

### 发现的问题

- 项目依赖 ES Modules、Node 内置测试运行器和 jsdom 27，但根 `package.json` 未声明 Node 版本要求。
- CI 已固定 Node 22，本地安装却缺少对应提示；低版本 Node 会在安装或测试时才暴露兼容问题。

### 修复方案

- 使用 `20 || >=22` 表达当前依赖支持窗口，避免误纳入 Node 21。
- 用 workflow 测试锁定 CI 与 package engines 的一致性。

### 性能、安全与质量指标

- `node --test tests/workflows.test.mjs`：2 个 workflow 测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：549 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：549 个测试全部通过；行覆盖率 93.04%，分支覆盖率 75.39%，函数覆盖率 89.96%。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 工程化收益：本地 Node 版本不匹配时能更早得到 npm engines 提示。

### 下一步计划

- 提交第二十八轮工程化优化。
- 继续评估文章图片资源项、覆盖率阈值或低风险 UX 项。

## 第 166 轮：增加覆盖率阈值门禁

时间：2026-06-18

### 已完成内容

- 为 `npm run test:coverage` 增加 Node 原生覆盖率阈值参数：lines 90%、branches 70%、functions 85%。
- 保持现有 Node 内置测试运行器，不新增覆盖率依赖。
- 扩展 `tests/workflows.test.mjs`，锁定 coverage script 的阈值参数，并继续验证 CI 执行覆盖率检查。
- 更新 DE-02、建议索引、健康评分和本轮工作报告。

### 发现的问题

- CI 已运行 `npm run test:coverage`，但此前只是输出覆盖率报告；覆盖率明显下降时不会自动失败。
- 项目当前覆盖率基线为 line 93.04%、branch 75.39%、functions 89.96%，适合设置保守阈值防止回退。

### 修复方案

- 使用 Node 内置 `--test-coverage-lines`、`--test-coverage-branches`、`--test-coverage-functions` 参数直接在测试命令中声明阈值。
- 将阈值设为低于当前基线但具备阻断意义的 90/70/85，降低 Node 覆盖率口径小幅波动导致 CI 脆弱的风险。
- 用 workflow 测试防止后续误删阈值或把 CI 覆盖率步骤退化成仅打印报告。

### 性能、安全与质量指标

- `node --test tests/workflows.test.mjs`：2 个 workflow 测试全部通过。
- `npm run test:coverage`：549 个测试全部通过；行覆盖率 93.04%，分支覆盖率 75.39%，函数覆盖率 89.96%，均高于阈值。
- 工程化收益：覆盖率回退可在本地和 CI 中自动失败，减少测试质量无声下降。

### 下一步计划

- 提交第二十九轮工程化优化。
- 继续评估文章图片资源项、低风险 UX 项或更高价值的内容/性能改进。

## 第 167 轮：主题默认跟随系统偏好

时间：2026-06-18

### 已完成内容

- 将主题模式从手动 light/dark 扩展为 `auto / light / dark`。
- 无本地偏好时默认 `auto`，根据 `prefers-color-scheme` 应用系统亮/暗主题。
- 监听系统主题变化，仅在 `auto` 模式下实时同步；用户显式选择 light/dark 后不被系统变化覆盖。
- 主题按钮图标随模式更新为 desktop/sun/moon，并补正无障碍文案为“切换主题 / Toggle theme”。
- 更新 F-04、建议索引、健康评分和本轮工作报告。

### 发现的问题

- 主题此前默认暗色，未尊重用户操作系统的亮/暗偏好。
- 导航按钮无障碍文案仍描述为“Toggle dark mode”，与三态主题能力不匹配。

### 修复方案

- 使用 `matchMedia("(prefers-color-scheme: dark)")` 获取系统偏好，并兼容无 `matchMedia` 时继续默认暗色。
- 使用 `auto/light/dark` 三态存储值；点击按钮按三态循环，localStorage 中的显式值优先于系统偏好。
- 为 MediaQueryList 同时兼容 `addEventListener` 和旧式 `addListener`。

### 性能、安全与质量指标

- `node --test tests/coder-deep.test.mjs tests/coder.test.mjs`：35 个 coder 测试全部通过。
- `node --test tests/i18n-deep.test.mjs tests/i18n-a11y.test.mjs`：26 个 i18n/a11y 测试全部通过。
- `npm test`：550 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：550 个测试全部通过；行覆盖率 93.04%，分支覆盖率 75.39%，函数覆盖率 89.96%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- UX 收益：首次访问时主题与用户系统偏好一致，减少亮/暗模式切换成本。

### 下一步计划

- 提交第三十轮 UX 优化。
- 继续评估文章图片资源项、性能优化项或更高价值的内容型 SEO 改进。

## 第 168 轮：补充文章专属社交封面

时间：2026-06-18

### 已完成内容

- 为 6 篇文章新增 `cover` front matter。
- 生成 6 张 1200×630 PNG 社交封面图，保存到 `images/posts/`。
- `scripts/build.mjs` 新增 `normalizeCover()`，校验 cover 必须为 `/images/` 或 http(s) 图片路径。
- 构建时将 cover 排入 `post.images` 首位，使 Article JSON-LD `image`、sitemap `image:image` 和单篇页 OG/Twitter image 使用文章专属封面。
- 更新 RES-02、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 文章正文均无图片，虽然站点已有 favicon 兜底，但所有文章分享卡片使用同一图片，社交平台区分度不足。
- Article JSON-LD `image` 和 sitemap `image:image` 依赖 `post.images`，缺少显式 cover 时无法稳定输出文章级图片信号。

### 修复方案

- 在 front matter 增加 `cover` 字段，并通过构建期校验阻断非图片路径和异常协议。
- 生成统一规格的本地 PNG 社交卡片，避免外链图片失效。
- 让单篇文章页优先使用 `post.cover` 渲染 OG/Twitter image，同时保留站点默认图给非文章页兜底。

### 性能、安全与质量指标

- `node --test tests/build-deep.test.mjs tests/build-extra.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs`：118 个构建/模板测试全部通过。
- 图片资产：6 张 PNG，均为 1200×630；单张约 137KB-149KB。
- `npm run lint:check`：通过。
- `npm test`：552 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：552 个测试全部通过；行覆盖率 93.14%，分支覆盖率 75.17%，函数覆盖率 90.46%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- SEO 收益：文章专属封面进入 Open Graph、Twitter Card、Article JSON-LD 和 image sitemap。

### 下一步计划

- 提交第三十一轮内容型 SEO 优化。
- 继续评估图片展示体验、Lightbox 或更高价值的性能改进。

## 第 169 轮：补齐依赖自动更新检查

时间：2026-06-18

### 已完成内容

- 新增 `.github/dependabot.yml`，每周检查 npm devDependencies 和 GitHub Actions 更新。
- npm 更新配置按 devDependencies 分组，并限制最多 5 个打开 PR，避免更新噪声过大。
- 扩展 `tests/workflows.test.mjs`，解析 Dependabot YAML 并验证 npm、GitHub Actions、更新周期、PR 数量限制和分组策略。
- 更新 DE-03、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- CI 已具备中高危依赖审计，但依赖版本更新提醒仍依赖人工主动检查。
- GitHub Actions 版本同样需要周期更新，否则后续 action 弃用或安全修复可能被遗漏。
- 工程化建议文档仍把 DE-03 记录为未修复状态，和现有 CI 审计能力不一致。

### 修复方案

- 使用 Dependabot 官方配置覆盖 `npm` 与 `github-actions` 两个 ecosystem。
- 对 npm devDependencies 启用分组更新，保持个人项目的维护节奏可控。
- 用 YAML 解析测试锁住配置结构，防止后续误删自动更新检查。

### 性能、安全与质量指标

- `node --test tests/workflows.test.mjs`：3 个 workflow 配置测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：553 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：553 个测试全部通过；行覆盖率 93.14%，分支覆盖率 75.17%，函数覆盖率 90.46%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 工程化收益：依赖漏洞审计和版本更新提醒形成自动化闭环，减少依赖维护遗漏。

### 下一步计划

- 提交第三十二轮工程化优化。
- 继续评估近期规划项中的 CSS 关键路径、JS 合并或 assistant.js i18n。

## 第 170 轮：移动端毛玻璃性能降级

时间：2026-06-18

### 已完成内容

- 在 `css/coder.css` 新增移动端 `max-width: 768px` 覆盖规则。
- 导航、移动菜单、卡片、弹窗、工具栏、浮层和下一篇推荐在小屏幕上关闭 `backdrop-filter` 与 `-webkit-backdrop-filter`。
- 关键浮层改用 `--surface-solid` 背景，减少关闭毛玻璃后的可读性风险。
- 扩展 `tests/css.test.mjs`，验证移动端 blur 降级规则、WebKit 前缀和实色背景。
- 更新 P-12、MR-CSS-06、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- `coder.css` 中多处 `backdrop-filter: blur()` 在移动端会增加 GPU 背景采样和合成成本。
- 直接新增规则一度让 `coder.css` 超出 118KB 性能门禁，说明 CSS 体积已经贴近阈值，需要控制新增样式体积。
- 文档仍将移动端毛玻璃压力标记为未修复状态。

### 修复方案

- 保留桌面端现有视觉，只在移动端关闭高成本 backdrop blur。
- 通过紧凑覆盖规则控制新增 CSS 体积，保持 `coder.css` 为 117.936KB，低于 118KB 门禁。
- 用 CSS 源码测试和性能体积测试双重约束，防止后续回退。

### 性能、安全与质量指标

- `node --test tests/css.test.mjs`：29 个 CSS 测试全部通过。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：554 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：554 个测试全部通过；行覆盖率 93.14%，分支覆盖率 75.17%，函数覆盖率 90.46%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 性能收益：移动端减少高成本背景模糊采样，桌面视觉保持不变。

### 下一步计划

- 提交第三十三轮性能优化。
- 继续评估 CSS 关键路径、JS 请求合并或 assistant.js i18n。

## 第 171 轮：独立文章 front matter 校验

时间：2026-06-18

### 已完成内容

- 新增 `scripts/validate-posts.mjs`，独立校验 `src/posts/*.md` 的 front matter，不生成站点产物。
- 新增 `npm run validate:posts`，并接入本地 `validate` 和 GitHub Actions CI，在 build 前更早发现文章元数据错误。
- 校验范围包括必填字段、日期、修改日期、封面路径、slug、重复 slug、`tags` / `tagsEn` 数组类型和数量一致性。
- 新增 `tests/validate-posts.test.mjs`，覆盖真实文章通过、重复 slug、标签翻译数量不一致、非法标签类型、缺参、越界目录、空目录和空正文 warning。
- 更新 DE-08、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 文章 front matter 校验此前只能借由完整构建触发，写作时反馈链路偏重。
- CI 虽然会构建站点，但没有独立表达“文章元数据校验”这个质量门禁。
- 新增脚本初版覆盖率偏低，补充失败和 warning 路径测试后脚本覆盖率提升到 96.85% 行覆盖。

### 修复方案

- 复用 `scripts/build.mjs` 中已有的 `validatePost`、`validateSlug`、`validateUniqueSlug`、`normalizeDate`、`normalizeModifiedDate` 和 `normalizeCover`。
- 新脚本只读取 Markdown 和 YAML front matter，输出格式化错误列表；校验失败时返回非零退出码。
- 在 CI 中将 `npm run validate:posts` 放在 build 前，减少文章错误进入完整构建阶段的成本。

### 性能、安全与质量指标

- `npm run validate:posts`：6 篇文章全部通过。
- `node --test tests/validate-posts.test.mjs`：8 个文章校验测试全部通过。
- `node --test tests/workflows.test.mjs`：3 个 workflow 配置测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：562 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：562 个测试全部通过；行覆盖率 93.27%，分支覆盖率 75.29%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 工程化收益：文章元数据错误可以通过独立命令和 CI 质量门禁更早暴露。

### 下一步计划

- 提交第三十四轮工程化优化。
- 继续评估 CSS 关键路径、JS 请求合并或不触碰外部改动的代码质量项。

## 第 172 轮：搜索资源空闲预热

时间：2026-06-18

### 已完成内容

- 在 `js/search.js` 暴露 `window.cwlPreloadSearch = loadIndex`，允许外部预热 Fuse.js 和搜索索引但不打开搜索弹窗。
- 在 `js/search-loader.js` 增加 idle 预热：支持 `requestIdleCallback(preloadSearch, { timeout: 3500 })`，并为不支持该 API 的浏览器提供 2.5 秒 `setTimeout` 降级。
- 预热失败时吞掉错误，不影响页面主流程；用户点击或快捷键打开搜索时仍走原有强制打开路径。
- 扩展 `tests/js-behavior.test.mjs`，锁定 idle 预热、降级定时器、`loadSearch(false)` 和 `cwlPreloadSearch` 入口。
- 更新 P-06、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 搜索主脚本、Fuse.js 和 `/search-index.json` 此前都在首次点击或快捷键打开搜索时才加载。
- 当前搜索索引体积较小，但首次搜索仍需要等待脚本加载、索引请求和 Fuse 实例构建。
- 既有懒加载策略对首屏友好，但未利用首屏空闲时间提前准备搜索体验。

### 修复方案

- 保持首屏不阻塞：页面加载后仍只加载轻量 `search-loader.js`。
- 浏览器进入空闲期后加载 `search.js`，再调用 `cwlPreloadSearch()` 预热 Fuse 和索引。
- 对老浏览器使用延迟定时器降级，避免因为缺少 `requestIdleCallback` 而丢失优化。

### 性能、安全与质量指标

- `node --test tests/js-behavior.test.mjs`：33 个 JS 行为测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：563 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：563 个测试全部通过；行覆盖率 93.27%，分支覆盖率 75.29%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 性能收益：搜索资源可在用户首次打开前完成预热，降低首次搜索冷启动等待。

### 下一步计划

- 提交第三十五轮性能优化。
- 继续评估 CSS 关键路径、JS 请求合并或其它不冲突的低风险性能项。

## 第 173 轮：统一阅读时间计算

时间：2026-06-18

### 已完成内容

- 新增 `src/lib/reading.mjs`，为构建端提供单一 `readingMinutes()` 实现。
- `scripts/build.mjs` 改为复用并重新导出共享阅读时间 helper，保持既有测试导入兼容。
- `js/utils.js` 新增 `CWLUtils.readingMinutes()`，供浏览器端业务模块统一调用。
- `js/coder.js` 删除本地阅读时间算法，文章页运行时改用公共 helper。
- `js/editor.js` 的统计面板改用 `CWLUtils.readingMinutes()`，不再维护第三份算法。
- 新增/扩展构建端、工具函数和编辑器测试，锁定 SSR、文章页与编辑器统计的一致性。
- 更新 B-05、MR-EDITOR-04、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 阅读时间算法此前散落在 `scripts/build.mjs`、`js/coder.js` 和 `js/editor.js`。
- 构建期 SSR 占位、文章页运行时刷新和编辑器统计使用相同常量，但缺少共享入口。
- 后续如果只改其中一处，会导致阅读时间闪烁或编辑器预估与发布后页面不一致。

### 修复方案

- 构建端用 `src/lib/reading.mjs` 作为单一数据源。
- 浏览器端沿用项目既有 `CWLUtils` 共享工具模式，避免引入前端模块加载改造。
- 保持 `scripts/build.mjs` 的 `readingMinutes` re-export，减少测试和外部调用迁移成本。

### 性能、安全与质量指标

- `node --test tests/build-extended.test.mjs tests/build-deep.test.mjs tests/build-extra.test.mjs`：112 个构建相关测试全部通过。
- `node --test tests/utils.test.mjs tests/editor.test.mjs`：40 个工具/编辑器测试全部通过。
- `node --test tests/coder.test.mjs tests/coder-deep.test.mjs`：35 个文章页运行时测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：566 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：566 个测试全部通过；行覆盖率 93.27%，分支覆盖率 75.21%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 代码质量收益：阅读时间算法由 3 处收敛为构建端 1 处 + 浏览器公共工具 1 处，业务模块不再各自维护常量。

### 下一步计划

- 运行全量质量门禁并提交第三十六轮代码质量优化。
- 继续从不触碰 `assistant.js` 外部改动的性能、工程化或可维护性项目中筛选下一轮。

## 第 174 轮：页面脚本合并去重

时间：2026-06-18

### 已完成内容

- 在 `src/templates/layout.mjs` 中将默认核心脚本抽为 `CORE_SCRIPTS`。
- `renderPage()` 合并核心脚本和页面脚本时改用 `Set` 去重，保留原始加载顺序。
- 扩展 `tests/templates.test.mjs`，验证核心脚本重复传入和页面脚本重复传入时都只输出一次。
- 更新 MR-BUILD-05、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- `renderPage()` 此前直接拼接核心脚本和页面脚本。
- 如果未来某个模板误把 `/js/utils.js` 等核心脚本再次传入 `scripts`，生成 HTML 会重复加载同一个脚本。
- 重复脚本可能造成额外请求、重复事件绑定或初始化逻辑重复执行。

### 修复方案

- 保留核心脚本优先加载顺序。
- 用 `new Set([...CORE_SCRIPTS, ...scripts])` 去除重复项。
- 增加模板层单元测试，防止后续回退为直接数组拼接。

### 性能、安全与质量指标

- `node --test tests/templates.test.mjs tests/templates-extended.test.mjs`：35 个模板测试全部通过。
- `node --test tests/links.test.mjs tests/performance.test.mjs`：18 个链接/性能测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：567 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：567 个测试全部通过；行覆盖率 93.24%，分支覆盖率 75.04%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 工程化收益：模板调用方即使误传重复脚本，也不会污染生成 HTML。

### 下一步计划

- 运行全量质量门禁并提交第三十七轮工程化优化。
- 继续筛选不触碰 `assistant.js` 外部改动的低风险质量项。

## 第 175 轮：跳过单篇页重复目录构建

时间：2026-06-18

### 已完成内容

- 在 `js/coder.js` 新增 `hasServerRenderedToc()`，检测单篇文章页 `.post-layout` 内是否已有 SSR `.toc-sidebar`。
- 单篇页已有 SSR 目录时，跳过动态 `.article-toc` 构建；博客列表页仍保留运行时动态目录。
- 扩展 `tests/coder-deep.test.mjs`，验证 SSR TOC 存在时不会再创建重复动态 TOC。
- 更新 B-07、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 单篇文章页已经由构建脚本输出 `.toc-sidebar`，且由 `toc.js` 负责交互和高亮。
- `coder.js` 此前仍会扫描同一篇文章的标题，并追加第二套 `.article-toc`。
- 这会带来重复 DOM、重复标题扫描和潜在视觉重复风险。

### 修复方案

- 明确职责：单篇页目录由 SSR + `toc.js` 管理，博客列表页目录由 `coder.js` 动态生成。
- 在 article 所属 `.post-layout` 内检测 `.toc-sidebar`，只在没有 SSR 目录时构建动态目录。
- 保持阅读时间、滚动进度和列表页 TOC 行为不变。

### 性能、安全与质量指标

- `node --test tests/coder-deep.test.mjs tests/coder.test.mjs`：36 个文章页运行时测试全部通过。
- `node --test tests/templates.test.mjs tests/links.test.mjs`：11 个模板/链接测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：568 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：568 个测试全部通过；行覆盖率 93.29%，分支覆盖率 75.29%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 性能收益：单篇页避免重复标题扫描和重复目录 DOM 构建。

### 下一步计划

- 运行全量质量门禁并提交第三十八轮性能/一致性优化。
- 继续处理不触碰 `assistant.js` 外部改动的低风险技术债。

## 第 176 轮：粒子删除热路径回归守卫

时间：2026-06-18

### 已完成内容

- 确认 `js/coder.js` 的粒子删除路径已经使用 `removeParticle(index)` 的 swap-and-pop 策略。
- 扩展 `tests/coder-deep.test.mjs`，新增源码守卫，防止粒子动画热路径回退到 `.splice()`。
- 更新 B-02、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- 建议清单仍记录 B-02 为待修复，但当前代码已经使用尾元素交换 + `pop()` 删除过期粒子。
- 缺少专门测试守卫，未来维护时仍可能把热路径改回 `splice()`。

### 修复方案

- 保留现有 swap-and-pop 实现，不做不必要重构。
- 新增源码级回归测试，断言不出现 `.splice(`，并锁定 `removeParticle()`、尾元素交换和 `pop()`。
- 将 B-02 文档状态校准为已修复。

### 性能、安全与质量指标

- `node --test tests/coder-deep.test.mjs tests/coder.test.mjs`：37 个文章页运行时测试全部通过。
- `npm run lint:check`：通过。
- `npm test`：569 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：569 个测试全部通过；行覆盖率 93.29%，分支覆盖率 75.29%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- 性能收益：减少未来回退导致的数组搬移和 GC 压力风险。

### 下一步计划

- 运行全量质量门禁并提交第三十九轮性能测试守卫优化。
- 继续筛选不触碰 `assistant.js` 外部改动的技术债或 UX 项。

## 第 177 轮：返回顶部按钮初始化防闪烁

时间：2026-06-18

### 已完成内容

- 在 `css/coder.css` 增加 `body:not(.to-top-ready) .to-top { display: none; }`，隐藏未初始化的返回顶部按钮。
- 在 `js/coder.js` 首次执行 `onScroll()` 后添加 `body.to-top-ready`，确保按钮状态先计算再进入可显示阶段。
- 扩展 `tests/css.test.mjs` 与 `tests/coder-deep.test.mjs`，分别锁定 CSS ready 门闩和 JS 初始化标记。
- 更新 UX-10、建议索引、健康评分、工作报告和本轮工作报告。

### 发现的问题

- `.to-top` 由 JS 动态创建，初始依赖 `visible` class 控制透明度。
- 浏览器恢复滚动位置或提前触发滚动状态时，按钮可能在初始化阶段出现短暂闪烁。
- 既有测试未覆盖“按钮完成首轮状态计算后再允许显示”的时序。

### 修复方案

- 用 body 级 ready class 作为初始化门闩。
- 首次 `onScroll()` 计算宽度/可见状态后再添加 `.to-top-ready`。
- 保持原有 `.to-top.visible` 显隐动画与滚动阈值逻辑不变。

### 性能、安全与质量指标

- `node --test tests/css.test.mjs tests/coder-deep.test.mjs tests/coder.test.mjs`：67 个 CSS 与运行时初始化测试全部通过。
- `npm run lint:check`：通过。
- `node --test tests/performance.test.mjs`：13 个性能测试全部通过。
- `npm test`：570 个测试全部通过。
- `npm run build`：通过，成功生成 6 篇文章页面。
- `npm run validate:production`：33 项检查通过，0 失败，0 警告。
- `npm run test:coverage`：570 个测试全部通过；行覆盖率 93.29%，分支覆盖率 75.29%，函数覆盖率 90.80%，均高于覆盖率阈值。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个中高危漏洞。
- UX 收益：返回顶部按钮不再进入未初始化可显示状态，减少页面加载视觉抖动。

### 下一步计划

- 运行全量质量门禁并提交第四十轮 UX 优化。
- 继续处理不触碰 `assistant.js` 外部改动的 UX 或工程化项目。
