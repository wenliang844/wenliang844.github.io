# AI 助手加载器与 LLM 运行时评审

> 轮次：2026-07-03 第四轮专题分析  
> 范围：`js/assistant-loader.js`、`js/assistant.js`、`src/templates/layout.mjs`、`tests/assistant*.mjs`、`css/coder.css`。  
> 验证：`node --test tests/assistant-loader.test.mjs tests/assistant.test.mjs tests/assistant-deep.test.mjs tests/assistant-enter.test.mjs tests/assistant-tools-page.test.mjs`，50 项通过。

## 总览

AI 助手当前已经完成几个关键安全修复：前端默认体验 key 已移除，默认进入站点助手模式，模型输出用 `textContent` 渲染，SSE 尾部 flush 和 OpenAI Responses fallback 也有回归测试。用户自填 API key 的第一阶段边界也已收紧：默认不持久化 key，发送/测试前需要确认实际 endpoint。剩余重点是长回复存储预算、LLM 配置 i18n、加载失败反馈和测试可靠性。

## 建议清单

### 1. 新增助手加载器存在发布一致性风险

- 📌 问题/建议标题：布局模板引用 `assistant-loader.js`，但当前工作区该文件仍是未跟踪文件
- 📍 位置：`src/templates/layout.mjs:52-60`、`js/assistant-loader.js:1-80`、`tests/assistant-loader.test.mjs:1-62`
- 📝 当前状况描述：`CORE_SCRIPTS` 已引用 `/js/assistant-loader.js`，加载器本身会懒加载 `/js/assistant.js` 并重放首次点击。当前工作区中 `js/assistant-loader.js` 与 `tests/assistant-loader.test.mjs` 处于 untracked 状态。如果后续只提交模板/生成页而遗漏加载器文件，生产页面会请求一个不存在的核心脚本；虽然站点主体仍可访问，但 AI 入口会静默失效，且普通 HTML 引用检查未必能发现“文件未纳入版本控制”的发布缺口。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：

```js
// scripts/validate-production.mjs
for (const src of collectLocalScriptSrcFromHtml()) {
  assertFileExists(src);
  assertTrackedByGit(src);
}

function assertTrackedByGit(path) {
  const tracked = gitLsFiles(path);
  if (!tracked) {
    throw new Error(`Referenced script is not tracked: ${path}`);
  }
}
```

同时让 loader 测试进入常规 CI 队列，避免新增入口只在手动测试中覆盖。

- 📊 预期收益：降低“模板已发布、运行时漏发”的前端入口故障；对之后的懒加载脚本也形成通用发布检查。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md` 中“Vendor files lack manifest/hash/source audit”。

### 2. [已修复第一阶段] 默认中转站与任意 HTTPS endpoint 的信任边界仍需显式化

- 📌 问题/建议标题：用户 API key 会被发送到预置或自填 endpoint，但 UI 缺少域名确认/信任提示
- 📍 位置：`js/assistant.js`、`css/assistant.css`、`tests/assistant.test.mjs`
- ✅ 修复状态：助手配置区已新增 endpoint 摘要和确认框，实时展示协议、host 与 path；`askLlm()` 和 `testConnection()` 在发送 API key 前都会要求用户勾选“我确认这个请求地址可信”。非完整 http(s) URL 会阻断请求，非 HTTPS endpoint 会在摘要中提示只适合可信本机代理或测试环境。
- 🧪 回归测试：`tests/assistant.test.mjs` 新增 “requires endpoint trust before sending an API key”，确认未勾选时 `fetch` 不会发起，勾选后才携带用户 key 请求；`tests/css.test.mjs` 锁定 endpoint summary/trust 控件样式。
- 📝 原状况描述：默认 OpenAI-compatible preset 指向 `https://muyuan.do/v1/responses`，Anthropic 旧 preset 仍在迁移逻辑中出现；自定义 endpoint 只做字符串 trim 和路径拼接。CSP 使用 `connect-src 'self' https: http:` 以兼容自定义请求和 API Tester 本机/内网调试，这意味着一旦用户填入 API key，前端可以把 key 发往任意 HTTPS 域名。此前隐私文案说明“请求你配置的中转站”，但没有在发送前突出显示实际 host、协议和路径，也没有“信任此 endpoint”的确认。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：

