# 🔒 安全审计报告

> 分析日期：2026-06-18 | 分析范围：全站前端代码、构建脚本、第三方依赖

---

## 2026-07-03 复查补充

> 复查时间：2026-07-03 22:40 +08:00 | 验证方式：`npm run check:readonly`、`npm run validate:production`、`npm audit --omit=dev --json`、`npm run test:coverage`、本地 HTTP 冒烟访问

### 📌 S-11: `assistant.js` 仍在前端运行时拼接并使用默认体验 API Key

- **📍 位置**：`js/assistant.js:39-63`, `js/assistant.js:328-333`, `js/assistant.js:1439-1510`, `tests/assistant.test.mjs:401-433`, `tests/assistant.test.mjs:464-497`
- **📝 当前状况描述**：当前源码中仍存在 `OPENAI_DEFAULT_API_KEY` 与 `LLM_EXPERIENCE_KEYS`，通过数组片段 `.join("")` 在运行时还原默认 key。`withEffectiveApiKey()` 在用户未填写 key 且 endpoint 为默认 preset 时自动注入该 key，测试也断言“uses the OpenAI experience key without showing or storing it”。这与本文件 S-00 中“已移除前端 demo key”的旧结论不一致。文档中不写出完整 key，但风险已经可以从源码行为确认。
- **⚠️ 影响程度**：高
- **💡 建议方案**：
  ```javascript
  // 前端只保留空 key；默认体验必须走服务端代理
  const LLM_EXPERIENCE_KEYS = Object.freeze({});

  function withEffectiveApiKey(config) {
    return { ...config, apiKey: String(config.apiKey || "").trim() };
  }
  ```
  同时把测试从“不可出现连续 key 字面量”改为“源码不得存在 `LLM_EXPERIENCE_KEYS`、`OPENAI_DEFAULT_API_KEY`、拼接 key，以及默认 key 请求断言”。
- **📊 预期收益**：消除前端 key 被提取、滥用和产生费用的高危风险，避免测试对“隐藏但仍可还原”的错误安全模型背书。
- **🔗 相关建议引用**：[S-00](#s-00-已修复-assistantjs-硬编码-demo-api-key-泄露), [CQ-12](code-quality.md#cq-12-安全回归测试只检查连续-key-字面量无法识别拼接型密钥)

### 📌 S-12: Mini API Tester 会把 Authorization 头和请求体持久化到 localStorage

- **📍 位置**：`src/templates/tools.mjs:123-170`, `js/tools.js:461-529`, `js/tools.js:584-643`, `js/tools.js:686-692`
- **📝 当前状况描述**：API 测试器的 placeholder 引导用户填写 `Authorization: Bearer YOUR_API_KEY`，`currentApiRequest()` 会读取完整 `headers` 和 `body`，`saveApiRequest()` 直接写入 `localStorage` 的 `cwl.tools.apiHistory`。发送成功后 `sendApiRequest()` 还会自动调用 `saveApiRequest()`。真实 token、cookie、body 中的密钥或个人数据可能长期留在浏览器本地历史。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const SECRET_HEADER = /^(authorization|cookie|x-api-key|api-key)$/i;

  function redactHeaders(raw) {
    return raw.split(/\r?\n/).map((line) => {
      const [name] = line.split(":");
      return SECRET_HEADER.test(name.trim()) ? `${name}: <redacted>` : line;
    }).join("\n");
  }
  ```
  UI 层建议把“保存请求”和“发送后自动保存”拆开：默认不保存敏感 header，保存前给出明确提示，并提供“清除全部历史”后的成功状态。
- **📊 预期收益**：降低本机浏览器、共享电脑、恶意扩展读取 API 凭据的风险，同时保留 API Tester 的便利性。
- **🔗 相关建议引用**：[S-08](#s-08-localstorage-中存储反馈数据无加密), [F-11](new-features.md#f-11-为-api-tester-增加隐私模式和敏感信息脱敏保存)

### 📌 S-13: 手势工具运行时加载 CDN 机器视觉脚本和模型，缺少完整供应链约束

- **📍 位置**：`js/gesture.js:160-167`, `js/gesture.js:213-216`, `js/gesture.js:223-229`, `js/gesture.js:258-265`, `src/templates/layout.mjs:39-50`, `src/templates/tools.mjs:865-868`
- **📝 当前状况描述**：手势工具运行时从 `cdn.jsdelivr.net`、`storage.googleapis.com` 加载 MediaPipe、face-api、Three.js、WASM 和模型文件；CSP 也为工具页放开了 `script-src https://cdn.jsdelivr.net`、`connect-src https:` 与 `wasm-unsafe-eval`。虽然摄像头帧处理在浏览器端执行，但第三方脚本一旦被供应链污染，就具备读取页面状态和摄像头处理数据的能力。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  /js/vendor/mediapipe/vision_bundle.mjs
  /js/vendor/mediapipe/wasm/*
  /models/hand_landmarker.task
  /models/efficientdet_lite0.tflite
  /js/vendor/three.module.js
  ```
  将关键运行时和模型自托管、记录版本与 hash；如果继续使用 CDN，至少在 UI 中说明外部模型来源，并把 CSP 从全站宽泛 `connect-src https:` 收敛到必要域名。
- **📊 预期收益**：减少第三方供应链风险，提升摄像头功能的隐私可信度，并让离线/弱网体验更可控。
- **🔗 相关建议引用**：[S-06](#s-06-第三方脚本缺少-subresource-integrity-sri-校验), [P-14](performance-bottlenecks.md#p-14-手势工具首次启动依赖远程模型链路弱网下冷启动不可控)

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
