# 🔒 安全审计报告

> 分析日期：2026-06-18 | 分析范围：全站前端代码、构建脚本、第三方依赖

---

## 📌 S-00 [已修复]: `assistant.js` 硬编码 Demo API Key 泄露

- **📍 原位置**：`js/assistant.js:54-57`
- **📝 原始状况**：
  ```javascript
  const DEMO_KEY_MAP = {
    openai: "sk-***",
    anthropic: "tp-***",
  };
  ```
  这两个 API key 曾以明文硬编码在前端 JS 中，且在 `withEffectiveApiKey()` 中作为用户未配置 key 时的默认值使用。任何用户打开浏览器开发者工具 Network 面板即可看到请求中的 key。
- **✅ 修复状态**：已移除前端 demo key 映射，AI 助手现在必须由用户显式输入自己的 API key 才会发起 LLM 请求，并新增回归测试防止常见 key 前缀形式的密钥再次进入前端包。
- **⚠️ 原影响程度**：🔴 **高**
  - API key 可被提取滥用，产生费用
  - 违反 API 提供商服务条款，可能导致账号封禁
  - 中转站 endpoint 同时暴露（`free.lyclaude.site`、`token-plan-cn.xiaomimimo.com`）
- **💡 后续建议**：
  1. **已完成**：清空前端默认 key，改为引导用户在 AI 助手设置中输入自己的 key
  2. **短期**：部署 Cloudflare Workers 代理，key 存服务端环境变量
  3. **长期**：实现用量配额和请求频率限制
- **📊 预期收益**：消除 API 费用风险，符合安全最佳实践
- **🔗 相关建议**：[[architecture-review]] AI 助手架构重构

---

## 📌 S-01: `innerHTML` 使用点审计 — 整体安全但存在维护风险

- **📍 位置**：多个文件
- **📝 当前状况**：对全站 JS 进行 `innerHTML` 使用审计，发现以下使用场景：

  | 文件 | 行号 | 用途 | 安全性 |
  |------|------|------|--------|
  | `search.js` | 240-265 | 搜索结果高亮 | ✅ 已改用 text node + `<mark>` 节点 |
  | `coder.js` | 203 | 复制按钮 i18n 文本 | ✅ 硬编码 + Font Awesome 图标 |
  | `coder.js` | 299 | TOC 切换按钮 | ✅ 硬编码 |
  | `giscus.js` | 33-62 | `createPlaceholder()` | ✅ 已改用 DOM API 和 `textContent` |
  | `share.js` | 94-99 | 复制成功反馈 | ✅ 使用预定义 SVG |
  | `share.js` | 136-178 | 二维码弹窗 | ✅ 已改用 DOM API，i18n 文本走 `textContent` / `setAttribute` |
  | `blog.js` | 276 | FAB 按钮图标 | ✅ 硬编码 Font Awesome |
  | `error-handler.js` | 69-88 | toast 消息 | ✅ 完全使用 DOM API |
  | `subscribe.js` | 96-110 | 订阅弹窗 | ✅ 硬编码模板 |

- **⚠️ 影响程度**：低（当前无实际 XSS 漏洞）
- **💡 建议方案**：建立 `innerHTML` 使用规范——只有在以下条件同时满足时才允许使用：
  1. 内容是硬编码字符串或经过 `escapeHtml` 处理
  2. 不包含用户输入
  3. 代码审查时重点检查

  长期方案：考虑引入 DOMPurify（已在 `eslintrc.json` 的 globals 中声明）作为统一的 HTML 净化层。