```js
function validateEndpoint(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("Endpoint must use HTTPS.");
  }
  return url;
}

function confirmEndpointTrust(url) {
  const known = readTrustedHosts();
  if (known.includes(url.host)) return true;
  return showTrustDialog({
    host: url.host,
    path: url.pathname,
    message: "Your API key will be sent to this host.",
  });
}
```

默认 preset 也建议展示“将请求到 muyuan.do”的明确提示；更稳妥的长期方案是把公共体验或推荐 relay 迁到服务端代理，前端只保存用户显式选择。

- 📊 实际收益：用户在提交 key 前能看到真实数据流，降低钓鱼式 endpoint、误填代理地址和第三方 relay 信任不透明带来的凭据风险。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage`、`docs/suggestions/module-reviews/user-data-entrypoints.md#mr-data-06全站-csp-的-connect-src-https-对普通页面过宽`。

### 3. [已修复第一阶段] API key 默认长期保存在 `localStorage`

- 📌 问题/建议标题：缺少“仅本次会话使用 key”或“记住 key”显式选择
- 📍 位置：`js/assistant.js`、`css/assistant.css`、`tests/assistant.test.mjs`
- ✅ 修复状态：配置区已新增“记住 API key（仅保存在本机浏览器）”复选框，默认关闭。`saveConfig()` 会把 `apiKey` 写入当前调用返回值供本次请求使用，但只有用户勾选 remember 时才持久化到 `cwl.assistant.llmConfig`；旧版已经保存过 key 的配置会自动视为 `rememberApiKey: true`，避免升级后突然丢失用户显式保存过的配置。
- 🧪 回归测试：`tests/assistant.test.mjs` 新增 “does not persist API keys unless the user opts in”，覆盖未勾选保存时 localStorage 中 `apiKey` 为空、勾选后才保存 key；原有空 key 不请求、用户自填 key 才请求和源码密钥扫描测试继续保留。
- 📝 原状况描述：配置保存逻辑会把 `format`、`endpoint`、`apiKey`、`model`、`stream` 一起写入 `cwl.assistant.llmConfig`。输入框使用 `type="password"` 和 `autocomplete="off"` 是好的，但只要用户保存或触发读取字段，就可能把 key 持久化到浏览器本地。对于共享电脑、浏览器扩展或后续 XSS 风险，长期 localStorage key 是更敏感的资产。
- ⚠️ 影响程度：高
- 💡 建议方案（含伪代码或示例片段）：

```js
const rememberKey = rememberKeyInput.checked;
const sessionKey = "cwl.assistant.sessionApiKey";

function saveConfig(config) {
  const clean = { ...config, apiKey: rememberKey ? config.apiKey : "" };
  storageSet(STORAGE_KEY, JSON.stringify(clean));
  if (!rememberKey) {
    sessionStorage.setItem(sessionKey, config.apiKey);
  }
}

function withEffectiveApiKey(config) {
  return {
    ...config,
    apiKey: config.apiKey || sessionStorage.getItem(sessionKey) || "",
  };
}
```

UI 层增加“记住 API key”复选框，默认关闭；再提供“一键清除本机 key 和对话”的按钮。

- 📊 实际收益：保留便捷配置，同时让默认隐私边界更安全；用户可以临时试用 LLM 模式而不把 key 长期留在浏览器。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/assistant-deep-dive.md#mr-ast-04-已修复核心风险-对话持久化缺少生命周期和隐私控制`、`docs/suggestions/security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage`。

### 4. 对话条数有限，但单条内容和写入失败没有用户反馈

