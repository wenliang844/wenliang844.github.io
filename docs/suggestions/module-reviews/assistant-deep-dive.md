# AI 助手模块深度分析

> 分析时间：2026-07-03 23:20 +08:00 | 范围：`js/assistant.js`, `tests/assistant*.mjs`

## 📌 MR-AST-01 [已修复]: 默认体验 key 仍是助手安全模型的中心风险

- **📍 位置**：`js/assistant.js:39-63`, `js/assistant.js:328-333`, `js/assistant.js:1314-1316`, `js/assistant.js:1445-1450`
- **✅ 修复状态**：前端默认 key 常量和 `LLM_EXPERIENCE_KEYS` 已删除；默认 preset 空 key 不会调用 `fetch`，LLM 模式要求用户自填 key。隐私文案改为“请填写你自己的 API key，密钥只保存在本机浏览器”。
- **🧪 回归测试**：`tests/assistant.test.mjs` 覆盖空 key 不请求、自填 key 请求、源码不得包含默认 key 机制；`tests/assistant-deep.test.mjs` 同步加强源码扫描。
- **📝 原状况描述**：助手会在用户未填写 key 且 endpoint 为默认 preset 时注入体验 key，隐私文案也写明“未填写时使用内置体验 key”。这让前端包承载了本应位于服务端的凭据分发责任。
- **⚠️ 影响程度**：高
- **💡 建议方案**：
  ```javascript
  function withEffectiveApiKey(config) {
    return { ...config, apiKey: String(config.apiKey || "").trim() };
  }
  ```
  默认体验如果必须保留，应迁移到限额服务端代理，并把前端能力降为选择 endpoint、发送 prompt 和展示结果。
- **📊 预期收益**：消除前端可提取凭据，减少费用、封禁和滥用风险。
- **🔗 相关建议引用**：[S-11](../security-audit.md#s-11-assistantjs-仍在前端运行时拼接并使用默认体验-api-key), [UX-13](../ux-improvements.md#ux-13-ai-助手默认模式与隐私文案需要重新对齐)

## 📌 MR-AST-02 [已修复]: 模式偏好保存与读取不对称

- **📍 位置**：`js/assistant.js:31`, `js/assistant.js:337-339`, `js/assistant.js:1306-1309`
- **✅ 修复状态**：`readMode()` 现在读取 `cwl.assistant.mode`，合法值为 `site` / `llm`；没有保存值时默认 `site`，与本地优先的隐私边界一致。
- **🧪 回归测试**：`tests/assistant.test.mjs` 覆盖默认站点模式、保存 `llm` 后恢复、保存 `site` 后恢复。
- **📝 原状况描述**：`applyMode()` 写入 `MODE_KEY`，但 `readMode()` 固定返回 `"llm"`。这会让刷新后的 UI 状态违背用户上一轮选择，也使“站点模式作为默认本地问答”的产品边界难以成立。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const saved = storageGet(MODE_KEY);
  return saved === "llm" || saved === "site" ? saved : "site";
  ```
  对旧用户可以保留一次迁移：如果已有 API key，则默认 `llm`；否则默认 `site`。
- **📊 预期收益**：提升助手状态可预测性，减少刷新后误触外部模型请求。
- **🔗 相关建议引用**：[B-15](../bugs-and-risks.md#b-15-ai-助手模式偏好写入后不会被恢复)

## 📌 MR-AST-03 [已修复]: SSE 解析缺少流结束收尾处理

- **📍 位置**：`js/assistant.js:594-649`
- **✅ 修复状态**：`postStream()` 已抽出事件消费 helper，支持 CRLF；reader 完成时会 flush `TextDecoder` 并消费剩余 `buffer`，未闭合的最后一个 `data:` 事件不会丢失。
- **🧪 回归测试**：`tests/assistant.test.mjs` 模拟最后一个 SSE 事件没有尾随空行，断言最终消息完整包含尾部 delta。
- **📝 原状况描述**：流式响应按 `\n\n` 切分事件，未闭合的最后一段会留在 `buffer`。当 reader 返回 `done` 时函数直接返回 `result`，未处理的 `buffer` 和 TextDecoder flush 都会被丢弃。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  if (chunk.done) {
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);
    break;
  }
  ```
  建议把 `consumeEvent()` 和 `consumeLine()` 抽成局部 helper，减少循环内嵌套复杂度。
- **📊 预期收益**：兼容更多 SSE 实现，避免回答尾部缺字或 `[DONE]` 前最后 delta 丢失。
- **🔗 相关建议引用**：[B-16](../bugs-and-risks.md#b-16-ai-助手-sse-流结束时可能丢失最后一个未闭合事件), [DE-13](../devex-improvements.md#de-13-为-ai-助手和-cron-边界行为补充回归测试)

## 📌 MR-AST-04 [已修复核心风险]: 对话持久化缺少生命周期和隐私控制

- **📍 位置**：`js/assistant.js:34`, `js/assistant.js:220-243`, `js/assistant.js:1104-1108`, `js/assistant.js:1454-1478`
- **✅ 修复状态**：助手会话持久化已受隐私模式和保留周期控制：隐私模式 / session 保留只保留内存态，7 天 / 30 天会清理过期会话，永久保留需要用户显式选择。
- **🧪 验证**：`tests/assistant.test.mjs` 覆盖隐私模式、保留期限、session 模式和清空全部对话；`tests/css.test.mjs` 覆盖隐私控件样式与移动端布局。
- **📝 原状况描述**：助手会清理并保留最近对话，但没有保留期限和隐私模式。`llmHistory` 截断到 12 条能控制上下文长度，却不能控制本地保存周期。
- **⚠️ 影响程度**：中
- **💡 后续建议**：
  ```javascript
  exportConversationAsJson(activeConversation());
  deleteConversation(activeConversationId);
  ```
- **📊 实际收益**：降低本地敏感信息长期暴露，增强 AI 助手长期使用的信任基础。
- **🔗 相关建议引用**：[S-14](../security-audit.md#s-14-已修复核心风险-ai-助手对话和-llm-上下文长期留存在-localstorage), [F-13](../new-features.md#f-13-已完成核心能力-ai-助手增加隐私模式和对话保留策略)

## 📌 MR-AST-05 [已修复]: 请求取消语义需要区分用户停止与超时

- **📍 位置**：`js/assistant.js:652-687`, `js/assistant.js:1461-1481`
- **✅ 修复状态**：助手请求超时会携带 `TimeoutError`，且在 AbortSignal reason 不可用或流读取退化为 `AbortError` 时通过 `timedOut` 标记重新归一化；手动停止继续走 `AbortError`。
- **🧪 回归测试**：`tests/assistant.test.mjs` 覆盖“请求超时”和“手动停止生成”两类可见文案。
- **📝 当前状况描述**：超时和手动停止都通过 abort 进入 `AbortError`，最终都显示“已停止生成。”。这让网络异常的可诊断性偏弱，尤其是中转站链路不稳定时。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  ```
  在 normalize 前携带 `timedOut` 状态，输出“请求超时”和“已停止生成”两类文案。
- **📊 实际收益**：帮助用户决定重试、切换 endpoint 或主动缩短 prompt。
- **🔗 相关建议引用**：[UX-12](../ux-improvements.md#ux-12-ai-助手超时和用户手动停止使用同一错误文案)
