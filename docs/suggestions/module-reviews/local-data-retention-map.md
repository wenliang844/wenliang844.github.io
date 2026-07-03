# 本地数据留存地图专题分析

生成时间：2026-07-03

分析范围：`js/assistant.js`、`js/tools.js`、`js/feedback.js`、`js/editor.js`、`js/overleaf.js`、`js/coder.js`、`js/i18n.js`、`js/gesture.js`、`js/post-next.js`、`js/utils.js` 以及本地存储相关测试。

本轮验证：

- `node --test tests/assistant.test.mjs tests/tools.test.mjs tests/feedback.test.mjs tests/share-subscribe-feedback-deep.test.mjs tests/utils-deep.test.mjs tests/coder-deep.test.mjs tests/post-next-deep.test.mjs`：172 项测试全部通过。
- 只读扫描 `localStorage` / `sessionStorage` 使用点，未修改任何源码、配置或测试文件。
- 本轮只新增 `/docs/suggestions/module-reviews/local-data-retention-map.md`。

## 总览

项目已经在几个高风险入口上做了实质改进：AI 助手有隐私模式、历史保留期限和清空对话；API Tester 会脱敏敏感 Header，且默认不保存请求体；反馈列表支持逐条删除和清空全部；底层 `CWLUtils.storageGet/storageSet` 能处理浏览器存储异常。

当前剩余风险不是单点失控，而是“全站本地数据治理缺少统一账本”。不同模块各自定义 key、各自决定是否显示失败、是否过期、是否可清除。随着 AI 助手、API Tester、Markdown 编辑器、简历编辑器和阅读进度功能增多，建议把本地存储视为一个产品级隐私面：为每类数据标注敏感等级、保留期限、清理入口和测试契约。

严重程度分布：

- 高：1
- 中：4
- 低：1

## 本地数据清单

| Key / 前缀 | 存储类型 | 主要位置 | 数据类别 | 当前治理状态 |
| --- | --- | --- | --- | --- |
| `cwl.assistant.llmConfig` | `localStorage` | `js/assistant.js:30`, `js/assistant.js:318-365` | API endpoint、model、用户 API key | 明确提示本机保存，但缺少“仅本次会话使用 key”和单独清除 key 入口 |
| `cwl.assistant.conversations` / `cwl.assistant.activeConversation` | `localStorage` | `js/assistant.js:34-37`, `js/assistant.js:1240-1249` | 对话内容、LLM 上下文 | 已有隐私模式、session、7 天、30 天、永久和清空全部 |
| `cwl.assistant.mode` / `opacity` / `privacyMode` / `retention` | `localStorage` | `js/assistant.js:31-37` | 偏好设置 | 低敏偏好，治理基本够用 |
| `cwl.tools.apiHistory` | `localStorage` | `js/tools.js:10`, `js/tools.js:743-756`, `js/tools.js:816-823` | API 请求 URL、Header、可选 Body | Header 已脱敏，Body 默认不保存；URL 查询串仍可能保留 token |
| `wenliang-feedback` | `localStorage` | `js/feedback.js:10`, `js/feedback.js:24-40`, `js/feedback.js:141-162` | 称呼、联系方式、反馈正文 | 有删除和清空全部，但无条数、长度、保留期限和写入失败提示 |
| `wenliang-markdown-editor` | `localStorage` | `js/editor.js:2`, `js/editor.js:160-219` | Markdown 草稿、标题、元信息 | 自动恢复方便，但无保留期限、清除草稿入口和配额反馈 |
| `cwl-overleaf-resume-format` / `cwl-overleaf-resume-source:*` | `localStorage` | `js/overleaf.js:13-15`, `js/overleaf.js:737-900` | 简历正文、教育经历、工作经历 | 可能包含强个人信息，无保留期限、清除入口和保存失败提示 |
| `cwl.reading.*` | `localStorage` | `js/coder.js:184-186`, `js/coder.js:221-230` | 阅读进度、滚动位置 | 14 天后不提示恢复，但旧 key 不主动清理 |
| `coder-color-scheme` / `cwl-lang` | `localStorage` | `js/coder.js:7-57`, `js/i18n.js:783-787` | 主题与语言偏好 | 低敏，风险很低 |
| `gesture-fruit-hs` / `gesture-dance-hs` | `localStorage` | `js/gesture.js:83-129`, `js/gesture.js:1502-1506` | 小游戏最高分 | 低敏，风险很低 |
| `cwl-next-dismissed:*` / `cwl.assistant.dismissed` | `sessionStorage` | `js/post-next.js:19-33`, `js/assistant.js:301-305` | 本次会话关闭状态 | 会话级存储，风险很低 |

