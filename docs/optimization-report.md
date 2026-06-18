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
