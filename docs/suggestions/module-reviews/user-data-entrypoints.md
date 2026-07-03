# 用户数据入口专题审查

生成时间：2026-07-03

审查范围：

- `contact/index.html`
- `js/feedback.js`
- `js/subscribe.js`
- `js/share.js`
- `js/logger.js`
- `src/templates/layout.mjs`
- `tests/feedback.test.mjs`
- `tests/subscribe-deep.test.mjs`
- `tests/share-subscribe-feedback-deep.test.mjs`

本轮只做只读分析与文档写入，未修改任何站点代码或配置。整体观察：反馈表单已经使用 DOM API 渲染用户输入，避免了直接 `innerHTML` 注入；订阅与反馈都有基础状态提示；分享二维码本地生成，不依赖外部二维码服务。以下建议集中在数据语义、隐私边界、可访问性和未来启用日志后的防线。

验证记录：`node --test tests/feedback.test.mjs tests/subscribe.test.mjs tests/subscribe-deep.test.mjs tests/share.test.mjs tests/share-subscribe-feedback-deep.test.mjs tests/logger-behavior.test.mjs` 通过，75 项测试全部成功。

## 📌 MR-DATA-01：Buttondown `no-cors` 提交无法判断真实订阅结果

📍 位置（文件路径 + 行号范围）

- `js/subscribe.js:8-14`
- `js/subscribe.js:24-52`
- `tests/share-subscribe-feedback-deep.test.mjs:350-362`

📝 当前状况描述

订阅表单提交到 Buttondown embed 端点，并使用 `mode: "no-cors"`。这种请求在浏览器里会返回 opaque response，前端无法读取状态码或错误响应；只要网络层没有抛异常，代码就会显示“差一步！请查收确认邮件完成订阅。”测试也固定断言当前使用 `no-cors`。如果用户名配置错误、服务端拒收、邮箱已存在或被风控，用户仍可能看到成功提示。

⚠️ 影响程度（高/中/低）

中。不会造成站点崩溃，但会造成订阅转化数据不可验证，用户也无法知道自己是否真的完成了订阅流程。

💡 建议方案（含伪代码或示例片段）

优先使用可观测的提交方式：如果 Buttondown 端点支持 CORS，改为正常 `cors` 并检查 `response.ok`；如果不支持，可提供一个极薄的 serverless relay，或者明确把状态文案改成“已提交请求，请以确认邮件为准”。

```js
async function submitEmail(email) {
  const response = await fetch(ENDPOINT + encodeURIComponent(username), {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error("Subscribe failed: " + response.status);
  }
  setStatus(t("subscribe.success", "请查收确认邮件完成订阅。"));
}
```

如果必须保留 `no-cors`：

```js
setStatus(t(
  "subscribe.submittedOpaque",
  "已提交订阅请求。是否成功请以确认邮件为准。"
));
```

📊 预期收益

- 减少“前端显示成功但实际未订阅”的误导。
- 便于监控订阅失败率和配置错误。
- 给用户更真实的下一步预期。

🔗 相关建议引用

- `devex-improvements.md` 中关于外部服务配置校验的建议。
- `ux-improvements.md` 中关于表单反馈可信度的建议。

## 📌 MR-DATA-02：留言反馈本地存储无数量、长度和保留期限上限

📍 位置（文件路径 + 行号范围）

- `contact/index.html:102-121`
- `js/feedback.js:24-40`
- `js/feedback.js:141-167`
- `tests/feedback.test.mjs:172-212`

📝 当前状况描述

反馈表单会把称呼、联系方式、反馈内容和时间保存到 `localStorage` 的 `wenliang-feedback`。页面文案已经说明“反馈会保存在你当前浏览器中”，这是好的。但当前没有限制单条消息长度、联系方式长度、总条数或保留期限；`localStorage` 写入失败也只静默忽略。用户如果粘贴很长文本或多次提交，可能快速触发浏览器配额问题，且联系方式会长期留在本机。

⚠️ 影响程度（高/中/低）

中。主要影响隐私保留、存储可靠性和弱设备上的页面性能。

💡 建议方案（含伪代码或示例片段）

增加输入长度、条数和保留期限，保存前进行裁剪，读取时清理过期记录。建议将默认策略写在表单附近或隐私说明中。

