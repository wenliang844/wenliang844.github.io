# 隐私与信任中心专题分析

生成时间：2026-07-03

分析范围：公开导航与页脚、搜索索引、订阅/反馈/评论/AI 助手/工具箱信任文案、CSP 与第三方资源声明、工程安全文档。

本轮验证：

- `node --test tests/css.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/performance.test.mjs tests/build.test.mjs tests/workflows.test.mjs`：111/111 通过。
- `npm run test:coverage`：789/789 通过，line 96.76% / branch 83.95% / funcs 96.30%。
- `npm run test:http-smoke`：6/6 路由通过，新增覆盖 `/trust/`。
- `npm run test:browser-smoke`：通过，新增桌面与移动端 `/trust/`，并覆盖 `/tools/` Canvas/Clipboard/手势确认门闩交互。
- `npm run validate:production`：34/34 通过；`git diff --check` 通过，仅 CRLF 工作区提示。

## 总览

项目的实际安全姿态已经比普通个人博客更复杂：有本地 AI 助手、API Tester、Markdown 与简历编辑器、Buttondown 订阅、Giscus 评论、Web3Forms 可选反馈提交、CSP、第三方资源提示和本地数据保留策略。工程侧已经记录了 `docs/SECURITY.md`、`docs/DEPLOYMENT.md` 以及大量建议文档，局部 UI 也已经加入了不少好提示。

本轮已修复用户视角的核心缺口：新增公开 `/trust/` 页面，并从导航、页脚、站内搜索、sitemap、robots、HTTP smoke 和 browser smoke 中接入。页面将本机数据、第三方服务、用户控制和安全摘要集中展示，信息来源由 `src/trust-data.mjs` 数据清单渲染，避免信任说明继续散落在脚本注释和工程文档里。

严重程度分布：

- 高：0
- 中：4
- 低：2

## 建议清单

### 📌 MR-TRUST-01 [已修复]：新增公开 Trust Center / Privacy 页面，并纳入导航、页脚和站内搜索

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:21-34`
- `src/config.mjs:38-116`
- `src/templates/layout.mjs:90-100`
- `src/templates/layout.mjs:256-268`
- `README.md:7-8`
- `docs/SECURITY.md:31-71`

✅ 修复状态

已新增 `src/trust-data.mjs` 和 `src/templates/trust.mjs`，构建生成 `trust/index.html`；`src/config.mjs` 将 `/trust/` 纳入 `STATIC_PAGES`、`SEARCH_PAGES`；`src/templates/layout.mjs` 将入口加入“更多”导航和页脚链接；`scripts/build.mjs` 将页面写入构建产物，并同步 `sitemap.xml`、`robots.txt`、`search-index.json`。新增回归测试覆盖模板渲染、第三方服务清单、静态页/搜索配置、CSS 选择器、构建产物和 smoke 路由。

📝 原状况描述

`STATIC_PAGES` 和 `SEARCH_PAGES` 中没有隐私、信任或安全说明页面；公共导航包含博客、AI、工具箱、留言反馈、订阅、赞助等入口，但没有“隐私/数据/安全”入口。仓库 README 能链接到 `docs/SECURITY.md`，但这是面向开发者或维护者的工程文档，不是访问者会自然打开的站点页面。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

新增 `/trust/` 或 `/privacy/` 页面，标题可以是“隐私与信任”。页面内容保持短、可操作，避免法律化长文；重点说明本站数据流和用户控制方式。

```js
// src/config.mjs
STATIC_PAGES.push({ path: "/trust/", withDate: true, priority: "0.5" });

