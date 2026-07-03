# 工具箱运行时安全专题分析

> 分析时间：2026-07-04 01:02 +08:00  
> 分析范围：`js/tools-core.js`, `js/tools.js`, `src/templates/tools.mjs`, `tests/tools*.mjs`  
> 验证命令：`node --test tests/tools.test.mjs tests/tools-core-deep.test.mjs`，73/73 通过

## 本轮结论

工具箱主路径测试稳定，且已经修复了 API 历史敏感 Header 脱敏、请求体默认不保存、Cron 无解表达式提前失败、JSONPath 非法尾部拒绝、API 历史写入失败反馈、Mini API Tester 私网/非 HTTPS 显式确认、API 请求超时和大响应预算、正则 Worker 超时、UUID 弱随机 fallback 等核心风险。本轮聚焦的工具运行时风险均已进入回归测试。

---

## 📌 MR-RT-01 [已修复核心风险]: 正则测试器需要 Web Worker 或超时预算防止灾难性回溯

- **📍 位置**：`js/tools-core.js:661-704`, `tests/tools-core-deep.test.mjs:112-158`
- **✅ 修复状态**：工具页正则按钮已优先使用 `/js/regex-worker.js` 执行正则匹配，主线程设置 250ms 硬超时；Worker 不可用时保留同步兜底。`tests/tools.test.mjs` 覆盖 Worker 路径和超时终止反馈。
- **📝 当前状况描述**：`testRegex()` 已限制 pattern 不超过 500 字符、input 不超过 50000 字符，并处理了空匹配避免死循环；这些限制很有价值。但 `new RegExp(source, runFlags)` 和后续 `regex.exec(target)` 仍在主线程同步执行。对于 `(a+)+$` 这类灾难性回溯表达式，即使输入很短也可能迅速放大耗时。本轮探针显示输入 22 个 `a` 加 `!` 已出现约 35ms 同步耗时，继续增大时会阻塞工具页交互。
- **⚠️ 影响程度**：中
- **💡 建议方案**：把正则执行移到 Worker，并设置硬超时；主线程只负责展示“执行中/超时/结果”。如果短期不引入 Worker，也应先降低输入预算并识别常见高危结构。
  ```javascript
  const worker = new Worker("/js/workers/regex-runner.js");
  const timeoutId = setTimeout(() => worker.terminate(), 250);
  worker.postMessage({ pattern, flags, input, maxMatches: 500 });
  worker.onmessage = ({ data }) => {
    clearTimeout(timeoutId);
    renderRegexResult(data);
  };
  ```