- **📊 预期收益**：建立安全编码规范，降低未来引入 XSS 的风险
- **🔗 相关建议**：[B-03 已修复](bugs-and-risks.md#b-03), [B-04 已修复](bugs-and-risks.md#b-04)

---

## 📌 S-02 [已修复]: `share.js` 二维码弹窗中 `t()` 返回值直接拼接 HTML 字符串

- **📍 原位置**：`js/share.js`
- **✅ 修复状态**：微信二维码弹窗已改用 DOM API 构建，`t()` 返回值分别通过 `setAttribute()` 或 `textContent` 写入，不再拼接到 HTML 字符串。
- **🧪 回归测试**：`tests/share.test.mjs` 新增恶意翻译文案用例，确认 `<img>` / `<script>` 只作为文本显示，不创建 HTML 节点。
- **📊 实际收益**：消除二维码弹窗 i18n 文案的属性注入和 HTML 注入维护风险。
- **🔗 相关建议**：[S-01](#s-01)

---

## 📌 S-03: `feedback.js` 中 Web3Forms Access Key 硬编码为空字符串

- **📍 位置**：`js/feedback.js:7`
- **📝 当前状况**：`var WEB3FORMS_ACCESS_KEY = "";` 是空字符串，意味着反馈仅保存在 localStorage 中，不会发送到服务端。这是安全的设计选择（避免在前端暴露 API key），但代码注释提到"Set a key only if you explicitly accept public client-side form submission"。
- **⚠️ 影响程度**：低（当前行为正确）
- **💡 建议方案**：如果未来需要启用在线反馈收集，建议：
  1. 不要在前端硬编码 access key
  2. 通过 Cloudflare Workers / Vercel Edge Functions 作为代理，将 key 存储在服务端环境变量中
  3. 或使用 GitHub Discussions / Issues API（已有 Giscus 集成）

- **📊 预期收益**：明确安全边界，为未来扩展提供指导
- **🔗 相关建议**：[F-01 新功能](new-features.md#f-01)

---

## 📌 S-04: `giscus.js` 硬编码 GitHub 仓库 ID 和 Category ID

- **📍 位置**：`js/giscus.js:16-24`
- **📝 当前状况**：
  ```javascript
  repo: "wenliang844/wenliang844.github.io",
  repoId: "MDEwOlJlcG9zaXRvcnkzNTQyNDE4MDY=",
  categoryId: "DIC_kwDOFR1NDs4C_PFL",
  ```
  这些是公开的 GitHub 仓库元数据，不是敏感信息。Giscus 设计就是在前端配置这些值。
- **⚠️ 影响程度**：无（设计如此）
- **💡 建议方案**：无需修改。但建议在注释中说明这些值的来源（giscus.app 配置页面），方便未来维护。
- **📊 预期收益**：提升代码可维护性
- **🔗 相关建议**：无

---

## 📌 S-05 [已修复]: 缺少 Content Security Policy (CSP) 头

- **📍 位置**：所有 HTML 页面、`src/templates/layout.mjs`
- **✅ 修复状态**：模板生成页和手写 HTML 页面已统一添加 `<meta http-equiv="Content-Security-Policy">`。
- **🧪 回归测试**：`tests/security-extended.test.mjs` 新增全站 HTML 扫描，确认每个已提交 HTML 都包含共享 CSP 且保留关键指令。
- **⚠️ 原影响程度**：中
- **🛡️ 当前策略**：
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://giscus.app; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src https://giscus.app; form-action 'self' https://buttondown.com https://api.web3forms.com">
  ```
  说明：`connect-src` 保留 `https:` 以兼容 AI 助手用户自定义 HTTPS API 端点；`style-src 'unsafe-inline'` 用于兼容现有运行时样式属性。`frame-ancestors` 不能通过 meta CSP 生效，未来若迁移到可配置 HTTP header 的托管平台，可在响应头中补充。

- **📊 实际收益**：限制默认资源加载来源，禁止插件对象加载，约束 giscus iframe 和表单提交目标，降低 XSS 后续扩展面。
- **🔗 相关建议**：[S-01](#s-01), [TD-02](tech-debt.md#td-02)

---

## 📌 S-06: 第三方脚本缺少 Subresource Integrity (SRI) 校验

- **📍 位置**：`js/search.js:234`（Fuse.js）、`js/giscus.js:61`（giscus.app/client.js）
- **📝 当前状况**：动态加载的 Fuse.js 和 Giscus 脚本都没有 SRI 校验。如果 CDN 被篡改，可能注入恶意代码。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  - Fuse.js：自托管到 `/js/vendor/fuse.min.js`（已存在），无需 SRI
  - Giscus：由于是动态创建的 script 元素，可以添加 `integrity` 属性：
  ```javascript
  script.integrity = "sha384-<hash>";
  script.crossOrigin = "anonymous";
  ```
  但 Giscus 脚本会频繁更新，SRI hash 需要同步更新，维护成本较高。建议接受当前风险，因为 Giscus 是可信来源。

- **📊 预期收益**：防御供应链攻击
- **🔗 相关建议**：[S-05](#s-05)

---

## 📌 S-07: `subscribe.js` 中 Buttondown 端点 URL 硬编码

- **📍 位置**：`js/subscribe.js:13-14`
- **📝 当前状况**：
  ```javascript
  const BUTTONDOWN_USERNAME = "cwl";
  const ENDPOINT = "https://buttondown.com/api/emails/embed-subscribe/";
  ```
  用户名 "cwl" 和端点 URL 硬编码在前端代码中。这是 Buttondown embed 的标准用法，不是安全漏洞。
- **⚠️ 影响程度**：无
- **💡 建议方案**：无需修改。但建议添加注释说明：此端点仅接受订阅请求，不暴露用户数据。
- **📊 预期收益**：代码文档化
- **🔗 相关建议**：[B-08](bugs-and-risks.md#b-08)

---

## 📌 S-08: localStorage 中存储反馈数据无加密

- **📍 位置**：`js/feedback.js:26-42`
- **📝 当前状况**：用户反馈（包括姓名、联系方式、留言内容）以明文 JSON 存储在 localStorage 中。任何能访问该浏览器的脚本或扩展都可以读取这些数据。
- **⚠️ 影响程度**：低（这是本地浏览器数据，同源策略已提供基本保护）
- **💡 建议方案**：
  1. 当前设计合理——数据不离开用户浏览器
  2. 在 UI 中明确告知"数据仅存储在当前浏览器"
  3. 如果未来添加服务端存储，需要考虑传输加密和数据脱敏

- **📊 预期收益**：用户隐私保护意识提升
- **🔗 相关建议**：[S-03](#s-03)

---

## 📌 S-09 [已修复]: 搜索索引 (`search-index.json`) 暴露文章正文摘要

- **📍 原位置**：`scripts/build.mjs:329-347`
- **✅ 修复状态**：`scripts/validate-posts.mjs` 已增加公开内容标记扫描，发现 `TODO`、`FIXME`、`HACK`、`XXX`、`SECRET`、`PASSWORD`、`PRIVATE_KEY`、`API_KEY`、`TOKEN` 时阻断文章校验。
- **🧪 回归测试**：`tests/validate-posts.test.mjs` 新增临时文章敏感标记用例，确认 `validate:posts` 会报告文件与行号。
- **📝 原状况**：搜索索引包含每篇文章的前 600 字纯文本（`stripHtml(p.contentHtml).slice(0, 600)`）。这是公开博客内容，不是安全问题，但需要注意：
  - 如果文章中包含内部笔记、TODO 或敏感注释，会被索引
  - 索引文件是公开可访问的 JSON
- **⚠️ 影响程度**：低
- **💡 建议方案**：确保 `src/posts/*.md` 中不包含不应公开的内容。可以在构建流程中添加检查：
  ```bash
  grep -rn "TODO\|FIXME\|HACK\|XXX\|SECRET" src/posts/
  ```
- **📊 实际收益**：敏感标记和内部笔记在生成搜索索引前被本地/CI 质量门禁拦截。
- **🔗 相关建议**：无

---

## 📌 S-10 [已修复]: `tools-core.js` 中 JWT 解码不校验签名

- **📍 原位置**：`js/tools-core.js:147-166`
- **✅ 修复状态**：`src/templates/tools.mjs` 已在 JWT 输出区旁增加常驻醒目警示，说明解码内容未经签名验证，不可用于安全决策；`js/tools.js` 的成功状态文案也同步强化。
- **🧪 回归测试**：`tests/tools.test.mjs` 覆盖 JWT 警示文案、英文切换和成功状态文案，`tests/performance.test.mjs` 继续约束 CSS 体积预算。
- **📝 原状况**：JWT 解码工具只解析 header 和 payload，不验证签名。UI 中已标注"本工具不校验签名"。这是正确的设计——纯前端工具无法安全地校验签名（需要密钥），但需要确保用户理解这一点。
- **⚠️ 影响程度**：无（设计如此）
- **📊 实际收益**：防止用户把本地解码结果误认为已验证结果，降低将未验证 JWT 内容用于权限或安全判断的误用风险。
- **🔗 相关建议**：[UX-02](ux-improvements.md#ux-02)

---

## 安全审计总结

| 类别 | 状态 | 说明 |
|------|------|------|
| XSS 防护 | ✅ 良好 | 所有用户输入都经过转义处理 |
| innerHTML 使用 | ✅ 安全 | 用户输入和 i18n 文案均避免直接 HTML 注入 |
| 第三方依赖 | ✅ 最小化 | 仅 Fuse.js、Giscus、Buttondown、QRCode |
| API Key 暴露 | ✅ 已修复 | 前端不再内置 demo key（S-00） |
| CSP 策略 | ⚠️ 缺失 | 建议添加 |
| SRI 校验 | ⚠️ 缺失 | Giscus 脚本无 SRI |
| 废弃 API | 🟢 低 | `pageYOffset`、`performance.timing` 与旧式集合转换已替换，剩余为剪贴板兼容 fallback |

> 整体评估：安全状况良好，当前无已知高危漏洞。主要改进方向是防御性措施（CSP、SRI）和代码规范（innerHTML 使用标准）。