- 📌 问题/建议标题：长回复/长 prompt 可挤爆本地存储，保存失败被静默吞掉
- 📍 位置：`js/assistant.js:164-175`、`js/assistant.js:209-240`、`js/assistant.js:1127-1133`、`js/assistant.js:1381-1389`、`js/assistant.js:1391-1447`
- 📝 当前状况描述：`MAX_MESSAGES` 和 `MAX_CONVERSATIONS` 控制了数量，`llmHistory` 也只保留最近 12 条；但 `cleanMessage()`、`persistMessage()`、`updateMessage()` 没有截断单条内容大小。流式回答可能非常长，用户也可能粘贴大段代码或日志。一旦 `localStorage.setItem()` 因配额失败，`storageSet()` 只返回 false，UI 不提示用户“历史未保存”。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const MAX_MESSAGE_CHARS = 8000;
const MAX_STORAGE_CHARS = 200000;

function trimMessageText(text) {
  const clean = String(text || "");
  return clean.length > MAX_MESSAGE_CHARS
    ? clean.slice(0, MAX_MESSAGE_CHARS) + "\n\n[truncated locally]"
    : clean;
}

function saveConversations() {
  const payload = JSON.stringify(pruneForBudget(conversations, MAX_STORAGE_CHARS));
  if (!storageSet(CONVERSATIONS_KEY, payload)) {
    configStatus.textContent = t("assistant.storageFail", "历史保存失败，请清理旧对话。");
  }
}
```

- 📊 预期收益：避免长会话导致本地存储不可预测失效；用户能清楚知道当前对话是否真的被保存。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md` 中关于 feedback localStorage 条数/长度/保留期限的建议。

### 5. LLM 配置和错误状态仍有大量中文硬编码

- 📌 问题/建议标题：英文模式下助手配置区和 LLM 错误提示会混合中文
- 📍 位置：`js/assistant.js:693-710`、`js/assistant.js:1028-1066`、`js/assistant.js:1230-1234`、`js/assistant.js:1462-1528`、`js/assistant.js:1572-1583`、`js/i18n.js:470-511`
- 📝 当前状况描述：助手主标题、模式、快捷入口等已通过 `assistant.*` 字典切换英文；但 endpoint label、模型名、流式输出、保存配置、测试连接、停止生成、连接中、无 API key、错误归一化等状态仍是中文字符串。`tests/assistant.test.mjs` 覆盖了部分英文静态标签，却未覆盖配置区和错误态。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
endpointLabel.appendChild(el("span", "", t("assistant.config.endpoint", "请求地址")));
modelLabel.appendChild(el("span", "", t("assistant.config.model", "模型名")));
streamLabel.appendChild(el("span", "", t("assistant.config.stream", "流式输出")));
saveConfigBtn.textContent = t("assistant.config.save", "保存配置");
testConfigBtn.textContent = t("assistant.config.test", "测试连接");

function normalizeLlmError(error) {
  if (error && error.name === "AbortError") {
    return t("assistant.error.stopped", "已停止生成。");
  }
  // ...
}
```

新增英文模式测试：切到 `en`，展开 LLM 配置，断言 label、按钮、缺 key 提示、401/429 错误提示均为英文。

- 📊 预期收益：英文用户在最关键的配置/失败路径里不再遇到混合语言，降低误配置和支持成本。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md` 中 TOC/search i18n 键名与失败态建议。

### 6. 加载器失败只写 console，用户无法感知入口失效

- 📌 问题/建议标题：`assistant-loader.js` 懒加载失败没有可见/可访问反馈
- 📍 位置：`js/assistant-loader.js:20-63`、`js/assistant-loader.js:65-79`、`tests/assistant-loader.test.mjs:22-62`
- 📝 当前状况描述：首次点击 AI 入口时，加载器会阻止原始点击、插入 runtime script，加载成功后重放点击。失败时仅 `console.warn("Failed to load assistant runtime.")`。普通用户不会打开控制台，也不会知道点击无效的原因。此外，当页面上已经存在同 src 的 script 但 load 事件已发生、`.assistant-widget` 又不存在时，`existingRuntimeScript()` 分支只监听未来 load/error，存在 promise 悬挂的边界。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function showLoaderStatus(message) {
  const status = document.querySelector("[data-assistant-loader-status]") ||
    document.body.appendChild(Object.assign(document.createElement("p"), {
      dataset: { assistantLoaderStatus: "true" },
    }));
  status.setAttribute("role", "status");
  status.textContent = message;
}