- **📊 预期收益**：避免单个正则表达式冻结整个工具页，降低 ReDoS 类输入对静态站点前端体验的影响。
- **🔗 相关建议引用**：[MR-CORE-05](tools-core.md#mr-core-05-现有输入上限值得保留为工具核心契约), [DE-13](../devex-improvements.md#de-13-为-ai-助手和-cron-边界行为补充回归测试)

---

## 📌 MR-RT-02 [已修复]: JSONPath 解析应拒绝未消费的非法尾部

- **📍 位置**：`js/tools-core.js:1170-1188`, `tests/tools.test.mjs:430-432`
- **✅ 修复状态**：`queryJsonPath()` 现在按 token 逐段消费整条表达式，遇到未消费尾部或暂不支持片段时返回 `jsonPathSyntax`；同时保留 `0` 等 falsey 匹配值的正确输出。
- **📝 当前状况描述**：`queryJsonPath()` 通过正则提取支持的 token：点字段、括号字符串键和数字索引。对于过滤器、通配符、递归下降等不支持语法，多数场景会返回“路径没有匹配到值”；但如果合法路径后追加非法尾部，例如 `$.deep.value trailing`，当前实现仍会只消费 `$.deep.value` 并返回 `1`。这会让用户误以为完整 JSONPath 表达式被正确执行。
- **⚠️ 影响程度**：中
- **💡 建议方案**：解析时记录 token 覆盖范围，确保从 `$` 到末尾没有未消费字符；发现非法片段时返回 `jsonPathSyntax` 错误，并在 UI 文案里列出支持子集。
  ```javascript
  const tokenPattern = /(?:\.[A-Za-z_$][\w$-]*)|(?:\[['"][^'"]+['"]\])|(?:\[\d+\])/g;
  let offset = 1;
  for (const match of rawPath.slice(1).matchAll(tokenPattern)) {
    if (match.index !== offset - 1) {
      return fail("JSONPath 包含暂不支持的语法片段", "jsonPathSyntax");
    }
    offset += match[0].length;
  }
  if (offset !== rawPath.length) {
    return fail("JSONPath 包含暂不支持的语法片段", "jsonPathSyntax");
  }
  ```
- **📊 预期收益**：让“不支持”变成明确错误，避免部分解析造成错误数据判断，也便于后续补充 JSONPath 语法测试。
- **🔗 相关建议引用**：[MR-CORE-05](tools-core.md#mr-core-05-现有输入上限值得保留为工具核心契约), [UX-11](../ux-improvements.md#ux-11-已修复核心问题-手势与-api-工具的隐私边界文案需要更精确)

---

## 📌 MR-RT-03 [已修复]: API 历史写入失败时不应显示“请求已安全保存”

- **📍 位置**：`js/tools.js:695-808`, `tests/tools.test.mjs:857-865`, `tests/tools.test.mjs:886-894`
- **✅ 修复状态**：`setApiHistory()` 现在返回真实写入结果并校验 readback；保存失败或发送完成后保存失败都会显示错误反馈，不再展示“已安全保存”。
- **📝 当前状况描述**：`setApiHistory()` 捕获 `localStorage.setItem()` 的配额、隐私模式或浏览器策略错误后静默忽略；`saveApiRequest()` 随后仍调用 `setStatusKey(..., "请求已安全保存", "ok")`。因此在 Safari 隐私模式、存储配额耗尽、第三方上下文禁用存储等场景里，用户看到的是成功反馈，但历史下拉实际上不会持久化。
- **⚠️ 影响程度**：中
- **💡 建议方案**：让 `setApiHistory()` 返回布尔值，并在失败时展示可恢复的错误反馈；测试里模拟 `localStorage.setItem` 抛错，断言状态不是成功。
  ```javascript
  function setApiHistory(items) {
    try {
      window.localStorage.setItem(API_HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
      return true;
    } catch (_error) {
      return false;
    }
  }

  if (!setApiHistory(history)) {
    setStatusKey("api-status", "tools.status.saveFailed", "历史保存失败，请检查浏览器存储权限", "error");
    return false;
  }
  ```
- **📊 预期收益**：减少“显示成功但数据丢失”的体验落差，也让隐私模式和存储配额问题更容易被用户自查。
- **🔗 相关建议引用**：[S-12](../security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage), [MR-TOOLS-03](tools-gesture-and-api.md#mr-tools-03-已修复核心风险-api-tester-历史保存未区分普通请求和敏感请求)

---

## 📌 MR-RT-04 [已修复核心风险]: Mini API Tester 需要标注私网和非 HTTPS 请求边界

- **📍 位置**：`src/templates/tools.mjs:147-169`, `js/tools.js:864-923`
- **✅ 修复状态**：API Tester 已增加“允许本机/内网/非 HTTPS 请求”显式开关；默认会拦截 `localhost`、回环地址、IPv4/IPv6 私网、`.local` 和 `http:` 目标，勾选后才发送请求。CSP 只在工具页放宽 `connect-src` 到 `http:`，普通页面仍保持 HTTPS-only 连接策略，并有中英文状态文案和回归测试。
- **📝 当前状况描述**：`sendApiRequest()` 允许用户输入任意 `http:` 或 `https:` URL。这是调试工具的核心能力，但在静态站点页面中，用户可能向 `http://localhost`、`http://127.0.0.1`、`http://192.168.x.x` 或公司内网地址发送请求。即便 CORS 阻止读取响应，请求本身仍可能被浏览器发出；同时非 HTTPS 目标也可能触发混合内容限制或把调试 token 暴露在明文链路中。
- **⚠️ 影响程度**：中
- **💡 建议方案**：在发送前对目标 URL 分类：公网 HTTPS 直接发送；非 HTTPS、localhost、回环地址、私网 IP、`.local` 域名需要显式二次确认或开启“高级模式”。历史记录里也可标记该请求属于本机/私网调试。
  ```javascript
  function classifyApiTarget(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^127\./.test(host)) return "local";
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return "private";
    if (new URL(url).protocol === "http:") return "insecure";
    return "publicHttps";
  }
  ```
- **📊 预期收益**：保留开发调试能力，同时把“这个网页将从你的浏览器访问本机/内网/明文 HTTP”的信任边界明确给用户。
- **🔗 相关建议引用**：[UX-11](../ux-improvements.md#ux-11-已修复核心问题-手势与-api-工具的隐私边界文案需要更精确), [MR-TOOLS-03](tools-gesture-and-api.md#mr-tools-03-已修复核心风险-api-tester-历史保存未区分普通请求和敏感请求)

---

## 📌 MR-RT-05 [已修复核心风险]: API 响应读取需要大小上限和超时控制

- **📍 位置**：`js/tools.js:855-923`
- **✅ 修复状态**：API Tester 已增加 15 秒请求超时、`AbortError` 超时文案区分、响应正文 500000 字符预算、`Content-Length` 超限跳过正文读取和截断状态反馈，并补充页面层回归测试。
- **📝 当前状况描述**：Mini API Tester 会调用 `response.text()` 一次性读取完整响应，然后把内容写入 `#api-response`；`formatApiBody()` 只是在响应超过 500000 字符时跳过 JSON pretty-print，但并不会阻止大响应进入内存和 textarea。当前也没有请求超时，只有“新请求取消旧请求”的 `AbortController`。如果目标接口长时间不返回或返回超大日志/文件，页面可能长时间处于处理中或出现内存压力。
- **⚠️ 影响程度**：中
- **💡 建议方案**：增加默认超时和最大展示字节数；对于 `Content-Length` 超限的响应先提示用户，流式读取时最多保留前 N KB，并明确标记“已截断”。
  ```javascript
  const timeoutId = setTimeout(() => apiAbortController.abort(), 15000);
  const maxPreviewBytes = 512 * 1024;
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxPreviewBytes) {
    return setStatusKey("api-status", "tools.status.responseTooLarge", "响应过大，仅展示预览", "error");
  }
  ```
- **📊 预期收益**：提升工具页面对慢接口、错误接口和大响应时的可恢复性，减少浏览器卡顿和内存峰值。
- **🔗 相关建议引用**：[P-13](../performance-bottlenecks.md#p-13-关键静态产物体积已经接近当前性能预算), [MR-CORE-05](tools-core.md#mr-core-05-现有输入上限值得保留为工具核心契约)

---

## 后续测试建议

- 后续如继续增强正则工具，可补充 Worker 真实浏览器性能基准和更细的高危表达式解释文案。