SEARCH_PAGES.push({
  title: "隐私与信任",
  summary: "本站本机数据、第三方服务、AI 助手、工具箱和反馈/订阅的数据说明。",
  path: "/trust/",
  tags: ["隐私", "信任", "数据", "安全", "第三方服务"],
  i18n: {
    en: {
      title: "Privacy & Trust",
      summary: "How local data, third-party services, AI assistant and tools behave on this site.",
      tags: ["Privacy", "Trust", "Security", "Data"]
    }
  }
});
```

页面建议包含：

- 本机保存的数据：AI 助手历史、API Tester 历史、反馈、草稿、简历模板、阅读进度。
- 外发请求：Buttondown、Giscus、Web3Forms、用户主动填写的 API URL、AI 助手用户配置的中转站。
- 用户控制：清空对话、清空 API 历史、删除反馈、清除本机数据、关闭隐私模式。
- 安全策略：CSP、无内置 API key、客户端 secret 不可保密、如何报告问题。

📊 实际收益

- 让访问者在使用 AI 助手、API Tester、评论和订阅前有统一预期。
- 把已有安全工程成果转化为用户可见信任信号。
- 给后续本地数据清理入口、服务状态和安全联系方式留下承载页。

🔗 相关建议引用

- `docs/suggestions/competitive-analysis.md` 中的 `COMP-11`
- `docs/suggestions/module-reviews/local-data-retention-map.md`
- `docs/suggestions/module-reviews/user-data-entrypoints.md`

### 📌 MR-TRUST-02 [已部分落地]：第三方服务与 CSP 放行域名缺少用户可读的数据流清单

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:30-51`
- `src/templates/layout.mjs:230-264`
- `js/subscribe.js:1-13`
- `js/giscus.js:3-23`
- `js/giscus.js:79-95`
- `js/feedback.js:1-10`

✅ 落地状态

`src/trust-data.mjs` 已新增 `THIRD_PARTY_SERVICES` 清单，并在 `/trust/` 页面渲染 Buttondown、Giscus/GitHub Discussions、Web3Forms、手势工具远程运行时资源、赞助跳转等数据流。每项包含 host、用途、触发时机、数据类别和用户控制。后续仍可把 CSP/resource hints 逐步从同一份 manifest 推导。

📝 原状况描述

公共模板会输出 Giscus、Buttondown、爱发电和 PayPal 的资源提示，并在 CSP 中放行 `giscus.app`、`buttondown.com`、`api.web3forms.com` 等域名。脚本注释解释了 Buttondown、Giscus 和 Web3Forms 的作用，但访问者看不到这些注释。工具箱手势面板已经能说明“第三方 CDN 下载模型”，但站点级第三方服务没有一张统一表。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

建立面向用户和测试共用的第三方服务 manifest，Trust Center 直接渲染它；CSP 和 resource hints 后续也可以逐步从这份 manifest 推导。

```js
const THIRD_PARTY_SERVICES = [
  {
    host: "buttondown.com",
    purpose: "邮件订阅",
    trigger: "提交订阅邮箱",
    data: ["email"],
    userControl: "通过确认邮件或退订链接管理"
  },
  {
    host: "giscus.app",
    purpose: "文章评论",
    trigger: "进入评论区或点击加载评论",
    data: ["GitHub 登录态", "评论内容"],
    userControl: "由 GitHub Discussions 托管"
  },
  {
    host: "api.web3forms.com",
    purpose: "可选在线反馈提交",
    trigger: "站长配置 key 后提交反馈",
    data: ["name", "contact", "message"]
  }
];
```

📊 实际收益

- 把 CSP 允许的外部域名从“浏览器策略细节”转成用户能理解的数据流。
- 新增第三方服务时必须说明目的、触发时机、数据类别和用户控制方式。
- 后续可以继续收敛 resource hints，避免普通页面无条件预热低概率第三方连接。

🔗 相关建议引用

- `docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`
- `docs/suggestions/module-reviews/dependency-supply-chain-posture.md`
- `docs/suggestions/security-audit.md`

