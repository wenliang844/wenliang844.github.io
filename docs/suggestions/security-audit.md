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
  | `search.js` | 330 | `highlightText()` 输出 | ✅ 经 `escapeHtml` 处理 |
  | `search.js` | 349 | `snippet()` 输出 | ✅ 经 `escapeHtml` 处理 |
  | `search.js` | 340 | `highlightText(tag)` | ✅ 经 `escapeHtml` 处理 |
  | `coder.js` | 203 | 复制按钮 i18n 文本 | ✅ 硬编码 + Font Awesome 图标 |
  | `coder.js` | 299 | TOC 切换按钮 | ✅ 硬编码 |
  | `giscus.js` | 33 | `placeholder()` | ⚠️ 含 i18n 返回值，当前安全 |
  | `giscus.js` | 44 | 语言切换重渲染 | ⚠️ 同上 |
  | `share.js` | 94-99 | 复制成功反馈 | ✅ 使用预定义 SVG |
  | `share.js` | 136-142 | 二维码弹窗 | ⚠️ 含 i18n 文本拼接 |
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
- **🔗 相关建议**：[B-03](bugs-and-risks.md#b-03), [B-04](bugs-and-risks.md#b-04)

---

## 📌 S-02: `share.js` 二维码弹窗中 `t()` 返回值直接拼接 HTML 字符串

- **📍 位置**：`js/share.js:136-142`
- **📝 当前状况**：
  ```javascript
  '<button class="share-qr-close" type="button" aria-label="' + t("post.qr.close", "关闭") + '">' +
  ```
  `t()` 的返回值被直接拼接进 HTML 属性和文本节点。如果 i18n 翻译文案中包含 `"` 或 HTML 标签，可能破坏 DOM 结构。
- **⚠️ 影响程度**：低（当前翻译文案均为硬编码安全文本）
- **💡 建议方案**：使用 `escapeAttr()` 对 `t()` 返回值进行转义后再拼接：
  ```javascript
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  'aria-label="' + escapeAttr(t("post.qr.close", "关闭")) + '"'
  ```
  或改用 DOM API 构建弹窗。
- **📊 预期收益**：消除属性注入风险
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

## 📌 S-05: 缺少 Content Security Policy (CSP) 头

- **📍 位置**：所有 HTML 页面
- **📝 当前状况**：站点没有设置 CSP 响应头。对于 GitHub Pages 托管的静态站点，无法在服务器层面设置 HTTP 头，但可以通过 `<meta http-equiv="Content-Security-Policy">` 标签实现。
- **⚠️ 影响程度**：中
- **💡 建议方案**：在 `<head>` 中添加 CSP meta 标签：
  ```html
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://giscus.app https://buttondown.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data:;
    connect-src 'self' https://buttondown.com https://api.web3forms.com;
    frame-src https://giscus.app;
    font-src 'self';
  ">
  ```
  注意：当前内联脚本（主题切换、错误处理样式）需要 `'unsafe-inline'`，长期应迁移到外部文件或 nonce 机制。

- **📊 预期收益**：防御 XSS 注入，限制外部资源加载
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

## 📌 S-09: 搜索索引 (`search-index.json`) 暴露文章正文摘要

- **📍 位置**：`scripts/build.mjs:329-347`
- **📝 当前状况**：搜索索引包含每篇文章的前 600 字纯文本（`stripHtml(p.contentHtml).slice(0, 600)`）。这是公开博客内容，不是安全问题，但需要注意：
  - 如果文章中包含内部笔记、TODO 或敏感注释，会被索引
  - 索引文件是公开可访问的 JSON
- **⚠️ 影响程度**：低
- **💡 建议方案**：确保 `src/posts/*.md` 中不包含不应公开的内容。可以在构建流程中添加检查：
  ```bash
  grep -rn "TODO\|FIXME\|HACK\|XXX\|SECRET" src/posts/
  ```
- **📊 预期收益**：防止意外泄露内部信息
- **🔗 相关建议**：无

---

## 📌 S-10: `tools-core.js` 中 JWT 解码不校验签名

- **📍 位置**：`js/tools-core.js:147-166`
- **📝 当前状况**：JWT 解码工具只解析 header 和 payload，不验证签名。UI 中已标注"本工具不校验签名"。这是正确的设计——纯前端工具无法安全地校验签名（需要密钥），但需要确保用户理解这一点。
- **⚠️ 影响程度**：无（设计如此）
- **💡 建议方案**：在 JWT 解码结果旁添加醒目提示："⚠️ 以下内容未经签名验证，不可用于安全决策"。
- **📊 预期收益**：防止用户误解解码结果的可信度
- **🔗 相关建议**：[UX-02](ux-improvements.md#ux-02)

---

## 安全审计总结

| 类别 | 状态 | 说明 |
|------|------|------|
| XSS 防护 | ✅ 良好 | 所有用户输入都经过转义处理 |
| innerHTML 使用 | ✅ 安全 | 均用于硬编码或转义后的内容 |
| 第三方依赖 | ✅ 最小化 | 仅 Fuse.js、Giscus、Buttondown、QRCode |
| API Key 暴露 | ✅ 已修复 | 前端不再内置 demo key（S-00） |
| CSP 策略 | ⚠️ 缺失 | 建议添加 |
| SRI 校验 | ⚠️ 缺失 | Giscus 脚本无 SRI |
| 废弃 API | 🟢 低 | `pageYOffset` 与 `performance.timing` 已替换，剩余为兼容 fallback 与旧式集合转换 |

> 整体评估：安全状况良好，当前无已知高危漏洞。主要改进方向是防御性措施（CSP、SRI）和代码规范（innerHTML 使用标准）。