loadRuntime().catch(function () {
  showLoaderStatus("AI assistant failed to load. Please refresh and try again.");
});
```

测试补充：模拟 script error，断言页面出现 `role="status"`；模拟已有 script 且 `dataset.assistantRuntimeLoaded="true"`，确保 `loadRuntime()` 能立即 resolve 或重新创建 runtime。

- 📊 预期收益：用户能理解失败原因，支持排障更容易；也避免缓存/重复脚本场景导致首次点击永久无响应。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md` 中关于表单提交/失败反馈的建议。

### 7. `assistant-deep.test.mjs` 仍保留旧 `.ai-*` fixture，存在误报风险

- 📌 问题/建议标题：深度测试部分断言没有覆盖真实 `.assistant-*` DOM
- 📍 位置：`tests/assistant-deep.test.mjs:10-60`、`tests/assistant-deep.test.mjs:142-170`、`tests/assistant-deep.test.mjs:176-204`、`tests/assistant-deep.test.mjs:248-270`、`js/assistant.js:873-1107`
- 📝 当前状况描述：运行时现在动态创建 `.assistant-widget`、`.assistant-endpoint`、`.assistant-history-item` 等 DOM；但 `assistant-deep.test.mjs` 的 fixture 仍保留旧的 `#ai-assistant`、`.ai-endpoint-input`、`.ai-conv-list`、`.ai-fullscreen-btn`。例如会话数量测试查询 `.ai-conv-item`，当前运行时不会创建该节点，结果 0 条也满足“<= 20”；旧 endpoint 迁移测试查询 fixture 里的 `.ai-endpoint-input`，不是运行时生成的 `.assistant-endpoint`。这类测试会给人“已覆盖”的错觉。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
test("assistant renders no more than 20 real history items", async () => {
  const dom = await loadAssistantWithStoredConversations(25);
  const items = dom.window.document.querySelectorAll(".assistant-history-item");
  assert.equal(items.length, 20);
});

test("legacy endpoint migration updates the real endpoint input", async () => {
  const endpoint = document.querySelector(".assistant-endpoint");
  assert.equal(endpoint.value, "https://muyuan.do/v1/responses");
});
```

建议删除旧 `.ai-*` fixture，统一复用 `tests/assistant.test.mjs` 的 `loadAssistant()` helper，避免两套 DOM 模型并存。

- 📊 预期收益：减少假阳性，让助手重构后的测试真正锁住当前 UI 和存储行为。
- 🔗 相关建议引用：`docs/suggestions/devex-improvements.md`、`docs/suggestions/module-reviews/assistant-deep-dive.md`。

## 测试补强建议

- loader：增加 script error、重复 script、runtime 初始化失败、用户可见状态测试。
- LLM 配置：endpoint host 确认和 remember key 默认关闭已补；后续可继续增加非 HTTPS 本机代理说明和更多错误态英文测试。
- i18n：覆盖 LLM 配置区、状态区和错误提示的英文模式。
- 存储：模拟 localStorage quota failure，断言 UI 提示；模拟超长模型回复，断言本地截断。
- 测试整理：移除 `assistant-deep.test.mjs` 中旧 `.ai-*` fixture，统一用真实 `.assistant-*` DOM。

## 本轮结论

助手主路径已经比早期版本安全很多：无内置前端 key、默认本地模式、输出安全渲染、请求和 SSE 行为有覆盖。用户自填 key 的核心边界也已推进到“默认不长期保存、发送前确认 endpoint”。下一步最值得做的是继续补失败时可见反馈、LLM 配置/错误态英文覆盖，并清理掉旧 fixture 测试带来的覆盖噪声。