### 📌 MR-TRUST-03：订阅表单没有就近说明 Buttondown 托管、确认邮件和前端不可观测结果

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:256-264`
- `js/subscribe.js:1-13`
- `js/subscribe.js:24-51`
- `js/subscribe.js:100-118`
- `js/i18n.js:83-91`

📝 当前状况描述

订阅逻辑注释明确写着“存储 / 发送 / 退订 / 双重确认全部由 Buttondown 托管”，并通过 `mode: "no-cors"` 提交到 Buttondown embed 端点。由于 opaque response 不可读，前端只能在请求未抛异常时显示“差一步！请查收确认邮件完成订阅。”。页脚和弹窗 UI 没有明确告诉用户：邮箱会提交给 Buttondown、必须通过确认邮件完成、退订由邮件链接管理、前端无法确认最终订阅状态。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

在订阅表单附近增加短说明，并把成功文案从“成功感”改成“提交请求 + 以确认邮件为准”。不需要大段文字，一行就够。

```html
<p class="subscribe-note" data-i18n="subscribe.note">
  邮箱将提交给 Buttondown 托管；是否订阅成功以确认邮件为准，可随时在邮件中退订。
</p>
```

```js
setStatus(t(
  "subscribe.submittedOpaque",
  "已提交订阅请求，请以 Buttondown 确认邮件为准。"
));
```

📊 预期收益

- 用户知道邮箱会交给谁处理，减少“站点自己保存邮箱”的误解。
- 将 `no-cors` 的技术限制转化为真实、准确的用户预期。
- 与后续 Trust Center 的第三方服务表保持一致。

🔗 相关建议引用

- `docs/suggestions/module-reviews/user-data-entrypoints.md` 中的 `MR-DATA-01`
- `docs/suggestions/bugs-and-risks.md`
- `docs/suggestions/ux-improvements.md`

### 📌 MR-TRUST-04：评论区加载 Giscus 前缺少就近第三方说明和可操作降级

📍 位置（文件路径 + 行号范围）

- `src/templates/post.mjs:254-263`
- `src/templates/post.mjs:402-418`
- `js/giscus.js:3-23`
- `js/giscus.js:79-95`
- `js/giscus.js:125-136`
- `post/rule-engine-alerts/index.html:231-233`

📝 当前状况描述

文章页和聚合页都会渲染评论区并加载 `/js/giscus.js`，脚本会注入 `https://giscus.app/client.js`。Giscus 是合理选择，但评论区目前只显示“评论”，没有就近说明“由 GitHub Discussions / Giscus 托管，可能需要 GitHub 登录”。已配置时也缺少加载失败、网络拦截或第三方不可用时的可操作降级，例如跳转联系页或打开 GitHub Discussions。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

在评论区加入一个轻量说明，并考虑显式加载按钮或 IntersectionObserver 懒加载。加载失败时展示替代路径。

```html
<p class="comments-note">
  评论由 Giscus / GitHub Discussions 托管。加载评论会连接 giscus.app，并可能需要 GitHub 登录。
</p>
<button type="button" data-load-comments>加载评论</button>
```

```js
function showGiscusFallback(reason) {
  thread.replaceChildren(
    textNotice("评论暂时无法加载。你也可以前往联系页留言，或稍后重试。")
  );
  window.CWLLogger && window.CWLLogger.warn("giscus-load-failed", { reason });
}
```

📊 预期收益

- 在第三方评论加载前给用户知情选择，提升隐私透明度。
- 网络屏蔽、浏览器扩展拦截或 Giscus 异常时不再表现为空白。
- 与站内“本地处理”和“第三方托管”边界保持一致。

🔗 相关建议引用

- `docs/suggestions/module-reviews/social-comments-integrations.md`
- `docs/suggestions/full-browser-audit-2026-07-03.md`
- `docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`

### 📌 MR-TRUST-05：工程安全文档完整，但缺少面向普通访问者的安全摘要

📍 位置（文件路径 + 行号范围）

- `README.md:7-8`
- `docs/SECURITY.md:31-71`
- `docs/DEPLOYMENT.md:396-397`
- `src/config.mjs:38-116`

📝 当前状况描述

仓库已经有 `docs/SECURITY.md`、`docs/DEPLOYMENT.md` 和质量报告，说明 CSP、Web3Forms key、Giscus 配置等工程信息。问题是它们位于仓库文档内，语气和内容更适合维护者；公开站点搜索索引也没有收录“安全说明/隐私说明”。访问者不会因为要发表评论或订阅而去 GitHub 仓库里找 `SECURITY.md`。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