```js
const MAX_ENTRIES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTACT_LENGTH = 120;
const RETENTION_DAYS = 30;

function normalizeEntry(entry) {
  return {
    ...entry,
    contact: entry.contact.slice(0, MAX_CONTACT_LENGTH),
    message: entry.message.slice(0, MAX_MESSAGE_LENGTH),
  };
}

function save(entries) {
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
  const next = entries
    .filter(entry => Date.parse(entry.time) >= cutoff)
    .slice(0, MAX_ENTRIES)
    .map(normalizeEntry);
  localStorage.setItem(storageKey, JSON.stringify(next));
}
```

📊 预期收益

- 降低本地长期保留联系方式和敏感反馈的隐私风险。
- 避免无限增长导致 `localStorage` 配额失败。
- 为后续接入在线提交保留更清晰的数据边界。

🔗 相关建议引用

- `security-audit.md` 中关于本地存储隐私的建议。
- `module-reviews/assistant-deep-dive.md` 中关于本地会话保留策略的建议。

## 📌 MR-DATA-03：反馈在线提交启用后缺少提交中状态和重复提交保护

📍 位置（文件路径 + 行号范围）

- `js/feedback.js:7-8`
- `js/feedback.js:141-190`

📝 当前状况描述

`WEB3FORMS_ACCESS_KEY` 默认留空，因此当前安全默认值是本地保存。一旦站长填入 key，表单会在本地保存后以 best-effort 方式提交到 Web3Forms。但提交期间按钮不会禁用，也没有“发送中”状态；用户连续点击提交可能产生多条本地记录和多次外部请求。当前也没有区分“本地保存成功但在线发送中”的状态阶段。

⚠️ 影响程度（高/中/低）

低到中。默认未启用外部提交时影响较低；启用后会影响表单可靠性和站长收到的反馈质量。

💡 建议方案（含伪代码或示例片段）

引入 `isSubmitting` 状态和按钮禁用，明确区分本地保存、在线提交中、在线成功和在线失败。

```js
let submitting = false;

async function submitOnline(entry) {
  if (submitting) return;
  submitting = true;
  submitButton.disabled = true;
  setStatus(t("contact.fb.sending", "已保存到本地，正在在线提交..."));
  try {
    const result = await sendToWeb3Forms(entry);
    setStatus(result.success ? t("contact.fb.sent", "已发送给站长。") : t("contact.fb.sendFail", "本地已保存，在线提交失败。"));
  } finally {
    submitting = false;
    submitButton.disabled = false;
  }
}
```

📊 预期收益

- 避免重复提交和重复邮件。
- 用户能理解本地保存与在线发送是两个阶段。
- 外部服务异常时反馈更可解释。

🔗 相关建议引用

- `ux-improvements.md` 中关于异步操作反馈的建议。
- `security-audit.md` 中关于公开客户端表单 key 的建议。

## 📌 MR-DATA-04：分享二维码弹窗和订阅弹窗缺少完整焦点约束

📍 位置（文件路径 + 行号范围）

- `js/share.js:123-183`
- `js/share.js:185-232`
- `js/subscribe.js:100-167`
- `js/subscribe.js:209-220`
- `tests/subscribe-deep.test.mjs:226-243`
- `tests/share-subscribe-feedback-deep.test.mjs:152-183`

📝 当前状况描述

二维码和订阅弹窗都设置了 `role="dialog"` 与 `aria-modal="true"`。订阅弹窗会聚焦输入框并尝试恢复焦点；二维码弹窗支持 Escape 关闭。当前缺口是：没有焦点陷阱，背景页面仍可被 Tab 到；二维码弹窗没有把初始焦点放到关闭按钮或弹窗容器，也没有关闭后恢复触发按钮焦点。测试覆盖了 ARIA 属性、Escape 和部分焦点恢复，但没有覆盖 Tab 循环与背景不可达。

⚠️ 影响程度（高/中/低）

中。主要影响键盘用户和读屏用户，属于可访问性与 UX 风险。

💡 建议方案（含伪代码或示例片段）

实现一个轻量通用 modal helper，负责保存触发元素、设置初始焦点、循环 Tab、关闭时恢复焦点，并在支持时给背景加 `inert`。

```js
function activateModal(modal, initialFocus) {
  const previous = document.activeElement;
  const focusables = () => modal.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])");
  initialFocus.focus();
  function onKeydown(event) {
    if (event.key !== "Tab") return;
    const items = Array.from(focusables());
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", onKeydown);
  return function deactivate() {
    document.removeEventListener("keydown", onKeydown);
    if (previous && previous.focus) previous.focus();
  };
}
```

