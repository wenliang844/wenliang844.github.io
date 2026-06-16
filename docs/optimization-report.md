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