在 Trust Center 中加入“安全摘要”而不是直接搬运工程文档，保留到 GitHub 文档的链接用于深入阅读。

```md
## 安全摘要

- 本站是静态站点，默认不运行自有后端。
- 评论由 Giscus / GitHub Discussions 托管。
- 订阅由 Buttondown 托管。
- AI 助手默认本地规则模式；大模型模式只请求你配置的中转站。
- 前端代码不应包含私密 API key；如发现安全问题，请通过联系页反馈。
```

📊 预期收益

- 把维护者文档转化成用户能理解的承诺和边界。
- 降低安全信息藏在仓库深处的发现成本。
- 给搜索引擎和站内搜索提供“隐私/安全/数据”相关入口。

🔗 相关建议引用

- `docs/SECURITY.md`
- `docs/suggestions/module-reviews/content-freshness-and-trust-signals.md`
- `docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`

### 📌 MR-TRUST-06 [已修复]：缺少信任信息的回归测试契约

📍 位置（文件路径 + 行号范围）

- `tests/templates.test.mjs:18-61`
- `tests/templates.test.mjs:63-78`
- `tests/security-extended.test.mjs:18-80`
- `tests/links.test.mjs:1-90`

✅ 修复状态

已新增/扩展 `tests/templates-extended.test.mjs`、`tests/css.test.mjs`、`tests/build.test.mjs`、`tests/templates.test.mjs` 和 `tests/workflows.test.mjs`，约束 `/trust/` 必须在静态页、站内搜索、导航、页脚、构建产物、sitemap、robots、HTTP smoke、browser smoke 中可发现；同时锁定 `THIRD_PARTY_SERVICES` 的渲染和 CSS 移动端栅格降级。

📝 原状况描述

现有测试已经覆盖模板转义、CSP 存在、工具页 `connect-src` 放宽、手势第三方资源确认、链接可用性、无 inline event handler、无 `javascript:` URL 等关键安全约束。本轮信任页建议目前还只是文档建议，没有测试要求“公开页面必须包含 Trust Center 入口”“第三方服务必须登记”“本机数据说明必须可搜索”。如果未来新增一个外部服务或本地存储 key，测试不会提醒同步用户可见说明。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

在实现 Trust Center 后补三类测试：路由/搜索索引、页脚入口、第三方服务清单。这样信任信息不会成为一次性页面。

```js
test("privacy trust page is discoverable", () => {
  assert.ok(STATIC_PAGES.some(page => page.path === "/trust/"));
  assert.ok(SEARCH_PAGES.some(page => page.path === "/trust/"));
  assert.match(renderPage({ main: "<main></main>" }), /href="\/trust\/"/);
});

test("third party services are declared", () => {
  const hosts = THIRD_PARTY_SERVICES.map(service => service.host);
  assert.ok(hosts.includes("buttondown.com"));
  assert.ok(hosts.includes("giscus.app"));
});
```

📊 预期收益

- 把用户信任信息纳入工程质量门槛。
- 新增第三方或本地数据能力时自动提醒补文案。
- 避免 Trust Center 随功能演进而过期。

🔗 相关建议引用

- `docs/suggestions/module-reviews/test-coverage-risk-map.md`
- `docs/suggestions/devex-improvements.md`
- `docs/suggestions/module-reviews/local-data-retention-map.md`

## 下一步优先级

1. 中优先级：优化订阅和评论区就近文案，明确 Buttondown 与 Giscus 的托管边界。
2. 中优先级：将 `THIRD_PARTY_SERVICES` 继续连接到 CSP/resource hints 检查，减少清单与策略漂移。
3. 低优先级：把 `docs/SECURITY.md` 的关键点进一步改写成访问者可读摘要并从 `/trust/` 链出。
4. 低优先级：为本机数据清理增加统一入口或“清理指南”锚点。