## 建议清单

### 📌 MR-LDR-01：建立全站本地数据账本与“清理本站数据”入口

📍 位置（文件路径 + 行号范围）

- `js/assistant.js:30-37`
- `js/tools.js:10`
- `js/feedback.js:10`
- `js/editor.js:2`
- `js/overleaf.js:13-15`
- `js/coder.js:205-230`
- `js/i18n.js:783-787`
- `js/gesture.js:83-129`
- `js/post-next.js:19-33`

📝 当前状况描述

各模块都在本地定义自己的 key。助手、API Tester、反馈模块已经有局部治理，但用户无法在一个地方看到“本站在本机保存了哪些数据、哪些敏感、保留多久、如何删除”。未来新增工具时也缺少一个必须登记的清单，容易继续分散。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

新增一个只描述数据的 manifest，并在隐私页、设置弹窗或工具箱中渲染“本机数据”面板。面板按敏感等级分组，提供导出、单类清除和清理全部本站数据。

```js
const LOCAL_DATA_MANIFEST = [
  {
    id: "assistant-config",
    keys: ["cwl.assistant.llmConfig"],
    label: "AI 助手配置",
    sensitivity: "high",
    retention: "until-cleared",
    clear() {
      localStorage.removeItem("cwl.assistant.llmConfig");
    }
  },
  {
    id: "api-history",
    keys: ["cwl.tools.apiHistory"],
    label: "API Tester 历史",
    sensitivity: "medium",
    retention: "last-20-items"
  }
];

function clearSiteLocalData(scope = "all") {
  LOCAL_DATA_MANIFEST
    .filter(item => scope === "all" || item.id === scope)
    .forEach(item => item.keys.forEach(key => localStorage.removeItem(key)));
}
```

📊 预期收益

- 用户能集中理解和清理本机数据，隐私边界更可信。
- 新增存储 key 时有显式登记点，减少“隐形持久化”。
- 给后续隐私页、信任中心和端到端测试提供稳定数据源。

🔗 相关建议引用