📊 预期收益

- 弹窗行为更符合 `aria-modal` 语义。
- 键盘用户不会意外跳到背景内容。
- 分享与订阅可以复用同一套焦点管理逻辑。

🔗 相关建议引用

- `ux-improvements.md` 中关于弹窗可访问性的建议。
- `code-quality.md` 中关于交互 helper 复用的建议。

## 📌 MR-DATA-05：前端日志器未来启用前需要脱敏、同意和端点约束

📍 位置（文件路径 + 行号范围）

- `js/logger.js:8-18`
- `js/logger.js:22-40`
- `js/logger.js:67-90`
- `js/logger.js:101-113`

📝 当前状况描述

`CWLLogger` 当前 `enabled: false` 且 `endpoint` 为空，因此默认不会上传。风险在于未来一旦启用，它会把 `url`、`userAgent` 和调用方传入的任意 `data` 批量发送到 endpoint；代码层没有字段 allowlist、敏感字段脱敏、采样、用户同意状态或 endpoint 域名约束。`sendBeacon` 分支也没有检查返回值，上传失败时队列已被清空。

⚠️ 影响程度（高/中/低）

中。当前默认关闭降低了即时风险，但这是典型“启用时才发现缺少隐私设计”的潜在债务。

💡 建议方案（含伪代码或示例片段）

启用前增加隐私网关：只有用户同意且 endpoint 在 allowlist 内才上传；日志数据进入队列前做脱敏；`sendBeacon` 失败时保留队列或降级 fetch。

```js
const ALLOWED_ENDPOINTS = ["https://logs.example.com/cwl"];
const REDACT_KEYS = /token|key|secret|password|email|contact/i;

function sanitizeData(data) {
  if (!data || typeof data !== "object") return null;
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    REDACT_KEYS.test(key) ? "[redacted]" : value,
  ]));
}

function canUpload() {
  return Logger.enabled &&
    ALLOWED_ENDPOINTS.includes(Logger.endpoint) &&
    localStorage.getItem("cwl.analytics.consent") === "yes";
}
```

📊 预期收益

- 避免未来启用日志时无意收集邮箱、联系方式、token 或页面敏感参数。
- 上传失败时日志不会静默丢失。
- 更容易向用户解释站点收集什么、不收集什么。

🔗 相关建议引用

- `security-audit.md` 中关于敏感信息与外发请求的建议。
- `devex-improvements.md` 中关于可观测性工程化的建议。

## 📌 MR-DATA-06：普通页面 CSP 的 `connect-src https:` 仍偏宽

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:39-50`
- `contact/index.html:6-6`
- `js/subscribe.js:41-44`
- `js/feedback.js:168-190`

📝 当前状况描述

普通页面默认 CSP 使用 `connect-src 'self' https:`，这允许任意 HTTPS 端点作为 fetch/WebSocket/EventSource 目标。工具页已通过页面级 CSP 单独放宽到 `connect-src 'self' https: http:`，用于支持用户显式允许后的 API Tester 调试目标；但普通文章页、联系页和静态内容页只需要 Buttondown、Web3Forms、Giscus 或站点自身。普通页面继续共享宽 HTTPS 策略，仍会放大 XSS 后的数据外带面。

⚠️ 影响程度（高/中/低）

中。它不是独立漏洞，但会降低 CSP 在 XSS 或供应链异常时的限制效果。

💡 建议方案（含伪代码或示例片段）

改为页面级 CSP：普通内容页使用窄 `connect-src`，工具箱/助手页显式使用宽连接策略，并在代码中把“用户自定义请求”集中到受控模块。

```js
const BASE_CSP = [
  "default-src 'self'",
  "connect-src 'self' https://buttondown.com https://api.web3forms.com https://giscus.app",
];

const TOOL_CSP = [
  ...BASE_CSP.filter(rule => !rule.startsWith("connect-src")),
  "connect-src 'self' https: http:",
];

renderPage({ csp: active === "tools" ? TOOL_CSP : BASE_CSP });
```

📊 预期收益

- 普通页面的外连面显著缩小。
- 工具箱仍保留必要的 API 调试能力。
- CSP 从“全站最宽需求”变成“按页面最小权限”。

🔗 相关建议引用

- `security-audit.md` 中关于 CSP 收敛的建议。
- `architecture-review.md` 中关于页面级配置拆分的建议。