- [S-14](../security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage)
- [S-12](../security-audit.md#s-12-已修复核心风险-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage)
- [用户数据入口专题审查](user-data-entrypoints.md)

### 📌 MR-LDR-02：API Tester 历史保存仍会原样保留 URL 查询串中的敏感参数

📍 位置（文件路径 + 行号范围）

- `js/tools.js:743-756`
- `js/tools.js:816-823`
- `js/tools.js:856-866`
- `tests/tools.test.mjs:1010-1081`

📝 当前状况描述

API Tester 已经对 `Authorization`、`Cookie`、`X-Api-Key` 等 Header 做脱敏，并且只有用户勾选后才保存 Body。这一层改进有效。但 `historyRequest()` 仍直接保存 `request.url`，如果用户测试的是 `https://example.com/api?api_key=...&token=...`、预签名 URL 或带 session 参数的回调地址，敏感值会进入 `cwl.tools.apiHistory`。

⚠️ 影响程度（高/中/低）

高。

💡 建议方案（含伪代码或示例片段）

保存历史前对 URL 查询参数做白名单或敏感名脱敏。发送请求仍使用原始 URL，只影响历史展示与持久化。

```js
const SENSITIVE_QUERY_RE = /^(api[-_]?key|access[-_]?token|token|secret|signature|sig|auth|session)$/i;

function redactSensitiveUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    url.searchParams.forEach((value, key) => {
      if (SENSITIVE_QUERY_RE.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    });
    return url.href;
  } catch (_error) {
    return String(rawUrl || "").replace(
      /([?&](?:api[-_]?key|token|secret|signature|sig|auth|session)=)[^&#]*/gi,
      "$1[redacted]"
    );
  }
}

function historyRequest(request) {
  return {
    method: request.method,
    url: redactSensitiveUrl(request.url),
    headers: sanitizeApiHeaders(request.headers),
    body: checked("api-save-body-history") ? request.body : "",
    savedAt: request.savedAt,
  };
}
```

📊 预期收益

- 延续已完成的 Header/Body 脱敏成果，把 URL 也纳入同一安全边界。
- 降低共享电脑、浏览器扩展或录屏场景下泄露 token 的概率。
- 测试可以明确覆盖“发送原始 URL、保存脱敏 URL”的双轨行为。

🔗 相关建议引用

- [S-12](../security-audit.md#s-12-已修复核心风险-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage)
- [工具箱核心运行时风险复查](tools-core-runtime-safety.md)
- [工具箱手势与 API 测试器](tools-gesture-and-api.md)

### 📌 MR-LDR-03：AI 助手 API key 配置缺少“仅本次会话使用”和单独清除凭据入口

📍 位置（文件路径 + 行号范围）

- `js/assistant.js:318-365`
- `js/assistant.js:1173-1180`
- `js/assistant.js:1535-1543`
- `js/assistant.js:1668-1675`
- `tests/assistant.test.mjs:407-490`
- `tests/assistant.test.mjs:526-550`

📝 当前状况描述

助手已经把默认体验 key 风险移除，并要求用户填写自己的 API key；对话历史也支持隐私模式、保留期限和清空全部。但 `saveConfig()` 会把 `apiKey` 与 endpoint/model 一起写入 `cwl.assistant.llmConfig`。隐私模式和 session 保留只影响对话，不影响凭据配置。当前文案说明“密钥只保存在本机浏览器 localStorage”，但缺少“本次使用不保存 key”“清除 API key”“保存 endpoint/model 但不保存 key”的细分选择。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

把 LLM 配置拆成“低敏配置”和“凭据保存策略”。默认可以继续保存 endpoint/model，API key 则提供 `session` / `local` / `none` 三种模式。

```js
function saveConfig(config, credentialMode) {
  const clean = {
    format: normalizeFormat(config.format),
    endpoint: String(config.endpoint || "").trim(),
    model: String(config.model || "").trim(),
    stream: Boolean(config.stream),
    credentialMode,
  };

  if (credentialMode === "local") {
    clean.apiKey = String(config.apiKey || "");
  } else {
    clean.apiKey = "";
    if (credentialMode === "session") {
      sessionStorage.setItem("cwl.assistant.sessionApiKey", String(config.apiKey || ""));
    }
  }

  storageSet(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}
```

同时在设置区增加“清除 API key”按钮，只删除凭据，不清掉 endpoint/model，避免用户为了隐私丢失全部配置。

📊 预期收益

- 在共享设备、临时调试或演示场景下更安全。
- 保留配置便利性，同时减少长期留存凭据的心理负担。
- 与现有“对话隐私模式”形成一致的用户模型。

🔗 相关建议引用

- [S-14](../security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage)
- [UX-13](../ux-improvements.md#ux-13-已修复核心问题-ai-助手默认模式与隐私文案需要重新对齐)
- [AI 助手深度分析](assistant-deep-dive.md)

### 📌 MR-LDR-04：草稿、简历和反馈类内容缺少统一保留期限、容量预算和保存失败反馈

📍 位置（文件路径 + 行号范围）

- `js/editor.js:2`
- `js/editor.js:160-219`
- `js/overleaf.js:13-15`
- `js/overleaf.js:737-900`
- `js/feedback.js:10`
- `js/feedback.js:24-40`
- `js/feedback.js:141-162`
- `js/utils.js:157-186`

📝 当前状况描述

Markdown 编辑器、简历编辑器和反馈表单都会保存用户输入内容。编辑器类内容有很强的便利性价值，但也可能包含尚未发布的文章、个人简历、联系方式或敏感经历。当前多个模块在写入失败时静默忽略或只依赖底层 console 警告，没有统一容量预算、过期清理、保存状态提示或“清除草稿”入口。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

为内容型存储使用带元数据的 envelope：保存时间、版本、过期时间、字节数和数据类型。写入失败时返回可见状态，让用户知道草稿没有被持久化。

```js
function saveContentDraft(key, payload, options = {}) {
  const envelope = {
    version: 1,
    type: options.type || "draft",
    savedAt: Date.now(),
    expiresAt: Date.now() + (options.days || 30) * 86400000,
    payload,
  };
  const serialized = JSON.stringify(envelope);
  if (serialized.length > (options.maxBytes || 256000)) {
    return { ok: false, reason: "tooLarge" };
  }
  return {
    ok: window.CWLUtils.storageSet(key, serialized),
    bytes: serialized.length,
  };
}

function readContentDraft(key) {
  const envelope = JSON.parse(window.CWLUtils.storageGet(key) || "null");
  if (!envelope || Date.now() > envelope.expiresAt) {
    localStorage.removeItem(key);
    return null;
  }
  return envelope.payload;
}
```

📊 预期收益

- 用户能知道“已保存到本机”是否真的成功。
- 减少长期保留草稿、简历和联系方式造成的隐私压力。
- 避免大文本无限占用 `localStorage`，降低配额失败概率。

🔗 相关建议引用

- [MR-DATA-02](user-data-entrypoints.md#mr-data-02留言反馈本地存储无数量长度和保留期限上限)
- [S-08](../security-audit.md#s-08-localstorage-中存储反馈数据无加密)
- [工具箱核心运行时风险复查](tools-core-runtime-safety.md)

### 📌 MR-LDR-05：阅读进度有过期判断但不清理旧 key，滚动路径仍会持续写入

📍 位置（文件路径 + 行号范围）

- `js/coder.js:184-186`
- `js/coder.js:221-230`
- `js/coder.js:257-305`
- `docs/suggestions/module-reviews/core-reading-interactions.md:67-94`

📝 当前状况描述

文章阅读进度使用 `cwl.reading.<slug>` 保存比例、滚动位置和时间。恢复提示会忽略超过 14 天的记录，这是合理的产品边界；但旧 key 不会主动删除。滚动处理被节流后仍会在阅读比例超过阈值时频繁写入，长期阅读大量文章后会留下许多过期 key。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

在页面加载、保存阅读进度或打开“本机数据”面板时清理过期阅读记录，并增加最小变化阈值。

```js
function pruneReadingPositions(now = Date.now()) {
  Object.keys(localStorage).forEach(key => {
    if (!key.startsWith("cwl.reading.")) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      if (now - Number(saved.time || 0) > READING_RESUME_MAX_AGE) {
        localStorage.removeItem(key);
      }
    } catch (_error) {
      localStorage.removeItem(key);
    }
  });
}

function shouldSaveReadingPosition(previous, nextRatio, now) {
  return !previous ||
    Math.abs(previous.ratio - nextRatio) >= 0.02 ||
    now - Number(previous.time || 0) > 30000;
}
```

📊 预期收益

- 让 14 天保留策略从“只是不提示”变成真正的数据生命周期。
- 降低滚动期间同步存储写入频率。
- 为全站本地数据清单提供一个简单、低风险的首批治理项。

🔗 相关建议引用

- [核心阅读交互复查](core-reading-interactions.md)
- [性能瓶颈建议](../performance-bottlenecks.md)
- [开发体验建议](../devex-improvements.md)

### 📌 MR-LDR-06：本地存储测试覆盖分散，缺少“新增 key 必须登记”的契约测试

📍 位置（文件路径 + 行号范围）

- `tests/assistant.test.mjs:407-490`
- `tests/tools.test.mjs:1010-1139`
- `tests/feedback.test.mjs:1-212`
- `tests/coder-deep.test.mjs:76-80`
- `tests/utils-deep.test.mjs:214-232`

📝 当前状况描述

现有测试覆盖了助手隐私模式、对话保留、API Tester 脱敏、反馈清空、底层存储异常处理和阅读进度恢复等关键行为。本轮 172 项相关测试全部通过。缺口是测试分散在模块内部，无法防止未来某个文件新增 `localStorage.setItem("new-key", ...)` 但没有进入数据清单、隐私文案或清理入口。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

增加一个 manifest 契约测试：扫描源码中的本地存储 key 字面量，要求它们出现在 `LOCAL_DATA_MANIFEST` 或显式 allowlist 中。偏好类 key 可以低敏登记，内容/凭据类 key 必须声明清理策略。

```js
test("local storage keys are declared in the data manifest", async () => {
  const sourceKeys = await collectStorageKeys(["js"]);
  const manifestKeys = new Set(LOCAL_DATA_MANIFEST.flatMap(item => item.keys));
  const allowlist = new Set(["cwl-next-dismissed:*"]);

  for (const key of sourceKeys) {
    assert.ok(
      manifestKeys.has(key) || allowlist.has(key),
      `${key} must be declared in LOCAL_DATA_MANIFEST`
    );
  }
});
```

📊 预期收益

- 把本地数据治理从文档建议变成工程约束。
- 新功能上线时同步考虑隐私文案、清理入口和保留期限。
- 降低后续安全复查的人工搜索成本。

🔗 相关建议引用

- [开发体验建议](../devex-improvements.md)
- [测试覆盖风险地图](test-coverage-risk-map.md)
- [建议知识库治理](suggestions-knowledge-base-governance.md)

## 下一步优先级

1. 高优先级：为 API Tester 历史增加 URL 查询串脱敏，并补充回归测试。
2. 中优先级：设计 `LOCAL_DATA_MANIFEST`，先用于文档和测试，再决定是否渲染为用户可见面板。
3. 中优先级：给 AI 助手 API key 增加“仅本次会话”和“清除 key”选项。
4. 中优先级：为编辑器、简历工具和反馈表单增加内容型存储 envelope、容量预算和可见保存状态。
5. 低优先级：清理过期 `cwl.reading.*` 记录，并减少滚动路径写入频率。
